export type InventoryStatus = 'active' | 'inactive';
export type StockMovementType = 'purchase' | 'sale' | 'adjustment';

export interface InventoryItem {
  id: string;
  userId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  barcode?: string;
  costPrice?: number;
  defaultUnitPrice: number;
  defaultTaxRate?: number;
  currentStock: number;
  reservedStock: number;
  reorderLevel: number;
  maxStockLevel?: number;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  userId: string;
  inventoryItemId: string;
  type: StockMovementType;
  quantity: number;
  sourceType: 'invoice' | 'manual' | 'import';
  sourceId?: string;
  note?: string;
  createdAt: string;
}

