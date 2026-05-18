import { apiClient } from './apiClient';

export interface StoreAlert {
  id: string;
  userId: string;
  storeId: string;
  inventoryItemId: string;
  alertType: 'low_stock' | 'out_of_stock';
  currentStock: number;
  minQty: number;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: string;
    name: string;
    code: string;
  };
  inventoryItem?: {
    id: string;
    name: string;
    sku?: string;
  };
}

export const storeAlertsApi = {
  getAlerts: async (storeId?: string, resolved?: boolean): Promise<StoreAlert[]> => {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (resolved !== undefined) params.append('resolved', String(resolved));

    const response = await apiClient.get<StoreAlert[]>(
      `/inventory/store-alerts${params.toString() ? `?${params.toString()}` : ''}`,
    );
    return response.data;
  },

  getStoreAlerts: async (storeId: string): Promise<StoreAlert[]> => {
    const response = await apiClient.get<StoreAlert[]>(`/inventory/store-alerts/store/${storeId}`);
    return response.data;
  },

  resolveAlert: async (alertId: string): Promise<StoreAlert> => {
    const response = await apiClient.patch<StoreAlert>(`/inventory/store-alerts/${alertId}/resolve`);
    return response.data;
  },

  checkAlerts: async (): Promise<StoreAlert[]> => {
    const response = await apiClient.get<StoreAlert[]>('/inventory/store-alerts/check');
    return response.data;
  },
};

