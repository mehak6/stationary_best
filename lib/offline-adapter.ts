'use client';

/**
 * Offline-First Database Adapter
 *
 * This adapter automatically routes database operations to either:
 * - Supabase (when online)
 * - Local PouchDB (when offline)
 *
 * It handles automatic syncing and conflict resolution.
 */

import { supabase } from '../supabase_client';
import type { Product, Sale, PartyPurchase } from '../supabase_client';
import * as OfflineDB from './offline-db';

// Network status
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let onlineStatusListeners: Set<(online: boolean) => void> = new Set();

// Initialize network detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    onlineStatusListeners.forEach(listener => listener(true));
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    onlineStatusListeners.forEach(listener => listener(false));
  });
}

// Subscribe to online status changes
export const subscribeToOnlineStatus = (callback: (online: boolean) => void) => {
  onlineStatusListeners.add(callback);
  callback(isOnline); // Call immediately with current status

  return () => {
    onlineStatusListeners.delete(callback);
  };
};

export const getOnlineStatus = () => isOnline;

// ==================== PRODUCTS ====================

export const getProducts = async (limit?: number): Promise<Product[]> => {
  try {
    if (isOnline) {
      // Try online first
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 1000);

      if (error) throw error;

      // Cache to local DB
      if (data && data.length > 0) {
        await Promise.all(data.map(product =>
          OfflineDB.saveProduct(product).catch(err =>
            console.warn('Failed to cache product:', err)
          )
        ));
      }

      return data || [];
    } else {
      // Use offline cache
      return await OfflineDB.getAllProducts();
    }
  } catch (error) {
    console.error('Error fetching products, using offline cache:', error);
    // Fallback to offline
    return await OfflineDB.getAllProducts();
  }
};

export const createProduct = async (product: any): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;

      // Cache to local DB
      await OfflineDB.saveProduct(data);
      return data;
    } else {
      // Save to offline DB with pending sync flag
      const newProduct = await OfflineDB.createProduct(product);
      return newProduct;
    }
  } catch (error) {
    console.error('Error creating product online, saving offline:', error);
    // Fallback to offline
    return await OfflineDB.createProduct(product);
  }
};

export const updateProduct = async (productId: string, updates: any): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.updateProduct(productId, updates);
      return data;
    } else {
      // Update offline DB with pending sync flag
      return await OfflineDB.updateProduct(productId, updates);
    }
  } catch (error) {
    console.error('Error updating product online, saving offline:', error);
    return await OfflineDB.updateProduct(productId, updates);
  }
};

export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    if (isOnline) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      // Delete from local cache
      await OfflineDB.deleteProduct(productId);
    } else {
      // Mark for deletion when online
      await OfflineDB.deleteProduct(productId);
    }
  } catch (error) {
    console.error('Error deleting product online, marking offline:', error);
    await OfflineDB.deleteProduct(productId);
  }
};

// ==================== SALES ====================

export const getSales = async (limit?: number): Promise<Sale[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit || 100);

      if (error) throw error;

      // Cache to local DB
      if (data && data.length > 0) {
        await Promise.all(data.map(sale =>
          OfflineDB.saveSale(sale).catch(err =>
            console.warn('Failed to cache sale:', err)
          )
        ));
      }

      return data || [];
    } else {
      // Use offline cache
      const sales = await OfflineDB.getAllSales();

      // Enrich with product data from local cache
      const products = await OfflineDB.getAllProducts();
      const productMap = new Map(products.map(p => [p.id, p]));

      return sales.map(sale => ({
        ...sale,
        products: productMap.get(sale.product_id) || null
      })) as any[];
    }
  } catch (error) {
    console.error('Error fetching sales, using offline cache:', error);
    const sales = await OfflineDB.getAllSales();
    const products = await OfflineDB.getAllProducts();
    const productMap = new Map(products.map(p => [p.id, p]));

    return sales.map(sale => ({
      ...sale,
      products: productMap.get(sale.product_id) || null
    })) as any[];
  }
};

