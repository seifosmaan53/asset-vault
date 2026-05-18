// Copyright (c) 2025 Asset Vault. All rights reserved.

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ThemeProvider, CssBaseline, Box, Paper, Typography } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'
import { defaultTheme, createDynamicTheme } from './theme'
import { ToastProvider } from './contexts/ToastContext'
import { UndoProvider } from './contexts/UndoContext'
import { SearchProvider } from './contexts/SearchContext'
import { RecentItemsProvider } from './contexts/RecentItemsContext'
import { SettingsProvider, useSettingsContext } from './contexts/SettingsContext'
import { KeyboardShortcutsProvider } from './contexts/KeyboardShortcutsContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import { logger } from './utils/logger'
import { trpc, trpcClient } from './utils/trpc'
import { initIndexedDB } from './utils/indexedDB'
import { setupOfflineSync } from './utils/offlineSync'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  logger.error('VITE_CLERK_PUBLISHABLE_KEY is not set in environment variables');
  // Show error in console and potentially in UI
  if (typeof window !== 'undefined') {
    console.error('❌ VITE_CLERK_PUBLISHABLE_KEY is missing! Please add it to your .env file.');
  }
}

// Add smooth scroll behavior globally
if (typeof document !== 'undefined') {
  document.documentElement.style.scrollBehavior = 'smooth';
}

// Suppress browser performance violation warnings in development
// These warnings appear during HMR and don't indicate real performance issues
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  // Helper function to check if a message is a performance violation warning
  const isPerformanceViolation = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    
    // Check for performance violation patterns
    // These warnings come from browser performance monitoring and are normal during:
    // - Hot Module Replacement (HMR)
    // - Heavy async operations
    // - Large data processing
    // They don't indicate actual performance problems in production
    
    if (lowerMessage.includes('[violation]') || lowerMessage.includes('violation')) {
      return true;
    }
    
    // Check for handler timing warnings
    if (lowerMessage.includes('handler took') && lowerMessage.includes('ms')) {
      return true;
    }
    
    // Check for setTimeout handler warnings
    if (lowerMessage.includes('settimeout') && lowerMessage.includes('handler')) {
      return true;
    }
    
    // Check for message handler warnings
    if (lowerMessage.includes('message') && lowerMessage.includes('handler took')) {
      return true;
    }
    
    // Check for long-running task warnings
    if (lowerMessage.includes('long-running') || lowerMessage.includes('long task')) {
      return true;
    }
    
    return false;
  };
  
  // Override console methods to filter out performance violation warnings
  console.error = (...args: unknown[]) => {
    const message = String(args[0] || '');
    // Suppress performance violation warnings (these are normal during HMR and async operations)
    if (isPerformanceViolation(message)) {
      return; // Suppress this warning
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] || '');
    // Suppress performance violation warnings
    if (isPerformanceViolation(message)) {
      return; // Suppress this warning
    }
    // Suppress MUI GridLegacy deprecation warning (informational only, doesn't affect functionality)
    if (message.includes('GridLegacy') && message.includes('deprecated')) {
      return; // Suppress this warning
    }
    // Suppress Clerk development keys warning (expected in development)
    if (message.includes('Clerk') && (message.includes('development keys') || message.includes('Development instances'))) {
      return; // Suppress this warning
    }
    originalWarn.apply(console, args);
  };
  
  // Also filter console.log for violations (some browsers log them there)
  console.log = (...args: unknown[]) => {
    const message = String(args[0] || '');
    // Suppress performance violation warnings
    if (isPerformanceViolation(message)) {
      return; // Suppress this warning
    }
    originalLog.apply(console, args);
  };
  
  // Also intercept performance observer warnings if available
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const originalObserve = PerformanceObserver.prototype.observe;
      PerformanceObserver.prototype.observe = function(...args) {
        // Suppress long task warnings in development
        if (args[0]?.entryTypes?.includes('longtask')) {
          return; // Don't observe long tasks in development
        }
        return originalObserve.apply(this, args);
      };
    } catch (e) {
      // Ignore if PerformanceObserver is not fully available
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refetch when window regains focus to get latest data
      refetchOnMount: true, // Always refetch on mount to ensure fresh data after mutations
      staleTime: 5000, // FIX #118: Consider data fresh for 5 seconds to reduce unnecessary refetches
      gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
      // Real-time synchronization: Refetch every 0.1 seconds (100ms) when page is visible
      // WARNING: This is very aggressive (10 requests/second per query). Consider using WebSocket/SSE for production.
      // DISABLED: Causing excessive re-renders. Use per-query refetchInterval instead.
      // refetchInterval: (query) => {
      //   // Only refetch if page is visible (reduces unnecessary requests when tab is hidden)
      //   if (typeof document === 'undefined') return false;
      //   if (document.hidden) return false;
      //   // Use real-time refresh interval for critical data
      //   return 100; // 0.1 seconds (100ms)
      // },
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401 (Unauthorized) or 403 (Forbidden) errors
        // These indicate authentication/authorization issues that won't be fixed by retrying
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as { response?: { status?: number } }).response;
          if (response?.status === 401 || response?.status === 403) {
            return false;
          }
        }
        // FIX #115: Retry logic applies to both initial fetch and background refetches
        // Retry up to 2 times for network errors, 1 time for other errors
        if (error && typeof error === 'object' && ('code' in error || 'message' in error)) {
          const errorObj = error as { code?: string; message?: string };
          if (errorObj.code === 'ERR_NETWORK' || errorObj.message?.includes('Network Error')) {
            return failureCount < 2; // More retries for network errors
          }
        }
        return failureCount < 1; // Single retry for other errors
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    },
    mutations: {
      // Ensure mutations refetch related queries after success
      onSuccess: () => {
        // This will be overridden by individual mutations, but provides a default
      },
    },
  },
})

