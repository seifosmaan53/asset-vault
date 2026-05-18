import { apiClient } from './apiClient';
import type { InvoiceTemplate, CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from '../types/invoiceTemplate';

export const invoiceTemplatesApi = {
  getAll: async (): Promise<InvoiceTemplate[]> => {
    const response = await apiClient.get<InvoiceTemplate[]>('/invoice-templates');
    return response.data;
  },

  getDefault: async (): Promise<InvoiceTemplate | null> => {
    try {
      const response = await apiClient.get<InvoiceTemplate>('/invoice-templates/default');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  getById: async (id: string): Promise<InvoiceTemplate> => {
    const response = await apiClient.get<InvoiceTemplate>(`/invoice-templates/${id}`);
    return response.data;
  },

  create: async (data: CreateInvoiceTemplateDto): Promise<InvoiceTemplate> => {
    const response = await apiClient.post<InvoiceTemplate>('/invoice-templates', data);
    return response.data;
  },

  update: async (id: string, data: UpdateInvoiceTemplateDto): Promise<InvoiceTemplate> => {
    const response = await apiClient.patch<InvoiceTemplate>(`/invoice-templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoice-templates/${id}`);
  },
};
