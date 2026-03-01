// File: app/api/users/delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) throw new Error('Missing env vars');
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // ── STEP 1: Get worker.id linked to this userId ──────────────────────────
    const { data: workerData } = await adminClient
      .from('workers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const workerId = workerData?.id ?? null;

    // ── STEP 2: Delete all tables that FK reference workers.id ───────────────
    if (workerId) {
      const workerChildTables = [
        'worker_queries',
        'shifts',
        'attendance',
        'leave_requests',
        'performance_reviews',
        'salary_records',
      ];

      for (const table of workerChildTables) {
        const { error } = await adminClient
          .from(table)
          .delete()
          .eq('worker_id', workerId);

        if (error && error.code !== 'PGRST116') {
          console.warn(`Warning deleting from ${table}:`, error.message);
        }
      }
    }

    // ── STEP 3: Nullify FK references in transactions/receipts ───────────────
    // We NULLIFY (not delete) to preserve financial history
    const appUserNullifyTargets = [
      { table: 'transactions', column: 'cashier_id' },
      { table: 'transactions', column: 'user_id' },
      { table: 'receipts',     column: 'cashier_id' },
      { table: 'receipts',     column: 'user_id' },
    ];

    for (const { table, column } of appUserNullifyTargets) {
      const { error } = await adminClient
        .from(table)
        .update({ [column]: null })
        .eq(column, userId);

      if (error && error.code !== 'PGRST116') {
        console.warn(`Warning nullifying ${table}.${column}:`, error.message);
      }
    }

    // ── STEP 4: Delete from workers ──────────────────────────────────────────
    const { error: workerError } = await adminClient
      .from('workers')
      .delete()
      .eq('user_id', userId);

    if (workerError && workerError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: `Failed to delete worker: ${workerError.message}` },
        { status: 500 }
      );
    }

    // ── STEP 5: Delete from app_users ────────────────────────────────────────
    const { error: profileError } = await adminClient
      .from('app_users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json(
        { error: `Failed to delete user profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // ── STEP 6: Delete from Supabase Auth (non-fatal if not found) ───────────
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError && !authError.message?.toLowerCase().includes('user not found')) {
      return NextResponse.json(
        { error: `Failed to delete auth user: ${authError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}