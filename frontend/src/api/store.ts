import { apiClient } from './apiClient';
import type { Store } from '../types/store';

export interface CreateStoreDto {
  clientId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  // active removed - all stores are always active
}

export interface UpdateStoreDto extends Partial<CreateStoreDto> {
  clientId?: string;
  // active removed - all stores are always active
}

export const storeApi = {
  getAll: async (activeOnly?: boolean): Promise<Store[]> => {
    // activeOnly parameter is ignored - all stores are always active
    const response = await apiClient.get<Store[]>('/inventory/stores');
    return response.data;
  },

  getById: async (id: string): Promise<Store> => {
    const response = await apiClient.get<Store>(`/inventory/stores/${id}`);
    return response.data;
  },

  create: async (data: CreateStoreDto): Promise<Store> => {
    const response = await apiClient.post<Store>('/inventory/stores', data);
    return response.data;
  },

  update: async (id: string, data: UpdateStoreDto): Promise<Store> => {
    const response = await apiClient.patch<Store>(`/inventory/stores/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/stores/${id}`);
  },
};

