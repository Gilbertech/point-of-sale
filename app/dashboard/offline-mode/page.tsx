'use client';
// app/dashboard/offline-mode/page.tsx
//
// WHAT THIS PAGE ACTUALLY IS:
// This is a "Transaction Sync Monitor" — it shows transactions that were
// recorded but are in a pending/failed state in Supabase.
//
// The old version used localStorage (data was lost on cache clear, stuck
// on one device, never actually synced). This version reads real data from
// Supabase and lets admins see and resolve genuinely stuck transactions.
//
// ONE-TIME SETUP: Run cash-drawer-offline-setup.sql in Supabase SQL Editor.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useStore } from '@/lib/store-context';
import { AlertCircle, Wifi, WifiOff, RefreshCw, Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingTransaction {
  id: string;
  transactionRef: string;
  type: string;
  amount: number;
  status: 'pending' | 'synced' | 'failed';
  errorMessage: string | null;
  attempts: number;
  storeId: string | null;
  createdAt: string;
  syncedAt: string | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfflineModePage() {
  const { currentStore } = useStore();
  const storeId = currentStore?.id ?? null;

  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [isOnline, setIsOnline]         = useState(true);
  const [retrying, setRetrying]         = useState<string | null>(null);
  const [success, setSuccess]           = useState('');

  // ── Online detection ────────────────────────────────────────────────────────

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Load from Supabase ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('pending_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (storeId) query = query.eq('store_id', storeId);

      const { data, error: err } = await query;
      if (err) { setError(err.message); return; }

      setTransactions((data || []).map(row => ({
        id:             row.id,
        transactionRef: row.transaction_ref,
        type:           row.type ?? 'sale',
        amount:         row.amount ?? 0,
        status:         row.status,
        errorMessage:   row.error_message ?? null,
        attempts:       row.attempts ?? 0,
        storeId:        row.store_id ?? null,
        createdAt:      row.created_at,
        syncedAt:       row.synced_at ?? null,
      })));
    } catch (e) {
      setError('Failed to load transaction data.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived counts ──────────────────────────────────────────────────────────

  const pending = useMemo(() => transactions.filter(t => t.status === 'pending'), [transactions]);
  const synced  = useMemo(() => transactions.filter(t => t.status === 'synced'),  [transactions]);
  const failed  = useMemo(() => transactions.filter(t => t.status === 'failed'),  [transactions]);

  // ── Retry a failed transaction ──────────────────────────────────────────────
  // Marks it back to 'pending' so your background sync job picks it up again.

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const { error: err } = await supabase
        .from('pending_transactions')
        .update({ status: 'pending', error_message: null })
        .eq('id', id);

      if (err) { setError(err.message); return; }

      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, status: 'pending', errorMessage: null } : t)
      );
      showSuccess('Transaction marked for retry.');
    } finally {
      setRetrying(null);
    }
  };

  // ── Mark synced (manual resolution) ────────────────────────────────────────

  const handleMarkSynced = async (id: string) => {
    const { error: err } = await supabase
      .from('pending_transactions')
      .update({ status: 'synced', synced_at: new Date().toISOString() })
      .eq('id', id);

    if (err) { setError(err.message); return; }

    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, status: 'synced', syncedAt: new Date().toISOString() } : t)
    );
    showSuccess('Transaction marked as synced.');
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `pending-transactions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
            Transaction Sync Monitor
          </h1>
          <p className="text-slate-400 mt-2">View and resolve pending or failed transactions</p>
        </div>
        <Button onClick={load} variant="outline" size="sm"
          className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Connection banner */}
      <Alert className={isOnline ? 'bg-green-950 border-green-800' : 'bg-amber-950 border-amber-800'}>
        <div className="flex items-center gap-2">
          {isOnline
            ? <><Wifi className="h-4 w-4 text-green-400" /><AlertDescription className="text-green-200">Connected to the internet. Supabase sync is active.</AlertDescription></>
            : <><WifiOff className="h-4 w-4 text-amber-400" /><AlertDescription className="text-amber-200">You are offline. New transactions cannot be saved until the connection is restored.</AlertDescription></>
          }
        </div>
      </Alert>

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
        {[
          { label: 'Pending',  value: pending.length, sub: 'Awaiting sync',       color: 'amber', Icon: Clock        },
          { label: 'Synced',   value: synced.length,  sub: 'Successfully synced', color: 'green', Icon: CheckCircle2 },
          { label: 'Failed',   value: failed.length,  sub: 'Sync failed',         color: 'red',   Icon: XCircle      },
          { label: 'Total',    value: transactions.length, sub: 'All records',    color: 'cyan',  Icon: RefreshCw    },
        ].map(({ label, value, sub, color, Icon }) => (
          <Card key={label} className={`bg-gradient-to-br from-${color}-950 to-${color}-900 border-${color}-800`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">{label}</CardTitle>
              <Icon className={`h-5 w-5 text-${color}-400`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-${color}-300`}>{value}</div>
              <p className={`text-xs text-${color}-400 mt-1`}>{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <Button onClick={exportJSON} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <Download className="w-4 h-4" />
          Export All Data
        </Button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Pending Transactions</CardTitle>
            <CardDescription className="text-slate-400">{pending.length} waiting to sync</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pending.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-amber-700/40">
                  <div>
                    <p className="font-semibold text-slate-100">{t.transactionRef}</p>
                    <p className="text-xs text-slate-400">{t.type} · {formatCurrency(t.amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()} · Attempts: {t.attempts}</p>
                  </div>
                  <Badge className="bg-amber-600">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Failed Transactions</CardTitle>
            <CardDescription className="text-slate-400">{failed.length} failed to sync — action required</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {failed.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-red-700/50">
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-slate-100">{t.transactionRef}</p>
                    <p className="text-xs text-slate-400">{t.type} · {formatCurrency(t.amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
                    {t.errorMessage && (
                      <p className="text-xs text-red-300 mt-1">Error: {t.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => handleRetry(t.id)}
                      disabled={retrying === t.id}
                      className="gap-1 bg-amber-600 hover:bg-amber-700 text-xs">
                      <RefreshCw className="w-3 h-3" />
                      {retrying === t.id ? '...' : 'Retry'}
                    </Button>
                    <Button size="sm" onClick={() => handleMarkSynced(t.id)}
                      className="gap-1 bg-slate-600 hover:bg-slate-500 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synced */}
      {synced.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Synced Transactions</CardTitle>
            <CardDescription className="text-slate-400">Last {Math.min(synced.length, 10)} synced</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {synced.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-green-700/40">
                  <div>
                    <p className="font-semibold text-slate-100">{t.transactionRef}</p>
                    <p className="text-xs text-slate-400">{t.type} · {formatCurrency(t.amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge className="bg-green-600">Synced</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && transactions.length === 0 && !error && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
            <p className="font-medium">All clear — no pending transactions.</p>
            <p className="text-sm mt-1">Everything is in sync.</p>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">How This Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>• Transactions saved to Supabase appear here with their sync status</p>
          <p>• <span className="text-amber-300 font-medium">Pending</span> — recorded but not yet fully processed</p>
          <p>• <span className="text-red-300 font-medium">Failed</span> — had an error; use Retry or Resolve to fix</p>
          <p>• <span className="text-green-300 font-medium">Synced</span> — successfully saved and processed</p>
          <p>• Data is stored in Supabase and visible on all devices simultaneously</p>
        </CardContent>
      </Card>
    </div>
  );
}