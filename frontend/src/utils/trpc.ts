// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * tRPC Client Setup
 * Provides type-safe API client for frontend
 * 
 * Note: Type import from backend will work once both are in the same monorepo
 * or if you generate shared types. For now, we'll use a type-safe approach.
 */

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { apiClient } from '../api/apiClient';

// Define AppRouter type (this should match backend)
// For now, we'll use a generic type - in production, generate types from backend
type AppRouter = any;

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Helper to get Clerk token (same as apiClient)
// Waits for the token function to be available (with timeout) to handle race conditions
const getClerkToken = async (maxWaitMs: number = 1000): Promise<string | null> => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const windowWithToken = window as Window & { __clerkGetToken?: () => Promise<string | null> };
    
    // If token function is already available, use it immediately
    if (windowWithToken.__clerkGetToken) {
      return await windowWithToken.__clerkGetToken() || null;
    }

    // Wait for token function to be available (handles race condition)
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Check every 50ms
      if (windowWithToken.__clerkGetToken) {
        return await windowWithToken.__clerkGetToken() || null;
      }
    }

    // Timeout reached, token function not available
    return null;
  } catch (e) {
    return null;
  }
};

// tRPC client configuration
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'}/trpc`,
      headers: async () => {
        // Get Clerk token for authentication
        const token = await getClerkToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      transformer: superjson,
      // Use fetch with credentials for cookies/auth
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});
