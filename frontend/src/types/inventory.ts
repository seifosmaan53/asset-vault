export type InventoryStatus = 'active' | 'inactive';
export type StockMovementType = 'purchase' | 'sale' | 'adjustment';

export interface InventoryItem {
  id: string;
  userId: string;
  sku: string;
  name: string;
  description?: string;
  /* Kept in step with the entity and with CreateInventoryItemDto in api/inventory.ts.
     There being two InventoryItem shapes in this codebase is the underlying problem —
     they drift, and pages break depending on which one they happen to import. */
  category?: string;
  unit: string;
  barcode?: string;
  costPrice?: number;
  defaultUnitPrice: number;
  defaultTaxRate?: number;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel?: number;
  status: InventoryStatus;
  // Bundle / Pack Information
  bundleSize?: number;
  bundleUnit?: string;
  // Space / Container Planning
  spacePerBundle?: number;
  bundlesPerContainer?: number;
  targetBundles?: number;
  // Pack Size
  packSize?: number;
  // Container Planning
  unitsPerContainer?: number;
  // Planning Fields
  weeksSupplyTargetOverride?: number;
  averageWeeklyUsage?: number;
  // Computed fields (from backend)
  computed?: {
    weeksOnHand?: number | null;
    containersNeeded?: number | null;
    effectiveWeeksSupplyTarget?: number;
  };
  // Store aggregation (from backend)
  storeAggregation?: {
    totalStoreStock: number;
    storeCount: number;
    storesWithStock: number;
    storesWithLowStock: number;
    averageStoreStock: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  userId: string;
  inventoryItemId: string;
  storeId?: string;
  invoiceItemId?: string;
  type: StockMovementType;
  quantity: number;
  sourceType: 'invoice' | 'manual' | 'import';
  sourceId?: string;
  note?: string;
  createdAt: string;
}

