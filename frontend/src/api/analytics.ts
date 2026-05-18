import { apiClient } from './apiClient';

export interface InvoiceStatusData {
  status: string;
  count: number;
}

export interface TopClient {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
}

export interface TopItem {
  inventoryItemId: string;
  itemName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  storeId?: string;
  storeName?: string;
}

export interface StoreSummary {
  storeId: string;
  storeName: string;
  storeCode: string;
  active: boolean;
  totalRevenue: number;
  paidRevenue: number;
  totalInvoices: number;
  averageInvoiceValue: number;
}

export interface StoreRevenue {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalRevenue: number;
  paidRevenue: number;
  sentRevenue: number;
  overdueRevenue: number;
  totalInvoices: number;
  averageInvoiceValue: number;
}

export interface StoreInventoryTurnover {
  storeId: string;
  storeName: string;
  uniqueItems: number;
  totalSales: number;
  totalPurchases: number;
  currentStock: number;
  turnover: number;
}

export interface StoreSalesTrend {
  storeId: string;
  storeName: string;
  period: string;
  revenue: number;
  invoiceCount: number;
}

export interface StoreAnalytics {
  storeId: string;
  storeName: string;
  storeCode: string;
  active: boolean;
  totalRevenue: number;
  paidRevenue: number;
  totalInvoices: number;
  averageInvoiceValue: number;
  revenue: StoreRevenue | null;
  topClients: TopClient[];
  topItems: TopItem[];
  turnover: StoreInventoryTurnover | null;
  trends: StoreSalesTrend[];
}

export interface InvoiceStatusByStore {
  status: string;
  storeId?: string;
  storeName?: string;
  count: number;
}

export interface SalesByCategory {
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  invoiceCount: number;
}

export interface RevenueByPaymentMethod {
  paymentMethod: string;
  totalRevenue: number;
  invoiceCount: number;
}

export const analyticsApi = {
  getInvoicesByStatus: async (): Promise<InvoiceStatusData[]> => {
    const response = await apiClient.get<InvoiceStatusData[]>('/analytics/invoices-by-status');
    return response.data;
  },

  getTopClients: async (): Promise<TopClient[]> => {
    const response = await apiClient.get<TopClient[]>('/analytics/top-clients');
    return response.data;
  },

  getTopItems: async (): Promise<TopItem[]> => {
    const response = await apiClient.get<{ data: TopItem[]; page: number; limit: number; total: number }>('/analytics/top-items');
    // Backend returns paginated response, extract the data array
    return response.data?.data || response.data || [];
  },

  getStoresAnalytics: async (): Promise<StoreSummary[]> => {
    const response = await apiClient.get<StoreSummary[]>('/analytics/stores');
    return response.data;
  },

  getStoreAnalytics: async (storeId: string): Promise<StoreAnalytics> => {
    const response = await apiClient.get<StoreAnalytics>(`/analytics/stores/${storeId}`);
    return response.data;
  },

  getStoreRevenue: async (
    storeId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<StoreRevenue[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    const url = `/analytics/stores/${storeId}/revenue${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<StoreRevenue[]>(url);
    return response.data;
  },

  getStoreItems: async (storeId: string, limit?: number): Promise<TopItem[]> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const queryString = params.toString();
    const url = `/analytics/stores/${storeId}/items${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<TopItem[]>(url);
    return response.data;
  },

  getStoreClients: async (storeId: string, limit?: number): Promise<TopClient[]> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const queryString = params.toString();
    const url = `/analytics/stores/${storeId}/clients${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<TopClient[]>(url);
    return response.data;
  },

  getStoreTrends: async (
    storeId: string,
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ): Promise<StoreSalesTrend[]> => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    const queryString = params.toString();
    const url = `/analytics/stores/${storeId}/trends${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<StoreSalesTrend[]>(url);
    return response.data;
  },

  getInvoicesByStatusAndStore: async (storeId?: string): Promise<InvoiceStatusByStore[]> => {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const queryString = params.toString();
    const url = `/analytics/invoices-by-status-store${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<InvoiceStatusByStore[]>(url);
    return response.data;
  },

  getSalesByCategory: async (
    startDate?: string,
    endDate?: string,
    storeId?: string,
  ): Promise<SalesByCategory[]> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (storeId) params.append('storeId', storeId);
      const queryString = params.toString();
      const url = `/analytics/sales-by-category${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient.get<SalesByCategory[]>(url);
      return response.data || [];
    } catch (error: any) {
      // Ignore request deduplication errors (these are expected and not real errors)
      // Also ignore axios cancel errors
      if (
        error?.code === 'ERR_CANCELED' || 
        error?.name === 'CanceledError' ||
        (error?.message && error.message.includes('deduplicated'))
      ) {
        // Request was canceled/deduplicated - this is expected, return empty array silently
        return [];
      }
      // Only log actual errors (not cancellations)
      if (error?.response?.status !== 401) {
        console.error('Error fetching sales by category:', error);
      }
      return [];
    }
  },

  getRevenueByPaymentMethod: async (
    startDate?: string,
    endDate?: string,
    storeId?: string,
  ): Promise<RevenueByPaymentMethod[]> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (storeId) params.append('storeId', storeId);
      const queryString = params.toString();
      const url = `/analytics/revenue-by-payment-method${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient.get<RevenueByPaymentMethod[]>(url);
      return response.data || [];
    } catch (error: any) {
      // Ignore request deduplication errors (these are expected and not real errors)
      // Also ignore axios cancel errors
      if (
        error?.code === 'ERR_CANCELED' || 
        error?.name === 'CanceledError' ||
        (error?.message && error.message.includes('deduplicated'))
      ) {
        // Request was canceled/deduplicated - this is expected, return empty array silently
        return [];
      }
      // Only log actual errors (not cancellations)
      if (error?.response?.status !== 401) {
        console.error('Error fetching revenue by payment method:', error);
      }
      return [];
    }
  },

  exportStoreCSV: async (storeId: string): Promise<Blob> => {
    const response = await apiClient.get(`/analytics/stores/${storeId}/export/csv`, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportStoreExcel: async (storeId: string): Promise<Blob> => {
    const response = await apiClient.get(`/analytics/stores/${storeId}/export/excel`, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportStorePDF: async (storeId: string): Promise<Blob> => {
    const response = await apiClient.get(`/analytics/stores/${storeId}/export/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

