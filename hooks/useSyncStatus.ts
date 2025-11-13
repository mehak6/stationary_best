'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  initializeSyncManager,
  performManualSync,
  getSyncStats,
  addSyncListener,
  removeSyncListener,
  getSyncConfig,
  updateSyncConfig,
  getLastSyncResult,
  forceSyncNow,
  queueSync,
  isSyncQueued,
  type SyncResult,
  type SyncConfig,
  type SyncStatus
} from '../lib/sync-manager';
import { useOfflineStatus } from './useOfflineStatus';

export const useSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [stats, setStats] = useState({
    totalSynced: 0,
    totalErrors: 0,
    isQueued: false
  });

  const { isOnline } = useOfflineStatus();

  // Initialize sync manager on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const init = async () => {
        try {
          await initializeSyncManager();

          // Load initial state
          const config = getSyncConfig();
          setSyncConfig(config);

          const result = await getLastSyncResult();
          if (result) {
            setLastSyncResult(result);
            setLastSyncTime(result.timestamp);
            setSyncStatus(result.status);
          }

          const syncStats = await getSyncStats();
          setStats({
            totalSynced: syncStats.totalSynced,
            totalErrors: syncStats.totalErrors,
            isQueued: syncStats.isQueued
          });
        } catch (err) {
          console.error('Error initializing sync manager:', err);
          setError(err instanceof Error ? err.message : 'Failed to initialize');
        }
      };

      init();
    }
  }, []);

  // Listen for sync updates
  useEffect(() => {
    const listener = (result: SyncResult) => {
      setLastSyncResult(result);
      setLastSyncTime(result.timestamp);
      setSyncStatus(result.status);
      setIsSyncing(false);

      setStats(prev => ({
        ...prev,
        totalSynced: result.totalSynced,
        totalErrors: result.totalErrors
      }));

      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
      }
    };

    addSyncListener(listener);

    return () => {
      removeSyncListener(listener);
    };
  }, []);

  // Perform manual sync
  const triggerSync = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    if (!isOnline) {
      // Queue sync for when we're back online
      await queueSync();
      setStats(prev => ({ ...prev, isQueued: true }));
      setError('Device is offline. Sync queued for later.');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setError(null);

      const result = await performManualSync();

      setLastSyncResult(result);
      setLastSyncTime(result.timestamp);
      setSyncStatus(result.status);

      setStats({
        totalSynced: result.totalSynced,
        totalErrors: result.totalErrors,
        isQueued: false
      });

      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  // Force sync (bypass checks)
  const forceSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setError(null);

      const result = await forceSyncNow();

      setLastSyncResult(result);
      setLastSyncTime(result.timestamp);
      setSyncStatus(result.status);

      setStats({
        totalSynced: result.totalSynced,
        totalErrors: result.totalErrors,
        isQueued: false
      });

      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Force sync failed');
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Update sync configuration
  const updateConfig = useCallback((config: Partial<SyncConfig>) => {
    updateSyncConfig(config);
    setSyncConfig(getSyncConfig());
  }, []);

  // Get time since last sync
  const getTimeSinceLastSync = useCallback((): string | null => {
    if (!lastSyncTime) return null;

    const now = new Date();
    const lastSync = new Date(lastSyncTime);
    const diffMs = now.getTime() - lastSync.getTime();

    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }, [lastSyncTime]);

  // Check if sync is needed
  const isSyncNeeded = useCallback((): boolean => {
    if (!lastSyncTime) return true;

    const now = new Date();
    const lastSync = new Date(lastSyncTime);
    const diffMs = now.getTime() - lastSync.getTime();
    const syncInterval = syncConfig?.syncInterval || 300000; // 5 minutes default

    return diffMs > syncInterval;
  }, [lastSyncTime, syncConfig]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    const syncStats = await getSyncStats();
    setStats({
      totalSynced: syncStats.totalSynced,
      totalErrors: syncStats.totalErrors,
      isQueued: syncStats.isQueued
    });
  }, []);

  return {
    // Status
    syncStatus,
    isSyncing,
    error,

    // Last sync info
    lastSyncTime,
    lastSyncResult,
    timeSinceLastSync: getTimeSinceLastSync(),

    // Stats
    stats,

    // Configuration
    syncConfig,
    updateConfig,

    // Actions
    triggerSync,
    forceSync,
    refreshStats,

    // Helpers
    isSyncNeeded: isSyncNeeded(),
    isOnline
  };
};
