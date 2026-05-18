import { useQuery } from '@tanstack/react-query';
import { storeItemSettingsApi } from '../api/storeItemSettings';
import { useAuthStore } from '../store/authStore';

/**
 * Hook to fetch store stock for a specific inventory item at a store
 */
export const useStoreStock = (storeId: string | undefined, inventoryItemId: string | undefined) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['storeStock', storeId, inventoryItemId],
    queryFn: async () => {
      if (!storeId || !inventoryItemId) {
        return null;
      }
      // Get store item settings which contains currentStock
      const settings = await storeItemSettingsApi.getByStore(storeId);
      const itemSetting = settings.find((s) => s.inventoryItemId === inventoryItemId);
      return itemSetting ? itemSetting.currentStock : 0;
    },
    enabled: !!storeId && !!inventoryItemId && isAuthenticated,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
};

/**
 * Hook to fetch store stock for multiple inventory items at a store
 */
export const useStoreStocks = (storeId: string | undefined, inventoryItemIds: string[]) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['storeStocks', storeId, inventoryItemIds.sort().join(',')],
    queryFn: async () => {
      if (!storeId || inventoryItemIds.length === 0) {
        return new Map<string, number>();
      }
      // Get all store item settings
      const settings = await storeItemSettingsApi.getByStore(storeId);
      const stockMap = new Map<string, number>();
      settings.forEach((s) => {
        if (inventoryItemIds.includes(s.inventoryItemId)) {
          stockMap.set(s.inventoryItemId, s.currentStock || 0);
        }
      });
      // Don't set 0 for items not found in settings - leave them out of the map
      // This allows us to distinguish between "item has 0 stock" vs "item not tracked in store"
      return stockMap;
    },
    enabled: !!storeId && inventoryItemIds.length > 0 && isAuthenticated,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
};

