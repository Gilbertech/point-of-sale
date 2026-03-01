// app/api/workers/create-account/route.ts
// Server-side route: creates Supabase Auth account + workers row for a new worker.
// Uses the service role key (never exposed to the browser).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      firstName,
      lastName,
      role,
      phone       = '',
      department  = '',
      salary      = 0,
      status      = 'active',
      joinDate,
      storeId     = null,
    } = await req.json();

    // ── Validate required fields ───────────────────────────────────────────
    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json(
        { error: 'email, firstName, lastName and role are required.' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // ── Generate a default password ────────────────────────────────────────
    // Format: First3LettersOfName + 4-digit random number e.g. "Gil4829"
    const defaultPassword =
      firstName.slice(0, 3).charAt(0).toUpperCase() +
      firstName.slice(1, 3).toLowerCase() +
      Math.floor(1000 + Math.random() * 9000).toString();

    // ── Create Supabase Auth user ──────────────────────────────────────────
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password:      defaultPassword,
        email_confirm: true,           // skip email verification
        user_metadata: {
          first_name: firstName,
          last_name:  lastName,
          role,
        },
      });

    if (authError || !authData?.user) {
      console.error('[create-account] Auth error:', authError);
      return NextResponse.json(
        { error: authError?.message ?? 'Failed to create auth account.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // ── Upsert app_users row (trigger may have created it already) ─────────
    const { error: appUserError } = await admin
      .from('app_users')
      .upsert(
        {
          id:         userId,
          email,
          first_name: firstName,
          last_name:  lastName,
          role,
          store_id:   storeId,
          is_active:  status === 'active',
        },
        { onConflict: 'id' }
      );

    if (appUserError) {
      console.error('[create-account] app_users upsert error:', appUserError);
      // Non-fatal — the trigger might have set defaults; continue.
    }

    // ── Insert workers row ─────────────────────────────────────────────────
    const { data: workerData, error: workerError } = await admin
      .from('workers')
      .insert([
        {
          user_id:    userId,
          first_name: firstName,
          last_name:  lastName,
          email,
          phone,
          role,
          department,
          salary,
          status,
          join_date:  joinDate ?? new Date().toISOString().split('T')[0],
          store_id:   storeId,
        },
      ])
      .select()
      .single();

    if (workerError) {
      console.error('[create-account] workers insert error:', workerError);
      // Roll back the auth user so we don't leave orphaned accounts
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: workerError.message },
        { status: 500 }
      );
    }

    // ── Also update JWT custom claims so role is in the token immediately ──
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role, store_id: storeId },
    });

    return NextResponse.json({
      worker: {
        id:        workerData.id,
        userId,
        email,
        firstName,
        lastName,
        role,
        storeId,
      },
      defaultPassword,
    });

  } catch (err: any) {
    console.error('[create-account] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error.' },
      { status: 500 }
    );
  }
}