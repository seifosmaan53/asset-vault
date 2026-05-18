// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const location = useLocation();
  const syncUser = useAuthStore((state) => state.syncUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { loadSubscription, checkAccess, subscription } = useSubscriptionStore();
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);

  // Set up global getToken function for API client
  // Do this synchronously during render (not in effect) to avoid infinite loops
  // Only set it once when Clerk is loaded
  if (typeof window !== 'undefined' && getToken && isLoaded) {
    const windowWithToken = window as Window & { __clerkGetToken?: () => Promise<string | null> };
    if (!windowWithToken.__clerkGetToken) {
      windowWithToken.__clerkGetToken = getToken;
    }
  }

  // Sync user data when signed in (always refresh to get latest role)
  useEffect(() => {
    if (isSignedIn && isLoaded) {
      // Always sync user data to ensure role is up-to-date
      syncUser().then(() => {
        // Load subscription after user is synced
        loadSubscription().then(() => {
          setSubscriptionLoaded(true);
        });
      });
    }
  }, [isSignedIn, isLoaded, syncUser, loadSubscription]);

  // Show loading state while Clerk is initializing or subscription is loading
  if (!isLoaded || (isSignedIn && !subscriptionLoaded)) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect if not signed in (only after Clerk has loaded)
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // Check subscription access (skip for subscription pages and public routes)
  const isSubscriptionPage = location.pathname.startsWith('/subscription');
  if (!isSubscriptionPage && isSignedIn && subscriptionLoaded) {
    const hasAccess = checkAccess();
    if (!hasAccess) {
      // Redirect to plan selection if no subscription or inactive
      return <Navigate to="/subscription/plan" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
