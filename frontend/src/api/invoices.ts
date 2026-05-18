import { apiClient } from './apiClient';
import type { Invoice, InvoiceItem } from '../types/invoice';

export interface CreateInvoiceDto {
  clientId: string;
  storeId?: string;
  type: 'invoice'; // Only invoices, no estimates
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
  storeId?: string;
}

export interface InvoiceStats {
  totalCount: number;
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyTotal: number;
  totalAmount: number;
}

export interface PagedMeta {
  page: number; // 1-based
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PagedResult<T> {
  data: T[];
  meta: PagedMeta;
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

  getPaged: async (params?: {
    page?: number; // 1-based
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    issueDateFrom?: string;
    issueDateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    paidDateFrom?: string;
    paidDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    totalMin?: number;
    totalMax?: number;
    subtotalMin?: number;
    subtotalMax?: number;
    type?: string;
    search?: string;
  }): Promise<PagedResult<Invoice>> => {
    const response = await apiClient.get<PagedResult<Invoice>>('/invoices/paged', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: CreateInvoiceDto, isDuplicate?: boolean): Promise<Invoice> => {
    // Send duplication flag both in query param and header for maximum compatibility
    const config = isDuplicate ? { 
      params: { duplicate: 'true' },
      headers: { 'x-duplicate': 'true' }
    } : {};
    const response = await apiClient.post<{ data: Invoice; message?: string }>('/invoices', data, config);
    // Backend returns { data: Invoice, message: string }, extract the invoice
    return response.data.data;
  },

  update: async (id: string, data: UpdateInvoiceDto): Promise<Invoice> => {
    const response = await apiClient.patch<{ data: Invoice; message?: string }>(`/invoices/${id}`, data);
    // Backend returns { data: Invoice, message: string }, extract the invoice
    return response.data.data;
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

  sendEmail: async (id: string, options?: {
    subject?: string;
    message?: string;
    to?: string;
    includePdf?: boolean;
  }): Promise<{ message: string; emailError?: string }> => {
    const response = await apiClient.post<{ message: string; emailError?: string }>(`/invoices/${id}/send`, options || {});
    return response.data;
  },

  generatePdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.post(`/invoices/${id}/pdf`, {}, {
      responseType: 'blob',
    });
    return response.data;
  },

  backfillPaidAt: async (): Promise<{ updatedCount: number; message: string }> => {
    const response = await apiClient.post<{ updatedCount: number; message: string }>('/invoices/backfill-paid-at');
    return response.data;
  },
};

