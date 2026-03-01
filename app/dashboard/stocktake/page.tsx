'use client';
// app/dashboard/stock-take/page.tsx

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, CheckCircle2, Clock, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { getAllProducts } from '@/lib/supabase/products-helper';
import { useAuth } from '@/lib/auth-context';
import {
  getAllStockSessions,
  createStockSession,
  completeStockSession,
  saveStockCountItems,
} from '@/lib/supabase/stock-taking-helper';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockSession {
  id: string;
  name: string;
  createdBy: string;
  status: 'in-progress' | 'completed';
  itemCount: number;
  discrepancies: number;
  createdAt: Date;
  completedAt: Date | null;
}

interface CountRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  systemCount: number;
  physicalCount: number | null;
  notes: string;
}

export default function StockTakePage() {
  const { currentStore } = useStore();
  const { user } = useAuth();

  const [view, setView] = useState<'history' | 'count'>('history');
  const [sessions, setSessions] = useState<StockSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState('');
  const [rows, setRows] = useState<CountRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'counted' | 'discrepancy'>('all');

  // ── FIX: Pass currentStore?.id so each branch only sees its own sessions ──
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await getAllStockSessions(currentStore?.id ?? null);
      setSessions(data);
    } catch (error) {
      console.error('Error loading stock sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [currentStore?.id]); // ← reloads automatically when branch changes

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const startNewCount = async () => {
    if (!currentStore?.id) {
      alert('Please select a branch before starting a stock count.');
      return;
    }

    setLoadingProducts(true);
    try {
      const name = `Stock Count — ${currentStore.name} — ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
      const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

      const session = await createStockSession({
        name,
        createdBy: displayName,
        storeId: currentStore.id,
      });

      setActiveSessionId(session.id);
      setActiveSessionName(name);

      const products = await getAllProducts(currentStore.id);
      setRows(products.map((p: any) => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        category: p.category,
        systemCount: p.stock,
        physicalCount: null,
        notes: '',
      })));

      setView('count');
    } catch (error) {
      console.error('Error starting count:', error);
      alert(`Failed to start stock count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingProducts(false);
    }
  };

  const updateRow = (productId: string, field: 'physicalCount' | 'notes', value: string) => {
    setRows(prev => prev.map(row => {
      if (row.productId !== productId) return row;
      if (field === 'physicalCount') return { ...row, physicalCount: value === '' ? null : Number(value) };
      return { ...row, notes: value };
    }));
  };

  const handleSave = async () => {
    if (!activeSessionId) return;
    if (!currentStore?.id) {
      alert('No store selected. Please select a branch from the sidebar.');
      return;
    }

    const counted = rows.filter(r => r.physicalCount !== null);
    if (counted.length === 0) {
      alert('Please enter at least one physical count before saving.');
      return;
    }

    setSaving(true);
    try {
      const itemsToSave = counted.map(r => ({
        productId: r.productId,
        systemCount: r.systemCount,
        physicalCount: r.physicalCount!,
        variance: r.physicalCount! - r.systemCount,
        notes: r.notes,
        storeId: currentStore.id,
      }));

      await saveStockCountItems(activeSessionId, itemsToSave);

      const discrepancies = itemsToSave.filter(i => i.variance !== 0).length;
      await completeStockSession(activeSessionId, rows.length, discrepancies);

      alert('Stock count saved successfully!');
      setView('history');
      setActiveSessionId(null);
      setRows([]);
      await loadSessions();
    } catch (error) {
      console.error('Error saving stock count:', error);
      alert(`Failed to save stock count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const counted    = rows.filter(r => r.physicalCount !== null && r.physicalCount === r.systemCount).length;
  const mismatched = rows.filter(r => r.physicalCount !== null && r.physicalCount !== r.systemCount).length;
  const pending    = rows.filter(r => r.physicalCount === null).length;
  const progress   = rows.length > 0 ? Math.round(((counted + mismatched) / rows.length) * 100) : 0;

  const filteredRows = useMemo(() => {
    let res = [...rows];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'pending')     res = res.filter(r => r.physicalCount === null);
    if (filterStatus === 'counted')     res = res.filter(r => r.physicalCount !== null && r.physicalCount === r.systemCount);
    if (filterStatus === 'discrepancy') res = res.filter(r => r.physicalCount !== null && r.physicalCount !== r.systemCount);
    return res;
  }, [rows, searchQuery, filterStatus]);

  if (loadingSessions) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stock takes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Taking</h1>
          <p className="text-muted-foreground mt-1">
            {currentStore
              ? `Inventory counts for ${currentStore.name}`
              : 'Conduct inventory counts and identify discrepancies'}
          </p>
        </div>
        <div className="flex gap-2">
          {view === 'count' && (
            <Button variant="outline" onClick={() => setView('history')}>← History</Button>
          )}
          {view === 'history' && (
            <Button
              onClick={startNewCount}
              disabled={loadingProducts || !currentStore}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loadingProducts
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Loading products...</>
                : <><Plus className="w-4 h-4" /> New Count</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* No store warning */}
      {!currentStore && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No store selected. Please select a branch from the sidebar.</AlertDescription>
        </Alert>
      )}

      {/* ── HISTORY VIEW ─────────────────────────────────────────────────────── */}
      {view === 'history' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-12 text-muted-foreground">
                {currentStore
                  ? `No stock counts recorded yet for ${currentStore.name}. Start your first count above.`
                  : 'No stock counts recorded yet. Start your first count above.'}
              </CardContent>
            </Card>
          ) : (
            sessions.map(session => (
              <Card key={session.id} className="bg-card border-border hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${session.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      {session.status === 'completed'
                        ? <CheckCircle2 className="w-5 h-5 text-green-700" />
                        : <Clock className="w-5 h-5 text-yellow-700" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{session.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {session.createdAt.toLocaleDateString()} · By {session.createdBy}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-foreground">{session.itemCount}</p>
                      <p className="text-xs text-muted-foreground">Items</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${session.discrepancies > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {session.discrepancies}
                      </p>
                      <p className="text-xs text-muted-foreground">Discrepancies</p>
                    </div>
                    <Badge className={session.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                    }>
                      {session.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── COUNT VIEW ───────────────────────────────────────────────────────── */}
      {view === 'count' && (
        <div className="space-y-4">
          {/* Progress bar */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="font-semibold text-foreground">{activeSessionName}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />{pending} pending
                  </span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />{counted} matched
                  </span>
                  <span className="text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />{mismatched} mismatched
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {progress}% complete ({rows.length} total products)
              </p>
            </CardContent>
          </Card>

          {/* Search & filter */}
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 border-border bg-input text-foreground"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'counted', 'discrepancy'] as const).map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={filterStatus === s ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Count table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Product Count</CardTitle>
              <CardDescription>Enter the physical count for each item. Leave blank to skip.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {['Product', 'SKU', 'Category', 'System Count', 'Physical Count', 'Variance', 'Notes', 'Status'].map(h => (
                        <th key={h} className="py-3 px-4 font-semibold text-foreground text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No products found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map(row => {
                        const variance = row.physicalCount !== null ? row.physicalCount - row.systemCount : null;
                        const rowBg = row.physicalCount === null
                          ? ''
                          : variance === 0 ? 'bg-green-50/40' : 'bg-yellow-50/40';

                        return (
                          <tr key={row.productId} className={`border-b border-border transition-colors ${rowBg}`}>
                            <td className="py-3 px-4 font-medium text-foreground">{row.productName}</td>
                            <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{row.sku}</td>
                            <td className="py-3 px-4"><Badge variant="outline">{row.category}</Badge></td>
                            <td className="py-3 px-4 font-semibold text-foreground">{row.systemCount}</td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min={0}
                                value={row.physicalCount ?? ''}
                                onChange={e => updateRow(row.productId, 'physicalCount', e.target.value)}
                                placeholder="—"
                                className="w-24 text-center border-border bg-input text-foreground"
                              />
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {variance === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className={
                                  variance === 0 ? 'text-green-600'
                                  : variance > 0 ? 'text-blue-600'
                                  : 'text-red-600'
                                }>
                                  {variance > 0 ? '+' : ''}{variance}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                value={row.notes}
                                onChange={e => updateRow(row.productId, 'notes', e.target.value)}
                                placeholder="Note..."
                                className="w-32 border-border bg-input text-foreground text-xs"
                              />
                            </td>
                            <td className="py-3 px-4">
                              {row.physicalCount === null && (
                                <Badge className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" />Pending
                                </Badge>
                              )}
                              {row.physicalCount !== null && variance === 0 && (
                                <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />Matched
                                </Badge>
                              )}
                              {row.physicalCount !== null && variance !== 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" />Mismatch
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {mismatched > 0 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {mismatched} item{mismatched > 1 ? 's have' : ' has'} stock discrepancies. Review before saving.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleSave}
                  disabled={saving || rows.filter(r => r.physicalCount !== null).length === 0}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Complete Stock Count'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}