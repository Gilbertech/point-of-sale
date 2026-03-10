// app/api/confirm-customer/route.ts
// Called right after supabase.auth.signUp() to auto-confirm the user
// so they can sign in immediately without checking their email.
//
// SETUP: Add SUPABASE_SERVICE_ROLE_KEY to your .env.local and Vercel env vars.
// Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)
// ⚠️  NEVER expose this key on the client side — only use it in API routes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // ← server-only, never sent to browser
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Use the Admin API to confirm the user's email immediately
    const { error } = await supabaseAdmin.auth.admin.updateUser(userId, {
      email_confirm: true,
    });

    if (error) {
      console.error('[confirm-customer] Admin update failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[confirm-customer] Exception:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}