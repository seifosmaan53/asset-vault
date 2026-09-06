import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@clerk/clerk-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { clearSettingsCache } from '../utils/settingsCache';

export const useProfile = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: authApi.getProfile,
    enabled: isAuthenticated,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['user', 'profile'], data);
      setUser(data);
    },
  });
};

export const useLogout = () => {
  const { signOut } = useClerk();
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Sign out from Clerk first
      await signOut();
      // Then call backend logout (optional, but good for cleanup)
      try {
        await authApi.logout();
      } catch (err) {
        // Ignore backend logout errors - Clerk signOut is the important one
      }
    },
    onSuccess: () => {
      logout();
      // FIX #112: Thoroughly clear React Query cache on logout to prevent data leakage
      queryClient.clear(); // Clear all cached queries
      queryClient.removeQueries(); // Remove all queries from cache
      queryClient.resetQueries(); // Reset all queries to initial state
      // Clear settings cache on logout
      try {
        clearSettingsCache();
      } catch (err) {
        // Ignore if settingsCache module fails to load
      }
    },
  });
};

