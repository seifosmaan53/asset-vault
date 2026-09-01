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
import type { initTRPC } from '@trpc/server';
import superjson from 'superjson';

/* This was `type AppRouter = any`, which broke the build. tRPC v11 rejects routers whose
   procedure names collide with its own built-ins (`useContext`, `useUtils`, `Provider`),
   and `any` structurally matches every one of them — so all three looked like collisions
   and `trpc.createClient` resolved to `never`.

   A router type needs a FINITE set of keys to pass that check, so we derive one from an
   empty router — but STRICTLY AT THE TYPE LEVEL. The obvious version of this,

       const factory = initTRPC.create();          // <-- runs in the browser
       type AppRouter = typeof factory.router({});

   type-checks and builds perfectly and then white-screens the entire application at
   runtime: `@trpc/server` throws "You're trying to use @trpc/server in a non-server
   environment" the moment `.create()` is evaluated, and because this module sits on the
   import path of the app shell, nothing renders at all. Neither `tsc` nor the unit tests
   catch it — only loading the page does.

   So `initTRPC` is imported with `import type`, and the two values below are `declare
   const` — they exist only for `typeof` to read and emit no JavaScript whatsoever, so
   the import is erased at build time and no server code reaches the browser. The empty
   record has to be spelled out explicitly: leaving the `router` call generic makes its
   key set open again, and tRPC goes straight back to reporting `useContext`, `useUtils`
   and `Provider` as collisions.

   The genuine end-to-end types are exported from backend/src/trpc/trpc.router.ts as
   `AppRouter`; wiring them up here requires the two packages to share a TypeScript
   project, which is tracked as follow-up work. */
declare const typeOnlyRouterFactory: ReturnType<
  typeof initTRPC.create<{ transformer: typeof superjson }>
>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the literal empty
// object is the point: it is what gives the router a closed, zero-key record.
declare const emptyRouter: ReturnType<typeof typeOnlyRouterFactory.router<{}>>;
type AppRouter = typeof emptyRouter;

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
      // Read into a local before calling: narrowing on the property does not survive
      // the await above, because anything could have reassigned it while suspended.
      const getToken = windowWithToken.__clerkGetToken;
      if (getToken) {
        return (await getToken()) || null;
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
      // tRPC types its own fetch options more loosely than the DOM's RequestInit
      // (its `body` admits Uint8Array), so narrow back to RequestInit at the boundary.
      fetch: (url, options) => {
        return fetch(url, {
          ...(options as RequestInit),
          credentials: 'include',
        });
      },
    }),
  ],
});
