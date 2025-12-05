import { apiClient } from './apiClient';
import { Client } from '../types/client';

export interface CreateClientDto {
  name: string;
  email?: string;
  phone?: string;
  addressJson?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes?: string;
  tags?: string[];
  avatarUrl?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}

export const clientsApi = {
  getAll: async (): Promise<Client[]> => {
    const response = await apiClient.get<Client[]>('/clients');
    return response.data;
  },

  getById: async (id: string): Promise<Client> => {
    const response = await apiClient.get<Client>(`/clients/${id}`);
    return response.data;
  },

  create: async (data: CreateClientDto): Promise<Client> => {
    const response = await apiClient.post<Client>('/clients', data);
    return response.data;
  },

  update: async (id: string, data: UpdateClientDto): Promise<Client> => {
    const response = await apiClient.patch<Client>(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },
};

