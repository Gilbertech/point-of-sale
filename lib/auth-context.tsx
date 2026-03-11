'use client';
// lib/auth-context.tsx
// Uses Supabase Auth for login — auth.uid() works correctly for RLS.
// Session tracking: writes to `user_sessions` table on login/logout.
// Requires: split-payments-sessions-setup.sql to have been run in Supabase.

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

// ─── Session row tracking (module-scoped, survives re-renders) ────────────────
// Stores the Supabase `user_sessions` row id so logout can close it out.
let _sessionRowId: string | null = null;

async function startSessionRow(userId: string, storeId: string | null) {
  try {
    const { data: meData } = await supabase
      .from('app_users')
      .select('first_name, last_name')
      .eq('id', userId)
      .single();
    const userName = meData
      ? `${meData.first_name ?? ''} ${meData.last_name ?? ''}`.trim()
      : userId;

    const { data, error } = await supabase
      .from('user_sessions')
      .insert([{
        user_id:   userId,
        user_name: userName,
        store_id:  storeId ?? null,
        status:    'active',
      }])
      .select('id')
      .single();

    if (error) {
      console.warn('[Session] Could not create session row:', error.message);
      return;
    }

    _sessionRowId = data.id;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pos_session_row_id', data.id);
    }
  } catch (e) {
    console.warn('[Session] startSessionRow exception:', e);
  }
}

async function endSessionRow(reason = 'manual_logout') {
  // Recover id if module was reloaded (e.g. hot reload / page refresh)
  if (!_sessionRowId && typeof window !== 'undefined') {
    _sessionRowId = sessionStorage.getItem('pos_session_row_id');
  }
  if (!_sessionRowId) return;

  try {
    const { data: row } = await supabase
      .from('user_sessions')
      .select('login_at')
      .eq('id', _sessionRowId)
      .single();

    const loginTime    = row?.login_at ? new Date(row.login_at).getTime() : Date.now();
    const durationMins = Math.max(0, Math.round((Date.now() - loginTime) / 60_000));

    await supabase
      .from('user_sessions')
      .update({
        status:           'ended',
        logout_at:        new Date().toISOString(),
        duration_minutes: durationMins,
        logout_reason:    reason,
      })
      .eq('id', _sessionRowId);
  } catch (e) {
    console.warn('[Session] endSessionRow exception:', e);
  } finally {
    _sessionRowId = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pos_session_row_id');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
    // 1. Close the session row in Supabase BEFORE signing out
    await endSessionRow('manual_logout');

    // 2. Clear local state
    setUser(null);
    setSession(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    }

    // 3. Sign out of Supabase Auth
    await supabase.auth.signOut({ scope: 'local' });

    // 4. Redirect — replace so Back button can't return to dashboard
    window.location.replace('/login');
  }, []);

  logoutRef.current = logout;

  const resetSessionTimeout = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (user && session) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsSessionExpired(true);
        endSessionRow('session_timeout').then(() => logoutRef.current?.());
      }, sessionTimeout * 60 * 1000);
      setSession(prev => prev ? { ...prev, lastActivityTime: new Date() } : null);
    }
  }, [user, session?.sessionId, sessionTimeout]);

  // ── Build User object from app_users row ──────────────────────────────────
  const buildUser = (data: any): User => ({
    id:        data.id,
    email:     data.email,
    firstName: data.first_name,
    lastName:  data.last_name,
    role:      data.role as UserRole,
    storeId:   data.store_id ?? null,
    isActive:  data.is_active,
  });

  // ── Login via Supabase Auth ───────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      console.log('[Auth] Attempting login for:', email);

      // 1. Sign in via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error('Invalid email or password');
      }

      console.log('[Auth] Auth success, uid:', authData.user.id);

      // 2. Fetch full profile from app_users
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

      console.log('[Auth] Profile found:', userData.email, '| role:', userData.role);

      // 3. Update last_login timestamp (non-blocking)
      supabase
        .from('app_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userData.id)
        .then(() => {});

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

        // Auto-select the user's assigned branch
        if (loggedInUser.storeId) {
          localStorage.setItem('pos_selected_store', loggedInUser.storeId);
        }
      }

      setUser(loggedInUser);
      setSession(sessionData);
      setIsSessionExpired(false);

      // 4. ✅ Create a session row in user_sessions (powers the Sessions page)
      await startSessionRow(loggedInUser.id, loggedInUser.storeId);

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

  // ── Restore session on mount ──────────────────────────────────────────────
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
            // Note: we do NOT call startSessionRow here — the existing open
            // session row from login is still active (recovered via sessionStorage).
          }
        }
      } catch (err) {
        console.error('[Auth] Session restore failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed silently');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [generateSessionId]);

  // ── Activity listeners ────────────────────────────────────────────────────
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