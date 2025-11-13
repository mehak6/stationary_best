'use client';

import { useState, useEffect } from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';

export default function SyncIndicator() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    syncStatus,
    isSyncing,
    lastSyncTime,
    timeSinceLastSync,
    error,
    stats,
    triggerSync,
    isOnline
  } = useSyncStatus();

  // Only render on client side
  if (!isClient) {
    return null;
  }

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }

    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }

    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }

    if (isSyncing) {
      return 'Syncing...';
    }

    if (stats.isQueued) {
      return 'Sync queued';
    }

    switch (syncStatus) {
      case 'success':
        return timeSinceLastSync ? `Synced ${timeSinceLastSync}` : 'Synced';
      case 'error':
        return 'Sync failed';
      case 'idle':
        return 'Not synced';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return 'bg-gray-500';
    }

    if (isSyncing) {
      return 'bg-blue-500';
    }

    switch (syncStatus) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${getStatusColor()} bg-opacity-10`}>
              {getStatusIcon()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {getStatusText()}
              </p>
              {error && (
                <p className="text-xs text-red-600 mt-0.5 line-clamp-1">
                  {error}
                </p>
              )}
              {lastSyncTime && !error && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.totalSynced} items synced
                </p>
              )}
            </div>
          </div>

          {isOnline && !isSyncing && (
            <button
              onClick={triggerSync}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sync now"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        {/* Sync progress indicator */}
        {isSyncing && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse w-3/4" />
              </div>
              <span className="text-xs text-gray-500">Syncing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
