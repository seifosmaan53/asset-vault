import { apiClient } from './apiClient';
import { InventoryItem, StockMovement } from '../types/inventory';

export interface CreateInventoryItemDto {
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
  reorderLevel: number;
  maxStockLevel?: number;
  status: 'active' | 'inactive';
}

export interface UpdateInventoryItemDto extends Partial<CreateInventoryItemDto> {}

export interface CreateStockMovementDto {
  type: 'purchase' | 'sale' | 'adjustment';
  quantity: number;
  sourceType: 'invoice' | 'manual' | 'import';
  sourceId?: string;
  note?: string;
}

export interface InventoryStats {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  totalValue: number;
}

export const inventoryApi = {
  getAll: async (params?: {
    search?: string;
    category?: string;
    status?: string;
    lowStockOnly?: boolean;
  }): Promise<InventoryItem[]> => {
    const response = await apiClient.get<InventoryItem[]>('/inventory/items', { params });
    return response.data;
  },

  getById: async (id: string): Promise<InventoryItem> => {
    const response = await apiClient.get<InventoryItem>(`/inventory/items/${id}`);
    return response.data;
  },

  create: async (data: CreateInventoryItemDto): Promise<InventoryItem> => {
    const response = await apiClient.post<InventoryItem>('/inventory/items', data);
    return response.data;
  },

  update: async (id: string, data: UpdateInventoryItemDto): Promise<InventoryItem> => {
    const response = await apiClient.patch<InventoryItem>(`/inventory/items/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/items/${id}`);
  },

  getMovements: async (id: string): Promise<StockMovement[]> => {
    const response = await apiClient.get<StockMovement[]>(`/inventory/items/${id}/movements`);
    return response.data;
  },

  createMovement: async (id: string, data: CreateStockMovementDto): Promise<StockMovement> => {
    const response = await apiClient.post<StockMovement>(`/inventory/items/${id}/movements`, data);
    return response.data;
  },

  getStats: async (): Promise<InventoryStats> => {
    const response = await apiClient.get<InventoryStats>('/inventory/stats');
    return response.data;
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    const response = await apiClient.get<InventoryItem[]>('/inventory/low-stock');
    return response.data;
  },

  getLinkedInvoices: async (id: string): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/inventory/items/${id}/invoices`);
    return response.data;
  },
};

