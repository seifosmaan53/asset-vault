import { apiClient } from './apiClient';
import type { User } from '../types/user';

export interface CreateUserDto {
  name: string;
  email: string;
  role: 'owner' | 'admin';
  password: string;
  companyName?: string;
}

export interface UpdateUserDto {
  name?: string;
  role?: 'owner' | 'admin';
  password?: string;
}

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users');
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserDto): Promise<User> => {
    const response = await apiClient.post<User>('/users', data);
    return response.data;
  },

  update: async (id: string, data: UpdateUserDto): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  addSampleData: async (): Promise<{ message: string; data: { clients: number; stores: number; inventory: number; invoices: number } }> => {
    const response = await apiClient.post<{ message: string; data: { clients: number; stores: number; inventory: number; invoices: number } }>('/sample-data');
    return response.data;
  },

  deleteSampleData: async (): Promise<{ message: string; data: { deleted: { clients: number; stores: number; inventory: number; invoices: number } } }> => {
    const response = await apiClient.delete<{ message: string; data: { deleted: { clients: number; stores: number; inventory: number; invoices: number } } }>('/sample-data');
    return response.data;
  },
};

