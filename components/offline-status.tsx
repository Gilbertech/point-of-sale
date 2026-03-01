'use client';

import { useEffect, useState } from 'react';
import { OfflineMode } from '@/lib/offline-mode';
import { AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function OfflineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    // Check initial status
    setIsOnline(OfflineMode.isOnline());
    updateStatus();

    // Setup listeners
    const unsubscribe = OfflineMode.setupOfflineListener((online) => {
      setIsOnline(online);
      if (online) {
        OfflineMode.recordSyncAttempt();
      }
      updateStatus();
    });

    const interval = setInterval(updateStatus, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateStatus = () => {
    setStatus(OfflineMode.getOfflineStatus());
  };

  if (isOnline && (!status || status.pendingCount === 0)) {
    return null; // Hide when online and no pending items
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!isOnline ? (
        <div className="flex items-center gap-2 p-3 bg-amber-900 border border-amber-700 rounded-lg shadow-lg">
          <WifiOff className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-100">Offline Mode</span>
          {status?.pendingCount > 0 && (
            <Badge className="bg-amber-600 text-white text-xs">
              {status.pendingCount} pending
            </Badge>
          )}
        </div>
      ) : status?.pendingCount > 0 ? (
        <div className="flex items-center gap-2 p-3 bg-cyan-900 border border-cyan-700 rounded-lg shadow-lg">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="text-sm font-semibold text-cyan-100">Syncing...</span>
          <Badge className="bg-cyan-600 text-white text-xs">
            {status.pendingCount}
          </Badge>
        </div>
      ) : status?.failedCount > 0 ? (
        <div className="flex items-center gap-2 p-3 bg-red-900 border border-red-700 rounded-lg shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-100">Sync Failed</span>
          <Badge className="bg-red-600 text-white text-xs">
            {status.failedCount}
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-green-900 border border-green-700 rounded-lg shadow-lg">
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-green-100">Synced</span>
        </div>
      )}
    </div>
  );
}
