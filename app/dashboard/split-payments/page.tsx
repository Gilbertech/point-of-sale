'use client';
// app/dashboard/split-payments/page.tsx
// Reads from Supabase `split_payment_transactions` table — real data, works across all devices.
//
// ONE-TIME SETUP (run split-payments-sessions-setup.sql in Supabase SQL Editor first)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store-context';
import { supabase } from '@/lib/supabase/client';
import { Download, CreditCard, RefreshCw, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentSplit {
  method: 'cash' | 'card' | 'check' | 'mobile' | string;
  amount: number;
}

interface SplitTransaction {
  id: string;
  transactionId: string;
  payments: PaymentSplit[];
  totalAmount: number;
  status: 'completed' | 'pending' | 'failed';
  storeId: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  cash:   'bg-green-500',
  card:   'bg-blue-600',
  check:  'bg-amber-500',
  mobile: 'bg-secondary',
};

function methodColor(method: string) {
  return METHOD_COLORS[method.toLowerCase()] ?? 'bg-muted-foreground/20';
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SplitPaymentsPage() {
  const { currentStore } = useStore();
  const storeId = currentStore?.id ?? null;

  const [transactions, setTransactions] = useState<SplitTransaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // ── Load from Supabase ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('split_payment_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) query = query.eq('store_id', storeId);

      const { data, error: err } = await query;
      if (err) { setError(err.message); return; }

      setTransactions((data || []).map(row => ({
        id:            row.id,
        transactionId: row.transaction_id,
        payments:      Array.isArray(row.payments) ? row.payments : [],
        totalAmount:   row.total_amount ?? 0,
        status:        row.status ?? 'completed',
        storeId:       row.store_id ?? null,
        createdAt:     row.created_at,
      })));
    } catch (e) {
      setError('Failed to load split payment data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // ── Date-filtered view ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let rows = transactions;
    if (dateFrom) rows = rows.filter(t => new Date(t.createdAt) >= new Date(dateFrom));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter(t => new Date(t.createdAt) <= end);
    }
    return rows;
  }, [transactions, dateFrom, dateTo]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const completed = filtered.filter(t => t.status === 'completed');
    const totalAmt  = completed.reduce((s, t) => s + t.totalAmount, 0);

    const byMethod = filtered.reduce((acc, t) => {
      t.payments.forEach(p => {
        const key = p.method.toLowerCase();
        if (!acc[key]) acc[key] = { count: 0, total: 0 };
        acc[key].count++;
        acc[key].total += p.amount;
      });
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return {
      total:     filtered.length,
      completed: completed.length,
      amount:    totalAmt,
      avg:       completed.length > 0 ? totalAmt / completed.length : 0,
      byMethod,
    };
  }, [filtered]);

  // ── CSV Export ──────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const rows = [
      ['Split Payment Report'],
      [`Generated: ${new Date().toISOString()}`],
      [`Total Transactions,${stats.total}`],
      [`Completed,${stats.completed}`],
      [`Total Amount,${stats.amount}`],
      [`Average Transaction,${stats.avg.toFixed(2)}`],
      [],
      ['Payment Method', 'Count', 'Total'],
      ...Object.entries(stats.byMethod).map(([m, d]) => [m, d.count, d.total.toFixed(2)]),
      [],
      ['Transaction ID', 'Date', 'Status', 'Total', 'Payment Methods'],
      ...filtered.map(t => [
        t.transactionId,
        new Date(t.createdAt).toLocaleString(),
        t.status,
        t.totalAmount.toFixed(2),
        t.payments.map(p => `${p.method}:${p.amount.toFixed(2)}`).join(' | '),
      ]),
    ];

    downloadCSV(rows.map(r => r.join(',')).join('\n'), `split-payments-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary">
            Split Payments
          </h1>
          <p className="text-muted-foreground mt-2">Track multi-method payment transactions</p>
        </div>
        <div className="flex items-center gap-3">
        {currentStore && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">{currentStore.name}</span>
          </div>
        )}
          <Button
            onClick={load}
            variant="outline"
            size="sm"
            className="gap-2 border-border text-foreground/75 hover:bg-muted"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-600 text-sm">
          ⚠ {error} — Run <code className="font-mono text-xs">split-payments-sessions-setup.sql</code> in Supabase if the table doesn't exist yet.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Transactions', value: stats.total,           sub: 'Split payments',  color: 'cyan',   Icon: CreditCard    },
          { label: 'Total Amount',       value: formatCurrency(stats.amount), sub: 'Total collected', color: 'green',  Icon: DollarSign    },
          { label: 'Average',            value: formatCurrency(stats.avg),    sub: 'Per transaction', color: 'violet', Icon: TrendingUp    },
          { label: 'Completed',          value: stats.completed,        sub: 'Fully paid',      color: 'blue',   Icon: CheckCircle2  },
        ].map(({ label, value, sub, color, Icon }) => (
          <Card key={label} className={`bg-gradient-to-br from-${color}-50 to-${color}-100 border-${color}-200`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/90">{label}</CardTitle>
              <Icon className={`h-5 w-5 text-${color}-600`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
              <p className={`text-xs text-${color}-600 mt-1`}>{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Method breakdown */}
      {Object.keys(stats.byMethod).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Payment Methods</CardTitle>
            <CardDescription className="text-muted-foreground">Breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(stats.byMethod).map(([method, data]) => (
                <div key={method} className="p-3 bg-muted rounded-lg border border-border">
                  <Badge className={`${methodColor(method)} capitalize mb-2`}>{method}</Badge>
                  <p className="font-bold text-foreground text-lg">{data.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(data.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Export */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Filters & Export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-foreground/75">From</label>
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-foreground/75">To</label>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={exportCSV} className="w-full gap-2 bg-secondary hover:bg-secondary/90">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Transactions</CardTitle>
          <CardDescription className="text-muted-foreground">
            Showing {filtered.length} split payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {error ? 'Could not load transactions.' : 'No split payment transactions found.'}
              </div>
            ) : (
              filtered.map(t => (
                <div key={t.id} className="p-3 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-foreground">
                        Transaction {t.transactionId.substring(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={t.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}>
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.payments.map((p, i) => (
                      <Badge key={i} className={`${methodColor(p.method)} capitalize`}>
                        {p.method}: {formatCurrency(p.amount)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-cyan-700 mt-2">
                    Total: {formatCurrency(t.totalAmount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}