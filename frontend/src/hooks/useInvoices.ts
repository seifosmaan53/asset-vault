import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices';
import type { CreateInvoiceDto, UpdateInvoiceDto, PagedResult } from '../api/invoices';
import type { Invoice } from '../types/invoice';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';
// Organizations removed - data is now user-scoped

// Helper to normalize query keys - ensures stable keys regardless of undefined/null values
const normalizeFilters = (filters?: { status?: string; type?: string; search?: string }) => {
  return {
    status: filters?.status || '',
    type: filters?.type || '',
    search: filters?.search || '',
  };
};

const normalizePagedParams = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}) => {
  return {
    page: params?.page || 1,
    limit: params?.limit || 100,
    status: params?.status || '',
    type: params?.type || '',
    search: params?.search || '',
  };
};

// Query key builders - user-scoped (organizations removed)
const buildListKey = (orgId: string | null, filters?: { status?: string; type?: string; search?: string }) => {
  const normalized = normalizeFilters(filters);
  // Organizations removed - query keys are now user-scoped only
  return ['invoices', 'list', normalized.status, normalized.type, normalized.search] as const;
};

const buildPagedKey = (
  orgId: string | null,
  params?: { page?: number; limit?: number; status?: string; type?: string; search?: string }
) => {
  const normalized = normalizePagedParams(params);
  // Organizations removed - query keys are now user-scoped only
  return ['invoices', 'paged', normalized.page, normalized.limit, normalized.status, normalized.type, normalized.search] as const;
};

const buildDetailKey = (orgId: string | null, id: string) => {
  // Organizations removed - query keys are now user-scoped only
  return ['invoices', id] as const;
};

const buildStatsKey = (orgId: string | null) => {
  // Organizations removed - query keys are now user-scoped only
  return ['invoices', 'stats'] as const;
};

export const useInvoices = (filters?: { status?: string; type?: string; search?: string }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  // Note: Clerk handles token management automatically via apiClient interceptor
  
  return useQuery({
    queryKey: buildListKey(null, filters),
    queryFn: () => invoicesApi.getAll(filters),
    enabled: isAuthenticated,
    staleTime: 5000, // Consider data fresh for 5 seconds to reduce unnecessary refetches
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always refetch when component mounts to get latest data
    refetchOnWindowFocus: true, // Refetch when window regains focus to catch updates from other tabs
    refetchOnReconnect: true, // Refetch when connection is restored
    // Real-time synchronization: Refetch when data is stale and page is visible
    // OPTIMIZED: Only refetch if data is actually stale and page is visible
    refetchInterval: (query) => {
      if (typeof document === 'undefined') return false;
      if (document.hidden) return false;
      // Only refetch if query is stale (not fresh)
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 5000) {
        return false; // Data is fresh, don't refetch
      }
      return 10000; // 10 seconds when stale
    },
    // CRITICAL FIX: Disable structural sharing to ensure status updates are detected immediately
    // Structural sharing can prevent React Query from detecting changes when only nested properties change
    structuralSharing: false,
    // CRITICAL FIX: Notify on all changes to ensure component re-renders when status changes
    notifyOnChangeProps: 'all',
  });
};

export const useInvoicesPaged = (
  params?: { page?: number; limit?: number } & { status?: string; type?: string; search?: string }
) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  // Note: Clerk handles token management automatically via apiClient interceptor
  
  return useQuery({
    queryKey: buildPagedKey(null, params),
    queryFn: () => invoicesApi.getPaged(params),
    enabled: isAuthenticated,
    // CRITICAL FIX: Remove placeholderData to ensure cache updates are immediately visible
    // placeholderData can prevent React Query from showing updated data
    staleTime: 5000, // Consider data fresh for 5 seconds to reduce unnecessary refetches
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always refetch when component mounts to get latest data
    // Refetch when window regains focus to catch updates from other tabs
    refetchOnWindowFocus: true,
    // Refetch when connection is restored
    refetchOnReconnect: true,
    // Real-time sync: Refetch when data is stale and page is visible
    refetchInterval: (query) => {
      if (typeof document === 'undefined') return false;
      if (document.hidden) return false;
      // Only refetch if data is stale (older than 5 seconds for list queries)
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 5000) {
        return false; // Data is fresh, don't refetch
      }
      return 10000; // 10 seconds when stale (reduced from 1s to prevent race conditions)
    },
    // CRITICAL FIX: Disable structural sharing to ensure status updates are detected immediately
    // Structural sharing can prevent React Query from detecting changes when only nested properties change
    structuralSharing: false,
    // CRITICAL FIX: Notify on all changes to ensure component re-renders when status changes
    notifyOnChangeProps: 'all',
  });
};

