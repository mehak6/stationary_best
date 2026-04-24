'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getPartyPurchases, 
  getPartyPurchaseById,
  createPartyPurchase as addPurchaseDB,
  updatePartyPurchase as updatePurchaseDB,
  deletePartyPurchase as removePurchaseDB
} from 'lib/offline-adapter';
import type { PartyPurchase, PartyPurchaseInsert } from 'supabase_client';
import { useSyncStatus } from './useSyncStatus';

export const usePartyPurchases = () => {
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { syncStatus } = useSyncStatus();

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPartyPurchases();
      setPartyPurchases(data || []);
      setError('');
    } catch (err) {
      console.error('Error loading party purchases:', err);
      setError('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases, syncStatus]);

  const addPurchase = async (purchase: PartyPurchaseInsert) => {
    try {
      const newPurchase = await addPurchaseDB(purchase);
      setPartyPurchases(prev => [newPurchase, ...prev]);
      return newPurchase;
    } catch (err) {
      console.error('Error adding purchase:', err);
      throw err;
    }
  };

  const updatePurchase = async (id: string, updates: Partial<PartyPurchaseInsert>) => {
    try {
      const updated = await updatePurchaseDB(id, updates);
      setPartyPurchases(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    } catch (err) {
      console.error('Error updating purchase:', err);
      throw err;
    }
  };

  const removePurchase = async (id: string) => {
    try {
      const success = await removePurchaseDB(id);
      if (success) {
        setPartyPurchases(prev => prev.filter(p => p.id !== id));
      }
      return success;
    } catch (err) {
      console.error('Error removing purchase:', err);
      throw err;
    }
  };

  const getPurchase = async (id: string) => {
    try {
      return await getPartyPurchaseById(id);
    } catch (err) {
      console.error('Error getting purchase:', err);
      return null;
    }
  };

  return {
    partyPurchases,
    loading,
    error,
    syncStatus,
    addPurchase,
    updatePurchase,
    removePurchase,
    getPurchase,
    refreshPurchases: loadPurchases
  };
};
