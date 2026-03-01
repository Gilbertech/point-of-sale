'use client';
// lib/auth-context.tsx
// Uses Supabase Auth for login — auth.uid() now works correctly for RLS.

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase/client';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'inventory_staff'
  | 'customer';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  storeId: string | null;
  isActive: boolean;
}

export interface SessionData {
  userId: string;
  loginTime: Date;
  lastActivityTime: Date;
  sessionId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loading: boolean;
  hasPermission: (requiredRole: string) => boolean;
  session: SessionData | null;
  sessionTimeout: number;
  setSessionTimeout: (minutes: number) => void;
  isSessionExpired: boolean;
  resetSessionTimeout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                         = useState<User | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [session, setSession]                   = useState<SessionData | null>(null);
  const [sessionTimeout, setSessionTimeout]     = useState(30);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const generateSessionId = useCallback(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  const logoutRef = useRef<(() => void) | undefined>(undefined);

  const logout = useCallback(async () => {
    // Clear state immediately so UI reacts
    setUser(null);
    setSession(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
      // Clear all Supabase session keys from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    }
    // MUST await — otherwise session survives the redirect and restores itself
    await supabase.auth.signOut({ scope: 'local' });
    // Replace (not href) so Back button can't return to dashboard
    window.location.replace('/login');
  }, []);

  logoutRef.current = logout;

  const resetSessionTimeout = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (user && session) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsSessionExpired(true);
        logoutRef.current?.();
      }, sessionTimeout * 60 * 1000);
      setSession(prev => prev ? { ...prev, lastActivityTime: new Date() } : null);
    }
  }, [user, session?.sessionId, sessionTimeout]);

  // ── Build User object from app_users row ─────────────────────────────────
  const buildUser = (data: any): User => ({
    id:        data.id,
    email:     data.email,
    firstName: data.first_name,
    lastName:  data.last_name,
    role:      data.role as UserRole,
    storeId:   data.store_id ?? null,
    isActive:  data.is_active,
  });

  // ── Login via Supabase Auth ──────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      console.log('[Auth] Attempting Supabase Auth login for:', email);

      // 1. Sign in via Supabase Auth — this sets the JWT session
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error('Invalid email or password');
      }

      console.log('[Auth] Supabase Auth success, uid:', authData.user.id);

      // 2. Fetch full profile from app_users using the auth uid
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('id, email, first_name, last_name, role, store_id, is_active')
        .eq('id', authData.user.id)
        .eq('is_active', true)
        .single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        throw new Error('Account not found or inactive. Contact your administrator.');
      }

      console.log('[Auth] User profile found:', userData.email, '| role:', userData.role);

      // 3. Update last_login timestamp
      await supabase
        .from('app_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userData.id);

      const loggedInUser = buildUser(userData);

      const sessionData: SessionData = {
        userId:           loggedInUser.id,
        loginTime:        new Date(),
        lastActivityTime: new Date(),
        sessionId:        generateSessionId(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('currentUser', JSON.stringify({
          id:         loggedInUser.id,
          email:      loggedInUser.email,
          first_name: loggedInUser.firstName,
          last_name:  loggedInUser.lastName,
          role:       loggedInUser.role,
          store_id:   loggedInUser.storeId,
          is_active:  loggedInUser.isActive,
        }));

        // ── Auto-select the user's assigned branch ──────────────────────
        // store-context reads 'selectedStoreId' from localStorage on mount.
        // Workers/managers/cashiers with an assigned store_id will see their
        // branch pre-selected in the sidebar immediately after login.
        // super_admin / admin with null store_id keep whatever was selected.
        if (loggedInUser.storeId) {
          localStorage.setItem('pos_selected_store', loggedInUser.storeId);
        }
      }

      setUser(loggedInUser);
      setSession(sessionData);
      setIsSessionExpired(false);

      return loggedInUser;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [generateSessionId]);

  const hasPermission = useCallback((requiredRole: string) => {
    if (!user) return false;
    const hierarchy: Record<string, number> = {
      customer: 0, cashier: 1, inventory_staff: 1,
      manager: 2, admin: 3, super_admin: 4,
    };
    return (hierarchy[user.role] ?? 0) >= (hierarchy[requiredRole] ?? 0);
  }, [user]);

  // ── Restore session on mount via Supabase Auth session ──────────────────
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (authSession?.user && mounted) {
          const { data: userData } = await supabase
            .from('app_users')
            .select('id, email, first_name, last_name, role, store_id, is_active')
            .eq('id', authSession.user.id)
            .eq('is_active', true)
            .single();

          if (userData && mounted) {
            const restoredUser = buildUser(userData);
            setUser(restoredUser);
            setSession({
              userId:           restoredUser.id,
              loginTime:        new Date(),
              lastActivityTime: new Date(),
              sessionId:        generateSessionId(),
            });
          }
        }
      } catch (err) {
        console.error('[Auth] Session restore failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, authSession) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED' && authSession?.user) {
          console.log('[Auth] Token refreshed silently');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [generateSessionId]);

  // ── Activity listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const handle = () => resetSessionTimeout();
    window.addEventListener('mousemove', handle);
    window.addEventListener('keydown', handle);
    window.addEventListener('click', handle);
    return () => {
      window.removeEventListener('mousemove', handle);
      window.removeEventListener('keydown', handle);
      window.removeEventListener('click', handle);
    };
  }, [user, resetSessionTimeout]);

  useEffect(() => {
    if (user && session?.sessionId) resetSessionTimeout();
    return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [user?.id, session?.sessionId, sessionTimeout]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user,
      login, logout, loading,
      hasPermission, session, sessionTimeout, setSessionTimeout,
      isSessionExpired, resetSessionTimeout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}