import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Store } from '../inventory/entities/store.entity';
import { PuppeteerService } from '../common/services/puppeteer.service';

@Injectable()
export class StoreReportPdfService {
  private readonly logger = new Logger(StoreReportPdfService.name);

  constructor(
    private analyticsService: AnalyticsService,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  async generateStoreReportPdf(storeId: string, userId: string): Promise<Buffer> {
    // Get store and analytics data
    // Organizations removed - filter by userId only (user-scoped data)
    const store = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.id = :storeId', { storeId })
      .andWhere('store.userId = :userId', { userId })
      .andWhere('store.deletedAt IS NULL')
      .getOne();

    if (!store) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }

    const summary = await this.analyticsService.getStoresSummary(userId);
    const storeSummary = summary.find((s) => s.storeId === storeId);

    if (!storeSummary) {
      throw new NotFoundException(`Store analytics not found for store ID "${storeId}"`);
    }

    const [revenue, topClients, topItems, turnover, trends] = await Promise.all([
      this.analyticsService.getStoreRevenueReport(userId, storeId, undefined, undefined),
      this.analyticsService.getTopClientsByStore(userId, storeId, 10),
      this.analyticsService.getTopItemsByStore(userId, storeId, 10),
      this.analyticsService.getStoreInventoryTurnover(userId, storeId),
      this.analyticsService.getStoreSalesTrends(userId, storeId, 'monthly'),
    ]);

    try {
      // Generate HTML content
      const htmlContent = this.generateHtmlReport(storeSummary, revenue[0], topClients, topItems, turnover[0], trends);

      const pdfBuffer = await this.puppeteerService.generatePdfFromHtml(htmlContent);

      this.logger.log(`PDF generated successfully for store ${store.name}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error(`Failed to generate PDF for store ${store.name}:`, error);
      throw error;
    }
  }

  private generateHtmlReport(
    storeSummary: any,
    revenue: any,
    topClients: any[],
    topItems: any[],
    turnover: any,
    trends: any[],
  ): string {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    const formatDate = (date: Date | string) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              font-size: 12px;
              line-height: 1.6;
              color: #333;
              padding: 20px;
            }
            .header {
              border-bottom: 3px solid #1976d2;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #1976d2;
              font-size: 28px;
              margin-bottom: 5px;
            }
            .header .subtitle {
              color: #666;
              font-size: 14px;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              color: #1976d2;
              margin-bottom: 15px;
              padding-bottom: 5px;
              border-bottom: 2px solid #e0e0e0;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .metric-card {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              border-left: 4px solid #1976d2;
            }
            .metric-label {
              font-size: 11px;
              color: #666;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .metric-value {
              font-size: 20px;
              font-weight: 600;
              color: #1976d2;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #1976d2;
              color: white;
              padding: 10px;
              text-align: left;
              font-weight: 600;
              font-size: 11px;
            }
            td {
              padding: 8px 10px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 11px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .text-right {
              text-align: right;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e0e0e0;
              text-align: center;
              color: #666;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Store Analytics Report</h1>
            <div class="subtitle">${storeSummary.storeName} (${storeSummary.storeCode})</div>
            <div class="subtitle">Generated on ${formatDate(new Date())}</div>
          </div>

          <div class="section">
            <div class="section-title">Revenue Summary</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value">${formatCurrency(storeSummary.totalRevenue)}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Paid Revenue</div>
                <div class="metric-value">${formatCurrency(storeSummary.paidRevenue)}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Invoices</div>
                <div class="metric-value">${storeSummary.totalInvoices}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Average Invoice Value</div>
                <div class="metric-value">${formatCurrency(storeSummary.averageInvoiceValue)}</div>
              </div>
            </div>
          </div>

          ${turnover ? `
          <div class="section">
            <div class="section-title">Inventory Turnover</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Turnover Rate</div>
                <div class="metric-value">${turnover.turnover.toFixed(2)}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Current Stock</div>
                <div class="metric-value">${turnover.currentStock}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Sales</div>
                <div class="metric-value">${turnover.totalSales}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Unique Items</div>
                <div class="metric-value">${turnover.uniqueItems}</div>
              </div>
            </div>
          </div>
          ` : ''}

          ${topItems.length > 0 ? `
          <div class="section">
            <div class="section-title">Top Items by Revenue</div>
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>SKU</th>
                  <th class="text-right">Revenue</th>
                  <th class="text-right">Quantity</th>
                  <th class="text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                ${topItems.map((item) => `
                  <tr>
                    <td>${item.itemName}</td>
                    <td>${item.sku || '-'}</td>
                    <td class="text-right">${formatCurrency(item.totalRevenue)}</td>
                    <td class="text-right">${item.totalQuantity}</td>
                    <td class="text-right">${item.invoiceCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${topClients.length > 0 ? `
          <div class="section">
            <div class="section-title">Top Clients by Revenue</div>
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th class="text-right">Total Revenue</th>
                  <th class="text-right">Paid Revenue</th>
                  <th class="text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                ${topClients.map((client) => `
                  <tr>
                    <td>${client.clientName}</td>
                    <td class="text-right">${formatCurrency(client.totalRevenue)}</td>
                    <td class="text-right">${formatCurrency(client.paidRevenue)}</td>
                    <td class="text-right">${client.invoiceCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${trends.length > 0 ? `
          <div class="section">
            <div class="section-title">Monthly Sales Trends</div>
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th class="text-right">Revenue</th>
                  <th class="text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                ${trends.map((trend) => `
                  <tr>
                    <td>${trend.period}</td>
                    <td class="text-right">${formatCurrency(trend.revenue)}</td>
                    <td class="text-right">${trend.invoiceCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>This report was generated automatically by InvoiceMe</p>
            <p>Store: ${storeSummary.storeName} | Code: ${storeSummary.storeCode}</p>
          </div>
        </body>
      </html>
    `;
  }
}