export const getSalesByDateRange = async (startDate: string, endDate: string): Promise<Sale[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } else {
      // Filter offline sales by date range
      const allSales = await OfflineDB.getAllSales();
      const products = await OfflineDB.getAllProducts();
      const productMap = new Map(products.map(p => [p.id, p]));

      const filtered = allSales.filter(sale => {
        const saleDate = sale.sale_date.split('T')[0];
        return saleDate >= startDate && saleDate <= endDate;
      });

      return filtered.map(sale => ({
        ...sale,
        products: productMap.get(sale.product_id) || null
      })) as any[];
    }
  } catch (error) {
    console.error('Error fetching sales by date range, using offline cache:', error);
    const allSales = await OfflineDB.getAllSales();
    const products = await OfflineDB.getAllProducts();
    const productMap = new Map(products.map(p => [p.id, p]));

    const filtered = allSales.filter(sale => {
      const saleDate = sale.sale_date.split('T')[0];
      return saleDate >= startDate && saleDate <= endDate;
    });

    return filtered.map(sale => ({
      ...sale,
      products: productMap.get(sale.product_id) || null
    })) as any[];
  }
};

export const getSalesByDate = async (date: string): Promise<Sale[]> => {
  // Get sales for a specific date
  return getSalesByDateRange(date, date);
};

export const createSale = async (sale: any): Promise<Sale> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .insert(sale)
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .single();

      if (error) throw error;

      // Cache to local DB
      await OfflineDB.saveSale(data);
      return data;
    } else {
      // Save to offline DB with pending sync flag
      const newSale = await OfflineDB.createSale(sale);
      return newSale;
    }
  } catch (error) {
    console.error('Error creating sale online, saving offline:', error);
    return await OfflineDB.createSale(sale);
  }
};

export const updateSale = async (saleId: string, updates: any): Promise<Sale> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', saleId)
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.updateSale(saleId, updates);
      return data;
    } else {
      // Update offline DB with pending sync flag
      return await OfflineDB.updateSale(saleId, updates);
    }
  } catch (error) {
    console.error('Error updating sale online, saving offline:', error);
    return await OfflineDB.updateSale(saleId, updates);
  }
};

export const deleteSale = async (saleId: string): Promise<void> => {
  try {
    if (isOnline) {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;

      // Delete from local cache
      await OfflineDB.deleteSale(saleId);
    } else {
      // Mark for deletion when online
      await OfflineDB.deleteSale(saleId);
    }
  } catch (error) {
    console.error('Error deleting sale online, marking offline:', error);
    await OfflineDB.deleteSale(saleId);
  }
};

// ==================== ANALYTICS ====================

export const getAnalytics = async (): Promise<any> => {
  try {
    if (isOnline) {
      // Fetch from Supabase
      const [products, sales] = await Promise.all([
        getProducts(),
        getSales(1000)
      ]);

      return calculateAnalytics(products, sales);
    } else {
      // Calculate from offline data
      const [products, sales] = await Promise.all([
        OfflineDB.getAllProducts(),
        OfflineDB.getAllSales()
      ]);

      return calculateAnalytics(products, sales);
    }
  } catch (error) {
    console.error('Error getting analytics:', error);
    // Fallback to offline calculation
    const [products, sales] = await Promise.all([
      OfflineDB.getAllProducts(),
      OfflineDB.getAllSales()
    ]);

    return calculateAnalytics(products, sales);
  }
};

function calculateAnalytics(products: Product[], sales: Sale[]): any {
  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.sale_date.startsWith(today));

  const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const todaySalesAmount = todaySales.reduce((sum, s) => sum + s.total_amount, 0);
  const todayProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock_level).length;

  return {
    totalProducts: products.length,
    totalSales,
    totalProfit,
    todaySales: todaySalesAmount,
    todayProfit,
    lowStockProducts
  };
}

