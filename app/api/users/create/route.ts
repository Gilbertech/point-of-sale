// File: app/api/users/create/route.ts

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

// Only these roles get a worker profile auto-created
const WORKER_ROLES = ['manager', 'cashier', 'inventory_staff'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, role, storeId } = body;

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // ── STEP 1: Check if email already exists in app_users ───────────────────
    const { data: existingProfile } = await adminClient
      .from('app_users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `A user with email "${email}" already exists.` },
        { status: 400 }
      );
    }

    // ── STEP 2: Create auth user (handle orphaned auth users gracefully) ──────
    let userId: string;
    let isOrphanedAuthUser = false;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // Auth user already exists but has no app_users profile (orphaned)
      if (
        authError.message?.toLowerCase().includes('already been registered') ||
        authError.message?.toLowerCase().includes('already exists') ||
        authError.code === 'email_exists'
      ) {
        const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const orphanedUser = listData?.users?.find(u => u.email === email);

        if (!orphanedUser) {
          return NextResponse.json(
            { error: 'Email conflict — could not locate existing auth user.' },
            { status: 500 }
          );
        }

        // Reuse orphaned auth user, update their password
        await adminClient.auth.admin.updateUserById(orphanedUser.id, { password });
        userId = orphanedUser.id;
        isOrphanedAuthUser = true;
      } else {
        return NextResponse.json(
          { error: authError.message ?? 'Failed to create auth user' },
          { status: 500 }
        );
      }
    } else {
      if (!authData.user) {
        return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 });
      }
      userId = authData.user.id;
    }

    // ── STEP 3: Create app_users profile ─────────────────────────────────────
    const { error: profileError } = await adminClient
      .from('app_users')
      .upsert([{
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        store_id: storeId || null,
        is_active: true,
      }], { onConflict: 'id' });

    if (profileError) {
      // Rollback: only delete auth user if we freshly created it
      if (!isOrphanedAuthUser) {
        await adminClient.auth.admin.deleteUser(userId);
      }
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // ── STEP 4: Auto-sync to workers table for worker roles ──────────────────
    // manager, cashier, inventory_staff automatically get a worker profile
    // so they show up in Worker Management without manual entry
    if (WORKER_ROLES.includes(role)) {
      const { data: existingWorker } = await adminClient
        .from('workers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!existingWorker) {
        // Create a new worker profile linked to this user
        const { error: workerError } = await adminClient.from('workers').insert([{
          first_name: firstName,
          last_name: lastName,
          email,
          role,
          store_id: storeId || null,
          status: 'active',
          salary: 0,
          join_date: new Date().toISOString().split('T')[0],
          user_id: userId,
        }]);

        if (workerError) {
          // Non-fatal: user account was created, worker profile can be added manually
          console.warn('Worker profile auto-sync failed:', workerError.message);
        }
      } else {
        // Worker exists without user_id link — patch it
        await adminClient
          .from('workers')
          .update({ user_id: userId })
          .eq('email', email);
      }
    }

    return NextResponse.json({ success: true, userId });

  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}