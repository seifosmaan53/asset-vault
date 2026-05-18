// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Timeout Constants
 * Centralized timeout values to avoid magic numbers and improve maintainability
 */

export const TIMEOUTS = {
  // Query invalidation delay (prevents race conditions)
  QUERY_INVALIDATION_DELAY: 100,
  
  // Success feedback display duration
  SUCCESS_FEEDBACK_DURATION: 5000,
  
  // Barcode rendering delay
  BARCODE_RENDER_DELAY: 100,
  
  // Print window delay
  PRINT_WINDOW_DELAY: 250,
  
  // Navigation delay after form submission
  NAVIGATION_DELAY: 100,
  
  // Auto-refresh intervals
  AUTO_REFRESH_INTERVAL: 60000, // 60 seconds (optimized from 30s to reduce API calls)
  // Real-time refresh interval (5 seconds = 5000ms) - Optimized to prevent race conditions
  // Reduced from 100ms to 5000ms to prevent excessive API calls and race conditions
  // Consider using WebSocket/SSE for true real-time updates if needed
  REAL_TIME_REFRESH_INTERVAL: 5000, // 5 seconds (5000ms) - for real-time synchronization
  
  // Date range warning display duration
  DATE_RANGE_WARNING_DURATION: 5000,
  
  // Copy to clipboard feedback duration
  COPY_FEEDBACK_DURATION: 2000,
  
  // Form validation debounce
  VALIDATION_DEBOUNCE: 300,
  
  // Dev mode hiding (Login/Register pages)
  DEV_MODE_HIDE_INTERVAL: 200,
  DEV_MODE_HIDE_DURATION: 3000,
} as const;

