import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { PuppeteerService } from '../common/services/puppeteer.service';
import { format, parseISO, isValid } from 'date-fns';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    private readonly userSettingsService: UserSettingsService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  async generateInvoicePdf(id: string, userId: string): Promise<Buffer> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    const invoice = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted clients
      .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
      // Load items separately to avoid TypeORM soft delete filtering (InvoiceItem uses CASCADE, not soft delete)
      .leftJoin('invoice.items', 'items')
      .addSelect([
        'items.id',
        'items.invoiceId',
        'items.inventoryItemId',
        'items.description',
        'items.quantity',
        'items.unitPrice',
        'items.taxRate',
        'items.discountRate',
        'items.lineTotal',
        'items.createdAt',
      ])
      .leftJoinAndSelect('invoice.user', 'user')
      .where('invoice.id = :id', { id })
      .andWhere('invoice.userId = :userId', { userId })
      .getOne();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Get user settings for formatting
    const settings = await this.userSettingsService.getSettings(userId);
    const html = this.buildInvoiceHtml(invoice, settings);

    try {
      const pdfBuffer = await this.puppeteerService.generatePdfFromHtml(html);
      this.logger.log(`PDF generated successfully for invoice ${invoice.number}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error(`Failed to generate PDF for invoice ${invoice.number}:`, error);
      throw error;
    }
  }

  private buildInvoiceHtml(invoice: Invoice, settings?: any): string {
    const itemsHtml = invoice.items?.map(item => {
      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
          ${this.escapeHtml(item.description || 'N/A')}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${this.formatCurrency(item.unitPrice, invoice.currency)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${item.taxRate}%</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${item.discountRate || 0}%</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">${this.formatCurrency(item.lineTotal, invoice.currency)}</td>
      </tr>
    `;
    }).join('') || '<tr><td colspan="6" style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">No items</td></tr>';

    // Use company info from settings, fallback to user entity
    const companyName = settings?.companyName || invoice.user?.companyName || invoice.user?.name || 'InvoiceMe';
    const companyAddress = settings?.companyAddress || '';
    const companyPhone = settings?.companyPhone || '';
    const companyEmail = settings?.companyEmail || '';
    const companyWebsite = settings?.companyWebsite || '';
    const companyTaxId = settings?.companyTaxId || '';
    const companyRegistrationNumber = settings?.companyRegistrationNumber || '';
    const companyVatNumber = settings?.companyVatNumber || '';
    
    // Use date format from settings
    const dateFormat = this.getDateFormat(settings?.dateFormat);
    const issueDate = this.formatDate(invoice.issueDate, dateFormat);
    const dueDate = invoice.dueDate ? this.formatDate(invoice.dueDate, dateFormat) : null;
    const paidDate = invoice.paidAt ? this.formatDate(invoice.paidAt, dateFormat) : null;
    
    // Invoice customization
    const invoiceHeaderText = settings?.invoiceHeaderText || '';
    const invoiceFooterText = settings?.invoiceFooterText || '';
    const showWatermark = settings?.showInvoiceWatermark || false;
    const watermarkText = settings?.invoiceWatermarkText || 'DRAFT';
    const showInvoiceNumber = settings?.showInvoiceNumberOnPDF !== false;

    const clientAddress = invoice.client?.addressJson
      ? `${invoice.client.addressJson.street || ''}<br>${invoice.client.addressJson.city || ''}, ${invoice.client.addressJson.state || ''} ${invoice.client.addressJson.zip || ''}<br>${invoice.client.addressJson.country || ''}`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 40px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
          }
          .header-left h1 {
            font-size: 24px;
            margin-bottom: 5px;
            color: #1976d2;
          }
          .header-left p {
            color: #666;
            font-size: 12px;
          }
          .header-right {
            text-align: right;
          }
          .header-right h2 {
            font-size: 20px;
            margin-bottom: 10px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            background-color: #e3f2fd;
            color: #1976d2;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 20px 0;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .bill-to {
            flex: 1;
          }
          .bill-to h3 {
            font-size: 16px;
            margin-bottom: 10px;
            color: #333;
          }
          .bill-to p {
            margin: 5px 0;
            color: #666;
          }
          .dates {
            text-align: right;
            flex: 1;
          }
          .dates p {
            margin: 5px 0;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
          }
          th {
            background-color: #f5f5f5;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e0e0e0;
            color: #333;
          }
          th:last-child,
          td:last-child {
            text-align: right;
          }
          .totals {
            margin-top: 30px;
            display: flex;
            justify-content: flex-end;
          }
          .totals-inner {
            min-width: 300px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .total-row:last-child {
            border-bottom: none;
            margin-top: 10px;
            padding-top: 15px;
            border-top: 2px solid #333;
          }
          .total-label {
            font-weight: 500;
          }
          .total-amount {
            font-weight: bold;
            font-size: 18px;
          }
          .notes {
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 4px;
          }
          .notes h3 {
            font-size: 16px;
            margin-bottom: 10px;
          }
          .notes p {
            color: #666;
            line-height: 1.8;
          }
        </style>
      </head>
      <body>
        ${showWatermark ? `<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72px; color: rgba(0,0,0,0.1); z-index: 1000; pointer-events: none; font-weight: bold;">${this.escapeHtml(watermarkText)}</div>` : ''}
        ${invoiceHeaderText ? `<div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">${this.escapeHtml(invoiceHeaderText)}</div>` : ''}
        <div class="header">
          <div class="header-left">
            <h1>${this.escapeHtml(companyName)}</h1>
            ${companyAddress ? `<p>${this.escapeHtml(companyAddress)}</p>` : ''}
            ${companyPhone ? `<p>Phone: ${this.escapeHtml(companyPhone)}</p>` : ''}
            ${companyEmail ? `<p>Email: ${this.escapeHtml(companyEmail)}</p>` : ''}
            ${companyWebsite ? `<p>Website: ${this.escapeHtml(companyWebsite)}</p>` : ''}
            ${companyTaxId ? `<p>Tax ID: ${this.escapeHtml(companyTaxId)}</p>` : ''}
            ${companyRegistrationNumber ? `<p>Registration: ${this.escapeHtml(companyRegistrationNumber)}</p>` : ''}
            ${companyVatNumber ? `<p>VAT: ${this.escapeHtml(companyVatNumber)}</p>` : ''}
          </div>
          <div class="header-right">
            ${showInvoiceNumber ? `<h2>${this.escapeHtml(invoice.number)}</h2>` : ''}
            <span class="status-badge">${invoice.status.toUpperCase()}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="info-section">
          <div class="bill-to">
            <h3>Bill To:</h3>
            <p style="font-weight: bold; color: #333;">${this.escapeHtml(invoice.client?.name || 'N/A')}</p>
            ${invoice.client?.email ? `<p>${this.escapeHtml(invoice.client.email)}</p>` : ''}
            ${invoice.client?.phone ? `<p>${this.escapeHtml(invoice.client.phone)}</p>` : ''}
            ${clientAddress ? `<p style="margin-top: 10px;">${clientAddress}</p>` : ''}
          </div>
          <div class="dates">
            <p><strong>Issue Date:</strong> ${issueDate}</p>
            ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
            ${paidDate ? `<p><strong>Paid Date:</strong> ${paidDate}</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Tax %</th>
              <th style="text-align: right;">Discount %</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-inner">
            <div class="total-row">
              <span class="total-label">Subtotal:</span>
              <span>${this.formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Discount:</span>
              <span>-${this.formatCurrency(invoice.discountTotal, invoice.currency)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Tax:</span>
              <span>${this.formatCurrency(invoice.taxTotal, invoice.currency)}</span>
            </div>
            <div class="total-row">
              <span class="total-label total-amount">Total:</span>
              <span class="total-amount">${this.formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes">
            <h3>Notes</h3>
            <p>${this.escapeHtml(invoice.notes)}</p>
          </div>
        ` : ''}
        ${invoice.metadataJson?.terms ? `
          <div class="notes">
            <h3>Terms & Conditions</h3>
            <p>${this.escapeHtml(invoice.metadataJson.terms)}</p>
          </div>
        ` : ''}
        ${invoiceFooterText ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">${this.escapeHtml(invoiceFooterText)}</div>` : ''}
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }

  private getDateFormat(userFormat?: string): string {
    const formatMap: Record<string, string> = {
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'DD/MM/YYYY': 'dd/MM/yyyy',
      'YYYY-MM-DD': 'yyyy-MM-dd',
      'DD-MM-YYYY': 'dd-MM-yyyy',
      'MMM DD, YYYY': 'MMM dd, yyyy',
    };
    return formatMap[userFormat || 'MM/DD/YYYY'] || 'MMM dd, yyyy';
  }

  private formatDate(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
    try {
      const d = typeof date === 'string' ? parseISO(date) : date;
      if (!isValid(d)) return '';
      return format(d, formatStr);
    } catch {
      return '';
    }
  }
}