// Theme wrapper that uses settings from context
function AppWithThemeInner() {
  const { settings } = useSettingsContext();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  
  // Listen for system theme changes when theme is set to "auto"
  useEffect(() => {
    if (settings?.theme !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    // Set initial value
    updateTheme(mediaQuery);
    
    // Listen for changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(updateTheme);
      return () => mediaQuery.removeListener(updateTheme);
    }
  }, [settings?.theme]);
  
  // Create dynamic theme based on user settings
  const dynamicTheme = createDynamicTheme(settings, systemTheme);

  // If Clerk key is missing, show error message
  if (!clerkPublishableKey) {
    return (
      <ThemeProvider theme={defaultTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
          }}
        >
          <Paper elevation={3} sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom color="error">
              Configuration Error
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              VITE_CLERK_PUBLISHABLE_KEY is not set in environment variables.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Please add it to your <code>frontend/.env</code> file and restart the dev server.
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={dynamicTheme}>
      <CssBaseline />
      <ToastProvider>
        <UndoProvider>
          <SearchProvider>
            <RecentItemsProvider>
              <KeyboardShortcutsProvider
            defaultShortcuts={[
              {
                title: 'General',
                shortcuts: [
                  { keys: ['Ctrl', 'K'], description: 'Focus search' },
                  { keys: ['Ctrl', 'N'], description: 'Create new item' },
                  { keys: ['Ctrl', '?'], description: 'Show keyboard shortcuts' },
                  { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
                  { keys: ['Esc'], description: 'Close dialog/modal' },
                ],
              },
              {
                title: 'Forms',
                shortcuts: [
                  { keys: ['Ctrl', 'S'], description: 'Save form' },
                ],
              },
            ]}
          >
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </KeyboardShortcutsProvider>
            </RecentItemsProvider>
          </SearchProvider>
        </UndoProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Simple theme wrapper
function AppWithTheme() {
  // If Clerk key is missing, show error message
  if (!clerkPublishableKey) {
    return (
      <ThemeProvider theme={defaultTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
          }}
        >
          <Paper elevation={3} sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom color="error">
              Configuration Error
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              VITE_CLERK_PUBLISHABLE_KEY is not set in environment variables.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Please add it to your <code>frontend/.env</code> file and restart the dev server.
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <SettingsProvider>
        <AppWithThemeInner />
      </SettingsProvider>
    </ClerkProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Make sure index.html has <div id="root"></div>');
}

logger.info('Initializing app...', { rootElement, hasRoot: !!rootElement });

// Test if basic rendering works
try {
  const root = createRoot(rootElement);
  
  logger.debug('Creating root...');
  
  // Initialize IndexedDB for offline support
  initIndexedDB().catch((error) => {
    logger.error('Failed to initialize IndexedDB:', error);
  });

  // Setup offline sync
  const cleanupOfflineSync = setupOfflineSync({
    queryClient,
    onSyncComplete: () => {
      logger.info('Offline mutations synced successfully');
    },
    onSyncError: (error) => {
      logger.error('Failed to sync offline mutations:', error);
    },
  });

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AppWithTheme />
          </QueryClientProvider>
        </trpc.Provider>
      </ErrorBoundary>
    </StrictMode>,
  );
  
  logger.info('App rendered successfully');
  
  // Check if root has content after render
  // Use requestAnimationFrame instead of setTimeout to avoid performance violation warnings
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      logger.debug('Checking root content...', {
        childrenLength: rootElement.children.length,
        innerHTML: rootElement.innerHTML.substring(0, 200),
      });
      
      if (rootElement.children.length === 0 && !rootElement.innerHTML.includes('Loading')) {
        logger.error('Root element has no children after render!');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000;';
        // Use textContent instead of innerHTML to prevent XSS
        const h1 = document.createElement('h1');
        h1.style.color = 'red';
        h1.textContent = 'Render Issue Detected';
        errorDiv.appendChild(h1);
        const p1 = document.createElement('p');
        p1.textContent = 'The app rendered but no content appeared.';
        errorDiv.appendChild(p1);
        const p2 = document.createElement('p');
        p2.textContent = 'Check the browser console for errors.';
        errorDiv.appendChild(p2);
        const p3 = document.createElement('p');
        p3.textContent = `Time: ${new Date().toISOString()}`;
        errorDiv.appendChild(p3);
        rootElement.appendChild(errorDiv);
      } else {
        logger.debug('Root has content:', rootElement.children.length, 'children');
      }
    });
  });
  
} catch (error: unknown) {
  logger.error('Failed to render app:', error);
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || '';
  
  // Use textContent instead of innerHTML to prevent XSS
  rootElement.textContent = ''; // Clear existing content
  const container = document.createElement('div');
  container.style.cssText = 'padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000;';
  
  const h1 = document.createElement('h1');
  h1.style.color = 'red';
  h1.textContent = 'Application Error';
  container.appendChild(h1);
  
  const p1 = document.createElement('p');
  p1.textContent = 'Failed to initialize the application.';
  container.appendChild(p1);
  
  const pre = document.createElement('pre');
  pre.style.cssText = 'background: #f5f5f5; padding: 10px; border-radius: 4px; color: #000; overflow: auto;';
  pre.textContent = `${errorMessage}\n\n${errorStack}`;
  container.appendChild(pre);
  
  const p2 = document.createElement('p');
  p2.textContent = 'Please check the browser console for more details.';
  container.appendChild(p2);
  
  rootElement.appendChild(container);
  
  // Also log error details
  logger.error('Full error details:', error);
}
