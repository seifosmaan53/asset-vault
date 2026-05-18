import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface AdminRouteProps {
  children: JSX.Element;
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

