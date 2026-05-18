// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import AuthLayout from '../layout/AuthLayout';
import { Box, CircularProgress } from '@mui/material';

interface AuthRouteWrapperProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const AuthRouteWrapper = ({ children, redirectTo = '/dashboard' }: AuthRouteWrapperProps) => {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();
  
  // Show loading state while Clerk is initializing
  if (!isLoaded) {
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
  
  // Don't redirect if we're on a Clerk callback route (SSO, email verification, etc.)
  const isCallbackRoute = location.pathname.includes('/sso-callback') || 
                          location.pathname.includes('/callback') ||
                          location.pathname.includes('/verify') ||
                          location.pathname.includes('/reset');

  // Allow Clerk to handle signup/login pages - they will redirect if already signed in
  const isAuthPage = location.pathname.startsWith('/register') || location.pathname.startsWith('/login');

  // Allow Clerk to handle callback routes and auth pages, don't redirect during those
  if (isSignedIn && !isCallbackRoute && !isAuthPage) {
    return <Navigate to={redirectTo} replace />;
  }

  return <AuthLayout>{children}</AuthLayout>;
};

