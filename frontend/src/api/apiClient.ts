import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { clearSettingsCache } from '../utils/settingsCache';
// Organizations removed - all data is now user-scoped

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// Helper to get Clerk token
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

// Helper to clear auth state (works in browser and SSR environments)
const clearAuthState = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return; // Not in browser environment
  }
  
  try {
    // Organizations removed - no longer need to clear organization storage
    // Clear persisted auth store
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const authData = JSON.parse(authStorage);
      authData.state.isAuthenticated = false;
      authData.state.user = null;
      localStorage.setItem('auth-storage', JSON.stringify(authData));
    }
  } catch (e) {
    // Ignore errors (localStorage might be disabled)
  }
  
  // Clear settings cache
  try {
    clearSettingsCache();
  } catch (e) {
    // Ignore if settingsCache module fails to load
  }
};

class ApiClient {
  private client: AxiosInstance;
  // FIX #119: Request deduplication - track pending requests
  private pendingRequests = new Map<string, Promise<AxiosResponse>>();
  // Track cleanup timeouts for pending requests
  private cleanupTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // FIX #156: 30 second timeout (configurable per request if needed)
      // IMPORTANT: allow axios to reject on 4xx so our refresh-token logic runs on 401
      validateStatus: (status) => status >= 200 && status < 300,
      // FIX #159: Support AbortController for request cancellation
      signal: undefined, // Will be set per request if needed
    });

    this.setupInterceptors();
  }
  
  /**
   * Clean up pending request and its timeout
   */
  private cleanupPendingRequest(requestKey: string): void {
    this.pendingRequests.delete(requestKey);
    const timeout = this.cleanupTimeouts.get(requestKey);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupTimeouts.delete(requestKey);
    }
  }
  
  /**
   * Schedule cleanup for a pending request
   */
  private scheduleCleanup(requestKey: string, delay: number = 1000): void {
    // Clear existing timeout if any
    const existingTimeout = this.cleanupTimeouts.get(requestKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule new cleanup
    const timeout = setTimeout(() => {
      this.cleanupPendingRequest(requestKey);
    }, delay);
    
    this.cleanupTimeouts.set(requestKey, timeout);
  }
  
  // FIX #159: Create cancellable request
  createCancelToken() {
    return axios.CancelToken.source();
  }
  
  // FIX #119: Generate request key for deduplication
  private getRequestKey(config: InternalAxiosRequestConfig): string {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${params}:${data}`;
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and deduplicate requests
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // FIX #119, #160: Deduplicate identical requests (GET requests only)
        // FIX #159: Support request cancellation via AbortController
        if (config.method?.toUpperCase() === 'GET') {
          const requestKey = this.getRequestKey(config);
          const pendingRequest = this.pendingRequests.get(requestKey);
          if (pendingRequest) {
            // Mark this as a deduplicated request
            const extendedConfig = config as InternalAxiosRequestConfig & { __isDedupe?: boolean; __dedupePromise?: Promise<AxiosResponse> };
            extendedConfig.__isDedupe = true;
            extendedConfig.__dedupePromise = pendingRequest;
            // Create a cancel token to prevent the actual HTTP request
            const cancelSource = axios.CancelToken.source();
            cancelSource.cancel('Request deduplicated');
            config.cancelToken = cancelSource.token;
          } else {
            // Mark config with request key for tracking
            (config as InternalAxiosRequestConfig & { __requestKey?: string }).__requestKey = requestKey;
          }
        }
        
        // FIX #159: Support AbortController for request cancellation
        if (config.signal && config.signal.aborted) {
          return Promise.reject(new axios.Cancel('Request was cancelled'));
        }
        
        // Get Clerk token
        const token = await getClerkToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Organization context removed - all data is now user-scoped

        // Ensure Content-Type is set for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
          if (config.headers && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
          }
          // If no data is provided, set empty object to ensure Content-Type is sent
          if (config.data === undefined || config.data === null) {
            config.data = {};
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh and network errors
    this.client.interceptors.response.use(
      (response) => {
        const config = response.config as InternalAxiosRequestConfig & { __requestKey?: string; __isDedupe?: boolean };
        
        // Handle request deduplication - if this was a deduplicated request, it was cancelled
        // so we shouldn't reach here. But if we do, return the original promise result
        if (config.__isDedupe && config.__dedupePromise) {
          // This shouldn't happen as deduplicated requests are cancelled, but handle it safely
          return config.__dedupePromise;
        }
        
        // Track the request promise for future deduplication
        if (config.__requestKey) {
          const requestKey = config.__requestKey;
          // The actual request was already made, so we store the resolved promise
          const resolvedPromise = Promise.resolve(response);
          this.pendingRequests.set(requestKey, resolvedPromise as Promise<AxiosResponse>);
          // Schedule cleanup after a delay to prevent memory leaks
          this.scheduleCleanup(requestKey, 2000);
        }
        
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle request deduplication - if this was a cancelled duplicate request, return the original promise
        if (originalRequest?.__isDedupe && originalRequest?.__dedupePromise) {
          // Check if this was cancelled (which is expected for duplicates)
          if (axios.isCancel(error)) {
            // Return the original promise result instead of the cancellation error
            try {
              return await originalRequest.__dedupePromise;
            } catch (dedupeError) {
              // If the original promise also failed, throw that error
              throw dedupeError;
            }
          }
          // If it's a real error (not cancellation), still return the original promise
          // This ensures all duplicate requests get the same result
          try {
            return await originalRequest.__dedupePromise;
          } catch (dedupeError) {
            throw dedupeError;
          }
        }
        
        // Track error promise for future deduplication (so duplicate requests get the same error)
        if (originalRequest?.__requestKey) {
          const requestKey = originalRequest.__requestKey;
          const rejectedPromise = Promise.reject(error);
          this.pendingRequests.set(requestKey, rejectedPromise as Promise<AxiosResponse>);
          // Schedule cleanup after a delay
          this.scheduleCleanup(requestKey, 2000);
        }

        // Issue #43: Enhanced error recovery for network errors
        if (!error.response) {
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            error.message = 'Request timeout. Please check your connection and try again.';
          } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            error.message = 'Network error. Please check your connection and ensure the server is running.';
          }
          
          
          // Retry network errors with exponential backoff (Issue #43)
          if (originalRequest && !originalRequest._networkRetry) {
            originalRequest._networkRetry = (originalRequest._networkRetry || 0) + 1;
            const maxRetries = 3;
            
            if (originalRequest._networkRetry <= maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, originalRequest._networkRetry - 1), 10000);
              await new Promise(resolve => setTimeout(resolve, delay));
              // Create new request for retry (don't use originalRequest to avoid circular reference)
              const retryConfig = { ...originalRequest };
              delete retryConfig._networkRetry; // Reset retry flag
              return this.client(retryConfig);
            }
          }
          
          return Promise.reject(error);
        }

        // FIX #158: Handle 401 Unauthorized - ensure user is redirected to login
        if (error.response?.status === 401) {
          clearAuthState();
          // Update auth store if available
          try {
            // Dynamic import to avoid circular dependencies
            import('../store/authStore').then(({ useAuthStore }) => {
              useAuthStore.getState().logout();
            }).catch(() => {
              // Auth store might not be available yet
            });
          } catch (e) {
            // Auth store might not be available yet
          }
          // FIX #158: Always redirect to login on 401, even if refresh fails
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
        
        // FIX #159: Handle request cancellation
        if (axios.isCancel(error)) {
          return Promise.reject(error);
        }

        return Promise.reject(error);
      }
    );
  }

  get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;

