import { apiClient } from './apiClient';
import { RecurringInvoice } from '../types/recurringInvoice';

export interface CreateRecurringInvoiceDto {
  clientId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  currency: string;
  items: Array<{
    inventoryItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountRate: number;
  }>;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateRecurringInvoiceDto extends Partial<CreateRecurringInvoiceDto> {}

export const recurringInvoicesApi = {
  getAll: async (): Promise<RecurringInvoice[]> => {
    const response = await apiClient.get<RecurringInvoice[]>('/recurring-invoices');
    return response.data;
  },

  getById: async (id: string): Promise<RecurringInvoice> => {
    const response = await apiClient.get<RecurringInvoice>(`/recurring-invoices/${id}`);
    return response.data;
  },

  create: async (data: CreateRecurringInvoiceDto): Promise<RecurringInvoice> => {
    const response = await apiClient.post<RecurringInvoice>('/recurring-invoices', data);
    return response.data;
  },

  update: async (id: string, data: UpdateRecurringInvoiceDto): Promise<RecurringInvoice> => {
    const response = await apiClient.patch<RecurringInvoice>(`/recurring-invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/recurring-invoices/${id}`);
  },
};

