import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(InvoiceItem)
    private invoiceItemsRepository: Repository<InvoiceItem>,
  ) {}

  async findAll(
    userId: string,
    filters?: {
      search?: string;
      category?: string;
      status?: string;
      lowStockOnly?: boolean;
    },
  ): Promise<InventoryItem[]> {
    const query = this.inventoryRepository.createQueryBuilder('item').where('item.userId = :userId', { userId });

    if (filters?.search) {
      query.andWhere(
        '(item.name ILIKE :search OR item.sku ILIKE :search OR item.barcode ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters?.category) {
      query.andWhere('item.category = :category', { category: filters.category });
    }

    if (filters?.status) {
      query.andWhere('item.status = :status', { status: filters.status });
    }

    if (filters?.lowStockOnly) {
      query.andWhere('item.currentStock <= item.reorderLevel');
    }

    return query.orderBy('item.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, userId: string): Promise<InventoryItem> {
    const item = await this.inventoryRepository.findOne({
      where: { id, userId },
      relations: ['movements'],
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }

  async create(userId: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = this.inventoryRepository.create({
      ...data,
      userId,
    });
    return this.inventoryRepository.save(item);
  }

  async update(id: string, userId: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    await this.findOne(id, userId);
    await this.inventoryRepository.update({ id, userId }, data);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const item = await this.findOne(id, userId);
    
    // Check if item is used in any invoices
    const invoiceItems = await this.invoiceItemsRepository.find({
      where: { inventoryItemId: id },
    });
    
    if (invoiceItems.length > 0) {
      throw new BadRequestException(
        `Cannot delete inventory item: it is used in ${invoiceItems.length} invoice(s). Please remove it from all invoices first.`,
      );
    }
    
    await this.inventoryRepository.remove(item);
  }

  async getMovements(inventoryItemId: string, userId: string): Promise<StockMovement[]> {
    await this.findOne(inventoryItemId, userId);
    return this.stockMovementRepository.find({
      where: { inventoryItemId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createMovement(
    inventoryItemId: string,
    userId: string,
    data: Partial<StockMovement>,
  ): Promise<StockMovement> {
    const item = await this.findOne(inventoryItemId, userId);
    const previousStock = item.currentStock;

    this.logger.log(
      `Stock adjustment for item ${item.sku} (${inventoryItemId}): type=${data.type}, quantity=${data.quantity}, previous stock=${previousStock}`,
    );

    const movement = this.stockMovementRepository.create({
      ...data,
      inventoryItemId,
      userId,
    });

    // Update stock based on movement type
    if (data.type === 'purchase') {
      item.currentStock += data.quantity;
    } else if (data.type === 'adjustment') {
      // For adjustment, quantity represents the new stock level
      item.currentStock = data.quantity;
      if (item.currentStock < 0) {
        item.currentStock = 0;
      }
    } else if (data.type === 'sale') {
      item.currentStock -= data.quantity;
      if (item.currentStock < 0) {
        item.currentStock = 0;
      }
    }

    await this.inventoryRepository.save(item);
    const savedMovement = await this.stockMovementRepository.save(movement);
    
    this.logger.log(
      `Stock adjustment completed for item ${item.sku}: new stock=${item.currentStock}`,
    );

    return savedMovement;
  }

  async getLowStock(userId: string): Promise<InventoryItem[]> {
    return this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .andWhere('item.currentStock <= item.reorderLevel')
      .andWhere('item.status = :status', { status: 'active' })
      .orderBy('item.currentStock', 'ASC')
      .limit(5)
      .getMany();
  }

  async getLinkedInvoices(inventoryItemId: string, userId: string) {
    await this.findOne(inventoryItemId, userId);
    const invoiceItems = await this.invoiceItemsRepository.find({
      where: { inventoryItemId },
      relations: ['invoice', 'invoice.client'],
    });
    
    // Get unique invoices
    const invoiceMap = new Map();
    invoiceItems.forEach((item) => {
      if (item.invoice && item.invoice.userId === userId) {
        invoiceMap.set(item.invoice.id, item.invoice);
      }
    });
    
    return Array.from(invoiceMap.values());
  }

  async getStats(userId: string) {
    const items = await this.inventoryRepository.find({ where: { userId } });
    const activeItems = items.filter((item) => item.status === 'active');
    const lowStockItems = items.filter(
      (item) => item.currentStock <= item.reorderLevel && item.status === 'active',
    );
    const totalValue = items.reduce(
      (sum, item) => sum + (item.costPrice || 0) * item.currentStock,
      0,
    );

    return {
      totalItems: items.length,
      activeItems: activeItems.length,
      lowStockItems: lowStockItems.length,
      totalValue,
    };
  }
}