// ==================== PARTY PURCHASES ====================

export const getPartyPurchases = async (): Promise<PartyPurchase[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('party_purchases')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (error) throw error;

      // Cache to local DB
      if (data && data.length > 0) {
        await Promise.all(data.map(purchase =>
          OfflineDB.savePartyPurchase(purchase).catch(err =>
            console.warn('Failed to cache party purchase:', err)
          )
        ));
      }

      return data || [];
    } else {
      return await OfflineDB.getAllPartyPurchases();
    }
  } catch (error) {
    console.error('Error fetching party purchases, using offline cache:', error);
    return await OfflineDB.getAllPartyPurchases();
  }
};

export const createPartyPurchase = async (purchase: any): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('party_purchases')
        .insert(purchase)
        .select()
        .single();

      if (error) throw error;

      await OfflineDB.savePartyPurchase(data);
      return data;
    } else {
      return await OfflineDB.createPartyPurchase(purchase);
    }
  } catch (error) {
    console.error('Error creating party purchase online, saving offline:', error);
    return await OfflineDB.createPartyPurchase(purchase);
  }
};

export const updatePartyPurchase = async (purchaseId: string, updates: any): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('party_purchases')
        .update(updates)
        .eq('id', purchaseId)
        .select()
        .single();

      if (error) throw error;

      await OfflineDB.updatePartyPurchase(purchaseId, updates);
      return data;
    } else {
      return await OfflineDB.updatePartyPurchase(purchaseId, updates);
    }
  } catch (error) {
    console.error('Error updating party purchase online, saving offline:', error);
    return await OfflineDB.updatePartyPurchase(purchaseId, updates);
  }
};

export const deletePartyPurchase = async (purchaseId: string): Promise<void> => {
  try {
    if (isOnline) {
      const { error } = await supabase
        .from('party_purchases')
        .delete()
        .eq('id', purchaseId);

      if (error) throw error;

      await OfflineDB.deletePartyPurchase(purchaseId);
    } else {
      await OfflineDB.deletePartyPurchase(purchaseId);
    }
  } catch (error) {
    console.error('Error deleting party purchase online, marking offline:', error);
    await OfflineDB.deletePartyPurchase(purchaseId);
  }
};

// ==================== SYNC ====================

export const syncAllData = async (): Promise<{
  success: boolean;
  synced: number;
  errors: number;
}> => {
  if (!isOnline) {
    return { success: false, synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  try {
    // Sync products
    const products = await OfflineDB.getAllProducts();
    for (const product of products) {
      try {
        // Check if product exists in Supabase
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('id', product.id)
          .single();

        if (!existing) {
          // Create in Supabase
          await supabase.from('products').insert(product);
          synced++;
        }
      } catch (err) {
        console.error('Error syncing product:', err);
        errors++;
      }
    }

    // Sync sales
    const sales = await OfflineDB.getAllSales();
    for (const sale of sales) {
      try {
        const { data: existing } = await supabase
          .from('sales')
          .select('id')
          .eq('id', sale.id)
          .single();

        if (!existing) {
          await supabase.from('sales').insert(sale);
          synced++;
        }
      } catch (err) {
        console.error('Error syncing sale:', err);
        errors++;
      }
    }

    // Sync party purchases
    const purchases = await OfflineDB.getAllPartyPurchases();
    for (const purchase of purchases) {
      try {
        const { data: existing } = await supabase
          .from('party_purchases')
          .select('id')
          .eq('id', purchase.id)
          .single();

        if (!existing) {
          await supabase.from('party_purchases').insert(purchase);
          synced++;
        }
      } catch (err) {
        console.error('Error syncing party purchase:', err);
        errors++;
      }
    }

    return { success: true, synced, errors };
  } catch (error) {
    console.error('Error during sync:', error);
    return { success: false, synced, errors: errors + 1 };
  }
};
