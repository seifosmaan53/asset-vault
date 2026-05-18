import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../api/inventory';
import type {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateStockMovementDto,
} from '../api/inventory';
import { useAuthStore } from '../store/authStore';
// Organizations removed - data is now user-scoped

export const useInventory = (filters?: {
  search?: string;
  category?: string;
  status?: string;
  lowStockOnly?: boolean;
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => inventoryApi.getAll(filters),
    enabled: isAuthenticated,
    staleTime: 5000, // Consider data fresh for 5 seconds to reduce unnecessary refetches
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Real-time synchronization: Refetch every 0.1 seconds when page is visible and data is stale
    refetchInterval: (query) => {
      if (typeof document === 'undefined') return false;
      if (document.hidden) return false;
      // Only refetch if data is stale (older than 5 seconds)
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 5000) {
        return false; // Data is fresh, don't refetch
      }
      return 100; // 0.1 seconds (100ms)
    },
    // Prevent unnecessary re-renders when data hasn't actually changed
    structuralSharing: true,
  });
};

export const useInventoryItem = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: () => inventoryApi.getById(id),
    enabled: !!id && isAuthenticated,
  });
};

export const useInventoryStats = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: () => inventoryApi.getStats(),
    enabled: isAuthenticated,
  });
};

export const useLowStock = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  // Note: Clerk handles token management automatically via apiClient interceptor
  return useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
    enabled: isAuthenticated,
  });
};

export const useStockMovements = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['inventory', id, 'movements'],
    queryFn: () => inventoryApi.getMovements(id),
    enabled: !!id && isAuthenticated,
  });
};

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  return useMutation({
    mutationFn: (data: CreateInventoryItemDto) => inventoryApi.create(data),
    // FIX #150: Optimistic updates applied immediately
    // FIX #152: Loading state is set automatically by React Query (isPending)
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      
      // FIX #150: Apply optimistic update immediately
      queryClient.setQueryData(['inventory'], (old: unknown) => {
        const optimisticItem = {
          ...newItem,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return old ? [optimisticItem, ...old] : [optimisticItem];
      });
      
      return { previousInventory };
    },
    onSuccess: async (newItem) => {
      // Update cache with server response
      // Fix Bug #8: Add null/array check before mapping
      queryClient.setQueryData(['inventory'], (old: unknown) => {
        if (!Array.isArray(old)) return [newItem];
        return old.map((item: { id?: string }) => 
          item.id?.startsWith('temp-') ? newItem : item
        );
      });
      // Also update the specific item in cache
      queryClient.setQueryData(['inventory', newItem.id], newItem);
      
      // CRITICAL: Refetch inventory queries to ensure data is persisted and fresh
      await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
      
      // Invalidate AND refetch analytics
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
    // Issue #40: Rollback on error
    onError: (error, variables, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(['inventory'], context.previousInventory);
      }
    },
  });
};

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
      inventoryApi.update(id, data),
    // Fix Missing Error Handler: Add optimistic update with rollback
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['inventory', id] });
      const previousItem = queryClient.getQueryData(['inventory', id]);
      const previousInventory = queryClient.getQueryData(['inventory']);
      
      // Optimistically update
      queryClient.setQueryData(['inventory', id], (old: unknown) => {
        if (!old || typeof old !== 'object') return { ...data };
        return {
          ...(old as Record<string, unknown>),
          ...data,
        };
      });
      
      queryClient.setQueryData(['inventory'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: { id?: string }) => 
          item.id === id ? { ...item, ...data } : item
        );
      });
      
      return { previousItem, previousInventory };
    },
    onSuccess: async (updatedItem, variables) => {
      // Update the specific item in cache immediately
      queryClient.setQueryData(['inventory', variables.id], updatedItem);
      
      // Update inventory list cache
      queryClient.setQueryData(['inventory'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: { id?: string }) => 
          item.id === variables.id ? updatedItem : item
        );
      });
      
      // Use setQueriesData with pattern matching to update ALL inventory queries
      queryClient.setQueriesData(
        { queryKey: ['inventory'], exact: false },
        (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: { id?: string }) => 
            item.id === variables.id ? updatedItem : item
          );
        }
      );
      
      // CRITICAL: Refetch inventory queries to ensure data is persisted and fresh
      await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
      
      // Mark related queries as stale (they depend on inventory data)
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['storeStock'] });
      queryClient.invalidateQueries({ queryKey: ['storeStocks'] });
      
      // FIX #116: Remove duplicate invalidations - single invalidation is sufficient
      // FIX #103: Single invalidation to prevent race conditions
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, variables, context) => {
      if (context?.previousItem) {
        queryClient.setQueryData(['inventory', variables.id], context.previousItem);
      }
      if (context?.previousInventory) {
        queryClient.setQueryData(['inventory'], context.previousInventory);
      }
    },
  });
};

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    // FIX #139: Handle concurrent deletes - check if item exists before deleting
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      
      // Snapshot previous value
      const previousInventory = queryClient.getQueryData(['inventory']);
      const previousItem = queryClient.getQueryData(['inventory', id]);
      
      // FIX #139: Check if item exists before optimistically removing
      if (!previousItem && !previousInventory) {
        // Item doesn't exist in cache, might have been deleted already
        throw new Error('Item not found - may have been deleted');
      }
      
      // Optimistically update
      // Fix Bug #8: Proper type checking for array operations
      queryClient.setQueriesData({ queryKey: ['inventory'] }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: { id?: string }) => item.id !== id);
      });
      
      return { previousInventory, previousItem };
    },
    // FIX #151: Clear error state on retry - error is cleared automatically by React Query
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousInventory) {
        queryClient.setQueryData(['inventory'], context.previousInventory);
      }
      if (context?.previousItem) {
        queryClient.setQueryData(['inventory', id], context.previousItem);
      }
    },
    onSuccess: (_, id) => {
      // Remove the deleted item from cache
      queryClient.removeQueries({ queryKey: ['inventory', id] });
      
      // FIX #116: Remove duplicate invalidations - single invalidation is sufficient
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      
      // Invalidate AND refetch analytics - use both org-scoped and global patterns
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
  });
};

export const useBulkDeleteInventoryItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => inventoryApi.bulkDelete(ids),
    onMutate: async (ids: string[]) => {
      // Optimistically remove from cache immediately
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      
      // Remove the items from cache immediately
      queryClient.setQueryData(['inventory'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: { id?: string }) => !ids.includes(item.id || ''));
      });
      
      return { previousInventory, deletedIds: ids };
    },
    onError: (_error, _ids, context) => {
      // Rollback on error
      if (context?.previousInventory) {
        queryClient.setQueryData(['inventory'], context.previousInventory);
      }
    },
    onSuccess: async (result, ids) => {
      // Remove successfully deleted items from cache
      const deletedIds = ids.filter(id => 
        !result.failed.some(f => f.id === id)
      );
      
      // Helper function to ensure items are removed from all queries
      const ensureItemsRemoved = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: { id?: string }) => !deletedIds.includes(item.id || ''));
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to ensure items are removed from ALL inventory queries
      queryClient.setQueriesData(
        { queryKey: ['inventory'], exact: false },
        ensureItemsRemoved
      );
      
      // Remove the individual item caches
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: ['inventory', id] });
      });
      
      // Invalidate analytics
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
  });
};

export const useCreateStockMovement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateStockMovementDto }) =>
      inventoryApi.createMovement(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.id, 'movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'low-stock'] });
    },
  });
};

export const useLinkedInvoices = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Organizations removed - data is now user-scoped
  return useQuery({
    queryKey: ['inventory', id, 'invoices'],
    queryFn: () => inventoryApi.getLinkedInvoices(id),
    enabled: !!id && isAuthenticated,
  });
};

