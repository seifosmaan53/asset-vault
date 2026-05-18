import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeAlertsApi } from '../api/storeAlerts';
import { useAuthStore } from '../store/authStore';

export const useStoreAlerts = (storeId?: string, resolved?: boolean) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor

  return useQuery({
    queryKey: ['storeAlerts', storeId, resolved],
    queryFn: () => storeAlertsApi.getAlerts(storeId, resolved),
    enabled: isAuthenticated,
  });
};

export const useStoreAlertsByStore = (storeId: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Note: Clerk handles token management automatically via apiClient interceptor

  return useQuery({
    queryKey: ['storeAlerts', 'store', storeId],
    queryFn: () => storeAlertsApi.getStoreAlerts(storeId),
    enabled: isAuthenticated && !!storeId,
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => storeAlertsApi.resolveAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeAlerts'] });
    },
  });
};

export const useCheckAlerts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => storeAlertsApi.checkAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeAlerts'] });
    },
  });
};

