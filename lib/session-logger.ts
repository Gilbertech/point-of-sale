// auth-context-session-patch.ts
// ─────────────────────────────────────────────────────────────────────────────
// Paste the two helper functions below into your existing auth-context.tsx.
// Then call startSession() right after a successful login,
// and call endSession() right before signing out.
//
// This is what makes the Sessions page show real data.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase/client';

// ── Stored in module scope (survives re-renders) ──────────────────────────────
let _currentSessionRowId: string | null = null;

// ── Call this right after login succeeds ─────────────────────────────────────

export async function startSession(userId: string, storeId: string | null) {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert([{
        user_id:  userId,
        store_id: storeId ?? null,
        status:   'active',
      }])
      .select('id')
      .single();

    if (error) {
      console.warn('[Session] Could not start session row:', error.message);
      return;
    }

    _currentSessionRowId = data.id;
    // Persist across page refreshes
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pos_session_row_id', data.id);
    }
  } catch (e) {
    console.warn('[Session] startSession exception:', e);
  }
}

// ── Call this right before supabase.auth.signOut() ───────────────────────────

export async function endSession(reason = 'manual_logout') {
  // Recover id from sessionStorage if module reloaded
  if (!_currentSessionRowId && typeof window !== 'undefined') {
    _currentSessionRowId = sessionStorage.getItem('pos_session_row_id');
  }

  if (!_currentSessionRowId) return;

  try {
    // Calculate duration from the stored login_at
    const { data: row } = await supabase
      .from('user_sessions')
      .select('login_at')
      .eq('id', _currentSessionRowId)
      .single();

    const loginTime    = row?.login_at ? new Date(row.login_at).getTime() : Date.now();
    const durationMins = Math.max(0, Math.round((Date.now() - loginTime) / 60000));

    await supabase
      .from('user_sessions')
      .update({
        status:           'ended',
        logout_at:        new Date().toISOString(),
        duration_minutes: durationMins,
        logout_reason:    reason,
      })
      .eq('id', _currentSessionRowId);

  } catch (e) {
    console.warn('[Session] endSession exception:', e);
  } finally {
    _currentSessionRowId = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pos_session_row_id');
    }
  }
}

// ── Increment activity counter (optional, call on each meaningful action) ────

export async function incrementActivity() {
  if (!_currentSessionRowId && typeof window !== 'undefined') {
    _currentSessionRowId = sessionStorage.getItem('pos_session_row_id');
  }
  if (!_currentSessionRowId) return;

  try {
    await supabase.rpc('increment_session_activity', {
      session_id: _currentSessionRowId,
    });
  } catch {
    // non-critical — ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL for the incrementActivity RPC (run in Supabase SQL Editor once):
//
// CREATE OR REPLACE FUNCTION increment_session_activity(session_id uuid)
// RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
//   UPDATE user_sessions
//   SET activity_count = activity_count + 1
//   WHERE id = session_id;
// $$;
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO WIRE INTO auth-context.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Import at the top of auth-context.tsx:
//    import { startSession, endSession } from './auth-context-session-patch';
//
// 2. In your login() function, after successfully getting the user profile:
//    await startSession(user.id, user.store_id ?? null);
//
// 3. In your logout() function, before calling supabase.auth.signOut():
//    await endSession('manual_logout');
//
// That's it. The Sessions page will start showing real data immediately.
// ─────────────────────────────────────────────────────────────────────────────