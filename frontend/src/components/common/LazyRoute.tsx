// Copyright (c) 2025 Asset Vault. All rights reserved.

/*
 * Route-level code splitting.
 *
 * Every page is its own chunk, loaded when its route first renders. Two things can go
 * wrong that a statically imported page never had to handle:
 *
 *  - the chunk is still downloading: <Suspense> shows a small loader inside the layout,
 *    so the navigation and header stay put;
 *  - the chunk cannot be fetched (offline, flaky network, or, most often, a redeploy
 *    replaced the hashed file names the open tab still refers to): the route shows a
 *    recoverable error with a Reload button instead of an empty screen. Reloading fetches
 *    the current index.html, which names the current chunks. (Retrying the import in place
 *    does not work: see utils/lazyPage.ts.)
 */

import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button, CircularProgress } from '@mui/material';
import { logger } from '../../utils/logger';
import { isChunkLoadError } from '../../utils/lazyPage';

export function PageLoader() {
  return (
    <Box
      role="status"
      aria-label="Loading page"
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, p: 4 }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** Injected in tests; defaults to a full page reload. */
  onReload?: () => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Catches errors from one route. A chunk that failed to load offers a reload; any other
 * error offers "Try again" (re-render) and a reload. Either way the app shell stays.
 * AppLayout keys its <Outlet> by pathname, so navigating elsewhere also clears it.
 */
export class RouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(isChunkLoadError(error) ? 'Page chunk failed to load' : 'Route render error', {
      error,
      componentStack: info.componentStack,
    });
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 640, mx: 'auto' }}>
        <Alert
          severity="error"
          role="alert"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!chunk && (
                <Button color="inherit" size="small" onClick={this.retry}>
                  Try again
                </Button>
              )}
              <Button color="inherit" size="small" variant="outlined" onClick={this.reload}>
                Reload
              </Button>
            </Box>
          }
        >
          <AlertTitle>{chunk ? 'This page could not be loaded' : 'Something went wrong on this page'}</AlertTitle>
          {chunk
            ? 'Check your connection, or reload: the app may have been updated since this tab was opened.'
            : 'Try again, or reload the page.'}
        </Alert>
      </Box>
    );
  }
}

/** Wraps a lazily loaded page in its error boundary and loading fallback. */
export function RoutePage({ children, onReload }: BoundaryProps) {
  return (
    <RouteErrorBoundary onReload={onReload}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}
