'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context'; // Fixed: Auth-Context is in root, not in context folder

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'cashier' | 'manager' | 'admin' | 'super_admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Not logged in
      if (!user) {
        router.push('/login');
        return;
      }

      // Doesn't have required permission
      if (requiredRole && !hasPermission(requiredRole)) {
        alert(`Access denied. This page requires ${requiredRole} role or higher.`);
        router.push('/dashboard');
        return;
      }
    }
  }, [user, loading, requiredRole, hasPermission, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // No permission
  if (requiredRole && !hasPermission(requiredRole)) {
    return null;
  }

  // Authorized
  return <>{children}</>;
}