// File: app/api/users/clean-stale/route.ts

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
    const adminClient = getAdminClient();

    // Get all profiles from app_users
    const { data: appUsers, error: appUsersError } = await adminClient
      .from('app_users')
      .select('id, email');

    if (appUsersError) {
      return NextResponse.json({ error: appUsersError.message }, { status: 500 });
    }

    if (!appUsers || appUsers.length === 0) {
      return NextResponse.json({ cleaned: 0 });
    }

    // Get all users from Supabase Auth
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const authUserIds = new Set(authData?.users?.map(u => u.id) ?? []);

    // Find app_users rows with no matching Auth user (orphaned/stale)
    const staleUsers = appUsers.filter(u => !authUserIds.has(u.id));

    if (staleUsers.length === 0) {
      return NextResponse.json({ cleaned: 0 });
    }

    let cleaned = 0;
    const cleanedEmails: string[] = [];

    for (const staleUser of staleUsers) {
      try {
        // Get linked worker id
        const { data: workerData } = await adminClient
          .from('workers')
          .select('id')
          .eq('user_id', staleUser.id)
          .maybeSingle();

        // Delete worker child records
        if (workerData?.id) {
          for (const table of [
            'worker_queries',
            'shifts',
            'attendance',
            'leave_requests',
            'performance_reviews',
            'salary_records',
          ]) {
            await adminClient.from(table).delete().eq('worker_id', workerData.id);
          }
        }

        // Nullify transaction/receipt references to preserve financial history
        for (const { table, column } of [
          { table: 'transactions', column: 'cashier_id' },
          { table: 'transactions', column: 'user_id' },
          { table: 'receipts',     column: 'cashier_id' },
          { table: 'receipts',     column: 'user_id' },
        ]) {
          await adminClient
            .from(table)
            .update({ [column]: null })
            .eq(column, staleUser.id);
        }

        // Delete worker record
        await adminClient.from('workers').delete().eq('user_id', staleUser.id);

        // Delete app_users profile
        await adminClient.from('app_users').delete().eq('id', staleUser.id);

        cleaned++;
        cleanedEmails.push(staleUser.email);
      } catch (err) {
        console.warn(`Failed to clean stale user ${staleUser.email}:`, err);
      }
    }

    return NextResponse.json({ cleaned, cleanedEmails });

  } catch (err) {
    console.error('Clean stale users error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}