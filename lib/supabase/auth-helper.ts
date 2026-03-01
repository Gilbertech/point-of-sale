// lib/supabase/auth-helper.ts
// FIXED: All Admin Auth operations now go through API routes (server-side).
// Client-side code never touches the service role key.

import { supabase } from './client';
import { createClient } from '@supabase/supabase-js';

// ── Admin client — only safe in server context (API routes / server actions) ──
// If you need to call admin ops from the browser, use the API routes below.
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local (server-only, never NEXT_PUBLIC_).'
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}

export interface CreateUserParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  storeId: string | null;
}

export interface UpdateUserParams {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  storeId?: string | null;
  isActive?: boolean;
}

// ── CREATE USER via API route (browser-safe) ──────────────────────────────────
export async function createUser(params: CreateUserParams) {
  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to create user');
  return json;
}

// ── UPDATE USER ───────────────────────────────────────────────────────────────
// Password updates need the admin API — route them through an API endpoint too.
export async function updateUser(userId: string, params: UpdateUserParams) {
  // Profile-only update (no password) — safe from client side
  if (!params.password) {
    const profileUpdate: Record<string, any> = {};
    if (params.email     !== undefined) profileUpdate.email      = params.email;
    if (params.firstName !== undefined) profileUpdate.first_name = params.firstName;
    if (params.lastName  !== undefined) profileUpdate.last_name  = params.lastName;
    if (params.role      !== undefined) profileUpdate.role       = params.role;
    if (params.storeId   !== undefined) profileUpdate.store_id   = params.storeId;
    if (params.isActive  !== undefined) profileUpdate.is_active  = params.isActive;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabase
        .from('app_users')
        .update(profileUpdate)
        .eq('id', userId);
      if (error) throw new Error(error.message);
    }
    return;
  }

  // Has password — must go server-side
  const res = await fetch('/api/users/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...params }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to update user');
}

// ── DELETE USER via API route ─────────────────────────────────────────────────
export async function deleteUser(userId: string) {
  const res = await fetch('/api/users/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to delete user');
}

// ── GET ALL USERS (client-safe — reads from app_users table) ──────────────────
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('first_name');

  if (error) throw new Error(error.message);

  return (data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    storeId: u.store_id,
    isActive: u.is_active ?? true,
    lastLogin: u.last_login,
    createdAt: u.created_at,
  }));
}