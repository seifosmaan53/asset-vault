import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  inventoryApi,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateStockMovementDto,
} from '../api/inventory';

export const useInventory = (filters?: {
  search?: string;
  category?: string;
  status?: string;
  lowStockOnly?: boolean;
}) => {
  return useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => inventoryApi.getAll(filters),
  });
};

export const useInventoryItem = (id: string) => {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: () => inventoryApi.getById(id),
    enabled: !!id,
  });
};

export const useInventoryStats = () => {
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: () => inventoryApi.getStats(),
  });
};

export const useLowStock = () => {
  return useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
  });
};

export const useStockMovements = (id: string) => {
  return useQuery({
    queryKey: ['inventory', id, 'movements'],
    queryFn: () => inventoryApi.getMovements(id),
    enabled: !!id,
  });
};

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryItemDto) => inventoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'low-stock'] });
    },
  });
};

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
      inventoryApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'low-stock'] });
    },
  });
};

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
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
  return useQuery({
    queryKey: ['inventory', id, 'invoices'],
    queryFn: () => inventoryApi.getLinkedInvoices(id),
    enabled: !!id,
  });
};

