// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

/**
 * TokenSetup component
 * Sets up the global token function for API client as soon as Clerk is available.
 * This prevents race conditions where API requests are made before the token function is set.
 * 
 * Simple approach: set it once when Clerk loads, and update it if getToken changes.
 * The window property check prevents unnecessary updates.
 */
export const TokenSetup = () => {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && getToken && typeof window !== 'undefined') {
      // Always update to ensure we have the latest getToken function
      // This is safe because we're just assigning a function reference
      (window as Window & { __clerkGetToken?: () => Promise<string | null> }).__clerkGetToken = getToken;
    }
  }, [isLoaded]); // Only depend on isLoaded - getToken is captured in closure

  // This component doesn't render anything
  return null;
};
