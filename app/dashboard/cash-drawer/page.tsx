'use client';
// app/dashboard/cash-drawer/page.tsx
// Reads/writes Supabase `cash_drawer_sessions` table — real data, works across all devices.
//
// ONE-TIME SETUP: Run cash-drawer-offline-setup.sql in Supabase SQL Editor first.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, DollarSign, Plus, X, CheckCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerSession {
  id: string;
  cashierId: string;
  cashierName: string;
  storeId: string;
  openingAmount: number;
  closingAmount: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashDrawerPage() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const storeId = currentStore?.id ?? null;

  const [drawers, setDrawers]             = useState<DrawerSession[]>([]);
  const [activeDrawer, setActiveDrawer]   = useState<DrawerSession | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');

  const [showOpenForm, setShowOpenForm]   = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes]                 = useState('');

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('cash_drawer_sessions')
        .select(`
          id, cashier_id, store_id, opening_amount, closing_amount,
          variance, status, notes, opened_at, closed_at,
          app_users ( first_name, last_name )
        `)
        .eq('store_id', storeId)
        .order('opened_at', { ascending: false })
        .limit(50);

      if (err) { setError(err.message); return; }

      const mapped: DrawerSession[] = (data || []).map((row: any) => ({
        id:            row.id,
        cashierId:     row.cashier_id,
        cashierName:   row.app_users
          ? `${row.app_users.first_name ?? ''} ${row.app_users.last_name ?? ''}`.trim()
          : row.cashier_id,
        storeId:       row.store_id,
        openingAmount: row.opening_amount ?? 0,
        closingAmount: row.closing_amount ?? null,
        variance:      row.variance ?? null,
        status:        row.status ?? 'closed',
        notes:         row.notes ?? null,
        openedAt:      row.opened_at,
        closedAt:      row.closed_at ?? null,
      }));

      setDrawers(mapped);

      // Find the current user's open drawer
      const mine = mapped.find(d => d.status === 'open' && d.cashierId === user?.id);
      setActiveDrawer(mine ?? null);

    } catch (e) {
      setError('Failed to load cash drawer data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [storeId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Open drawer ─────────────────────────────────────────────────────────────

  const handleOpen = async () => {
    if (!user || !storeId || !openingAmount) return;
    setSaving(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('cash_drawer_sessions')
        .insert([{
          cashier_id:     user.id,
          store_id:       storeId,
          opening_amount: Number(openingAmount),
          status:         'open',
        }])
        .select(`
          id, cashier_id, store_id, opening_amount, closing_amount,
          variance, status, notes, opened_at, closed_at,
          app_users ( first_name, last_name )
        `)
        .single();

      if (err) { setError(err.message); return; }

      const newDrawer: DrawerSession = {
        id:            data.id,
        cashierId:     data.cashier_id,
        cashierName:   (() => {
  const u = data.app_users as { first_name?: string; last_name?: string } | null;
  return u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : data.cashier_id;
})(),
        storeId:       data.store_id,
        openingAmount: data.opening_amount,
        closingAmount: null,
        variance:      null,
        status:        'open',
        notes:         null,
        openedAt:      data.opened_at,
        closedAt:      null,
      };

      setDrawers(prev => [newDrawer, ...prev]);
      setActiveDrawer(newDrawer);
      setOpeningAmount('');
      setShowOpenForm(false);
      showSuccess('Cash drawer opened successfully.');
    } finally {
      setSaving(false);
    }
  };

  // ── Close drawer ────────────────────────────────────────────────────────────

  const handleClose = async () => {
    if (!activeDrawer || !closingAmount) return;
    setSaving(true);
    setError('');
    try {
      const closing  = Number(closingAmount);
      const variance = closing - activeDrawer.openingAmount;

      const { error: err } = await supabase
        .from('cash_drawer_sessions')
        .update({
          closing_amount: closing,
          variance,
          status:         'closed',
          notes:          notes || null,
          closed_at:      new Date().toISOString(),
        })
        .eq('id', activeDrawer.id);

      if (err) { setError(err.message); return; }

      setDrawers(prev => prev.map(d =>
        d.id === activeDrawer.id
          ? { ...d, closingAmount: closing, variance, status: 'closed', notes: notes || null, closedAt: new Date().toISOString() }
          : d
      ));
      setActiveDrawer(null);
      setClosingAmount('');
      setNotes('');
      setShowCloseForm(false);
      showSuccess('Drawer closed and reconciled.');
    } finally {
      setSaving(false);
    }
  };

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const today        = new Date().toDateString();
    const todayDrawers = drawers.filter(d => new Date(d.openedAt).toDateString() === today);
    const closedToday  = todayDrawers.filter(d => d.status === 'closed');
    const totalVar     = closedToday.reduce((s, d) => s + (d.variance ?? 0), 0);
    return {
      active:    drawers.filter(d => d.status === 'open').length,
      today:     todayDrawers.length,
      closed:    closedToday.length,
      totalVar,
      avgVar:    closedToday.length > 0 ? totalVar / closedToday.length : 0,
    };
  }, [drawers]);

  const variance = closingAmount
    ? Number(closingAmount) - (activeDrawer?.openingAmount ?? 0)
    : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400">
            Cash Drawer Management
          </h1>
          <p className="text-slate-400 mt-2">Track and reconcile cash transactions</p>
        </div>
        <Button onClick={load} variant="outline" size="sm"
          className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          ⚠ {error} — Run <code className="font-mono text-xs">cash-drawer-offline-setup.sql</code> if the table doesn't exist yet.
        </div>
      )}
      {success && (
        <Alert className="bg-green-900/30 border-green-700">
          <AlertDescription className="text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Active Drawers</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{stats.active}</div>
            <p className="text-xs text-green-400 mt-1">Open now</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Today's Sessions</CardTitle>
            <DollarSign className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">{stats.today}</div>
            <p className="text-xs text-cyan-400 mt-1">{stats.closed} closed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-950 to-blue-900 border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Variance</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalVar >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
              {formatCurrency(stats.totalVar)}
            </div>
            <p className="text-xs text-blue-400 mt-1">Avg: {formatCurrency(stats.avgVar)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-950 to-violet-900 border-violet-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Your Status</CardTitle>
            <CheckCircle className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeDrawer ? 'text-green-300' : 'text-slate-400'}`}>
              {activeDrawer ? 'OPEN' : 'CLOSED'}
            </div>
            <p className="text-xs text-violet-400 mt-1">Your drawer</p>
          </CardContent>
        </Card>
      </div>

      {/* Active drawer banner */}
      {activeDrawer && (
        <Alert className="bg-amber-950 border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            Active drawer opened at {new Date(activeDrawer.openedAt).toLocaleTimeString()} with float of {formatCurrency(activeDrawer.openingAmount)}.
          </AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        {!activeDrawer ? (
          <Button onClick={() => setShowOpenForm(true)}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4" /> Open Cash Drawer
          </Button>
        ) : (
          <Button onClick={() => setShowCloseForm(true)}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <X className="w-4 h-4" /> Close & Reconcile
          </Button>
        )}
      </div>

      {/* Open form */}
      {showOpenForm && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Open Cash Drawer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-200">Opening Float</label>
              <Input type="number" value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                placeholder="Enter opening amount"
                className="mt-1 bg-slate-700 border-slate-600 text-white" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpen} disabled={saving || !openingAmount}
                className="flex-1 bg-green-600 hover:bg-green-700">
                {saving ? 'Opening...' : 'Open Drawer'}
              </Button>
              <Button onClick={() => { setShowOpenForm(false); setOpeningAmount(''); }}
                variant="outline" className="flex-1">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close form */}
      {showCloseForm && activeDrawer && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Close & Reconcile Drawer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-slate-700 rounded-lg space-y-1">
              <p className="text-sm text-slate-300">
                Opening Float: <span className="font-bold text-green-400">{formatCurrency(activeDrawer.openingAmount)}</span>
              </p>
              <p className="text-sm text-slate-300">
                Opened at: <span className="text-slate-200">{new Date(activeDrawer.openedAt).toLocaleTimeString()}</span>
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-200">Actual Cash Count</label>
              <Input type="number" value={closingAmount}
                onChange={e => setClosingAmount(e.target.value)}
                placeholder="Count the physical cash and enter here"
                className="mt-1 bg-slate-700 border-slate-600 text-white" />
            </div>

            {variance !== null && (
              <div className={`p-3 rounded-lg ${variance >= 0 ? 'bg-green-900/40 border border-green-700' : 'bg-red-900/40 border border-red-700'}`}>
                <p className="text-sm font-semibold">
                  Variance:{' '}
                  <span className={variance >= 0 ? 'text-green-300' : 'text-red-300'}>
                    {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                  </span>
                  <span className="text-slate-400 text-xs ml-2">
                    {variance > 0 ? '(surplus)' : variance < 0 ? '(shortage)' : '(exact match ✓)'}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-200">Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any discrepancies or notes..."
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={3} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClose} disabled={saving || !closingAmount}
                className="flex-1 bg-violet-600 hover:bg-violet-700">
                {saving ? 'Saving...' : 'Reconcile & Close'}
              </Button>
              <Button onClick={() => { setShowCloseForm(false); setClosingAmount(''); setNotes(''); }}
                variant="outline" className="flex-1">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session history */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Sessions</CardTitle>
          <CardDescription className="text-slate-400">Last 20 cash drawer sessions for this store</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : drawers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No drawer sessions yet.</div>
          ) : (
            <div className="space-y-2">
              {drawers.slice(0, 20).map(drawer => (
                <div key={drawer.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {formatCurrency(drawer.openingAmount)}
                      {drawer.closingAmount != null ? ` → ${formatCurrency(drawer.closingAmount)}` : ' → ...'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {drawer.cashierName} · {new Date(drawer.openedAt).toLocaleString()}
                    </p>
                    {drawer.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">{drawer.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {drawer.variance != null && (
                      <span className={`text-sm font-bold ${drawer.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {drawer.variance >= 0 ? '+' : ''}{formatCurrency(drawer.variance)}
                      </span>
                    )}
                    <Badge className={drawer.status === 'open' ? 'bg-green-600' : 'bg-gray-600'}>
                      {drawer.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}