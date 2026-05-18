import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeItemSettingsApi } from '../api/storeItemSettings';
import type {
  CreateStoreItemSettingsDto,
  UpdateStoreItemSettingsDto,
} from '../api/storeItemSettings';
import { useAuthStore } from '../store/authStore';

export const useStoreItemSettingsByStore = (storeId: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['store-item-settings', 'store', storeId],
    queryFn: () => storeItemSettingsApi.getByStore(storeId),
    enabled: !!storeId && isAuthenticated,
  });
};

export const useStoreItemSettingsByItem = (itemId: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['store-item-settings', 'item', itemId],
    queryFn: () => storeItemSettingsApi.getByItem(itemId),
    enabled: !!itemId && isAuthenticated,
  });
};

export const useCreateOrUpdateStoreItemSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStoreItemSettingsDto) =>
      storeItemSettingsApi.createOrUpdate(data),
    onSuccess: async (_, variables) => {
      // CRITICAL: Refetch queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', variables.storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', variables.inventoryItemId] });
      await queryClient.refetchQueries({ queryKey: ['store-item-settings'], exact: false });
      
      // Invalidate storeStock queries used in InvoiceForm
      queryClient.invalidateQueries({ queryKey: ['storeStock', variables.storeId, variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['storeStocks'] });
      queryClient.invalidateQueries({ queryKey: ['storeStock'] });
      
      // Invalidate main inventory queries to sync global stock display
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.inventoryItemId] });
      await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
      
      // Invalidate store analytics
      queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', variables.storeId] });
      await queryClient.refetchQueries({ queryKey: ['analytics', 'stores', variables.storeId], exact: false });
    },
    onError: (error) => {
      // Error handling - could show toast notification here if needed
      // The error will be handled by the component using this hook
    },
  });
};

export const useUpdateStoreItemSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStoreItemSettingsDto }) =>
      storeItemSettingsApi.update(id, data),
    onSuccess: async (settings, variables) => {
      // CRITICAL: Refetch queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['store-item-settings'] });
      await queryClient.refetchQueries({ queryKey: ['store-item-settings'], exact: false });
      // Invalidate inventory and analytics that might be affected
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['analytics'], exact: false });
    },
    onError: (error) => {
      // Error handling - could show toast notification here if needed
      // The error will be handled by the component using this hook
    },
  });
};

export const useUpdateStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, itemId, quantity }: { storeId: string; itemId: string; quantity: number }) =>
      storeItemSettingsApi.updateStock(storeId, itemId, quantity),
    onSuccess: async (_, variables) => {
      // CRITICAL: Refetch queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', variables.storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', variables.itemId] });
      await queryClient.refetchQueries({ queryKey: ['store-item-settings'], exact: false });
      
      // Invalidate storeStock queries
      queryClient.invalidateQueries({ queryKey: ['storeStock', variables.storeId, variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['storeStocks'] });
      queryClient.invalidateQueries({ queryKey: ['storeStock'] });
      
      // Invalidate main inventory queries to sync global stock display
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.itemId] });
      await queryClient.refetchQueries({ queryKey: ['inventory'], exact: false });
      
      // Invalidate store analytics (stock changes affect turnover, etc.)
      queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', variables.storeId] });
      await queryClient.refetchQueries({ queryKey: ['analytics', 'stores', variables.storeId], exact: false });
    },
    onError: (error) => {
      // Error handling - could show toast notification here if needed
      // The error will be handled by the component using this hook
    },
  });
};

export const useStoreStockReport = (storeId: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['store-item-settings', 'report', storeId],
    queryFn: () => storeItemSettingsApi.getStoreStockReport(storeId),
    enabled: !!storeId && isAuthenticated,
  });
};

