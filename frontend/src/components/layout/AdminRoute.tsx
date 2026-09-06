import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuthStore } from '../../store/authStore';

interface AdminRouteProps {
  // React 19 no longer publishes a global JSX namespace; ReactElement is the type this
  // always meant, and it does not depend on an ambient global being in scope.
  children: ReactElement;
  ownerOnly?: boolean;
}

export function AdminRoute({ children, ownerOnly = false }: AdminRouteProps) {
  const { user, isAdmin, isOwner } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (ownerOnly) {
    if (!isOwner()) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page. Owner access required.</p>
        </div>
      );
    }
  } else {
    if (!isAdmin()) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      );
    }
  }

  return children;
}

