import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '../api/store';
import type { CreateStoreDto, UpdateStoreDto } from '../api/store';
import { useAuthStore } from '../store/authStore';

export const useStores = (activeOnly?: boolean) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['stores', activeOnly],
    queryFn: () => storeApi.getAll(activeOnly),
    enabled: isAuthenticated,
    // Keep data fresh but don't refetch too aggressively
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

export const useStore = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['stores', id],
    queryFn: () => storeApi.getById(id),
    enabled: !!id && isAuthenticated,
  });
};

export const useCreateStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStoreDto) => storeApi.create(data),
    // Fix Missing Error Handler: Add optimistic update with rollback
    onMutate: async (newStore) => {
      await queryClient.cancelQueries({ queryKey: ['stores'] });
      const previousStores = queryClient.getQueryData(['stores']);
      
      const optimisticStore = {
        ...newStore,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      
      queryClient.setQueryData(['stores'], (old: unknown) => {
        if (!Array.isArray(old)) return [optimisticStore];
        return [optimisticStore, ...old];
      });
      
      return { previousStores };
    },
    onSuccess: async (newStore) => {
      // Update the specific store in cache
      queryClient.setQueryData(['stores', newStore.id], newStore);
      
      // Replace temp store with real one
      queryClient.setQueryData(['stores'], (old: unknown) => {
        if (!Array.isArray(old)) return [newStore];
        return old.map((store: { id?: string }) => 
          store.id?.startsWith('temp-') ? newStore : store
        );
      });
      
      // Use setQueriesData with pattern matching to update ALL stores queries
      queryClient.setQueriesData(
        { queryKey: ['stores'], exact: false },
        (old: unknown) => {
          if (!Array.isArray(old)) return [newStore];
          return old.map((store: { id?: string }) => 
            store.id?.startsWith('temp-') ? newStore : store
          );
        }
      );
      
      // CRITICAL: Refetch stores queries to ensure data is persisted and fresh
      await queryClient.refetchQueries({ queryKey: ['stores'], exact: false });
      
      // Invalidate client queries since stores are associated with clients
      // This ensures client detail pages show updated stores list
      if (newStore.clientId) {
        queryClient.invalidateQueries({ queryKey: ['clients', newStore.clientId], exact: false });
        queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      }
      
      // Mark analytics as stale (they depend on store data)
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, _newStore, context) => {
      if (context?.previousStores) {
        queryClient.setQueryData(['stores'], context.previousStores);
      }
    },
  });
};

export const useUpdateStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStoreDto }) =>
      storeApi.update(id, data),
    // Fix Missing Error Handler: Add optimistic update with rollback
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['stores'] });
      
      // Snapshot the previous values for rollback
      const previousStore = queryClient.getQueryData(['stores', id]);
      const previousStoresUndefined = queryClient.getQueryData(['stores', undefined]);
      const previousStoresActiveOnly = queryClient.getQueryData(['stores', true]);
      const previousStoresInactiveOnly = queryClient.getQueryData(['stores', false]);
      
      // Helper function to update stores in cache
      const updateStoresCache = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        // Always return a new array to ensure React detects the change
        const updated = old.map((store: { id?: string }) => {
          if (store.id === id) {
            // Create a completely new object to ensure React detects the change
            const updatedStore = { ...store };
            // Apply all data updates
            Object.assign(updatedStore, data);
            // active is always true - removed from form
            updatedStore.active = true;
            return updatedStore;
          }
          // Return store as-is (but still in new array)
          return store;
        });
        return updated;
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to update ALL stores queries
      // This ensures we catch ['stores'], ['stores', undefined], ['stores', true], ['stores', false]
      // React Query serializes query keys, so ['stores', undefined] might be stored as ['stores']
      queryClient.setQueriesData(
        { queryKey: ['stores'], exact: false },
        updateStoresCache
      );
      
      // Also update the individual store cache if it exists
      if (previousStore) {
        queryClient.setQueryData(['stores', id], (old: unknown) => {
          if (!old || typeof old !== 'object') return { ...data };
          return {
            ...(old as Record<string, unknown>),
            ...data,
          };
        });
      }
      
      return { 
        previousStore, 
        previousStores: previousStoresUndefined,
        previousStoresActiveOnly,
        previousStoresInactiveOnly,
      };
    },
    onSuccess: async (updatedStore, variables) => {
      // Update the specific store in cache immediately with server response
      queryClient.setQueryData(['stores', variables.id], updatedStore);
      
      // Helper function to update stores in cache with server response
      const updateStoresCacheWithResponse = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((store: { id?: string; active?: boolean }) => 
          store.id === variables.id ? { ...updatedStore, active: updatedStore.active } : store
        );
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to update ALL stores queries
      // This ensures we catch all query variants: ['stores'], ['stores', undefined], ['stores', true], ['stores', false]
      queryClient.setQueriesData(
        { queryKey: ['stores'], exact: false },
        updateStoresCacheWithResponse
      );
      
      // CRITICAL: Refetch stores queries to ensure data is persisted and fresh
      await queryClient.refetchQueries({ queryKey: ['stores'], exact: false });
      
      // Mark analytics and invoices as stale (they depend on store status)
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, variables, context) => {
      if (context?.previousStore) {
        queryClient.setQueryData(['stores', variables.id], context.previousStore);
      }
      if (context?.previousStores) {
        queryClient.setQueryData(['stores', undefined], context.previousStores);
      }
      if (context?.previousStoresActiveOnly) {
        queryClient.setQueryData(['stores', true], context.previousStoresActiveOnly);
      }
      if (context?.previousStoresInactiveOnly) {
        queryClient.setQueryData(['stores', false], context.previousStoresInactiveOnly);
      }
    },
  });
};

