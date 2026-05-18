import { apiClient } from './apiClient';
import type { StoreItemSettings } from '../types/store';

export interface CreateStoreItemSettingsDto {
  storeId: string;
  inventoryItemId: string;
  currentStock?: number;
  minQty?: number;
  targetQty?: number;
  weeklyUsage?: number;
}

export interface UpdateStoreItemSettingsDto {
  currentStock?: number;
  minQty?: number;
  targetQty?: number;
  weeklyUsage?: number;
}

export interface UpdateStockDto {
  quantity: number;
}

export const storeItemSettingsApi = {
  createOrUpdate: async (data: CreateStoreItemSettingsDto): Promise<StoreItemSettings> => {
    const response = await apiClient.post<StoreItemSettings>('/inventory/store-item-settings', data);
    return response.data;
  },

  getByStore: async (storeId: string): Promise<StoreItemSettings[]> => {
    const response = await apiClient.get<StoreItemSettings[]>(`/inventory/store-item-settings/store/${storeId}`);
    return response.data;
  },

  getByItem: async (itemId: string): Promise<StoreItemSettings[]> => {
    const response = await apiClient.get<StoreItemSettings[]>(`/inventory/store-item-settings/item/${itemId}`);
    return response.data;
  },

  update: async (id: string, data: UpdateStoreItemSettingsDto): Promise<StoreItemSettings> => {
    const response = await apiClient.patch<StoreItemSettings>(`/inventory/store-item-settings/${id}`, data);
    return response.data;
  },

  updateStock: async (storeId: string, itemId: string, quantity: number): Promise<StoreItemSettings> => {
    const response = await apiClient.post<StoreItemSettings>(
      `/inventory/store-item-settings/store/${storeId}/item/${itemId}/stock`,
      { quantity },
    );
    return response.data;
  },

  getStoreStockReport: async (storeId: string): Promise<{ items: Array<{ name: string; sku?: string; currentStock: number; minQty: number }> }> => {
    const response = await apiClient.get(`/inventory/store-item-settings/store/${storeId}/report`);
    return response.data;
  },

  transferStock: async (data: {
    fromStoreId: string;
    toStoreId: string;
    inventoryItemId: string;
    quantity: number;
    note?: string;
  }): Promise<{ success: boolean; fromMovement: StockMovement; toMovement: StockMovement }> => {
    const response = await apiClient.post('/inventory/stores/transfer', data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/store-item-settings/${id}`);
  },

  deleteByStoreAndItem: async (storeId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/inventory/store-item-settings/store/${storeId}/item/${itemId}`);
  },
};

