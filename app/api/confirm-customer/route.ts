




// app/api/confirm-customer/route.ts
//
// Does 3 things with the service role key (bypasses RLS):
//   1. Confirms the user's email so they can log in immediately
//   2. Upserts app_users row with store_id — RLS blocks the anon client from doing this,
//      which is the root cause of customers showing "All" (unassigned) in User Management
//   3. Upserts customers row
//
// SETUP: Add to .env.local AND Vercel Environment Variables:
//   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
// Get it: Supabase Dashboard → Project Settings → API → service_role (secret key)
// ⚠️  NEVER use this key on the client side.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userId, email, firstName, lastName, phone, storeId } = await req.json();

    if (!userId || !email || !firstName || !lastName || !storeId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, firstName, lastName, storeId' },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    // ── 1. Confirm email ────────────────────────────────────────────────────
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[confirm-customer] Email confirm failed:', confirmError.message);
      errors.push(`email_confirm: ${confirmError.message}`);
      // Non-fatal — continue with profile writes regardless
    }

    // ── 2. Upsert app_users with store_id (service role bypasses RLS) ───────
    // ROOT CAUSE FIX: The anon Supabase client was blocked by RLS from writing
    // to app_users, so store_id was never saved → customer showed as "All" (unassigned).
    // The service role key ignores RLS entirely.
    const { error: appUserError } = await supabaseAdmin
      .from('app_users')
      .upsert({
        id:         userId,
        email:      email,
        first_name: firstName,
        last_name:  lastName,
        role:       'customer',
        is_active:  true,
        store_id:   storeId,
      }, { onConflict: 'id' });

    if (appUserError) {
      console.error('[confirm-customer] app_users upsert failed:', appUserError.message);
      errors.push(`app_users: ${appUserError.message}`);
    }

    // ── 3. Upsert customers (service role bypasses RLS) ─────────────────────
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert([{
        id:             userId,
        first_name:     firstName,
        last_name:      lastName,
        email:          email,
        phone:          phone || null,
        store_id:       storeId,
        loyalty_points: 0,
        total_spent:    0,
      }], { onConflict: 'id' });

    if (customerError) {
      console.error('[confirm-customer] customers upsert failed:', customerError.message);
      errors.push(`customers: ${customerError.message}`);
    }

    if (errors.length > 0) {
      // Return partial — sign-in may still work even if some writes failed
      return NextResponse.json({ success: false, errors }, { status: 207 });
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error('[confirm-customer] Exception:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}