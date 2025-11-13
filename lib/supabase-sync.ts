'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  getProductsDB,
  getSalesDB,
  getCategoriesDB,
  getPartyPurchasesDB,
  getSyncMetaDB
} from './pouchdb-client';
import type { Product, Sale, Category, PartyPurchase } from './offline-db';

// Supabase client
let supabaseClient: ReturnType<typeof createClientComponentClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient && typeof window !== 'undefined') {
    supabaseClient = createClientComponentClient();
  }
  return supabaseClient;
};

// Sync metadata helpers
const getSyncMeta = async (key: string): Promise<any> => {
  const db = getSyncMetaDB();
  if (!db) return null;

  try {
    const doc = await db.get(`sync_${key}`);
    return doc.value;
  } catch (err) {
    return null;
  }
};

const setSyncMeta = async (key: string, value: any): Promise<void> => {
  const db = getSyncMetaDB();
  if (!db) return;

  try {
    const docId = `sync_${key}`;
    let doc: any;

    try {
      doc = await db.get(docId);
      doc.value = value;
      doc.updated_at = new Date().toISOString();
    } catch {
      doc = {
        _id: docId,
        value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    await db.put(doc);
  } catch (err) {
    console.error('Error setting sync meta:', err);
  }
};

// Convert PouchDB document to Supabase format
const toSupabaseFormat = (doc: any, type: string) => {
  const { _id, _rev, ...data } = doc;
  return {
    ...data,
    id: data.id || _id.replace(`${type}_`, '')
  };
};

// Convert Supabase document to PouchDB format
const toPouchFormat = (data: any, type: string) => {
  const { id, ...rest } = data;
  return {
    _id: `${type}_${id}`,
    id,
    ...rest
  };
};

// Sync Products: PouchDB → Supabase
export const syncProductsToSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getProductsDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    // Get last sync timestamp
    const lastSync = await getSyncMeta('products_last_sync') || '1970-01-01T00:00:00.000Z';

    // Get all products modified since last sync
    const result = await db.find({
      selector: {
        updated_at: { $gt: lastSync }
      }
    });

    // Sync each product to Supabase
    for (const doc of result.docs) {
      try {
        const product = toSupabaseFormat(doc, 'product');

        // Upsert to Supabase
        const { error } = await supabase
          .from('products')
          .upsert(product, { onConflict: 'id' });

        if (error) {
          console.error('Error syncing product:', error);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error('Error processing product:', err);
        errors++;
      }
    }

    // Update last sync timestamp
    if (synced > 0) {
      await setSyncMeta('products_last_sync', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncProductsToSupabase:', err);
    throw err;
  }
};

// Sync Products: Supabase → PouchDB
export const syncProductsFromSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getProductsDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    // Get last sync timestamp
    const lastSync = await getSyncMeta('products_last_pull') || '1970-01-01T00:00:00.000Z';

    // Fetch products modified since last sync
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .gt('updated_at', lastSync)
      .order('updated_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!products || products.length === 0) {
      return { synced: 0, errors: 0 };
    }

    // Sync each product to PouchDB
    for (const product of products) {
      try {
        const pouchDoc = toPouchFormat(product, 'product');
        const docId = pouchDoc._id;

        // Check if document exists
        let existingDoc;
        try {
          existingDoc = await db.get(docId);
          pouchDoc._rev = existingDoc._rev;
        } catch {
          // Document doesn't exist, will be created
        }

        await db.put(pouchDoc);
        synced++;
      } catch (err) {
        console.error('Error syncing product from Supabase:', err);
        errors++;
      }
    }

    // Update last pull timestamp
    if (synced > 0) {
      await setSyncMeta('products_last_pull', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncProductsFromSupabase:', err);
    throw err;
  }
};

// Sync Sales: PouchDB → Supabase
export const syncSalesToSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getSalesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('sales_last_sync') || '1970-01-01T00:00:00.000Z';

    const result = await db.find({
      selector: {
        created_at: { $gt: lastSync }
      }
    });

    for (const doc of result.docs) {
      try {
        const sale = toSupabaseFormat(doc, 'sale');

        const { error } = await supabase
          .from('sales')
          .upsert(sale, { onConflict: 'id' });

        if (error) {
          console.error('Error syncing sale:', error);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error('Error processing sale:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('sales_last_sync', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncSalesToSupabase:', err);
    throw err;
  }
};

// Sync Sales: Supabase → PouchDB
export const syncSalesFromSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getSalesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('sales_last_pull') || '1970-01-01T00:00:00.000Z';

    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .gt('created_at', lastSync)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!sales || sales.length === 0) {
      return { synced: 0, errors: 0 };
    }

    for (const sale of sales) {
      try {
        const pouchDoc = toPouchFormat(sale, 'sale');
        const docId = pouchDoc._id;

        let existingDoc;
        try {
          existingDoc = await db.get(docId);
          pouchDoc._rev = existingDoc._rev;
        } catch {
          // Document doesn't exist
        }

        await db.put(pouchDoc);
        synced++;
      } catch (err) {
        console.error('Error syncing sale from Supabase:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('sales_last_pull', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncSalesFromSupabase:', err);
    throw err;
  }
};

// Sync Categories: PouchDB → Supabase
export const syncCategoriesToSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getCategoriesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('categories_last_sync') || '1970-01-01T00:00:00.000Z';

    const result = await db.find({
      selector: {
        created_at: { $gt: lastSync }
      }
    });

    for (const doc of result.docs) {
      try {
        const category = toSupabaseFormat(doc, 'category');

        const { error } = await supabase
          .from('categories')
          .upsert(category, { onConflict: 'id' });

        if (error) {
          console.error('Error syncing category:', error);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error('Error processing category:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('categories_last_sync', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncCategoriesToSupabase:', err);
    throw err;
  }
};

// Sync Categories: Supabase → PouchDB
export const syncCategoriesFromSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getCategoriesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('categories_last_pull') || '1970-01-01T00:00:00.000Z';

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .gt('created_at', lastSync)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!categories || categories.length === 0) {
      return { synced: 0, errors: 0 };
    }

    for (const category of categories) {
      try {
        const pouchDoc = toPouchFormat(category, 'category');
        const docId = pouchDoc._id;

        let existingDoc;
        try {
          existingDoc = await db.get(docId);
          pouchDoc._rev = existingDoc._rev;
        } catch {
          // Document doesn't exist
        }

        await db.put(pouchDoc);
        synced++;
      } catch (err) {
        console.error('Error syncing category from Supabase:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('categories_last_pull', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncCategoriesFromSupabase:', err);
    throw err;
  }
};

// Sync Party Purchases: PouchDB → Supabase
export const syncPartyPurchasesToSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getPartyPurchasesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('party_purchases_last_sync') || '1970-01-01T00:00:00.000Z';

    const result = await db.find({
      selector: {
        created_at: { $gt: lastSync }
      }
    });

    for (const doc of result.docs) {
      try {
        const purchase = toSupabaseFormat(doc, 'party');

        const { error } = await supabase
          .from('party_purchases')
          .upsert(purchase, { onConflict: 'id' });

        if (error) {
          console.error('Error syncing party purchase:', error);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error('Error processing party purchase:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('party_purchases_last_sync', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncPartyPurchasesToSupabase:', err);
    throw err;
  }
};

// Sync Party Purchases: Supabase → PouchDB
export const syncPartyPurchasesFromSupabase = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  const supabase = getSupabaseClient();
  const db = getPartyPurchasesDB();

  if (!supabase || !db) {
    throw new Error('Supabase or PouchDB not initialized');
  }

  let synced = 0;
  let errors = 0;

  try {
    const lastSync = await getSyncMeta('party_purchases_last_pull') || '1970-01-01T00:00:00.000Z';

    const { data: purchases, error } = await supabase
      .from('party_purchases')
      .select('*')
      .gt('created_at', lastSync)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!purchases || purchases.length === 0) {
      return { synced: 0, errors: 0 };
    }

    for (const purchase of purchases) {
      try {
        const pouchDoc = toPouchFormat(purchase, 'party');
        const docId = pouchDoc._id;

        let existingDoc;
        try {
          existingDoc = await db.get(docId);
          pouchDoc._rev = existingDoc._rev;
        } catch {
          // Document doesn't exist
        }

        await db.put(pouchDoc);
        synced++;
      } catch (err) {
        console.error('Error syncing party purchase from Supabase:', err);
        errors++;
      }
    }

    if (synced > 0) {
      await setSyncMeta('party_purchases_last_pull', new Date().toISOString());
    }

    return { synced, errors };
  } catch (err) {
    console.error('Error in syncPartyPurchasesFromSupabase:', err);
    throw err;
  }
};

// Full bidirectional sync
export const performFullSync = async (): Promise<{
  products: { push: number; pull: number; errors: number };
  sales: { push: number; pull: number; errors: number };
  categories: { push: number; pull: number; errors: number };
  partyPurchases: { push: number; pull: number; errors: number };
}> => {
  const results = {
    products: { push: 0, pull: 0, errors: 0 },
    sales: { push: 0, pull: 0, errors: 0 },
    categories: { push: 0, pull: 0, errors: 0 },
    partyPurchases: { push: 0, pull: 0, errors: 0 }
  };

  try {
    // Sync products
    const productsPush = await syncProductsToSupabase();
    const productsPull = await syncProductsFromSupabase();
    results.products = {
      push: productsPush.synced,
      pull: productsPull.synced,
      errors: productsPush.errors + productsPull.errors
    };

    // Sync sales
    const salesPush = await syncSalesToSupabase();
    const salesPull = await syncSalesFromSupabase();
    results.sales = {
      push: salesPush.synced,
      pull: salesPull.synced,
      errors: salesPush.errors + salesPull.errors
    };

    // Sync categories
    const categoriesPush = await syncCategoriesToSupabase();
    const categoriesPull = await syncCategoriesFromSupabase();
    results.categories = {
      push: categoriesPush.synced,
      pull: categoriesPull.synced,
      errors: categoriesPush.errors + categoriesPull.errors
    };

    // Sync party purchases
    const purchasesPush = await syncPartyPurchasesToSupabase();
    const purchasesPull = await syncPartyPurchasesFromSupabase();
    results.partyPurchases = {
      push: purchasesPush.synced,
      pull: purchasesPull.synced,
      errors: purchasesPush.errors + purchasesPull.errors
    };

    return results;
  } catch (err) {
    console.error('Error in performFullSync:', err);
    throw err;
  }
};
