// app/api/users/update/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { userId, email, password, firstName, lastName, role, storeId, isActive } =
      await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Update auth (email + password)
    const authUpdates: any = {};
    if (email)    authUpdates.email    = email;
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update profile
    const profileUpdate: Record<string, any> = {};
    if (email      !== undefined) profileUpdate.email      = email;
    if (firstName  !== undefined) profileUpdate.first_name = firstName;
    if (lastName   !== undefined) profileUpdate.last_name  = lastName;
    if (role       !== undefined) profileUpdate.role       = role;
    if (storeId    !== undefined) profileUpdate.store_id   = storeId;
    if (isActive   !== undefined) profileUpdate.is_active  = isActive;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from('app_users')
        .update(profileUpdate)
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}