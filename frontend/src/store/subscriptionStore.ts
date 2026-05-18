// Copyright (c) 2025 Asset Vault. All rights reserved.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscriptionsApi, type Subscription, type Usage } from '../api/subscriptions';
import { logger } from '../utils/logger';

// Fallback storage for environments where localStorage is unavailable
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

interface SubscriptionState {
  subscription: Subscription | null;
  usage: Usage | null;
  isLoading: boolean;
  loadSubscription: () => Promise<void>;
  syncSubscription: () => Promise<void>;
  loadUsage: () => Promise<void>;
  checkAccess: () => boolean;
  getUsage: () => Usage | null;
  clearSubscription: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscription: null,
      usage: null,
      isLoading: false,
      loadSubscription: async () => {
        set({ isLoading: true });
        try {
          const response = await subscriptionsApi.getCurrentSubscription();
          set({ subscription: response.subscription, isLoading: false });
        } catch (error: unknown) {
          // Ignore CanceledError - this is expected in React Strict Mode (development)
          // when effects are double-invoked and requests get cancelled
          if (error && typeof error === 'object' && ('name' in error && (error as { name?: string }).name === 'CanceledError' || 'code' in error && (error as { code?: string }).code === 'ERR_CANCELED')) {
            set({ isLoading: false });
            return;
          }
          logger.error('Failed to load subscription:', error);
          set({ isLoading: false });
          // Don't clear subscription on error - keep cached value
        }
      },
      syncSubscription: async () => {
        set({ isLoading: true });
        try {
          const response = await subscriptionsApi.syncSubscription();
          set({ subscription: response.subscription, isLoading: false });
        } catch (error: unknown) {
          // Ignore CanceledError - this is expected in React Strict Mode (development)
          if (error && typeof error === 'object' && ('name' in error && (error as { name?: string }).name === 'CanceledError' || 'code' in error && (error as { code?: string }).code === 'ERR_CANCELED')) {
            set({ isLoading: false });
            return;
          }
          
          // Don't log 400 errors as errors - they're expected when user has no subscription
          // or subscription doesn't have a Stripe ID yet
          const axiosError = error as any;
          if (axiosError?.response?.status === 400) {
            // 400 means no subscription or no Stripe ID - this is expected for new users
            // Don't log as error, just silently fail
            set({ isLoading: false });
            return;
          }
          
          logger.error('Failed to sync subscription:', error);
          set({ isLoading: false });
          // Don't clear subscription on error - keep cached value
        }
      },
      loadUsage: async () => {
        try {
          const response = await subscriptionsApi.getUsage();
          set({ usage: response.usage });
        } catch (error: unknown) {
          // Ignore CanceledError - this is expected in React Strict Mode (development)
          if (error && typeof error === 'object' && ('name' in error && (error as { name?: string }).name === 'CanceledError' || 'code' in error && (error as { code?: string }).code === 'ERR_CANCELED')) {
            return;
          }
          logger.error('Failed to load usage:', error);
        }
      },
      checkAccess: () => {
        const subscription = get().subscription;
        if (!subscription) {
          return false;
        }

        const activeStatuses = ['active', 'trialing', 'pending'];
        if (activeStatuses.includes(subscription.status)) {
          return true;
        }

        // Allow access during grace period (7 days after cancellation)
        if (subscription.status === 'canceled' && subscription.currentPeriodEnd) {
          const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
          return new Date() < gracePeriodEnd;
        }

        return false;
      },
      getUsage: () => {
        return get().usage;
      },
      clearSubscription: () => {
        set({ subscription: null, usage: null });
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(safeLocalStorage),
      partialize: (state) => ({
        subscription: state.subscription,
        usage: state.usage,
      }),
    }
  )
);

