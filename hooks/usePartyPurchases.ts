'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllPartyPurchases,
  getPartyPurchaseById,
  createPartyPurchase as createPartyPurchaseDB,
  updatePartyPurchase as updatePartyPurchaseDB,
  deletePartyPurchase as deletePartyPurchaseDB,
  type PartyPurchase
} from '../lib/offline-db';
import { initializeDatabases } from '../lib/pouchdb-client';

export const usePartyPurchases = () => {
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');

  // Initialize databases on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeDatabases();
      loadPartyPurchases();
    }
  }, []);

  const loadPartyPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllPartyPurchases();
      setPartyPurchases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load party purchases');
      console.error('Error loading party purchases:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPartyPurchase = useCallback(async (partyPurchase: Omit<PartyPurchase, 'id' | 'created_at'>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const newPartyPurchase = await createPartyPurchaseDB(partyPurchase);
      setPartyPurchases(prev => [newPartyPurchase, ...prev]);
      setSyncStatus('synced');
      return newPartyPurchase;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create party purchase');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const updatePartyPurchase = useCallback(async (id: string, updates: Partial<PartyPurchase>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const updated = await updatePartyPurchaseDB(id, updates);
      if (updated) {
        setPartyPurchases(prev => prev.map(p => p.id === id ? updated : p));
      }
      setSyncStatus('synced');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update party purchase');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const deletePartyPurchase = useCallback(async (id: string) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const success = await deletePartyPurchaseDB(id);
      if (success) {
        setPartyPurchases(prev => prev.filter(p => p.id !== id));
      }
      setSyncStatus('synced');
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete party purchase');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const getPartyPurchase = useCallback(async (id: string) => {
    try {
      return await getPartyPurchaseById(id);
    } catch (err) {
      console.error('Error getting party purchase:', err);
      return null;
    }
  }, []);

  const refreshPartyPurchases = useCallback(() => {
    loadPartyPurchases();
  }, [loadPartyPurchases]);

  return {
    partyPurchases,
    loading,
    error,
    syncStatus,
    createPartyPurchase,
    updatePartyPurchase,
    deletePartyPurchase,
    getPartyPurchase,
    refreshPartyPurchases
  };
};
