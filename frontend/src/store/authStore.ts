// Copyright (c) 2025 Asset Vault. All rights reserved.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types/user';
import { ORGANIZATION_ID_STORAGE_KEY } from './organizationStore';
import { authApi } from '../api/auth';
import { logger } from '../utils/logger';

// Fallback storage for environments where localStorage is unavailable (private mode / blocked storage)
const memoryStorage = (() => {
  const mem = new Map<string, string>();
  return {
    getItem: (name: string) => mem.get(name) ?? null,
    setItem: (name: string, value: string) => {
      mem.set(name, value);
    },
    removeItem: (name: string) => {
      mem.delete(name);
    },
  };
})();

// Type-safe localStorage wrapper that returns a compatible storage interface
const safeLocalStorage = (): Storage => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryStorage as unknown as Storage;
    }
    return window.localStorage;
  } catch {
    return memoryStorage as unknown as Storage;
  }
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  syncUser: () => Promise<User | null>;
  logout: () => void;
  isAdmin: () => boolean;
  isOwner: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
      syncUser: async () => {
        try {
          const user = await authApi.getProfile();
          set({ user, isAuthenticated: !!user });
          return user;
        } catch (error: unknown) {
          // Silently handle request deduplication - this is expected behavior when
          // syncUser is called from multiple places (ProtectedRoute, AppLayout)
          if (error && typeof error === 'object' && '__isDedupe' in error && (error as { __isDedupe?: boolean }).__isDedupe) {
            // The original request is still in progress, so we'll just return null
            // The component that made the original request will handle the result
            return null;
          }
          // Ignore CanceledError - this is expected in React Strict Mode (development)
          // when effects are double-invoked and requests get cancelled
          if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
            return null;
          }
          // Log other errors but don't clear auth state for network errors
          if (error?.response?.status !== 401) {
            logger.error('Failed to sync user:', error);
          }
          // Only clear auth state on 401 (unauthorized)
          if (error?.response?.status === 401) {
            set({ user: null, isAuthenticated: false });
          }
          return null;
        }
      },
      logout: () => {
        try {
          localStorage.removeItem(ORGANIZATION_ID_STORAGE_KEY);
          localStorage.removeItem('organization-storage');
        } catch {
          // ignore
        }
        set({ user: null, isAuthenticated: false });
      },
      isAdmin: () => {
        const role = get().user?.role;
        return role === 'admin' || role === 'owner';
      },
      isOwner: () => {
        return get().user?.role === 'owner';
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(safeLocalStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
