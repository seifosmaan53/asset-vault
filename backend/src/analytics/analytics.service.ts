import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
// Organizations removed - no longer using buildOrgScopedWhere

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

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
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
  ) {}

  async getInvoicesByStatus(userId: string) {
    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.status', 'status')
      .addSelect('COUNT(*)', 'count')
      // Organizations removed - filter by userId only (user-scoped data)
      .where('invoice.userId = :userId', { userId });
    
    const invoices = await query
      .groupBy('invoice.status')
      .getRawMany();

    return invoices.map((item) => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }

  async getTopClients(userId: string, limit: number = 10, skip: number = 0) {
    // Include all invoice statuses except cancelled and draft
    // This shows revenue from sent, paid, and overdue invoices
    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.clientId', 'clientId')
      .addSelect('client.name', 'clientName')
      .addSelect('SUM(invoice.total)', 'totalRevenue')
      .addSelect('COUNT(invoice.id)', 'invoiceCount')
      .addSelect(`SUM(CASE WHEN invoice.status = 'paid' THEN invoice.total ELSE 0 END)`, 'paidRevenue')
      .leftJoin('invoice.client', 'client')
      // CRITICAL: Filter by invoice.userId AND client.userId for complete data isolation
      .where('invoice.userId = :userId', { userId })
      .andWhere('client.userId = :userId', { userId });
    
    const topClients = await query
      .andWhere('invoice.status IN (:...statuses)', { 
        statuses: ['sent', 'paid', 'overdue']
      })
      .groupBy('invoice.clientId')
      .addGroupBy('client.name')
      .orderBy('SUM(invoice.total)', 'DESC')
      .skip(skip)
      .limit(limit)
      .getRawMany();

    return topClients.map((item) => ({
      clientId: item.clientId,
      clientName: item.clientName,
      totalRevenue: parseFloat(item.totalRevenue || '0'),
      paidRevenue: parseFloat(item.paidRevenue || '0'),
      invoiceCount: parseInt(item.invoiceCount, 10),
    }));
  }

  async getTopItems(userId: string, limit: number = 10, skip: number = 0) {
    // Include items from sent, paid, and overdue invoices (exclude draft and cancelled)
    const query = this.invoiceItemRepository
      .createQueryBuilder('item')
      .select('item.inventoryItemId', 'inventoryItemId')
      .addSelect('inventory.name', 'itemName')
      .addSelect('inventory.sku', 'sku')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .addSelect('SUM(item.lineTotal)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')
      .leftJoin('item.inventoryItem', 'inventory')
      .leftJoin('item.invoice', 'invoice')
      // CRITICAL: Filter by invoice.userId AND inventory.userId for complete data isolation
      .where('invoice.userId = :userId', { userId })
      .andWhere('inventory.userId = :userId', { userId });
    
    const topItems = await query
      .andWhere('item.inventoryItemId IS NOT NULL')
      .andWhere('invoice.status IN (:...statuses)', { 
        statuses: ['sent', 'paid', 'overdue']
      })
      .groupBy('item.inventoryItemId')
      .addGroupBy('inventory.name')
      .addGroupBy('inventory.sku')
      .orderBy('SUM(item.lineTotal)', 'DESC') // Order by revenue instead of quantity
      .skip(skip)
      .limit(limit)
      .getRawMany();

    return topItems.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      itemName: item.itemName,
      sku: item.sku,
      totalQuantity: parseFloat(item.totalQuantity || '0'),
      totalRevenue: parseFloat(item.totalRevenue || '0'),
      invoiceCount: parseInt(item.invoiceCount || '0', 10),
    }));
  }

  async getSalesByCategory(
    userId: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
    storeId: string | undefined,
  ) {
    try {
      // CRITICAL: Validate store ownership to prevent data leakage
      if (storeId) {
        await this.validateStoreOwnership(storeId, userId);
      }

      const query = this.invoiceItemRepository
        .createQueryBuilder('item')
        .select('\'Uncategorized\'', 'category')
        .addSelect('SUM(item.quantity)', 'totalQuantity')
        .addSelect('SUM(item.lineTotal)', 'totalRevenue')
        .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')
        .innerJoin('item.invoice', 'invoice')
        .leftJoin('item.inventoryItem', 'inventory')
        .where('invoice.userId = :userId', { userId })
        .andWhere('item.inventoryItemId IS NOT NULL')
        .andWhere('invoice.status IN (:...statuses)', { 
          statuses: ['sent', 'paid', 'overdue']
        })
        .andWhere('invoice.deletedAt IS NULL'); // Exclude soft-deleted invoices

      // Apply date filter if provided
      if (startDate) {
        query.andWhere('invoice.issueDate >= :startDate', { startDate });
      }
      if (endDate) {
        query.andWhere('invoice.issueDate <= :endDate', { endDate });
      }

      // Apply store filter if provided
      if (storeId) {
        query.andWhere('invoice.storeId = :storeId', { storeId });
      }

      const results = await query
        .groupBy('category')
        .orderBy('SUM(item.lineTotal)', 'DESC')
        .getRawMany();

      return results.map((item) => ({
        category: item.category || 'Uncategorized',
        totalQuantity: parseFloat(item.totalQuantity || '0'),
        totalRevenue: parseFloat(item.totalRevenue || '0'),
        invoiceCount: parseInt(item.invoiceCount || '0', 10),
      }));
    } catch (error) {
      this.logger.error(`Error in getSalesByCategory for user ${userId}:`, error);
      // Return empty array instead of throwing to prevent frontend errors
      return [];
    }
  }

  /**
   * Parse payment method from paymentMethodNote text field
   */
  private parsePaymentMethod(note: string | null | undefined): string {
    if (!note || note.trim() === '') {
      return 'Not specified';
    }

    const lowerNote = note.toLowerCase().trim();

    // Pattern matching for common payment methods
    if (lowerNote.includes('cash')) {
      return 'Cash';
    }
    if (lowerNote.includes('check') || lowerNote.includes('cheque')) {
      return 'Check';
    }
    if (lowerNote.includes('credit') && lowerNote.includes('card')) {
      return 'Credit Card';
    }
    if (lowerNote.includes('debit') && lowerNote.includes('card')) {
      return 'Debit Card';
    }
    if (lowerNote.includes('credit_card') || lowerNote.includes('creditcard')) {
      return 'Credit Card';
    }
    if (lowerNote.includes('bank') && (lowerNote.includes('transfer') || lowerNote.includes('wire'))) {
      return 'Bank Transfer';
    }
    if (lowerNote.includes('bank_transfer')) {
      return 'Bank Transfer';
    }
    if (lowerNote.includes('paypal')) {
      return 'PayPal';
    }
    if (lowerNote.includes('stripe')) {
      return 'Stripe';
    }
    if (lowerNote.includes('venmo') || lowerNote.includes('zelle') || lowerNote.includes('square')) {
      return 'Digital Payment';
    }
    if (lowerNote.includes('other') || lowerNote.includes('misc')) {
      return 'Other';
    }

    // If no pattern matches, return as "Other" or keep original
    return 'Other';
  }

  async getRevenueByPaymentMethod(
    userId: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
    storeId: string | undefined,
  ) {
    try {
      // CRITICAL: Validate store ownership to prevent data leakage
      if (storeId) {
        await this.validateStoreOwnership(storeId, userId);
      }

      // Get all paid invoices with paymentMethodNote
      const query = this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('invoice.id', 'id')
        .addSelect('invoice.total', 'total')
        .addSelect('invoice.paymentMethodNote', 'paymentMethodNote')
        // CRITICAL: Filter by invoice.userId to ensure data isolation
        .where('invoice.userId = :userId', { userId })
        .andWhere('invoice.status = :status', { status: 'paid' }) // Only paid invoices have payment methods
        .andWhere('invoice.deletedAt IS NULL'); // Exclude soft-deleted invoices

      // Apply date filter if provided
      if (startDate) {
        query.andWhere('invoice.paidAt >= :startDate', { startDate });
      }
      if (endDate) {
        query.andWhere('invoice.paidAt <= :endDate', { endDate });
      }

      // Apply store filter if provided
      if (storeId) {
        query.andWhere('invoice.storeId = :storeId', { storeId });
      }

      const invoices = await query.getRawMany();

      // If no invoices found, return empty array
      if (!invoices || invoices.length === 0) {
        return [];
      }

      // Group by payment method
      const methodMap = new Map<string, { totalRevenue: number; invoiceCount: number }>();

      invoices.forEach((invoice) => {
        const paymentMethod = this.parsePaymentMethod(invoice.paymentMethodNote);
        const existing = methodMap.get(paymentMethod) || { totalRevenue: 0, invoiceCount: 0 };
        methodMap.set(paymentMethod, {
          totalRevenue: existing.totalRevenue + parseFloat(invoice.total || '0'),
          invoiceCount: existing.invoiceCount + 1,
        });
      });

      // Convert to array and sort by revenue
      return Array.from(methodMap.entries())
        .map(([method, data]) => ({
          paymentMethod: method,
          totalRevenue: data.totalRevenue,
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      this.logger.error(`Error in getRevenueByPaymentMethod for user ${userId}:`, error);
      // Return empty array instead of throwing to prevent frontend errors
      return [];
    }
  }

  async getInvoicesByStatusAndStore(userId: string, storeId: string | undefined) {
    // CRITICAL: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.status', 'status')
      .addSelect('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('invoice.store', 'store')
      // CRITICAL: Filter by invoice.userId to ensure data isolation
      .where('invoice.userId = :userId', { userId });

    if (storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId });
    }

    const results = await query
      .groupBy('invoice.status')
      .addGroupBy('invoice.storeId')
      .addGroupBy('store.name')
      .getRawMany();

    return results.map((item) => ({
      status: item.status,
      storeId: item.storeId,
      storeName: item.storeName,
      count: parseInt(item.count, 10),
    }));
  }

  async getTopClientsByStore(userId: string, storeId: string | undefined, limit: number) {
    // CRITICAL: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.clientId', 'clientId')
      .addSelect('client.name', 'clientName')
      .addSelect('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('SUM(invoice.total)', 'totalRevenue')
      .addSelect('COUNT(invoice.id)', 'invoiceCount')
      .addSelect(`SUM(CASE WHEN invoice.status = 'paid' THEN invoice.total ELSE 0 END)`, 'paidRevenue')
      .leftJoin('invoice.client', 'client')
      .leftJoin('invoice.store', 'store')
      // CRITICAL: Filter by invoice.userId AND client.userId for complete data isolation
      .where('invoice.userId = :userId', { userId })
      .andWhere('client.userId = :userId', { userId });
    
    query.andWhere('invoice.status IN (:...statuses)', {
      statuses: ['sent', 'paid', 'overdue'],
    });

    if (storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId });
    }

    const topClients = await query
      .groupBy('invoice.clientId')
      .addGroupBy('client.name')
      .addGroupBy('invoice.storeId')
      .addGroupBy('store.name')
      .orderBy('SUM(invoice.total)', 'DESC')
      .limit(limit)
      .getRawMany();

    return topClients.map((item) => ({
      clientId: item.clientId,
      clientName: item.clientName,
      storeId: item.storeId,
      storeName: item.storeName,
      totalRevenue: parseFloat(item.totalRevenue || '0'),
      paidRevenue: parseFloat(item.paidRevenue || '0'),
      invoiceCount: parseInt(item.invoiceCount, 10),
    }));
  }

  async getTopItemsByStore(userId: string, storeId: string | undefined, limit: number) {
    // CRITICAL: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.invoiceItemRepository
      .createQueryBuilder('item')
      .select('item.inventoryItemId', 'inventoryItemId')
      .addSelect('inventory.name', 'itemName')
      .addSelect('inventory.sku', 'sku')
      .addSelect('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .addSelect('SUM(item.lineTotal)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')
      .leftJoin('item.inventoryItem', 'inventory')
      .leftJoin('item.invoice', 'invoice')
      .leftJoin('invoice.store', 'store')
      // CRITICAL: Filter by invoice.userId AND inventory.userId for complete data isolation
      .where('invoice.userId = :userId', { userId })
      .andWhere('inventory.userId = :userId', { userId });
    
    query
      .andWhere('item.inventoryItemId IS NOT NULL')
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'paid', 'overdue'],
      });

    if (storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId });
    }

    const topItems = await query
      .groupBy('item.inventoryItemId')
      .addGroupBy('inventory.name')
      .addGroupBy('inventory.sku')
      .addGroupBy('invoice.storeId')
      .addGroupBy('store.name')
      .orderBy('SUM(item.lineTotal)', 'DESC')
      .limit(limit)
      .getRawMany();

    return topItems.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      itemName: item.itemName,
      sku: item.sku,
      storeId: item.storeId,
      storeName: item.storeName,
      totalQuantity: parseFloat(item.totalQuantity || '0'),
      totalRevenue: parseFloat(item.totalRevenue || '0'),
      invoiceCount: parseInt(item.invoiceCount || '0', 10),
    }));
  }

  async getStoreRevenueReport(
    userId: string,
    storeId: string | undefined,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ) {
    // CRITICAL: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('store.code', 'storeCode')
      .addSelect('SUM(invoice.total)', 'totalRevenue')
      .addSelect('COUNT(invoice.id)', 'totalInvoices')
      .addSelect(`SUM(CASE WHEN invoice.status = 'paid' THEN invoice.total ELSE 0 END)`, 'paidRevenue')
      .addSelect(`SUM(CASE WHEN invoice.status = 'sent' THEN invoice.total ELSE 0 END)`, 'sentRevenue')
      .addSelect(`SUM(CASE WHEN invoice.status = 'overdue' THEN invoice.total ELSE 0 END)`, 'overdueRevenue')
      .leftJoin('invoice.store', 'store')
      // CRITICAL: Filter by invoice.userId to ensure data isolation
      .where('invoice.userId = :userId', { userId });
    
    query.andWhere('invoice.status IN (:...statuses)', {
      statuses: ['sent', 'paid', 'overdue'],
    });

    if (storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId });
    }

    if (startDate) {
      query.andWhere('invoice.issueDate >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('invoice.issueDate <= :endDate', { endDate });
    }

    const results = await query
      .groupBy('invoice.storeId')
      .addGroupBy('store.name')
      .addGroupBy('store.code')
      .getRawMany();

    return results.map((item) => ({
      storeId: item.storeId,
      storeName: item.storeName,
      storeCode: item.storeCode,
      totalRevenue: parseFloat(item.totalRevenue || '0'),
      paidRevenue: parseFloat(item.paidRevenue || '0'),
      sentRevenue: parseFloat(item.sentRevenue || '0'),
      overdueRevenue: parseFloat(item.overdueRevenue || '0'),
      totalInvoices: parseInt(item.totalInvoices, 10),
      averageInvoiceValue:
        parseInt(item.totalInvoices, 10) > 0
          ? parseFloat(item.totalRevenue || '0') / parseInt(item.totalInvoices, 10)
          : 0,
    }));
  }

  /**
   * Validate that a store belongs to the user
   * CRITICAL: Prevents data leakage between users
   * This ensures multi-tenant data isolation for thousands of users
   */
  private async validateStoreOwnership(storeId: string, userId: string): Promise<void> {
    const store = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.id = :storeId', { storeId })
      .andWhere('store.userId = :userId', { userId })
      .andWhere('store.deletedAt IS NULL')
      .getOne();
    
    if (!store) {
      throw new NotFoundException(`Store with ID "${storeId}" not found or does not belong to user`);
    }
  }

  async getStoreInventoryTurnover(userId: string, storeId: string | undefined) {
    // CRITICAL FIX: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.stockMovementRepository
      .createQueryBuilder('movement')
      .select('movement.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('COUNT(DISTINCT movement.inventoryItemId)', 'uniqueItems')
      .addSelect('SUM(CASE WHEN movement.type = \'sale\' THEN movement.quantity ELSE 0 END)', 'totalSales')
      .addSelect('SUM(CASE WHEN movement.type = \'purchase\' THEN movement.quantity ELSE 0 END)', 'totalPurchases')
      .leftJoin('movement.store', 'store')
      // CRITICAL FIX: Filter by BOTH movement.userId AND store.userId to prevent data leakage
      // This ensures we only get movements created by the user AND linked to stores owned by the user
      .where('movement.userId = :userId', { userId })
      .andWhere('store.userId = :userId', { userId })
      .andWhere('movement.storeId IS NOT NULL');

    if (storeId) {
      query.andWhere('movement.storeId = :storeId', { storeId });
    }

    const results = await query
      .groupBy('movement.storeId')
      .addGroupBy('store.name')
      .getRawMany();

    // Get current stock levels for turnover calculation
    const storeSettingsQuery = this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .select('settings.storeId', 'storeId')
      .addSelect('SUM(settings.currentStock)', 'totalCurrentStock')
      .leftJoin('settings.store', 'store')
      // Org-shared: visibility boundary is organizationId.
      // Safe legacy: include org NULL rows only if created by the current user.
      .where('store.userId = :userId', { userId });

    if (storeId) {
      storeSettingsQuery.andWhere('settings.storeId = :storeId', { storeId });
    }

    const stockLevels = await storeSettingsQuery
      .groupBy('settings.storeId')
      .getRawMany();

    const stockMap = new Map(
      stockLevels.map((s) => [s.storeId, parseFloat(s.totalCurrentStock || '0')]),
    );

    return results.map((item) => {
      const currentStock = stockMap.get(item.storeId) || 0;
      const totalSales = parseFloat(item.totalSales || '0');
      const turnover = currentStock > 0 ? totalSales / currentStock : 0;

      return {
        storeId: item.storeId,
        storeName: item.storeName,
        uniqueItems: parseInt(item.uniqueItems || '0', 10),
        totalSales,
        totalPurchases: parseFloat(item.totalPurchases || '0'),
        currentStock,
        turnover: Number(turnover.toFixed(2)),
      };
    });
  }

  async getStoreSalesTrends(
    userId: string,
    storeId: string | undefined,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ) {
    // CRITICAL: Validate store ownership to prevent data leakage
    if (storeId) {
      await this.validateStoreOwnership(storeId, userId);
    }

    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('SUM(invoice.total)', 'revenue')
      .addSelect('COUNT(invoice.id)', 'invoiceCount')
      .leftJoin('invoice.store', 'store')
      // CRITICAL: Filter by invoice.userId to ensure data isolation
      .where('invoice.userId = :userId', { userId });
    
    query
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'paid', 'overdue'],
      })
      .andWhere('invoice.storeId IS NOT NULL');

    if (storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId });
    }

    // Group by period based on issueDate
    let dateFormat: string;
    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        query.addSelect("TO_CHAR(invoice.issueDate, 'YYYY-MM-DD')", 'period');
        break;
      case 'weekly':
        dateFormat = 'YYYY-"W"WW';
        query.addSelect("TO_CHAR(invoice.issueDate, 'IYYY-\"W\"IW')", 'period');
        break;
      case 'monthly':
        dateFormat = 'YYYY-MM';
        query.addSelect("TO_CHAR(invoice.issueDate, 'YYYY-MM')", 'period');
        break;
      case 'yearly':
        dateFormat = 'YYYY';
        query.addSelect("TO_CHAR(invoice.issueDate, 'YYYY')", 'period');
        break;
    }

    const results = await query
      .groupBy('invoice.storeId')
      .addGroupBy('store.name')
      .addGroupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return results.map((item) => ({
      storeId: item.storeId,
      storeName: item.storeName,
      period: item.period,
      revenue: parseFloat(item.revenue || '0'),
      invoiceCount: parseInt(item.invoiceCount, 10),
    }));
  }

  async getStoresSummary(userId: string) {
    try {
      this.logger.debug(`Getting stores summary for user ${userId}`);
      
      // Get all stores with summary metrics
      // Organizations removed - filter by userId only (user-scoped data)
      const stores = await this.storeRepository
        .createQueryBuilder('store')
        .where('store.userId = :userId', { userId })
        .andWhere('store.deletedAt IS NULL')
        .orderBy('store.name', 'ASC')
        .getMany();

      this.logger.debug(`Found ${stores.length} stores for user ${userId}`);

      const storeIds = stores.map((s) => s.id);

      if (storeIds.length === 0) {
        this.logger.debug(`No stores found for user ${userId}, returning empty array`);
        return [];
      }

      // Get revenue per store
      // FIX: Count ALL invoices (including drafts) but only calculate revenue from finalized invoices
      const revenueQuery = this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('invoice.storeId', 'storeId')
        // Revenue: Only count finalized invoices (sent, paid, overdue) - exclude drafts and cancelled
        .addSelect(`SUM(CASE WHEN invoice.status IN ('sent', 'paid', 'overdue') THEN invoice.total ELSE 0 END)`, 'totalRevenue')
        // Total invoices: Count ALL invoices regardless of status
        .addSelect('COUNT(invoice.id)', 'totalInvoices')
        // Paid revenue: Only count paid invoices
        .addSelect(`SUM(CASE WHEN invoice.status = 'paid' THEN invoice.total ELSE 0 END)`, 'paidRevenue')
        // Organizations removed - filter by userId only (user-scoped data)
        .where('invoice.userId = :userId', { userId })
        .andWhere('invoice.storeId IN (:...storeIds)', { storeIds })
        // FIX: Include all statuses to get accurate invoice count
        .andWhere('invoice.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
        .groupBy('invoice.storeId');
      
      const revenueData = await revenueQuery.getRawMany();

      this.logger.debug(`Found revenue data for ${revenueData.length} stores`);

      const revenueMap = new Map(
        revenueData.map((r) => [
          r.storeId,
          {
            totalRevenue: parseFloat(r.totalRevenue || '0'),
            paidRevenue: parseFloat(r.paidRevenue || '0'),
            totalInvoices: parseInt(r.totalInvoices, 10),
          },
        ]),
      );

      const result = stores.map((store) => {
        const revenue = revenueMap.get(store.id) || {
          totalRevenue: 0,
          paidRevenue: 0,
          totalInvoices: 0,
        };

        return {
          storeId: store.id,
          storeName: store.name,
          storeCode: store.code,
          active: store.active,
          totalRevenue: revenue.totalRevenue,
          paidRevenue: revenue.paidRevenue,
          totalInvoices: revenue.totalInvoices,
          averageInvoiceValue:
            revenue.totalInvoices > 0
              ? revenue.totalRevenue / revenue.totalInvoices
              : 0,
        };
      });

      this.logger.debug(`Successfully generated summary for ${result.length} stores`);
      return result;
    } catch (error) {
      this.logger.error(`Error in getStoresSummary for user ${userId}:`, error);
      throw error;
    }
  }

  async compareStores(
    userId: string,
    storeIds: string[],
    startDate: Date | undefined,
    endDate: Date | undefined,
  ) {
    if (storeIds.length === 0) {
      return [];
    }

    // Validate all stores belong to user
    // Organizations removed - filter by userId only (user-scoped data)
    const stores = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.userId = :userId', { userId })
      .andWhere('store.deletedAt IS NULL')
      .andWhere('store.id IN (:...storeIds)', { storeIds })
      .getMany();

    if (stores.length !== storeIds.length) {
      throw new NotFoundException('One or more stores not found or do not belong to user');
    }

    // Build date filter
    const invoiceQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.storeId', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('store.code', 'storeCode')
      .addSelect('SUM(invoice.total)', 'totalRevenue')
      .addSelect('COUNT(invoice.id)', 'totalInvoices')
      .addSelect(`SUM(CASE WHEN invoice.status = 'paid' THEN invoice.total ELSE 0 END)`, 'paidRevenue')
      .addSelect(`AVG(invoice.total)`, 'averageInvoiceValue')
      .leftJoin('invoice.store', 'store')
      // Organizations removed - filter by userId only (user-scoped data)
      .where('invoice.userId = :userId', { userId });
    
    invoiceQuery
      .andWhere('invoice.storeId IN (:...storeIds)', { storeIds })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'paid', 'overdue'],
      });

    if (startDate) {
      invoiceQuery.andWhere('invoice.issueDate >= :startDate', { startDate });
    }

    if (endDate) {
      invoiceQuery.andWhere('invoice.issueDate <= :endDate', { endDate });
    }

    const revenueData = await invoiceQuery
      .groupBy('invoice.storeId')
      .addGroupBy('store.name')
      .addGroupBy('store.code')
      .getRawMany();

    // Get inventory turnover data
    const turnoverData = await this.getStoreInventoryTurnover(userId, undefined);
    const turnoverMap = new Map(
      turnoverData.map((t) => [t.storeId, t.turnover]),
    );

    // Calculate growth rate (comparing first half vs second half of period)
    const comparisonResults = await Promise.all(
      storeIds.map(async (storeId) => {
        const revenue = revenueData.find((r) => r.storeId === storeId);
        const turnover = turnoverMap.get(storeId) || 0;

        // Calculate growth rate if date range is provided
        let growthRate = 0;
        if (startDate && endDate) {
          const periodLength = endDate.getTime() - startDate.getTime();
          const midPoint = new Date(startDate.getTime() + periodLength / 2);

          // Organizations removed - filter by userId only (user-scoped data)
          const firstHalfQuery = this.invoiceRepository
            .createQueryBuilder('invoice')
            .select('SUM(invoice.total)', 'revenue')
            .where('invoice.userId = :userId', { userId })
            .andWhere('invoice.storeId = :storeId', { storeId });
          
          const firstHalfRevenue = await firstHalfQuery
            .andWhere('invoice.status IN (:...statuses)', {
              statuses: ['sent', 'paid', 'overdue'],
            })
            .andWhere('invoice.issueDate >= :startDate', { startDate })
            .andWhere('invoice.issueDate < :midPoint', { midPoint })
            .getRawOne();

          // Organizations removed - filter by userId only (user-scoped data)
          const secondHalfQuery = this.invoiceRepository
            .createQueryBuilder('invoice')
            .select('SUM(invoice.total)', 'revenue')
            .where('invoice.userId = :userId', { userId })
            .andWhere('invoice.storeId = :storeId', { storeId });
          
          const secondHalfRevenue = await secondHalfQuery
            .andWhere('invoice.status IN (:...statuses)', {
              statuses: ['sent', 'paid', 'overdue'],
            })
            .andWhere('invoice.issueDate >= :midPoint', { midPoint })
            .andWhere('invoice.issueDate <= :endDate', { endDate })
            .getRawOne();

          const firstHalf = parseFloat(firstHalfRevenue?.revenue || '0');
          const secondHalf = parseFloat(secondHalfRevenue?.revenue || '0');

          if (firstHalf > 0) {
            growthRate = ((secondHalf - firstHalf) / firstHalf) * 100;
          }
        }

        return {
          storeId,
          storeName: revenue?.storeName || stores.find((s) => s.id === storeId)?.name || '',
          storeCode: revenue?.storeCode || stores.find((s) => s.id === storeId)?.code || '',
          totalRevenue: parseFloat(revenue?.totalRevenue || '0'),
          paidRevenue: parseFloat(revenue?.paidRevenue || '0'),
          totalInvoices: parseInt(revenue?.totalInvoices || '0', 10),
          averageInvoiceValue: parseFloat(revenue?.averageInvoiceValue || '0'),
          turnover,
          growthRate: Number(growthRate.toFixed(2)),
        };
      }),
    );

    return comparisonResults;
  }
}

