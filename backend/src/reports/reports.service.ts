import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Store } from '../inventory/entities/store.entity';
import { ReportFiltersDto, ReportType, PeriodType } from './dto/report-filters.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
  ) {}

  /**
   * Generate Profit & Loss Report
   */
  async generateProfitLossReport(userId: string, filters: ReportFiltersDto) {
    const { startDate, endDate, includeCancelled = false } = filters;
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.type = :type', { type: 'invoice' });

    if (!includeCancelled) {
      query.andWhere('invoice.status != :status', { status: 'cancelled' });
    }

    if (dateFilter.start) {
      query.andWhere('invoice.issueDate >= :startDate', { startDate: dateFilter.start });
    }
    if (dateFilter.end) {
      query.andWhere('invoice.issueDate <= :endDate', { endDate: dateFilter.end });
    }

    const invoices = await query.getMany();

    // Calculate revenue (paid invoices)
    const revenue = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    // Calculate costs (from inventory items)
    const costs = await this.calculateCosts(userId, invoices, dateFilter);

    // Calculate profit
    const profit = revenue - costs;

    // Group by period
    const periodData = this.groupByPeriod(
      invoices.filter((inv) => inv.status === 'paid'),
      filters.periodType || PeriodType.MONTHLY,
    );

    return {
      summary: {
        revenue,
        costs,
        profit,
        profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
        period: {
          start: dateFilter.start || null,
          end: dateFilter.end || null,
        },
      },
      periodData,
      invoiceCount: invoices.length,
      paidInvoiceCount: invoices.filter((inv) => inv.status === 'paid').length,
    };
  }

  /**
   * Generate Sales Trends Report
   */
  async generateSalesTrendsReport(userId: string, filters: ReportFiltersDto) {
    const { startDate, endDate, periodType = PeriodType.MONTHLY, includeCancelled = false } = filters;
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.type = :type', { type: 'invoice' });

    if (!includeCancelled) {
      query.andWhere('invoice.status != :status', { status: 'cancelled' });
    }

    if (dateFilter.start) {
      query.andWhere('invoice.issueDate >= :startDate', { startDate: dateFilter.start });
    }
    if (dateFilter.end) {
      query.andWhere('invoice.issueDate <= :endDate', { endDate: dateFilter.end });
    }

    const invoices = await query.getMany();

    // Group by period
    const trends = this.groupSalesByPeriod(invoices, periodType);

    return {
      trends,
      totalRevenue: invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      averageRevenue: invoices.length > 0
        ? invoices.reduce((sum, inv) => sum + Number(inv.total), 0) / invoices.length
        : 0,
      periodType,
    };
  }

  /**
   * Generate Client Sales Summary
   */
  async generateClientSalesReport(userId: string, filters: ReportFiltersDto) {
    const { startDate, endDate, clientId, includeCancelled = false } = filters;
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.type = :type', { type: 'invoice' });

    if (!includeCancelled) {
      query.andWhere('invoice.status != :status', { status: 'cancelled' });
    }

    if (clientId) {
      query.andWhere('invoice.clientId = :clientId', { clientId });
    }

    if (dateFilter.start) {
      query.andWhere('invoice.issueDate >= :startDate', { startDate: dateFilter.start });
    }
    if (dateFilter.end) {
      query.andWhere('invoice.issueDate <= :endDate', { endDate: dateFilter.end });
    }

    const invoices = await query.getMany();

    // Group by client
    const clientSales = invoices.reduce((acc, invoice) => {
      const clientId = invoice.clientId;
      if (!acc[clientId]) {
        acc[clientId] = {
          clientId,
          clientName: invoice.client?.name || 'Unknown',
          invoiceCount: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          unpaidRevenue: 0,
        };
      }
      acc[clientId].invoiceCount++;
      acc[clientId].totalRevenue += Number(invoice.total);
      if (invoice.status === 'paid') {
        acc[clientId].paidRevenue += Number(invoice.total);
      } else {
        acc[clientId].unpaidRevenue += Number(invoice.total);
      }
      return acc;
    }, {} as Record<string, any>);

    const summary = Object.values(clientSales).sort(
      (a: any, b: any) => b.totalRevenue - a.totalRevenue,
    );

    return {
      summary,
      totalClients: summary.length,
      totalRevenue: summary.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
    };
  }

  /**
   * Generate Inventory Valuation Report
   */
  async generateInventoryValuationReport(userId: string, filters: ReportFiltersDto) {
    const { storeId } = filters;

    const query = this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId });

    const items = await query.getMany();

    // Get store settings separately if needed
    let storeSettings: any[] = [];
    if (storeId) {
      // Note: StoreItemSettings would need to be injected separately
      // For now, we'll use defaultUnitPrice and currentStock
    }

    const valuation = items.map((item) => {
      const unitPrice = Number(item.defaultUnitPrice || 0);
      const totalValue = unitPrice * (item.currentStock || 0);
      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        unitPrice,
        currentStock: item.currentStock || 0,
        totalValue,
        store: 'N/A', // Store info would need separate query
      };
    });

    const totalValuation = valuation.reduce((sum, item) => sum + item.totalValue, 0);

    return {
      items: valuation.sort((a, b) => b.totalValue - a.totalValue),
      summary: {
        totalItems: valuation.length,
        totalValuation,
        averageValue: valuation.length > 0 ? totalValuation / valuation.length : 0,
      },
    };
  }

  /**
   * Generate Invoice Aging Report
   */
  async generateInvoiceAgingReport(userId: string, filters: ReportFiltersDto) {
    const { includeCancelled = false } = filters;

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.type = :type', { type: 'invoice' })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'overdue'],
      });

    if (!includeCancelled) {
      query.andWhere('invoice.status != :status', { status: 'cancelled' });
    }

    const invoices = await query.getMany();
    const now = new Date();

    const aging = invoices.map((invoice) => {
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysOverdue = dueDate && dueDate < now
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let agingBucket = 'current';
      if (daysOverdue > 90) {
        agingBucket = 'over_90';
      } else if (daysOverdue > 60) {
        agingBucket = '61_90';
      } else if (daysOverdue > 30) {
        agingBucket = '31_60';
      } else if (daysOverdue > 0) {
        agingBucket = '1_30';
      }

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        clientName: invoice.client?.name || 'Unknown',
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        daysOverdue,
        agingBucket,
        amount: Number(invoice.total),
        status: invoice.status,
      };
    });

    // Group by aging bucket
    const buckets = {
      current: { count: 0, total: 0 },
      '1_30': { count: 0, total: 0 },
      '31_60': { count: 0, total: 0 },
      '61_90': { count: 0, total: 0 },
      over_90: { count: 0, total: 0 },
    };

    aging.forEach((item) => {
      buckets[item.agingBucket as keyof typeof buckets].count++;
      buckets[item.agingBucket as keyof typeof buckets].total += item.amount;
    });

    return {
      invoices: aging.sort((a, b) => b.daysOverdue - a.daysOverdue),
      buckets,
      totalOutstanding: aging.reduce((sum, item) => sum + item.amount, 0),
    };
  }

  /**
   * Generate Payment Collection Analysis
   */
  async generatePaymentCollectionReport(userId: string, filters: ReportFiltersDto) {
    const { startDate, endDate, includeCancelled = false } = filters;
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.type = :type', { type: 'invoice' });

    if (!includeCancelled) {
      query.andWhere('invoice.status != :status', { status: 'cancelled' });
    }

    if (dateFilter.start) {
      query.andWhere('invoice.issueDate >= :startDate', { startDate: dateFilter.start });
    }
    if (dateFilter.end) {
      query.andWhere('invoice.issueDate <= :endDate', { endDate: dateFilter.end });
    }

    const invoices = await query.getMany();

    const paidInvoices = invoices.filter((inv) => inv.status === 'paid' && inv.paidAt);
    const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid');

    // Calculate average days to payment
    const daysToPayment = paidInvoices
      .map((inv) => {
        if (!inv.paidAt || !inv.issueDate) return null;
        const issueDate = new Date(inv.issueDate);
        const paidDate = new Date(inv.paidAt);
        return Math.floor((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
      })
      .filter((days): days is number => days !== null);

    const averageDaysToPayment =
      daysToPayment.length > 0
        ? daysToPayment.reduce((sum, days) => sum + days, 0) / daysToPayment.length
        : 0;

    // Payment method breakdown
    const paymentMethods = paidInvoices.reduce((acc, inv) => {
      const method = inv.paymentMethodNote || 'unknown';
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 };
      }
      acc[method].count++;
      acc[method].total += Number(inv.total);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return {
      summary: {
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        unpaidInvoices: unpaidInvoices.length,
        paidAmount: paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0),
        unpaidAmount: unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0),
        collectionRate: invoices.length > 0
          ? (paidInvoices.length / invoices.length) * 100
          : 0,
        averageDaysToPayment,
      },
      paymentMethods,
      period: {
        start: dateFilter.start || null,
        end: dateFilter.end || null,
      },
    };
  }

  // Helper methods

  private buildDateFilter(startDate?: string, endDate?: string) {
    return {
      start: startDate ? new Date(startDate) : null,
      end: endDate ? new Date(endDate) : null,
    };
  }

  private async calculateCosts(
    userId: string,
    invoices: Invoice[],
    dateFilter: { start: Date | null; end: Date | null },
  ): Promise<number> {
    // Get all invoice items for these invoices
    const invoiceIds = invoices.map((inv) => inv.id);
    if (invoiceIds.length === 0) return 0;

    const items = await this.invoiceItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.inventoryItem', 'inventoryItem')
      .where('item.invoiceId IN (:...invoiceIds)', { invoiceIds })
      .getMany();

    // Calculate cost based on inventory item cost (if available)
    // For now, we'll use a simple calculation - in a real system, you'd track actual costs
    return items.reduce((sum, item) => {
      // If inventory item has cost tracking, use it; otherwise estimate at 50% of price
      const cost = item.inventoryItem?.costPrice
        ? Number(item.inventoryItem.costPrice) * Number(item.quantity)
        : item.inventoryItem?.defaultUnitPrice
          ? Number(item.inventoryItem.defaultUnitPrice) * Number(item.quantity) * 0.5
          : Number(item.unitPrice) * Number(item.quantity) * 0.5;
      return sum + cost;
    }, 0);
  }

  private groupByPeriod(invoices: Invoice[], periodType: PeriodType) {
    const groups: Record<string, { revenue: number; count: number }> = {};

    invoices.forEach((invoice) => {
      const date = new Date(invoice.issueDate);
      let key: string;

      switch (periodType) {
        case PeriodType.DAILY:
          key = date.toISOString().split('T')[0];
          break;
        case PeriodType.WEEKLY:
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case PeriodType.MONTHLY:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case PeriodType.QUARTERLY:
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          break;
        case PeriodType.YEARLY:
          key = String(date.getFullYear());
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groups[key]) {
        groups[key] = { revenue: 0, count: 0 };
      }
      groups[key].revenue += Number(invoice.total);
      groups[key].count++;
    });

    return Object.entries(groups)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  private groupSalesByPeriod(invoices: Invoice[], periodType: PeriodType) {
    return this.groupByPeriod(invoices, periodType);
  }
}
