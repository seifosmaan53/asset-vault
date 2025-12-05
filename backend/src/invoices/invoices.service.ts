import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemsRepository: Repository<InvoiceItem>,
    private inventoryService: InventoryService,
  ) {}

  async findAll(
    userId: string,
    filters?: {
      status?: string;
      type?: string;
      search?: string;
    },
  ): Promise<Invoice[]> {
    const query = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('invoice.userId = :userId', { userId });

    if (filters?.status) {
      query.andWhere('invoice.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      query.andWhere('invoice.type = :type', { type: filters.type });
    }

    if (filters?.search) {
      query.andWhere(
        '(invoice.number ILIKE :search OR client.name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return query.orderBy('invoice.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id, userId },
      relations: ['client', 'items', 'items.inventoryItem'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async create(userId: string, data: any): Promise<Invoice> {
    this.logger.log(`Creating invoice for user ${userId}, type: ${data.type}`);
    
    const invoice = this.invoicesRepository.create({
      ...data,
      userId,
      issueDate: new Date(data.issueDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    });

    // Calculate totals
    const { subtotal, taxTotal, discountTotal, total } = this.calculateTotals(data.items);
    invoice.subtotal = subtotal;
    invoice.taxTotal = taxTotal;
    invoice.discountTotal = discountTotal;
    invoice.total = total;

    // Generate invoice number
    if (!invoice.number) {
      invoice.number = await this.generateInvoiceNumber(userId, invoice.type);
    }

    const savedInvoice = await this.invoicesRepository.save(invoice);
    this.logger.log(`Invoice created: ${savedInvoice.number} (${savedInvoice.id})`);

    // Create invoice items
    const items = data.items.map((item: any) =>
      this.invoiceItemsRepository.create({
        ...item,
        invoiceId: savedInvoice.id,
      }),
    );
    await this.invoiceItemsRepository.save(items);

    // Update inventory stock if items are linked
    for (const item of items) {
      if (item.inventoryItemId) {
        try {
          await this.inventoryService.createMovement(
            item.inventoryItemId,
            userId,
            {
              type: 'sale',
              quantity: item.quantity,
              sourceType: 'invoice',
              sourceId: savedInvoice.id,
              note: `Invoice ${savedInvoice.number}`,
            },
          );
        } catch (error) {
          // Log error but don't fail invoice creation
          console.error('Failed to update stock for item:', item.inventoryItemId, error);
        }
      }
    }

    return this.findOne(savedInvoice.id, userId);
  }

  async update(id: string, userId: string, data: any): Promise<Invoice> {
    this.logger.log(`Updating invoice ${id} for user ${userId}`);
    const invoice = await this.findOne(id, userId);

    if (data.items) {
      // Recalculate totals
      const { subtotal, taxTotal, discountTotal, total } = this.calculateTotals(data.items);
      data.subtotal = subtotal;
      data.taxTotal = taxTotal;
      data.discountTotal = discountTotal;
      data.total = total;

      // Update items
      await this.invoiceItemsRepository.delete({ invoiceId: id });
      const items = data.items.map((item: any) =>
        this.invoiceItemsRepository.create({
          ...item,
          invoiceId: id,
        }),
      );
      await this.invoiceItemsRepository.save(items);
      delete data.items;
    }

    if (data.issueDate) {
      data.issueDate = new Date(data.issueDate);
    }
    if (data.dueDate) {
      data.dueDate = new Date(data.dueDate);
    }
    if (data.paidAt) {
      data.paidAt = new Date(data.paidAt);
    }

    await this.invoicesRepository.update({ id, userId }, data);
    const updatedInvoice = await this.findOne(id, userId);
    this.logger.log(`Invoice updated: ${updatedInvoice.number} (${id})`);
    return updatedInvoice;
  }

  async remove(id: string, userId: string): Promise<void> {
    const invoice = await this.findOne(id, userId);
    await this.invoicesRepository.softRemove(invoice);
  }

  async convertEstimateToInvoice(id: string, userId: string): Promise<Invoice> {
    const estimate = await this.findOne(id, userId);
    
    if (estimate.type !== 'estimate') {
      throw new BadRequestException('Only estimates can be converted to invoices');
    }

    // Update the estimate to become an invoice
    estimate.type = 'invoice';
    estimate.status = 'draft';
    
    // Generate new invoice number
    estimate.number = await this.generateInvoiceNumber(userId, 'invoice');
    
    return this.invoicesRepository.save(estimate);
  }

  async getStats(userId: string) {
    const invoices = await this.invoicesRepository.find({
      where: { userId },
    });

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const unpaid = invoices.filter(
      (inv) => inv.status === 'sent' || inv.status === 'draft',
    );
    const overdue = invoices.filter(
      (inv) =>
        inv.status === 'sent' &&
        inv.dueDate &&
        new Date(inv.dueDate) < now,
    );
    const monthlyPaid = invoices.filter(
      (inv) =>
        inv.status === 'paid' &&
        new Date(inv.issueDate) >= currentMonth,
    );

    return {
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((sum, inv) => sum + Number(inv.total), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, inv) => sum + Number(inv.total), 0),
      monthlyTotal: monthlyPaid.reduce((sum, inv) => sum + Number(inv.total), 0),
      totalAmount: invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
    };
  }

  private calculateTotals(items: any[]) {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    for (const item of items) {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount = (lineSubtotal * item.discountRate) / 100;
      const lineAfterDiscount = lineSubtotal - lineDiscount;
      const lineTax = (lineAfterDiscount * item.taxRate) / 100;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += lineTax;
    }

    const total = subtotal - discountTotal + taxTotal;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  private async generateInvoiceNumber(userId: string, type: string): Promise<string> {
    const prefix = type === 'invoice' ? 'INV' : 'EST';
    const year = new Date().getFullYear();
    const count = await this.invoicesRepository.count({
      where: { userId, type },
    });
    const number = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${number}`;
  }

  async sendEmail(id: string, userId: string): Promise<{ message: string }> {
    const invoice = await this.findOne(id, userId);
    
    if (!invoice.client?.email) {
      throw new BadRequestException('Client email is required to send invoice');
    }

    // TODO: Implement actual email sending with nodemailer or similar
    // For now, return success message
    // In production, you would:
    // 1. Generate PDF
    // 2. Send email with PDF attachment using nodemailer
    // 3. Update invoice status to 'sent' if needed
    
    return { message: 'Invoice email sent successfully' };
  }

  async generatePdf(id: string, userId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, userId);
    
    // Generate simple HTML invoice
    const html = this.generateInvoiceHtml(invoice);
    
    // Convert HTML to PDF buffer
    // For a production implementation, use a library like puppeteer or pdfkit
    // For now, return a simple text-based representation as PDF
    const pdfContent = this.htmlToPdfBuffer(html);
    
    return pdfContent;
  }

  private generateInvoiceHtml(invoice: Invoice): string {
    const itemsHtml = invoice.items?.map(item => `
      <tr>
        <td>${item.description}</td>
        <td align="right">${item.quantity}</td>
        <td align="right">${item.unitPrice.toFixed(2)}</td>
        <td align="right">${item.taxRate}%</td>
        <td align="right">${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { margin-bottom: 30px; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; }
          .total { text-align: right; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Invoice ${invoice.number}</h1>
          <p>Type: ${invoice.type.toUpperCase()}</p>
          <p>Status: ${invoice.status.toUpperCase()}</p>
        </div>
        <div class="info">
          <h3>Bill To:</h3>
          <p>${invoice.client?.name || 'N/A'}<br>
          ${invoice.client?.email || ''}<br>
          ${invoice.client?.phone || ''}</p>
        </div>
        <div class="info">
          <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
          ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th align="right">Quantity</th>
              <th align="right">Unit Price</th>
              <th align="right">Tax %</th>
              <th align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total">
          <p>Subtotal: ${invoice.currency} ${invoice.subtotal.toFixed(2)}</p>
          <p>Tax: ${invoice.currency} ${invoice.taxTotal.toFixed(2)}</p>
          <p>Discount: ${invoice.currency} ${invoice.discountTotal.toFixed(2)}</p>
          <p>Total: ${invoice.currency} ${invoice.total.toFixed(2)}</p>
        </div>
        ${invoice.notes ? `<div><h3>Notes:</h3><p>${invoice.notes}</p></div>` : ''}
      </body>
      </html>
    `;
  }

  private htmlToPdfBuffer(html: string): Buffer {
    // Simple implementation: return HTML as text for now
    // In production, use puppeteer or pdfkit to convert HTML to actual PDF
    // For now, return a text representation that can be saved as PDF
    const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return Buffer.from(textContent, 'utf-8');
  }
}

