'use client';

import { supabase } from '../supabase_client';
import {
  getProductsDB,
  getSalesDB,
  getCategoriesDB,
  getPartyPurchasesDB,
  getSyncMetaDB
} from './pouchdb-client';
import type { Product, Sale, Category, PartyPurchase } from './offline-db';
import * as OfflineDB from './offline-db';
import { hasConflict, resolveEntityConflict } from './conflict-resolver';

/**
 * Supabase Synchronization Engine (Offline-First)
 * 
 * Strategy:
 * 1. Pull changes from Supabase since last sync
 * 2. Resolve conflicts locally using Last-Write-Wins (LWW)
 * 3. Push local changes to Supabase
 */

interface SyncMeta {
  _id: string;
  _rev?: string;
  last_sync_time: string;
}

const getSyncMeta = async (table: string): Promise<SyncMeta> => {
  const db = await getSyncMetaDB();
  const id = `sync_meta_${table}`;
  try {
    return await db.get(id);
  } catch {
    return { _id: id, last_sync_time: new Date(0).toISOString() };
  }
};

const updateSyncMeta = async (table: string, time: string): Promise<void> => {
  const db = await getSyncMetaDB();
  const meta = await getSyncMeta(table);
  await db.put({
    ...meta,
    last_sync_time: time
  });
};

// ==================== PRODUCTS SYNC ====================

export const syncProducts = async () => {
  const meta = await getSyncMeta('products');
  const syncStartTime = new Date().toISOString();
  
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL changes from Supabase
    const { data: remoteData, error: pullError } = await (supabase.from('products') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
      for (const remote of (remoteData as any[])) {
        try {
          const local = await OfflineDB.getProductById(remote.id);
          
          if (local && hasConflict(local, remote)) {
            const resolved = resolveEntityConflict('product', local, remote);
            await OfflineDB.saveProduct(resolved);
          } else {
            await OfflineDB.saveProduct(remote as Product);
          }
          stats.pull++;
        } catch (err) {
          console.error(`Error syncing product ${remote.id}:`, err);
          stats.errors++;
        }
      }
    }

    // 2. PUSH changes to Supabase
    const localProducts = await OfflineDB.getAllProducts();
    const toPush = localProducts.filter(p => p.updated_at > meta.last_sync_time);

    if (toPush.length > 0) {
      for (const local of toPush) {
        try {
          // Fetch current remote to check for mid-sync conflicts
          const { data: currentRemote } = await (supabase.from('products') as any)
            .select('updated_at')
            .eq('id', local.id)
            .single();

          if (currentRemote && (currentRemote as any).updated_at > local.updated_at) {
            // Remote is newer, skip push and let next pull resolve it
            continue;
          }

          const { error: pushError } = await (supabase.from('products') as any)
            .upsert(local);

          if (pushError) throw pushError;
          stats.push++;
        } catch (err) {
          console.error(`Error pushing product ${local.id}:`, err);
          stats.errors++;
        }
      }
    }

    await updateSyncMeta('products', syncStartTime);
  } catch (err) {
    console.error('Products sync failed:', err);
    stats.errors++;
  }

  return stats;
};

// ==================== SALES SYNC ====================

export const syncSales = async () => {
  const meta = await getSyncMeta('sales');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL (Sales are mostly immutable, so we just download new ones)
    const { data: remoteData, error: pullError } = await (supabase.from('sales') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
      for (const remote of (remoteData as any[])) {
        await OfflineDB.saveSale(remote as Sale);
        stats.pull++;
      }
    }

    // 2. PUSH (Offline created sales)
    const localSales = await OfflineDB.getAllSales();
    const toPush = localSales.filter(s => s.created_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('sales') as any)
        .upsert(toPush);

      if (pushError) throw pushError;
      stats.push += toPush.length;
    }

    await updateSyncMeta('sales', syncStartTime);
  } catch (err) {
    console.error('Sales sync failed:', err);
    stats.errors++;
  }

  return stats;
};

// ==================== CATEGORIES SYNC ====================

export const syncCategories = async () => {
  const meta = await getSyncMeta('categories');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    const { data: remoteData, error: pullError } = await (supabase.from('categories') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData) {
      for (const remote of (remoteData as any[])) {
        await OfflineDB.saveCategory(remote as Category);
        stats.pull++;
      }
    }

    const localCats = await OfflineDB.getAllCategories();
    const toPush = localCats.filter(c => c.created_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('categories') as any)
        .upsert(toPush);
      if (pushError) throw pushError;
      stats.push += toPush.length;
    }

    await updateSyncMeta('categories', syncStartTime);
  } catch (err) {
    console.error('Categories sync failed:', err);
    stats.errors++;
  }
  return stats;
};

// ==================== PARTY PURCHASES SYNC ====================

export const syncPartyPurchases = async () => {
  const meta = await getSyncMeta('party_purchases');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    const { data: remoteData, error: pullError } = await (supabase.from('party_purchases') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData) {
      for (const remote of (remoteData as any[])) {
        try {
          const local = await OfflineDB.getPartyPurchaseById(remote.id);
          if (local && hasConflict(local, remote)) {
            const resolved = resolveEntityConflict('party_purchase', local, remote);
            await OfflineDB.savePartyPurchase(resolved);
          } else {
            await OfflineDB.savePartyPurchase(remote as PartyPurchase);
          }
          stats.pull++;
        } catch (err) {
          stats.errors++;
        }
      }
    }

    const localPP = await OfflineDB.getAllPartyPurchases();
    const toPush = localPP.filter(p => p.updated_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('party_purchases') as any)
        .upsert(toPush);
      if (pushError) throw pushError;
      stats.push += toPush.length;
    }

    await updateSyncMeta('party_purchases', syncStartTime);
  } catch (err) {
    console.error('Party purchases sync failed:', err);
    stats.errors++;
  }
  return stats;
};

// ==================== DELETIONS SYNC ====================

export const syncDeletions = async () => {
  const pendingDeletions = await OfflineDB.getPendingDeletions();
  let count = 0;

  for (const del of pendingDeletions) {
    try {
      const { error } = await (supabase.from(del.table) as any)
        .delete()
        .eq('id', del.record_id);

      if (!error) {
        await OfflineDB.clearDeletion(del);
        count++;
      }
    } catch (err) {
      console.error(`Failed to sync deletion for ${del.table}:${del.record_id}`, err);
    }
  }

  return count;
};

// ==================== FULL SYNC ====================

export const performFullSync = async () => {
  console.log('Starting full synchronization...');
  
  try {
    const [products, sales, categories, partyPurchases] = await Promise.all([
      syncProducts(),
      syncSales(),
      syncCategories(),
      syncPartyPurchases()
    ]);

    const deletions = await syncDeletions();

    const results = {
      products,
      sales,
      categories,
      partyPurchases,
      deletions,
      timestamp: new Date().toISOString()
    };

    console.log('Sync completed:', results);
    return results;
  } catch (err) {
    console.error('Sync failed:', err);
    throw err;
  }
};
