import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import { useAuthStore } from '../store/authStore';
// Organizations removed - data is now user-scoped

export const useInvoicesByStatus = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['analytics', 'invoices-by-status'],
    queryFn: () => analyticsApi.getInvoicesByStatus(),
    enabled: isAuthenticated,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useTopClients = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['analytics', 'top-clients'],
    queryFn: () => analyticsApi.getTopClients(),
    enabled: isAuthenticated,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useTopItems = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['analytics', 'top-items'],
    queryFn: () => analyticsApi.getTopItems(),
    enabled: isAuthenticated,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useStoresAnalytics = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['analytics', 'stores'],
    queryFn: () => analyticsApi.getStoresAnalytics(),
    enabled: isAuthenticated,
    staleTime: 30000, // Consider data fresh for 30 seconds (matches backend cache TTL)
    refetchOnWindowFocus: false, // Disable aggressive refetching to prevent race conditions
    refetchOnMount: false, // Only refetch if data is stale
    retry: 2, // Retry failed requests up to 2 times
  });
};

export const useStoreAnalytics = (storeId: string | undefined) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['analytics', 'stores', storeId],
    queryFn: () => analyticsApi.getStoreAnalytics(storeId!),
    enabled: isAuthenticated && !!storeId,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useStoreRevenue = (
  storeId: string | undefined,
  startDate?: string,
  endDate?: string,
) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['analytics', 'stores', storeId, 'revenue', startDate, endDate],
    queryFn: () => analyticsApi.getStoreRevenue(storeId!, startDate, endDate),
    enabled: isAuthenticated && !!storeId,
  });
};

export const useStoreTrends = (
  storeId: string | undefined,
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['analytics', 'stores', storeId, 'trends', period],
    queryFn: () => analyticsApi.getStoreTrends(storeId!, period),
    enabled: isAuthenticated && !!storeId,
  });
};

export const useInvoicesByStatusAndStore = (storeId?: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['analytics', 'invoices-by-status-store', storeId],
    queryFn: () => analyticsApi.getInvoicesByStatusAndStore(storeId),
    enabled: isAuthenticated,
  });
};

export const useSalesByCategory = (
  startDate?: Date | null,
  endDate?: Date | null,
  storeId?: string,
) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  // Organizations removed - data is now user-scoped
  const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
  const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
  return useQuery({
    queryKey: ['analytics', 'sales-by-category', startDateStr, endDateStr, storeId],
    queryFn: () => analyticsApi.getSalesByCategory(startDateStr, endDateStr, storeId),
    enabled: isAuthenticated,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: (failureCount, error: any) => {
      // Don't retry on canceled/deduplicated requests
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.message?.includes('deduplicated')) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

export const useRevenueByPaymentMethod = (
  startDate?: Date | null,
  endDate?: Date | null,
  storeId?: string,
) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor
  // Organizations removed - data is now user-scoped
  const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
  const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
  return useQuery({
    queryKey: ['analytics', 'revenue-by-payment-method', startDateStr, endDateStr, storeId],
    queryFn: () => analyticsApi.getRevenueByPaymentMethod(startDateStr, endDateStr, storeId),
    enabled: isAuthenticated,
    staleTime: 0, // Consider data stale immediately so it refetches on invalidation
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: (failureCount, error: any) => {
      // Don't retry on canceled/deduplicated requests
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.message?.includes('deduplicated')) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

