import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
        // Better chunk splitting
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'query-vendor': ['@tanstack/react-query'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    // Source maps for better debugging (disable in production for speed)
    sourcemap: process.env.NODE_ENV === 'development',
  },
  // @ts-ignore - test config is for Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
