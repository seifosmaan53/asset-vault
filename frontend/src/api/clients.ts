import { apiClient } from './apiClient';
import type { Client } from '../types/client';
import { logger } from '../utils/logger';

export interface CreateClientDto {
  name: string;
  email?: string;
  phone?: string;
  addressJson?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  notes?: string;
  avatarUrl?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}

// Helper function to validate and sanitize client data
const sanitizeClient = (client: unknown): Client | null => {
  if (!client || typeof client !== 'object') return null;
  
  const clientObj = client as Record<string, unknown>;
  
  // Ensure required fields exist
  if (!clientObj.id || !clientObj.name || typeof clientObj.name !== 'string') return null;
  
  return {
    id: String(clientObj.id),
    userId: clientObj.userId ? String(clientObj.userId) : '',
    name: String(clientObj.name || '').trim(),
    email: clientObj.email ? String(clientObj.email).trim() : undefined,
    phone: clientObj.phone ? String(clientObj.phone).trim() : undefined,
    addressJson: clientObj.addressJson && typeof clientObj.addressJson === 'object' ? {
      street: (clientObj.addressJson as Record<string, unknown>).street ? String((clientObj.addressJson as Record<string, unknown>).street).trim() : '',
      city: (clientObj.addressJson as Record<string, unknown>).city ? String((clientObj.addressJson as Record<string, unknown>).city).trim() : '',
      state: (clientObj.addressJson as Record<string, unknown>).state ? String((clientObj.addressJson as Record<string, unknown>).state).trim() : '',
      zip: (clientObj.addressJson as Record<string, unknown>).zip ? String((clientObj.addressJson as Record<string, unknown>).zip).trim() : '',
      country: (clientObj.addressJson as Record<string, unknown>).country ? String((clientObj.addressJson as Record<string, unknown>).country).trim() : '',
    } : undefined,
    notes: clientObj.notes ? String(clientObj.notes).trim() : undefined,
    avatarUrl: clientObj.avatarUrl ? String(clientObj.avatarUrl).trim() : undefined,
    createdAt: clientObj.createdAt ? String(clientObj.createdAt) : new Date().toISOString(),
    updatedAt: clientObj.updatedAt ? String(clientObj.updatedAt) : new Date().toISOString(),
    deletedAt: clientObj.deletedAt ? String(clientObj.deletedAt) : undefined,
  };
};

export const clientsApi = {
  getAll: async (params?: {
    search?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    updatedAtFrom?: string;
    updatedAtTo?: string;
  }): Promise<Client[]> => {
    try {
      const response = await apiClient.get<Client[]>('/clients', { params });
      
      // Edge case: response or response.data might be null/undefined
      if (!response || !response.data) {
        logger.warn('Clients API: Empty or invalid response');
        return [];
      }
      
      // Edge case: response.data might not be an array
      if (!Array.isArray(response.data)) {
        logger.warn('Clients API: Response data is not an array', response.data);
        return [];
      }
      
      // Sanitize and validate each client
      const clients = response.data
        .map(sanitizeClient)
        .filter((client): client is Client => client !== null);
      
      return clients;
    } catch (error) {
      // Ignore CanceledError - this is expected when React Query deduplicates requests
      if (error && typeof error === 'object' && ('name' in error && (error as { name?: string }).name === 'CanceledError' || 'code' in error && (error as { code?: string }).code === 'ERR_CANCELED')) {
        // Silently rethrow - React Query handles this internally
        throw error;
      }
      // Edge case: Network errors, timeout, etc.
      logger.error('Clients API: Error fetching clients', error);
      throw error;
    }
  },

  getById: async (id: string): Promise<Client> => {
    // Edge case: Invalid or missing ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Invalid client ID');
    }
    
    try {
      const response = await apiClient.get<Client>(`/clients/${id}`);
      
      // Edge case: response or response.data might be null/undefined
      if (!response || !response.data) {
        throw new Error('Client not found');
      }
      
      // Sanitize and validate client
      const client = sanitizeClient(response.data);
      if (!client) {
        throw new Error('Invalid client data received');
      }
      
      return client;
    } catch (error) {
      // Edge case: Network errors, 404, etc.
      logger.error('Clients API: Error fetching client', { id, error });
      throw error;
    }
  },

  create: async (data: CreateClientDto): Promise<Client> => {
    // Edge case: Validate required fields
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid client data');
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('Client name is required');
    }
    
    try {
      const response = await apiClient.post<Client>('/clients', data);
      
      // Edge case: response or response.data might be null/undefined
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      // Sanitize and validate created client
      const client = sanitizeClient(response.data);
      if (!client) {
        throw new Error('Invalid client data received');
      }
      
      return client;
    } catch (error) {
      // Edge case: Network errors, validation errors, etc.
      logger.error('Clients API: Error creating client', error);
      throw error;
    }
  },

  update: async (id: string, data: UpdateClientDto): Promise<Client> => {
    // Edge case: Invalid or missing ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Invalid client ID');
    }
    
    // Edge case: Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid client data');
    }
    
    // Edge case: If name is provided, ensure it's valid
    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
      throw new Error('Client name cannot be empty');
    }
    
    try {
      const response = await apiClient.patch<Client>(`/clients/${id}`, data);
      
      // Edge case: response or response.data might be null/undefined
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      // Sanitize and validate updated client
      const client = sanitizeClient(response.data);
      if (!client) {
        throw new Error('Invalid client data received');
      }
      
      return client;
    } catch (error) {
      // Edge case: Network errors, 404, validation errors, etc.
      logger.error('Clients API: Error updating client', { id, error });
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    // Edge case: Invalid or missing ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Invalid client ID');
    }
    
    try {
      await apiClient.delete(`/clients/${id}`);
    } catch (error) {
      // Edge case: Network errors, 404, etc.
      logger.error('Clients API: Error deleting client', { id, error });
      throw error;
    }
  },

  bulkDelete: async (ids: string[]): Promise<{ deleted: number; failed: Array<{ id: string; reason: string }> }> => {
    // Edge case: Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('At least one client ID is required');
    }
    
    try {
      const response = await apiClient.post<{ deleted: number; failed: Array<{ id: string; reason: string }> }>('/clients/bulk-delete', { ids });
      return response.data;
    } catch (error) {
      logger.error('Clients API: Error bulk deleting clients', { ids, error });
      throw error;
    }
  },

  import: async (file: File): Promise<{ created: number; failed: Array<{ row: number; data: any; errors: string[] }> }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await apiClient.post<{ created: number; failed: Array<{ row: number; data: any; errors: string[] }> }>('/clients/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Clients API: Error importing clients', error);
      throw error;
    }
  },
};

