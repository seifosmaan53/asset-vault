import { apiClient } from './apiClient';
import { ApiKey } from '../types/apiKey';

export interface CreateApiKeyDto {
  name: string;
  permissions: string[];
  expiresAt?: string;
  isActive?: boolean;
}

export interface UpdateApiKeyDto extends Partial<CreateApiKeyDto> {}

export const apiKeysApi = {
  getAll: async (): Promise<ApiKey[]> => {
    const response = await apiClient.get<ApiKey[]>('/api-keys');
    return response.data;
  },

  getById: async (id: string): Promise<ApiKey> => {
    const response = await apiClient.get<ApiKey>(`/api-keys/${id}`);
    return response.data;
  },

  create: async (data: CreateApiKeyDto): Promise<ApiKey> => {
    const response = await apiClient.post<ApiKey>('/api-keys', data);
    return response.data;
  },

  update: async (id: string, data: UpdateApiKeyDto): Promise<ApiKey> => {
    const response = await apiClient.patch<ApiKey>(`/api-keys/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api-keys/${id}`);
  },

  getUsage: async (id: string): Promise<ApiKey> => {
    const response = await apiClient.get<ApiKey>(`/api-keys/${id}/usage`);
    return response.data;
  },
};

