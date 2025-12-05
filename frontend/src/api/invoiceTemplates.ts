import { apiClient } from './apiClient';
import { InvoiceTemplate } from '../types/invoiceTemplate';

export interface CreateInvoiceTemplateDto {
  name: string;
  description?: string;
  templateData: {
    header?: any;
    footer?: any;
    styles?: any;
    fields?: any;
  };
  isDefault?: boolean;
}

export interface UpdateInvoiceTemplateDto extends Partial<CreateInvoiceTemplateDto> {}

export const invoiceTemplatesApi = {
  getAll: async (): Promise<InvoiceTemplate[]> => {
    const response = await apiClient.get<InvoiceTemplate[]>('/invoice-templates');
    return response.data;
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