export const useDeleteStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storeApi.delete(id),
    // Fix Missing Error Handler: Add optimistic update with rollback
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['stores'] });
      
      // Snapshot the previous values for rollback
      const previousStore = queryClient.getQueryData(['stores', id]);
      const previousStoresUndefined = queryClient.getQueryData(['stores', undefined]);
      const previousStoresActiveOnly = queryClient.getQueryData(['stores', true]);
      const previousStoresInactiveOnly = queryClient.getQueryData(['stores', false]);
      
      // Helper function to remove store from cache
      const removeStoreFromCache = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        // Always return a new array to ensure React detects the change
        return old.filter((store: { id?: string }) => store.id !== id);
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to update ALL stores queries
      // This ensures we catch all query variants: ['stores'], ['stores', undefined], ['stores', true], ['stores', false]
      queryClient.setQueriesData(
        { queryKey: ['stores'], exact: false },
        removeStoreFromCache
      );
      
      // Remove the individual store cache
      queryClient.removeQueries({ queryKey: ['stores', id] });
      
      return { 
        previousStore,
        previousStores: previousStoresUndefined,
        previousStoresActiveOnly,
        previousStoresInactiveOnly,
      };
    },
    onSuccess: (_, id) => {
      // Remove the deleted store from cache (already done in onMutate, but ensure it's gone)
      queryClient.removeQueries({ queryKey: ['stores', id] });
      
      // Helper function to ensure store is removed from all queries
      const ensureStoreRemoved = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((store: { id?: string }) => store.id !== id);
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to ensure store is removed from ALL stores queries
      queryClient.setQueriesData(
        { queryKey: ['stores'], exact: false },
        ensureStoreRemoved
      );
      
      // Mark analytics and invoices as stale (they depend on store data)
      // But DON'T invalidate stores queries - we've already updated them
      // Invalidating would mark them as stale and potentially trigger unwanted refetches
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      
      // The stores cache is already updated - no need to refetch
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, id, context) => {
      if (context?.previousStore) {
        queryClient.setQueryData(['stores', id], context.previousStore);
      }
      if (context?.previousStores) {
        queryClient.setQueryData(['stores', undefined], context.previousStores);
      }
      if (context?.previousStoresActiveOnly) {
        queryClient.setQueryData(['stores', true], context.previousStoresActiveOnly);
      }
      if (context?.previousStoresInactiveOnly) {
        queryClient.setQueryData(['stores', false], context.previousStoresInactiveOnly);
      }
    },
  });
};

