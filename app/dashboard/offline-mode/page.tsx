'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OfflineMode, type OfflineTransaction } from '@/lib/offline-mode';
import { AlertCircle, Wifi, WifiOff, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/currency';

export default function OfflineModePage() {
  const [offlineStatus, setOfflineStatus] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<OfflineTransaction[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    loadOfflineData();
    setIsOnline(OfflineMode.isOnline());

    // Setup offline listener
    const unsubscribe = OfflineMode.setupOfflineListener((online) => {
      setIsOnline(online);
      loadOfflineData();
    });

    const interval = setInterval(loadOfflineData, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadOfflineData = () => {
    setOfflineStatus(OfflineMode.getOfflineStatus());
    setAllTransactions(OfflineMode.getAllTransactions());
  };

  const pendingTransactions = useMemo(() => {
    return allTransactions.filter(t => t.status === 'pending');
  }, [allTransactions]);

  const syncedTransactions = useMemo(() => {
    return allTransactions.filter(t => t.status === 'synced');
  }, [allTransactions]);

  const failedTransactions = useMemo(() => {
    return allTransactions.filter(t => t.status === 'failed');
  }, [allTransactions]);

  const handleRetryFailed = (id: string) => {
    OfflineMode.retryFailedTransaction(id);
    loadOfflineData();
  };

  const handleClearSynced = () => {
    const cleared = OfflineMode.clearSyncedTransactions();
    alert(`Cleared ${cleared} synced transactions`);
    loadOfflineData();
  };

  const handleExportData = () => {
    const data = OfflineMode.exportOfflineData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
          Offline Mode
        </h1>
        <p className="text-slate-400 mt-2">Manage offline transactions and synchronization</p>
      </div>

      {/* Connection Status */}
      {offlineStatus && (
        <Alert className={isOnline ? 'bg-green-950 border-green-800' : 'bg-amber-950 border-amber-800'}>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">
                  Connected. {offlineStatus.pendingCount} transactions pending sync.
                </AlertDescription>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-amber-200">
                  You are offline. Transactions are being queued locally.
                </AlertDescription>
              </>
            )}
          </div>
        </Alert>
      )}

      {/* Status Stats */}
      {offlineStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-950 to-amber-900 border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Pending</CardTitle>
              <RefreshCw className="h-5 w-5 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-300">{offlineStatus.pendingCount}</div>
              <p className="text-xs text-amber-400 mt-1">Awaiting sync</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Synced</CardTitle>
              <Wifi className="h-5 w-5 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-300">{offlineStatus.syncedCount}</div>
              <p className="text-xs text-green-400 mt-1">Successfully synced</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-950 to-red-900 border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Failed</CardTitle>
              <AlertCircle className="h-5 w-5 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-300">{offlineStatus.failedCount}</div>
              <p className="text-xs text-red-400 mt-1">Sync failed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Last Sync</CardTitle>
              <Wifi className="h-5 w-5 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold text-cyan-300">
                {offlineStatus.lastSync ? new Date(offlineStatus.lastSync).toLocaleTimeString() : 'Never'}
              </div>
              <p className="text-xs text-cyan-400 mt-1">Sync time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleExportData}
          className="gap-2 bg-violet-600 hover:bg-violet-700"
        >
          <Download className="w-4 h-4" />
          Export Offline Data
        </Button>
        {syncedTransactions.length > 0 && (
          <Button
            onClick={handleClearSynced}
            className="gap-2 bg-slate-600 hover:bg-slate-700"
          >
            <Trash2 className="w-4 h-4" />
            Clear Synced ({syncedTransactions.length})
          </Button>
        )}
      </div>

      {/* Pending Transactions */}
      {pendingTransactions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Pending Transactions</CardTitle>
            <CardDescription className="text-slate-400">
              {pendingTransactions.length} transactions waiting to sync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-100">
                      Transaction {transaction.transactionId.substring(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-amber-300 mt-1">
                      Attempts: {transaction.attempts}
                    </p>
                  </div>
                  <Badge className="bg-amber-600">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Transactions */}
      {failedTransactions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Failed Transactions</CardTitle>
            <CardDescription className="text-slate-400">
              {failedTransactions.length} transactions failed to sync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {failedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-red-600"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-slate-100">
                      Transaction {transaction.transactionId.substring(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </p>
                    {transaction.error && (
                      <p className="text-xs text-red-300 mt-1">
                        Error: {transaction.error}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleRetryFailed(transaction.id)}
                    size="sm"
                    className="gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synced Transactions */}
      {syncedTransactions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Synced Transactions</CardTitle>
            <CardDescription className="text-slate-400">
              {syncedTransactions.length} successfully synced transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {syncedTransactions.slice(0, 10).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-green-600"
                >
                  <div>
                    <p className="font-semibold text-slate-100">
                      Transaction {transaction.transactionId.substring(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge className="bg-green-600">Synced</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">How Offline Mode Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>
            • When you go offline, all transactions are automatically queued locally
          </p>
          <p>
            • Transactions are stored securely in your browser's local storage
          </p>
          <p>
            • When connection is restored, pending transactions are automatically synced
          </p>
          <p>
            • Failed transactions can be manually retried or exported for troubleshooting
          </p>
          <p>
            • Synced transactions can be cleared to free up storage space
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
