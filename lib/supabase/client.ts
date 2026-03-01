import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using mock data mode.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,       // keep session in localStorage across page reloads
      autoRefreshToken: true,     // silently refresh JWT before it expires
      detectSessionInUrl: true,   // handle magic link / OAuth redirects
    },
  }
);