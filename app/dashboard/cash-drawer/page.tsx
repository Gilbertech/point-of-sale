'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import { CashDrawer, type CashDrawerSession } from '@/lib/cash-drawer';
import { AlertCircle, DollarSign, Plus, X, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/currency';

export default function CashDrawerPage() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const [drawers, setDrawers] = useState<CashDrawerSession[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<CashDrawerSession | null>(null);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadDrawers();
  }, []);

  const loadDrawers = () => {
    const allDrawers = CashDrawer.getAllSessions().filter(
      d => d.storeId === currentStore?.id
    );
    setDrawers(allDrawers);
    
    const active = allDrawers.find(d => d.status === 'open' && d.cashierId === user?.id);
    setActiveDrawer(active || null);
  };

  const handleOpenDrawer = () => {
    if (!user || !currentStore || !openingAmount) return;

    const drawer = CashDrawer.openCashDrawer(
      user.id,
      currentStore.id,
      Number(openingAmount)
    );

    setActiveDrawer(drawer);
    setDrawers([...drawers, drawer]);
    setOpeningAmount('');
    setShowOpenForm(false);
  };

  const handleCloseDrawer = () => {
    if (!activeDrawer || !closingAmount) return;

    const updated = CashDrawer.closeCashDrawer(
      activeDrawer.id,
      Number(closingAmount),
      notes
    );

    if (updated) {
      setDrawers(drawers.map(d => d.id === updated.id ? updated : d));
      setActiveDrawer(null);
      setClosingAmount('');
      setNotes('');
      setShowCloseForm(false);
    }
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayDrawers = drawers.filter(
      d => new Date(d.openedAt).toDateString() === today
    );
    const closedToday = todayDrawers.filter(d => d.status === 'closed');
    const totalVariance = closedToday.reduce((sum, d) => sum + (d.variance || 0), 0);

    return {
      totalToday: todayDrawers.length,
      closedToday: closedToday.length,
      activeCount: drawers.filter(d => d.status === 'open').length,
      totalVariance,
      avgVariance: closedToday.length > 0 ? totalVariance / closedToday.length : 0,
    };
  }, [drawers]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400">
          Cash Drawer Management
        </h1>
        <p className="text-slate-400 mt-2">Track and reconcile cash transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Active Drawers</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{stats.activeCount}</div>
            <p className="text-xs text-green-400 mt-1">Open now</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Today's Sessions</CardTitle>
            <DollarSign className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">{stats.totalToday}</div>
            <p className="text-xs text-cyan-400 mt-1">{stats.closedToday} closed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-950 to-blue-900 border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Variance</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalVariance >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
              {formatCurrency(stats.totalVariance)}
            </div>
            <p className="text-xs text-blue-400 mt-1">Average: {formatCurrency(stats.avgVariance)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-950 to-violet-900 border-violet-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Your Status</CardTitle>
            <CheckCircle className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-300">
              {activeDrawer ? 'OPEN' : 'CLOSED'}
            </div>
            <p className="text-xs text-violet-400 mt-1">Drawer status</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Drawer Status */}
      {activeDrawer && (
        <Alert className="bg-amber-950 border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            You have an active cash drawer opened at {new Date(activeDrawer.openedAt).toLocaleTimeString()}
            with {formatCurrency(activeDrawer.openingAmount)} float.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {!activeDrawer ? (
          <Button
            onClick={() => setShowOpenForm(true)}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Open Cash Drawer
          </Button>
        ) : (
          <Button
            onClick={() => setShowCloseForm(true)}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <X className="w-4 h-4" />
            Close & Reconcile
          </Button>
        )}
      </div>

      {/* Open Drawer Form */}
      {showOpenForm && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Open Cash Drawer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-200">Opening Float (KSH)</label>
              <Input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="Enter opening amount"
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleOpenDrawer}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Open Drawer
              </Button>
              <Button
                onClick={() => {
                  setShowOpenForm(false);
                  setOpeningAmount('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close Drawer Form */}
      {showCloseForm && activeDrawer && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Close & Reconcile Drawer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-300">
                Opening Float: <span className="font-bold text-green-400">{formatCurrency(activeDrawer.openingAmount)}</span>
              </p>
              <p className="text-sm text-slate-300 mt-1">
                Expected Cash: <span className="font-bold text-cyan-400">{formatCurrency(activeDrawer.openingAmount)}</span>
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-200">Actual Cash Count (KSH)</label>
              <Input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                placeholder="Enter actual cash count"
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {closingAmount && (
              <div className={`p-3 rounded-lg ${Number(closingAmount) >= Number(activeDrawer.openingAmount) ? 'bg-green-900' : 'bg-red-900'}`}>
                <p className="text-sm font-semibold">
                  Variance: {' '}
                  <span className={Number(closingAmount) >= Number(activeDrawer.openingAmount) ? 'text-green-300' : 'text-red-300'}>
                    {formatCurrency(Number(closingAmount) - Number(activeDrawer.openingAmount))}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-200">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any discrepancies or notes..."
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCloseDrawer}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                Reconcile & Close
              </Button>
              <Button
                onClick={() => {
                  setShowCloseForm(false);
                  setClosingAmount('');
                  setNotes('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Drawers */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Sessions</CardTitle>
          <CardDescription className="text-slate-400">Last 10 cash drawer sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {drawers.slice(-10).reverse().map((drawer) => (
              <div
                key={drawer.id}
                className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600"
              >
                <div>
                  <p className="font-semibold text-slate-100">
                    {formatCurrency(drawer.openingAmount)} → {drawer.closingAmount ? formatCurrency(drawer.closingAmount) : '...'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(drawer.openedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {drawer.variance !== undefined && (
                    <div className={`text-sm font-bold ${drawer.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(drawer.variance)}
                    </div>
                  )}
                  <Badge className={drawer.status === 'open' ? 'bg-green-600' : 'bg-gray-600'}>
                    {drawer.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
