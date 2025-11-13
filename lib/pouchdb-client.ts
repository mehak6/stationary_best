'use client';

// Lazy load PouchDB only on client side
let PouchDB: any = null;
let PouchDBFind: any = null;

const loadPouchDB = async () => {
  if (typeof window === 'undefined') return;
  if (PouchDB) return; // Already loaded

  try {
    PouchDB = (await import('pouchdb-browser')).default;
    PouchDBFind = (await import('pouchdb-find')).default;
    PouchDB.plugin(PouchDBFind);
  } catch (err) {
    console.error('Failed to load PouchDB:', err);
  }
};

// Database version for migrations
const DB_VERSION = 1;

// Initialize PouchDB instances for each collection
let productsDB: PouchDB.Database | null = null;
let salesDB: PouchDB.Database | null = null;
let categoriesDB: PouchDB.Database | null = null;
let partyPurchasesDB: PouchDB.Database | null = null;
let syncMetaDB: PouchDB.Database | null = null;

// Initialize databases only on client side
export const initializeDatabases = async () => {
  if (typeof window === 'undefined') return;

  // Load PouchDB first
  await loadPouchDB();
  if (!PouchDB) return;

  if (!productsDB) {
    productsDB = new PouchDB('inventory_products', {
      auto_compaction: true,
      revs_limit: 10
    });
  }

  if (!salesDB) {
    salesDB = new PouchDB('inventory_sales', {
      auto_compaction: true,
      revs_limit: 10
    });
  }

  if (!categoriesDB) {
    categoriesDB = new PouchDB('inventory_categories', {
      auto_compaction: true,
      revs_limit: 10
    });
  }

  if (!partyPurchasesDB) {
    partyPurchasesDB = new PouchDB('inventory_party_purchases', {
      auto_compaction: true,
      revs_limit: 10
    });
  }

  if (!syncMetaDB) {
    syncMetaDB = new PouchDB('inventory_sync_meta', {
      auto_compaction: true,
      revs_limit: 5
    });
  }

  // Create indexes for better query performance
  createIndexes();
};

// Create indexes for each database
const createIndexes = async () => {
  try {
    // Products indexes
    if (productsDB) {
      await productsDB.createIndex({
        index: { fields: ['name'] }
      });
      await productsDB.createIndex({
        index: { fields: ['barcode'] }
      });
      await productsDB.createIndex({
        index: { fields: ['category_id'] }
      });
      await productsDB.createIndex({
        index: { fields: ['stock_quantity'] }
      });
      await productsDB.createIndex({
        index: { fields: ['created_at'] }
      });
    }

    // Sales indexes
    if (salesDB) {
      await salesDB.createIndex({
        index: { fields: ['product_id'] }
      });
      await salesDB.createIndex({
        index: { fields: ['sale_date'] }
      });
      await salesDB.createIndex({
        index: { fields: ['created_at'] }
      });
    }

    // Categories indexes
    if (categoriesDB) {
      await categoriesDB.createIndex({
        index: { fields: ['name'] }
      });
    }

    // Party purchases indexes
    if (partyPurchasesDB) {
      await partyPurchasesDB.createIndex({
        index: { fields: ['party_name'] }
      });
      await partyPurchasesDB.createIndex({
        index: { fields: ['item_name'] }
      });
      await partyPurchasesDB.createIndex({
        index: { fields: ['purchase_date'] }
      });
    }

    console.log('✅ PouchDB indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};

// Get database instances
export const getProductsDB = () => {
  if (!productsDB) initializeDatabases();
  return productsDB!;
};

export const getSalesDB = () => {
  if (!salesDB) initializeDatabases();
  return salesDB!;
};

export const getCategoriesDB = () => {
  if (!categoriesDB) initializeDatabases();
  return categoriesDB!;
};

export const getPartyPurchasesDB = () => {
  if (!partyPurchasesDB) initializeDatabases();
  return partyPurchasesDB!;
};

export const getSyncMetaDB = () => {
  if (!syncMetaDB) initializeDatabases();
  return syncMetaDB!;
};

// Utility: Generate UUID for document IDs
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Utility: Convert UUID to PouchDB ID format
export const toPouchID = (prefix: string, uuid: string): string => {
  return `${prefix}_${uuid}`;
};

// Utility: Extract UUID from PouchDB ID
export const fromPouchID = (pouchId: string): string => {
  const parts = pouchId.split('_');
  return parts.slice(1).join('_');
};

// Utility: Get current timestamp
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

// Database info and stats
export const getDatabaseInfo = async () => {
  const info = {
    products: await productsDB?.info(),
    sales: await salesDB?.info(),
    categories: await categoriesDB?.info(),
    partyPurchases: await partyPurchasesDB?.info(),
    syncMeta: await syncMetaDB?.info(),
  };
  return info;
};

// Clear all databases (for testing/reset)
export const clearAllDatabases = async () => {
  try {
    await productsDB?.destroy();
    await salesDB?.destroy();
    await categoriesDB?.destroy();
    await partyPurchasesDB?.destroy();
    await syncMetaDB?.destroy();

    // Reinitialize
    productsDB = null;
    salesDB = null;
    categoriesDB = null;
    partyPurchasesDB = null;
    syncMetaDB = null;

    initializeDatabases();

    console.log('✅ All databases cleared and reinitialized');
  } catch (error) {
    console.error('❌ Error clearing databases:', error);
  }
};

// Export database version
export { DB_VERSION };
