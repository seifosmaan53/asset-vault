import { apiClient } from './apiClient';
import { Invoice, InvoiceItem } from '../types/invoice';

export interface CreateInvoiceDto {
  clientId: string;
  type: 'invoice' | 'estimate';
  issueDate: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt'>[];
}

export interface UpdateInvoiceDto extends Partial<CreateInvoiceDto> {
  status?: Invoice['status'];
  paidAt?: string;
  paymentMethodNote?: string;
}

export interface InvoiceStats {
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyTotal: number;
  totalAmount: number;
}

export const invoicesApi = {
  getAll: async (params?: {
    status?: string;
    type?: string;
    search?: string;
  }): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>('/invoices', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: CreateInvoiceDto): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>('/invoices', data);
    return response.data;
  },

  update: async (id: string, data: UpdateInvoiceDto): Promise<Invoice> => {
    const response = await apiClient.patch<Invoice>(`/invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoices/${id}`);
  },

  getStats: async (): Promise<InvoiceStats> => {
    const response = await apiClient.get<InvoiceStats>('/invoices/stats');
    return response.data;
  },

  convertToInvoice: async (id: string): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/convert`);
    return response.data;
  },

  sendEmail: async (id: string): Promise<void> => {
    await apiClient.post(`/invoices/${id}/send`);
  },

  generatePdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.post(`/invoices/${id}/pdf`, {}, {
      responseType: 'blob',
    });
    return response.data;
  },
};

