import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../api/clients';
import type { CreateClientDto, UpdateClientDto } from '../api/clients';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

export const useClients = (filters?: {
  search?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      const clients = await clientsApi.getAll(filters);
      // Edge case: Ensure we always return an array
      if (!Array.isArray(clients)) {
        logger.warn('useClients: API returned non-array data', clients);
        return [];
      }
      logger.debug(`[useClients] Fetched ${clients.length} clients`);
      return clients;
    },
    enabled: isAuthenticated,
    // Enhanced reactivity: refetch when window regains focus or component remounts
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Consider data stale after 30 seconds to ensure fresh data
    staleTime: 30000,
    // Refetch interval for real-time updates (only when page is visible)
    // WARNING: 0.1 second refresh is very aggressive. Consider using WebSocket/SSE for production.
    refetchInterval: (query) => {
      // Edge case: Check if document exists (SSR safety)
      if (typeof document === 'undefined') return false;
      // Only refetch if page is visible
      if (document.hidden) return false;
      // Only refetch if data is stale (older than 5 seconds)
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 5000) {
        return false; // Data is fresh, don't refetch
      }
      return 100; // 0.1 seconds (100ms) - real-time synchronization
    },
    // Prevent unnecessary re-renders when data hasn't actually changed
    structuralSharing: true,
    // Edge case: Retry configuration
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useClient = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Edge case: Validate ID
  const isValidId = id && typeof id === 'string' && id.trim() !== '';
  
  // Edge case: Ensure enabled is always a boolean
  const enabled = Boolean(isValidId && isAuthenticated);
  
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      try {
        const client = await clientsApi.getById(id);
        // Edge case: Validate client data
        if (!client || !client.id) {
          throw new Error('Invalid client data received');
        }
        return client;
      } catch (error) {
        logger.error('useClient: Error fetching client', { id, error });
        throw error;
      }
    },
    enabled: enabled,
    // Edge case: Retry configuration
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateClientDto) => {
      // Edge case: Validate data before sending
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid client data');
      }
      if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        throw new Error('Client name is required');
      }
      
      try {
        return await clientsApi.create(data);
      } catch (error) {
        logger.error('useCreateClient: Error creating client', error);
        throw error;
      }
    },
    // Issue #40: Optimistic updates
    onMutate: async (newClient) => {
      try {
        await queryClient.cancelQueries({ queryKey: ['clients'] });
        const previousClients = queryClient.getQueryData(['clients']);
        
        // Edge case: Ensure we have valid data before optimistic update
        if (!newClient || !newClient.name) {
          return { previousClients };
        }
        
        queryClient.setQueryData(['clients'], (old: unknown) => {
          const optimisticClient = {
            ...newClient,
            id: `temp-${Date.now()}-${Math.random()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          // Edge case: Handle null/undefined/empty array
          if (!Array.isArray(old)) return [optimisticClient];
          return [optimisticClient, ...old];
        });
        
        return { previousClients };
      } catch (error) {
        // Edge case: If optimistic update fails, continue anyway
        logger.error('useCreateClient: Error in optimistic update', error);
        return { previousClients: null };
      }
    },
    onSuccess: async (newClient) => {
      try {
        // Edge case: Validate newClient before updating cache
        if (!newClient || !newClient.id) {
          logger.warn('useCreateClient: Invalid client data received', newClient);
          return;
        }
        
        // Update cache with server response
        // Fix Bug #9: Add null/array check before mapping
        queryClient.setQueryData(['clients'], (old: unknown) => {
          if (!Array.isArray(old)) return [newClient];
          return old.map((client: { id?: string }) => 
            client.id?.startsWith('temp-') ? newClient : client
          );
        });
        // Also update the specific client in cache
        queryClient.setQueryData(['clients', newClient.id], newClient);
        
        // CRITICAL: Refetch clients queries to ensure data is persisted and fresh
        await queryClient.refetchQueries({ queryKey: ['clients'], exact: false });
        
        // Invalidate AND refetch analytics that depend on clients (top clients, revenue by client)
        queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
        await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
      } catch (error) {
        // Edge case: If cache update fails, log but don't throw
        logger.error('useCreateClient: Error updating cache', error);
      }
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, _newClient, context) => {
      try {
        if (context?.previousClients) {
          queryClient.setQueryData(['clients'], context.previousClients);
        }
      } catch (error) {
        // Edge case: If rollback fails, invalidate queries instead
        logger.error('useCreateClient: Error rolling back', error);
        queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      }
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClientDto }) => {
      // Edge case: Validate ID and data
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Invalid client ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid client data');
      }
      // Edge case: If name is provided, ensure it's valid
      if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
        throw new Error('Client name cannot be empty');
      }
      
      try {
        return await clientsApi.update(id, data);
      } catch (error) {
        logger.error('useUpdateClient: Error updating client', { id, error });
        throw error;
      }
    },
    // Fix Missing Error Handler: Add optimistic update with rollback
    onMutate: async ({ id, data }) => {
      try {
        await queryClient.cancelQueries({ queryKey: ['clients', id] });
        const previousClient = queryClient.getQueryData(['clients', id]);
        const previousClients = queryClient.getQueryData(['clients']);
        
        // Edge case: Only update if we have valid data
        if (!id || !data) {
          return { previousClient, previousClients };
        }
        
        // FIX #117: Don't set updatedAt in optimistic update - let server set it
        // Server timestamp will be used when response arrives, preventing timestamp mismatches
        queryClient.setQueryData(['clients', id], (old: unknown) => {
          if (!old || typeof old !== 'object') return old;
          return { ...(old as Record<string, unknown>), ...data };
        });
        
        queryClient.setQueryData(['clients'], (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((client: { id?: string }) => 
            client.id === id ? { ...client, ...data } : client
          );
        });
        
        return { previousClient, previousClients };
      } catch (error) {
        // Edge case: If optimistic update fails, continue anyway
        logger.error('useUpdateClient: Error in optimistic update', error);
        return { previousClient: null, previousClients: null };
      }
    },
    onSuccess: async (updatedClient, variables) => {
      try {
        // Edge case: Validate updatedClient before updating cache
        if (!updatedClient || !updatedClient.id) {
          logger.warn('useUpdateClient: Invalid client data received', updatedClient);
          return;
        }
        
        // Update the specific client in cache immediately
        queryClient.setQueryData(['clients', variables.id], updatedClient);
        
        // Update clients list cache
        queryClient.setQueryData(['clients'], (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((client: { id?: string }) => 
            client.id === variables.id ? updatedClient : client
          );
        });
        
        // FIX #108: Invalidate invoice queries when client is updated (invoices reference clients)
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
        
        // Use setQueriesData with pattern matching to update ALL clients queries
        queryClient.setQueriesData(
          { queryKey: ['clients'], exact: false },
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            return old.map((client: { id?: string }) => 
              client.id === variables.id ? updatedClient : client
            );
          }
        );
        
        // CRITICAL: Refetch clients queries to ensure data is persisted and fresh
        await queryClient.refetchQueries({ queryKey: ['clients'], exact: false });
        
        // Mark analytics and invoices as stale (they depend on client data)
        queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
        await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
      } catch (error) {
        // Edge case: If cache update fails, log but don't throw
        logger.error('useUpdateClient: Error updating cache', error);
      }
    },
    // Fix Missing Error Handler: Rollback optimistic update on error
    onError: (err, variables, context) => {
      try {
        if (context?.previousClient) {
          queryClient.setQueryData(['clients', variables.id], context.previousClient);
        }
        if (context?.previousClients) {
          queryClient.setQueryData(['clients'], context.previousClients);
        }
      } catch (error) {
        // Edge case: If rollback fails, invalidate queries instead
        logger.error('useUpdateClient: Error rolling back', error);
        queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      }
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onMutate: async (id: string) => {
      // Optimistically remove from cache immediately
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previousClients = queryClient.getQueryData(['clients']);
      
      // Remove the client from cache immediately - this is the source of truth
      queryClient.setQueryData(['clients'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((client: { id?: string }) => client.id !== id);
      });
      
      return { previousClients, deletedId: id };
    },
    onError: (_error, _id, context) => {
      // Rollback on error
      if (context?.previousClients) {
        queryClient.setQueryData(['clients'], context.previousClients);
      }
    },
    onSuccess: async (_data, id) => {
      // Helper function to ensure client is removed from all queries
      const ensureClientRemoved = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((client: { id?: string }) => client.id !== id);
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to ensure client is removed from ALL clients queries
      queryClient.setQueriesData(
        { queryKey: ['clients'], exact: false },
        ensureClientRemoved
      );
      
      // Remove the individual client cache
      queryClient.removeQueries({ queryKey: ['clients', id] });
      
      // Mark analytics as stale (they depend on client data)
      // But DON'T invalidate clients queries - we've already updated them
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      
      // The clients cache is already updated - no need to refetch
    },
  });
};

export const useBulkDeleteClients = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => clientsApi.bulkDelete(ids),
    onMutate: async (ids: string[]) => {
      // Optimistically remove from cache immediately
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previousClients = queryClient.getQueryData(['clients']);
      
      // Remove the clients from cache immediately
      queryClient.setQueryData(['clients'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((client: { id?: string }) => !ids.includes(client.id || ''));
      });
      
      return { previousClients, deletedIds: ids };
    },
    onError: (_error, _ids, context) => {
      // Rollback on error
      if (context?.previousClients) {
        queryClient.setQueryData(['clients'], context.previousClients);
      }
    },
    onSuccess: async (result, ids) => {
      // Remove successfully deleted clients from cache
      const deletedIds = ids.filter(id => 
        !result.failed.some(f => f.id === id)
      );
      
      // Helper function to ensure clients are removed from all queries
      const ensureClientsRemoved = (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((client: { id?: string }) => !deletedIds.includes(client.id || ''));
      };
      
      // CRITICAL: Use setQueriesData with pattern matching to ensure clients are removed from ALL clients queries
      queryClient.setQueriesData(
        { queryKey: ['clients'], exact: false },
        ensureClientsRemoved
      );
      
      // Remove the individual client caches
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: ['clients', id] });
      });
      
      // Mark analytics as stale
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
    },
  });
};