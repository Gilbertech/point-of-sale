'use client';
// app/login/page.tsx
// ✅ Email confirmation bypassed via /api/confirm-customer (server-side Admin API)
// ✅ Customer is signed in immediately after registration — no email check needed
// ✅ Branch selector with two-attempt fallback

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Mail, ShoppingBag, UserPlus, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

const ROLE_ROUTES: Record<string, string> = {
  super_admin:     '/dashboard',
  admin:           '/dashboard',
  manager:         '/dashboard',
  cashier:         '/dashboard/sales',
  inventory_staff: '/dashboard/inventory',
  customer:        '/dashboard/query',
};

type Store = { id: string; name: string; address?: string | null };

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<'login' | 'register'>('login');

  // ── Login state ──────────────────────────────────────────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError]               = useState('');

  // ── Register state ───────────────────────────────────────────────────────
  const [reg, setReg] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirm: '', storeId: '',
  });
  const [stores, setStores]               = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError]     = useState('');
  const [regLoading, setRegLoading]       = useState(false);
  const [regError, setRegError]           = useState('');
  const [regStep, setRegStep]             = useState('');   // progress message

  const setRegField = (k: keyof typeof reg, v: string) =>
    setReg(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!loading && isAuthenticated) router.push('/dashboard');
  }, [loading, isAuthenticated, router]);

  // ── Robust store fetching ────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'register') return;

    const fetchStores = async () => {
      setStoresLoading(true);
      setStoresError('');
      setStores([]);

      try {
        const { data: activeData, error: activeError } = await supabase
          .from('stores').select('id, name, address').eq('is_active', true).order('name');

        if (!activeError && activeData && activeData.length > 0) {
          setStores(activeData); return;
        }

        const { data: allData, error: allError } = await supabase
          .from('stores').select('id, name, address').order('name');

        if (!allError && allData && allData.length > 0) {
          setStores(allData);
        } else if (allError) {
          setStoresError('Could not load branches. Please contact staff.');
        } else {
          setStoresError('No branches found. Please ask your administrator to add branches.');
        }
      } catch (e) {
        setStoresError('Failed to load branches. Please refresh and try again.');
      } finally {
        setStoresLoading(false);
      }
    };

    fetchStores();
  }, [view]);

  if (loading) return null;
  if (isAuthenticated) return null;

  // ── Login handler ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoginLoading(true);
    setError('');
    try {
      const loggedInUser = await login(email, password);
      router.push(ROLE_ROUTES[loggedInUser.role] ?? '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
      setLoginLoading(false);
    }
  };

  // ── Register handler ─────────────────────────────────────────────────────
  //
  // Flow:
  //   1. supabase.auth.signUp()            → creates unconfirmed account
  //   2. POST /api/confirm-customer        → server confirms it via Admin API
  //   3. supabase.auth.signInWithPassword  → now succeeds (account confirmed)
  //   4. redirect to /dashboard/query
  //
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reg.firstName || !reg.lastName || !reg.email || !reg.password) {
      setRegError('Please fill in all required fields.'); return;
    }
    if (!reg.storeId) {
      setRegError('Please select the branch where you shop.'); return;
    }
    if (reg.password !== reg.confirm) { setRegError('Passwords do not match.'); return; }
    if (reg.password.length < 6)      { setRegError('Password must be at least 6 characters.'); return; }

    setRegLoading(true);
    setRegError('');
    setRegStep('Checking email…');

    try {
      // ── Check for existing account ──
      const { data: existing } = await supabase
        .from('app_users').select('id').eq('email', reg.email).maybeSingle();

      if (existing) {
        setRegError('An account with this email already exists. Please sign in.');
        return;
      }

      // ── Step 1: Create auth account ──
      setRegStep('Creating account…');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    reg.email,
        password: reg.password,
        options: {
          data: {
            first_name: reg.firstName,
            last_name:  reg.lastName,
            role:       'customer',
            store_id:   reg.storeId,
          },
        },
      });

      if (authError || !authData.user) {
        setRegError(authError?.message ?? 'Registration failed. Please try again.');
        return;
      }

      const userId = authData.user.id;

      // ── Step 2: Auto-confirm via server API route ──
      setRegStep('Activating account…');
      const confirmRes = await fetch('/api/confirm-customer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      });

      if (!confirmRes.ok) {
        const confirmErr = await confirmRes.json().catch(() => ({}));
        console.error('[Register] Confirm failed:', confirmErr);
        // Non-fatal: continue anyway — sign-in may still work if Supabase
        // "Confirm email" was already disabled in the dashboard
      }

      // ── Step 3: Write profile rows ──
      setRegStep('Saving profile…');

      await supabase.from('app_users').upsert({
        id:         userId,
        email:      reg.email,
        first_name: reg.firstName,
        last_name:  reg.lastName,
        role:       'customer',
        is_active:  true,
        store_id:   reg.storeId,
      }, { onConflict: 'id' });

      await supabase.from('customers').upsert([{
        id:             userId,
        first_name:     reg.firstName,
        last_name:      reg.lastName,
        email:          reg.email,
        phone:          reg.phone || null,
        store_id:       reg.storeId,
        loyalty_points: 0,
        total_spent:    0,
      }], { onConflict: 'id' });

      // ── Step 4: Sign in immediately ──
      setRegStep('Signing you in…');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email:    reg.email,
        password: reg.password,
      });

      if (signInError || !signInData.session) {
        console.error('[Register] Sign-in after registration failed:', signInError?.message);
        // Fall back to login page with helpful message
        setView('login');
        setEmail(reg.email);
        setError(
          'Account created! You can now sign in. ' +
          '(If this fails, go to Supabase → Authentication → Email → disable "Confirm email")'
        );
        return;
      }

      // ── Step 5: Redirect ──
      router.push('/dashboard/query');

    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setRegLoading(false);
      setRegStep('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <ShoppingBag className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">POS System</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {view === 'login' ? 'Sign in to your account' : 'Create a customer account'}
          </p>
        </div>

        {/* ── Login Card ── */}
        {view === 'login' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-foreground">Welcome back</CardTitle>
              <CardDescription>Enter your credentials to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="pl-10" required autoComplete="email" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="pl-10" required autoComplete="current-password" />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-border text-center">
                <p className="text-sm text-muted-foreground">
                  New customer?{' '}
                  <button type="button" onClick={() => { setView('register'); setError(''); }}
                    className="text-primary font-semibold hover:underline">
                    Create an account
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Register Card ── */}
        {view === 'register' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Customer Registration
              </CardTitle>
              <CardDescription>Create your account to track orders and submit queries</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <Alert variant="destructive">
                    <AlertDescription>{regError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input value={reg.firstName} onChange={e => setRegField('firstName', e.target.value)} placeholder="Jane" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input value={reg.lastName} onChange={e => setRegField('lastName', e.target.value)} placeholder="Doe" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" value={reg.email} onChange={e => setRegField('email', e.target.value)}
                      placeholder="you@example.com" className="pl-10" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Phone <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input type="tel" value={reg.phone} onChange={e => setRegField('phone', e.target.value)} placeholder="+254 7XX XXX XXX" />
                </div>

                {/* Branch selector */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    Which branch do you shop at? *
                  </Label>

                  {storesLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 border border-input rounded-md text-sm text-muted-foreground">
                      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading branches...
                    </div>
                  ) : storesError ? (
                    <div className="px-3 py-3 border border-destructive/30 bg-destructive/5 rounded-md space-y-1">
                      <p className="text-sm text-destructive font-medium">⚠️ Could not load branches</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{storesError}</p>
                      <button type="button" onClick={() => { setView('login'); setTimeout(() => setView('register'), 50); }}
                        className="text-xs text-primary font-semibold hover:underline mt-1">↻ Try again</button>
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="px-3 py-2.5 border border-input rounded-md text-sm text-muted-foreground">
                      No branches found — please contact staff.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                      {stores.map(store => (
                        <button key={store.id} type="button" onClick={() => setRegField('storeId', store.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                            reg.storeId === store.id
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border hover:border-primary/40 hover:bg-muted/50 text-foreground'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">{store.name}</p>
                              {store.address && <p className="text-xs text-muted-foreground mt-0.5">{store.address}</p>}
                            </div>
                            {reg.storeId === store.id && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" value={reg.password} onChange={e => setRegField('password', e.target.value)}
                      placeholder="Min 6 characters" className="pl-10" required autoComplete="new-password" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" value={reg.confirm} onChange={e => setRegField('confirm', e.target.value)}
                      placeholder="Repeat password" className="pl-10" required autoComplete="new-password" />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={regLoading || storesLoading}>
                  {regLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {regStep || 'Creating account...'}
                    </span>
                  ) : 'Create Account'}
                </Button>

                <button type="button" onClick={() => { setView('login'); setRegError(''); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                  Already have an account? Sign in
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Staff? Contact your administrator for access.
        </p>
      </div>
    </div>
  );
}