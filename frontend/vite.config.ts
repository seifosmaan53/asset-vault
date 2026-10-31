/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Invoice money validation and arithmetic, shared with the API (one implementation).
      '@invoice-money': fileURLToPath(new URL('../backend/src/common/money', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'jsbarcode',
      '@trpc/client',
      '@trpc/react-query',
      '@trpc/server',
      'superjson',
    ],
    // Exclude heavy dependencies from pre-bundling if they cause issues
    exclude: ['idb'], // idb uses ESM and should not be pre-bundled
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Enable HMR with better performance
    hmr: {
      overlay: true,
      // Reduce HMR update delay
      clientPort: 5173,
    },
    // File watching configuration - fixes issues on Docker/WSL/network drives
    watch: {
      // Use polling for Docker/WSL/network drives (required for hot reload in containers)
      usePolling: true,
      interval: 150,
      // Ignore certain files that might cause infinite reloads
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.vite/**',
        '**/coverage/**',
        '**/build/**',
      ],
    },
    // Faster file system operations
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
      // Strict mode for better security (can be disabled if needed)
      strict: false,
    },
  },
  // Build optimizations
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Optimize rollup options
    rollupOptions: {
      output: {
        // Vendor code the app shell needs on every page gets long-lived chunks of its own, so
        // a release that only touches app code does not invalidate them. Everything else is
        // left to Rollup: pages are lazy (see App.tsx), and a library used only by some pages
        // (charts, date pickers, forms, icons) lands in a chunk those pages share, fetched
        // with them rather than at start-up. Listing such a library here would pull it into
        // a named chunk that is still only loaded on demand, except for the cases below,
        // which are loaded on demand under a readable name.
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined
          const pkg = id.split('/node_modules/').pop() ?? ''
          if (/^(react|react-dom|scheduler|react-router|react-router-dom)\//.test(pkg)) return 'react-vendor'
          if (/^(@mui\/(material|system|utils|styled-engine|private-theming|core-downloads-tracker)|@emotion\/[^/]+|@popperjs\/core|react-transition-group|stylis|clsx|prop-types|react-is|hoist-non-react-statics)\//.test(pkg)) return 'mui-vendor'
          if (/^@tanstack\/(react-query|query-core)\//.test(pkg)) return 'query-vendor'
          if (/^@clerk\//.test(pkg)) return 'clerk-vendor'
          // Only chart pages import these (dashboard, analytics, store reports).
          if (/^(recharts|victory-vendor|d3-[^/]+|internmap|decimal\.js-light|es-toolkit|@reduxjs\/toolkit|redux|redux-thunk|reselect|immer|react-redux|eventemitter3|tiny-invariant)\//.test(pkg)) return 'charts-vendor'
          return undefined
        },
      },
    },
    // Source maps for better debugging (disable in production for speed)
    sourcemap: process.env.NODE_ENV === 'development',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
