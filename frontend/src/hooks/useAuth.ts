import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@clerk/clerk-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { clearSettingsCache } from '../utils/settingsCache';

/* useLogin and useRegister were removed here. They predate the move to Clerk and could
   not have run for a long time: they called authApi.login and authApi.register, which no
   longer exist (the API exposes getProfile, updateProfile, changePassword and logout),
   and wrote through useAuthStore.setAuth, which does not exist either — the store has
   setUser and syncUser. Nothing imported them. Sign-in and sign-up are Clerk's job now,
   so these are obsolete rather than unfinished. */

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