export const useInvoice = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  // Note: Clerk handles token management automatically via apiClient interceptor
  
  return useQuery({
    queryKey: buildDetailKey(null, id),
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id && isAuthenticated,
  });
};

export const useInvoiceStats = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  // Note: Clerk handles token management automatically via apiClient interceptor
  
  return useQuery({
    queryKey: buildStatsKey(null),
    queryFn: () => invoicesApi.getStats(),
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true, // ENHANCED: Refetch when connection is restored
    staleTime: 10000, // Consider data fresh for 10 seconds to reduce unnecessary refetches
    // ENHANCED: Real-time synchronization - refetch when data is stale and page is visible
    refetchInterval: (query) => {
      if (typeof document === 'undefined') return false;
      if (document.hidden) return false;
      // Only refetch if data is stale (older than 10 seconds)
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 10000) {
        return false; // Data is fresh, don't refetch
      }
      return 10000; // 10 seconds when stale (reduced from 500ms to prevent race conditions)
    },
    // Prevent unnecessary re-renders when data hasn't actually changed
    structuralSharing: true,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  
  return useMutation({
    mutationFn: (data: CreateInvoiceDto & { isDuplicate?: boolean }) => {
      // Extract isDuplicate flag but keep it in the data for the API call
      // The backend guard will check for it, and the service will ignore it
      const { isDuplicate } = data;
      return invoicesApi.create(data, isDuplicate);
    },
    onMutate: async (newInvoice) => {
      
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticInvoice: Invoice = {
        ...newInvoice,
        id: tempId,
        createdAt: new Date().toISOString(),
        status: 'draft', // Default status for new invoices
      } as Invoice;
      
      // Cancel all invoice queries
      await queryClient.cancelQueries({ queryKey: ['invoices'], exact: false });
      
      // Capture previous data for rollback
      const previousData: Record<string, unknown> = {};
      
      // Update list queries (array shape)
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'list'], exact: false },
        (old: unknown) => {
          if (Array.isArray(old)) {
            previousData[`list-${JSON.stringify(old)}`] = old;
            return [optimisticInvoice, ...old];
          }
          return old;
        }
      );
      
      // Update paged queries ({ data: [], meta: {} } shape)
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'paged'], exact: false },
        (old: unknown) => {
          if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
            const pagedOld = old as PagedResult<Invoice>;
            previousData[`paged-${JSON.stringify(old)}`] = old;
            return {
              ...pagedOld,
              data: [optimisticInvoice, ...pagedOld.data],
              meta: {
                ...pagedOld.meta,
                total: (pagedOld.meta?.total || 0) + 1,
              },
            };
          }
          return old;
        }
      );
      
      return { tempId, previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback optimistic updates
      if (context?.previousData) {
        // Restore previous data - simplified rollback via invalidation
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      }
    },
    onSuccess: async (newInvoice, _variables, context) => {
      
      // Replace temp invoice with real one in all caches
      const tempId = context?.tempId;
      
      // Update list queries - replace temp with real
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'list'], exact: false },
        (old: unknown) => {
          if (Array.isArray(old)) {
            return old.map((inv: Invoice) => (inv.id === tempId ? newInvoice : inv));
          }
          return old;
        }
      );
      
      // Update paged queries - replace temp with real AND add new invoice to first page if it matches filters
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'paged'], exact: false },
        (old: unknown) => {
          if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
            const pagedOld = old as PagedResult<Invoice>;
            // Check if temp invoice exists in the data
            const hasTemp = pagedOld.data.some((inv: Invoice) => inv.id === tempId);
            
            if (hasTemp) {
              // Replace temp with real
              return {
                ...pagedOld,
                data: pagedOld.data.map((inv: Invoice) => (inv.id === tempId ? newInvoice : inv)),
              };
            } else {
              // Temp not found, add new invoice to first page (if it's page 1)
              // This handles the case where the list was on a different page when invoice was created
              const isFirstPage = pagedOld.meta?.page === 1 || !pagedOld.meta?.page;
              if (isFirstPage) {
                return {
                  ...pagedOld,
                  data: [newInvoice, ...pagedOld.data],
                  meta: {
                    ...pagedOld.meta,
                    total: (pagedOld.meta?.total || 0) + 1,
                  },
                };
              }
            }
          }
          return old;
        }
      );
      
      // Update detail cache
      queryClient.setQueryData(buildDetailKey(null, newInvoice.id), newInvoice);
      
      // FIX #103: Single invalidation to prevent race conditions
      // FIX #105: Consistent query key invalidation - invalidate all invoice-related queries
      // FIX #113: Invalidate pagination cache to ensure page numbers stay in sync
      // ENHANCED: Ensure stats are invalidated for real-time dashboard updates
      // Invalidate all paginated queries to ensure page numbers are recalculated
      queryClient.invalidateQueries({ queryKey: ['invoices', 'paged'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      queryClient.invalidateQueries({ queryKey: buildStatsKey(null) }); // Use buildStatsKey for consistency
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'], exact: false }); // Also invalidate alternate key format
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      
      // Invalidate and refetch related data if needed
      if (newInvoice.items?.some((item: { inventoryItemId?: string }) => item.inventoryItemId)) {
        queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
        await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
        // Also invalidate store stocks if invoice has a store
        if (newInvoice.storeId) {
          queryClient.invalidateQueries({ queryKey: ['storeStocks'], exact: false });
          await queryClient.refetchQueries({ queryKey: ['storeStocks'], exact: false });
        }
      }
      
      if (newInvoice.storeId) {
        // Store analytics queries use ['analytics', 'stores', storeId] format
        queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', newInvoice.storeId], exact: false });
        await queryClient.refetchQueries({ queryKey: ['analytics', 'stores', newInvoice.storeId], exact: false });
      }
      
      // FIX #103: Single invalidation to prevent race conditions
      // FIX #116: Remove duplicate invalidations
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      
      // FIX #108: Invalidate clients query since invoices reference clients
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  
  return useMutation({
    mutationKey: ['invoices', 'update'],
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceDto }) => invoicesApi.update(id, data),
    onMutate: async (variables) => {
      // CRITICAL: Read old invoice BEFORE any updates
      const oldInvoice = queryClient.getQueryData<Invoice>(buildDetailKey(null, variables.id));
      
      // FIX #128: Cancel queries to prevent race conditions - ensure cancellation works
      await queryClient.cancelQueries({ queryKey: ['invoices'], exact: false });
      
      // CRITICAL FIX: Optimistic update - update UI immediately before server response
      // Always set a new updatedAt timestamp to ensure React Query detects the change
      const optimisticInvoice: Invoice | undefined = oldInvoice ? {
        ...oldInvoice,
        ...variables.data,
        // Always use current time for optimistic update to ensure change detection
        updatedAt: new Date().toISOString(),
      } as Invoice : undefined;
      
      // Optimistically update detail cache
      if (optimisticInvoice) {
        queryClient.setQueryData(buildDetailKey(null, variables.id), optimisticInvoice);
      }
      
      // Optimistically update list queries - use setQueriesData with predicate for safer access
      if (optimisticInvoice) {
        try {
          queryClient.setQueriesData(
            {
              predicate: (query) => {
                const key = query.queryKey;
                return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'list';
              },
            },
            (old: unknown) => {
              if (Array.isArray(old)) {
                const invoiceIndex = old.findIndex((inv: Invoice) => inv.id === variables.id);
                if (invoiceIndex !== -1) {
                  // Create a new array with the updated invoice to ensure React detects the change
                  return old.map((inv, idx) => {
                    if (idx === invoiceIndex) {
                      return { ...optimisticInvoice };
                    }
                    return { ...inv }; // Create new reference for each item
                  });
                }
              }
              return old;
            }
          );
        } catch (error) {
          // If queryCache is not initialized, fall back to invalidation
          logger.warn('Could not optimistically update list queries, will invalidate instead', error);
          queryClient.invalidateQueries({ queryKey: ['invoices', 'list'], exact: false });
        }
      }
      
      // Optimistically update paged queries - use setQueriesData with predicate for safer access
      if (optimisticInvoice) {
        try {
          queryClient.setQueriesData(
            {
              predicate: (query) => {
                const key = query.queryKey;
                return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'paged';
              },
            },
            (old: unknown) => {
              if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
                const pagedData = old as PagedResult<Invoice>;
                const invoiceIndex = pagedData.data.findIndex(inv => inv.id === variables.id);
                if (invoiceIndex !== -1) {
                  // Create completely new array with new invoice object
                  // Use map to ensure every element is a new reference
                  const updatedData = pagedData.data.map((inv, idx) => {
                    if (idx === invoiceIndex) {
                      // Create completely new object - this is critical for change detection
                      return { ...optimisticInvoice };
                    }
                    // Return new reference for each item to ensure React Query detects the array change
                    return { ...inv };
                  });
                  
                  // Create completely new PagedResult object with new array
                  return {
                    ...pagedData,
                    data: updatedData,
                    meta: { ...pagedData.meta },
                  };
                }
              }
              return old;
            }
          );
        } catch (error) {
          // If queryCache is not initialized, fall back to invalidation
          logger.warn('Could not optimistically update paged queries, will invalidate instead', error);
          queryClient.invalidateQueries({ queryKey: ['invoices', 'paged'], exact: false });
        }
      }
      
      // FIX #106, #107: Store old invoice for conflict detection and rollback
      return { oldInvoice, optimisticInvoice, timestamp: Date.now() };
    },
    // FIX #138: Handle 409 Conflict - revert optimistic update
    onError: (error: unknown, variables, context) => {
      // FIX #104: Rollback optimistic update on error - restore old invoice
      if (context?.oldInvoice) {
        queryClient.setQueryData(buildDetailKey(null, variables.id), context.oldInvoice);
      }
      
      // Rollback list queries - create new array reference for change detection
      if (context?.oldInvoice) {
        queryClient.setQueriesData(
          { queryKey: ['invoices', 'list'], exact: false },
          (old: unknown) => {
            if (Array.isArray(old)) {
              const invoiceIndex = old.findIndex((inv: Invoice) => inv.id === variables.id);
              if (invoiceIndex === -1) return old;
              
              const updatedList = [...old];
              updatedList[invoiceIndex] = { ...context.oldInvoice };
              return updatedList;
            }
            return old;
          }
        );
      }
      
      // Rollback paged queries - create new array reference for change detection
      if (context?.oldInvoice) {
        queryClient.setQueriesData(
          { 
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'paged';
            }
          },
          (old: unknown) => {
            if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
              const pagedOld = old as PagedResult<Invoice>;
              const invoiceIndex = pagedOld.data.findIndex((inv: Invoice) => inv.id === variables.id);
              if (invoiceIndex === -1) return old;
              
              const updatedData = [...pagedOld.data];
              updatedData[invoiceIndex] = { ...context.oldInvoice };
              
              return {
                ...pagedOld,
                data: updatedData,
              };
            }
            return old;
          }
        );
      }
      
      // FIX #138: If 409 Conflict, invalidate to force refetch
      if (error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      }
    },
    onSuccess: async (updatedInvoice, variables, context) => {
      // FIX #106, #107: Check for conflicts if oldInvoice exists and show warning
      if (context?.oldInvoice && updatedInvoice.updatedAt) {
        const oldTimestamp = new Date(context.oldInvoice.updatedAt).getTime();
        const newTimestamp = new Date(updatedInvoice.updatedAt).getTime();
        // If server timestamp is significantly older than what we had, there might be a conflict
        // This indicates the invoice was modified by another user after we loaded it
        if (newTimestamp < oldTimestamp - 2000) { // 2 second tolerance for network delays
          logger.warn('Possible conflict detected: Invoice was modified by another user', {
            localTimestamp: context.oldInvoice.updatedAt,
            serverTimestamp: updatedInvoice.updatedAt,
          });
          // Note: User will see the updated data, which is correct behavior
          // The conflict is resolved by accepting the server's version (last write wins)
        }
      }
      
      // CRITICAL FIX: Update detail cache first
      queryClient.setQueryData(buildDetailKey(null, variables.id), updatedInvoice);
      
      // CRITICAL FIX: Update list cache directly (not just invalidate) so inactive queries get updated data
      // This ensures when user navigates back to list, they see the updated invoice immediately
      // Also ensures Dashboard updates immediately when invoice status changes
      // Use setQueriesData with predicate for safer access (avoids queryCache initialization issues)
      try {
        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'list';
            },
          },
          (old: unknown) => {
            if (Array.isArray(old)) {
              const invoiceIndex = old.findIndex((inv: Invoice) => inv.id === variables.id);
              if (invoiceIndex !== -1) {
                // Create a new array with the updated invoice to ensure React detects the change
                return old.map((inv, idx) => {
                  if (idx === invoiceIndex) {
                    return { ...updatedInvoice };
                  }
                  return { ...inv }; // Create new reference for each item
                });
              }
            }
            return old;
          }
        );
      } catch (error) {
        logger.warn('Could not update list queries, will invalidate instead', error);
        queryClient.invalidateQueries({ queryKey: ['invoices', 'list'], exact: false });
      }
      
      // CRITICAL FIX: Update paged queries cache directly with completely new object references
      // This MUST happen synchronously and create new references for React Query to detect changes
      // Use setQueriesData with predicate for safer access (avoids queryCache initialization issues)
      try {
        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'paged';
            },
          },
          (old: unknown) => {
            if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
              const pagedData = old as PagedResult<Invoice>;
              const invoiceIndex = pagedData.data.findIndex(inv => inv.id === variables.id);
              if (invoiceIndex !== -1) {
                // Create completely new array with new invoice object
                // Use map to ensure every element is a new reference
                const updatedData = pagedData.data.map((inv, idx) => {
                  if (idx === invoiceIndex) {
                    return { ...updatedInvoice };
                  }
                  return { ...inv };
                });
                
                // Create completely new PagedResult object with new array
                return {
                  ...pagedData,
                  data: updatedData,
                  meta: { ...pagedData.meta },
                };
              }
            }
            return old;
          }
        );
      } catch (error) {
        logger.warn('Could not update paged queries, will invalidate instead', error);
        queryClient.invalidateQueries({ queryKey: ['invoices', 'paged'], exact: false });
      }
      
      // Get paged queries count for logging (only if queryCache is available)
      let updatedCount = 0;
      try {
        const queryCache = queryClient.getQueryCache();
        const pagedQueries = queryCache.findAll({
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key[0] === 'invoices' && key[1] === 'paged';
          },
        });
        updatedCount = pagedQueries.length;
        // Log for debugging (can be removed in production)
        if (updatedCount > 0) {
          logger.debug(`Updated ${updatedCount} paged query cache entries for invoice ${variables.id}`);
        }
      } catch (error) {
        // queryCache not available, skip logging
      }
      
      // CRITICAL FIX: Invalidate all invoice queries to ensure Dashboard and other components update
      // This ensures that even if cache update didn't trigger a re-render, the query will be marked stale
      // and will refetch when the component becomes active
      queryClient.invalidateQueries({ 
        queryKey: ['invoices'], 
        exact: false,
      });
      
      // Also invalidate stats to ensure Dashboard stats card updates
      queryClient.invalidateQueries({ queryKey: buildStatsKey(null) });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'], exact: false });
      
      // Invalidate related queries (stats, analytics, clients)
      queryClient.invalidateQueries({ queryKey: buildStatsKey(null) });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      
      // Handle inventory invalidation if needed
      if (updatedInvoice.items?.some((item) => item.inventoryItemId)) {
        queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
        await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
        // Also invalidate store stocks if invoice has a store
        if (updatedInvoice.storeId) {
          queryClient.invalidateQueries({ queryKey: ['storeStocks'], exact: false });
          await queryClient.refetchQueries({ queryKey: ['storeStocks'], exact: false });
        }
      }
      
      // Handle store invalidation - use OLD invoice from context (read before update)
      const oldInvoice = context?.oldInvoice;
      const storeIds = new Set<string>();
      if (oldInvoice?.storeId) storeIds.add(oldInvoice.storeId);
      if (updatedInvoice.storeId) storeIds.add(updatedInvoice.storeId);
      
      for (const storeId of storeIds) {
        // Store analytics queries use ['analytics', 'stores', storeId] format
        queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', storeId], exact: false });
        await queryClient.refetchQueries({ queryKey: ['analytics', 'stores', storeId], exact: false });
      }
      
      // Invalidate clients query since invoices reference clients and client stats may change
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['clients'], exact: false });
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  
  return useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onMutate: async (id) => {
      // Read invoice data before deletion for cleanup
      const invoiceToDelete = queryClient.getQueryData<Invoice>(buildDetailKey(null, id));
      
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['invoices'], exact: false });
      
      // Capture previous data for rollback
      const previousData: Record<string, unknown> = {};
      
      // Optimistically remove from list queries (array shape)
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'list'], exact: false },
        (old: unknown) => {
          if (Array.isArray(old)) {
            previousData[`list-${JSON.stringify(old)}`] = old;
            return old.filter((inv: Invoice) => inv.id !== id);
          }
          return old;
        }
      );
      
      // Optimistically remove from paged queries ({ data: [], meta: {} } shape)
      queryClient.setQueriesData(
        { queryKey: ['invoices', 'paged'], exact: false },
        (old: unknown) => {
          if (old && typeof old === 'object' && 'data' in old && Array.isArray((old as PagedResult<Invoice>).data)) {
            const pagedOld = old as PagedResult<Invoice>;
            previousData[`paged-${JSON.stringify(old)}`] = old;
            return {
              ...pagedOld,
              data: pagedOld.data.filter((inv: Invoice) => inv.id !== id),
              meta: {
                ...pagedOld.meta,
                total: Math.max(0, (pagedOld.meta?.total || 0) - 1),
              },
            };
          }
          return old;
        }
      );
      
      return { invoiceToDelete, previousData };
    },
    onError: (_error, _id, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      }
    },
    onSuccess: async (_data, id, context) => {
      // Remove detail cache
      queryClient.removeQueries({ queryKey: buildDetailKey(null, id) });
      
      // ENHANCED: Invalidate stats for real-time dashboard updates
      queryClient.invalidateQueries({ queryKey: buildStatsKey(null) }); // Use buildStatsKey for consistency
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'], exact: false }); // Also invalidate alternate key format
      
      // Handle cleanup for related data
      const invoiceToDelete = context?.invoiceToDelete;
      
      if (invoiceToDelete?.items?.some((item) => item.inventoryItemId)) {
        queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
        await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
        // Also invalidate store stocks if deleted invoice had a store
        if (invoiceToDelete.storeId) {
          queryClient.invalidateQueries({ queryKey: ['storeStocks'], exact: false });
          await queryClient.refetchQueries({ queryKey: ['storeStocks'], exact: false });
        }
      }
      
      if (invoiceToDelete?.storeId) {
        // Store analytics queries use ['analytics', 'stores', storeId] format
        queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', invoiceToDelete.storeId], exact: false });
        queryClient.refetchQueries({ queryKey: ['analytics', 'stores', invoiceToDelete.storeId], exact: false });
      }
      
      // Invalidate AND refetch analytics queries
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
      
      // Invalidate clients query since invoices reference clients and client stats may change
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
    },
  });
};
