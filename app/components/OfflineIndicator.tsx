'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { subscribeToOnlineStatus, syncAllData } from '../../lib/offline-adapter';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  useEffect(() => {
    // Subscribe to online/offline status
    const unsubscribe = subscribeToOnlineStatus((online) => {
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online && !isOnline) {
        handleSync();
      }
    });

    return () => unsubscribe();
  }, [isOnline]);

  const handleSync = async () => {
    setIsSyncing(true);
    setShowSyncStatus(true);

    try {
      const result = await syncAllData();
      setSyncResult({ synced: result.synced, errors: result.errors });

      // Hide status after 5 seconds
      setTimeout(() => {
        setShowSyncStatus(false);
        setSyncResult(null);
      }, 5000);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncResult({ synced: 0, errors: 1 });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Online/Offline Badge - positioned to avoid overlapping with hamburger menu */}
      <div className="fixed top-20 right-4 z-30 flex items-center gap-2">
        {isOnline ? (
          <div className="flex items-center gap-1 sm:gap-2 bg-green-100 text-green-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm">
            <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline text-sm font-medium">Online</span>
            {!isSyncing && (
              <button
                onClick={handleSync}
                className="p-0.5 sm:p-1 hover:bg-green-200 rounded-full transition-colors"
                title="Sync now"
                aria-label="Sync data"
              >
                <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            )}
            {isSyncing && (
              <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2 bg-orange-100 text-orange-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm">
            <WifiOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline text-sm font-medium">Offline</span>
          </div>
        )}

        {/* Sync Status */}
        {showSyncStatus && syncResult && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm ${
              syncResult.errors === 0
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {syncResult.errors === 0 ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              Synced: {syncResult.synced}
              {syncResult.errors > 0 && ` | Errors: ${syncResult.errors}`}
            </span>
          </div>
        )}
      </div>

      {/* Offline Mode Banner */}
      {!isOnline && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-orange-500 text-white py-2 px-4 text-center shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            <p className="text-sm font-medium">
              You're working offline. Changes will sync when connection is restored.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
