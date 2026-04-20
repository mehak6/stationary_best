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
import type { 
  Product, 
  Sale, 
  PartyPurchase,
  ProductInsert,
  SaleInsert,
  PartyPurchaseInsert 
} from '../supabase_client';
import * as OfflineDB from './offline-db';
import { 
  getFinancialYear, 
  getFYRange, 
  isDateInFY 
} from './date-utils';

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

// ==================== PRODUCTS ====================

export const getProducts = async (limit?: number): Promise<Product[]> => {
  try {
    if (isOnline) {
      // Try online sync first
      const { data, error } = await supabase.from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 1000);

      if (!error && data && data.length > 0) {
        // Update local cache but don't wait for it
        await Promise.all(data.map(product =>
          OfflineDB.saveProduct(product).catch(err =>
            console.warn('Failed to cache product:', err)
          )
        ));
      }
    }
    
    // CRITICAL: Always return data from Local DB as the source of truth
    // This ensures that local resets (0 stock) are shown immediately
    // even if the server hasn't updated yet.
    return await OfflineDB.getAllProducts();
    } catch (error) {
    console.error('Error in getProducts, using offline cache:', error);
    return await OfflineDB.getAllProducts();
    }
    };


export const createProduct = async (product: ProductInsert): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('products')
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

export const updateProduct = async (productId: string, updates: Partial<ProductInsert>): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.saveProduct(data);
      return data;
    } else {
      // Update local DB
      const updatedProduct = await OfflineDB.updateProduct(productId, updates);
      if (!updatedProduct) throw new Error('Product not found in local DB');
      return updatedProduct;
    }
  } catch (error) {
    console.error('Error updating product online, marking offline:', error);
    // Update local DB
    const updatedProduct = await OfflineDB.updateProduct(productId, updates);
    if (!updatedProduct) throw new Error('Product not found in local DB');
    return updatedProduct;
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

      // Remove from local cache
      await OfflineDB.deleteProduct(productId);
    } else {
      // Delete from local DB
      await OfflineDB.deleteProduct(productId);
    }
  } catch (error) {
    console.error('Error deleting product online, marking offline:', error);
    await OfflineDB.deleteProduct(productId);
  }
};

export const resetAllProductsStock = async (newYearLabel: string): Promise<boolean> => {
  try {
    // CRITICAL: Fetch products from LOCAL DB only to ensure reset can always proceed
    const products = await OfflineDB.getAllProducts();
    if (!products || products.length === 0) return true;

    const updates = products.map(p => ({
      id: p.id,
      updates: { stock_quantity: 0, updated_at: new Date().toISOString() }
    }));

    // Step 1: Update local PouchDB cache
    await OfflineDB.bulkUpdateProducts(updates as any);
    
    // Step 2: Save closing stock for the previous year
    // Extract previous year from the newYearLabel
    const [startYearStr] = newYearLabel.split('-');
    const startYear = parseInt(startYearStr);
    const prevYearLabel = `${startYear - 1}-${String(startYear % 100).padStart(2, '0')}`;
    
    const closingRecords = products.map(p => ({
      product_id: p.id,
      financial_year: prevYearLabel,
      closing_stock: p.stock_quantity
    }));
    await OfflineDB.saveYearlyClosingStock(closingRecords);

    // Step 3: Add to history in bulk
    const { addProductHistoryBulk } = await import('./product-history');
    const historyEntries = products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      action: 'stock_reset' as any,
      quantity_change: -p.stock_quantity,
      stock_before: p.stock_quantity,
      stock_after: 0,
      notes: `Stock reset for new financial year ${newYearLabel}`
    }));
    await addProductHistoryBulk(historyEntries);

    // Note: We do NOT perform a direct online UPDATE here.
    // The changes are saved locally with a new 'updated_at' timestamp.
    // The background sync engine will naturally push these 0-stock levels
    // to Supabase during the next sync cycle. This bypasses any 
    // global "UPDATE requires a WHERE clause" restrictions.

    return true;
  } catch (error) {
    console.error('Error during stock reset:', error);
    return false;
  }
};

export const getClosingStockForYear = async (financialYear: string): Promise<Record<string, number>> => {
  return await OfflineDB.getClosingStockForYear(financialYear);
};

export const getSalesByDate = async (date: string): Promise<Sale[]> => {
  return await OfflineDB.getSalesByDate(date);
};

export const deletePartyPurchase = async (id: string): Promise<boolean> => {
  return await OfflineDB.deletePartyPurchase(id);
};

export const syncAllData = async () => {
  const { performFullSync } = await import('./supabase-sync');
  return await performFullSync();
};

// ==================== ANALYTICS ====================

export const getAnalytics = async (financialYear?: string) => {
  try {
    const targetFY = financialYear || getFinancialYear();
    const { start: fyStart, end: fyEnd } = getFYRange(targetFY);

    if (isOnline) {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, profit, sale_date')
        .gte('sale_date', fyStart)
        .lte('sale_date', fyEnd);

      const { count: totalProducts, error: prodError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('stock_quantity', 5);

      if (salesError || prodError) throw salesError || prodError;

      const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const totalProfit = salesData?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0;

      const today = new Date().toISOString().split('T')[0];
      const todaySalesData = salesData?.filter(sale => sale.sale_date === today) || [];
      const todaySales = todaySalesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const todayProfit = todaySalesData.reduce((sum, sale) => sum + (sale.profit || 0), 0);

      return {
        totalProducts: totalProducts || 0,
        totalSales,
        totalProfit,
        todaySales,
        todayProfit,
        lowStockProducts: lowStockCount || 0
      };
    }
    
    // Fallback to offline analytics
    const products = await OfflineDB.getAllProducts();
    const allSales = await OfflineDB.getAllSales();
    
    // Filter sales by financial year
    const sales = allSales.filter(sale => 
      sale.sale_date >= fyStart && sale.sale_date <= fyEnd
    );
    
    const totalProducts = products.length;
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    
    const today = new Date().toISOString().split('T')[0];
    const todaySalesData = sales.filter(sale => sale.sale_date === today);
    const todaySales = todaySalesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const todayProfit = todaySalesData.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    
    const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock_level).length;

    return {
      totalProducts,
      totalSales,
      totalProfit,
      todaySales,
      todayProfit,
      lowStockProducts
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      totalProducts: 0,
      totalSales: 0,
      totalProfit: 0,
      todaySales: 0,
      todayProfit: 0,
      lowStockProducts: 0
    };
  }
};

// ==================== SALES ====================

export const getSales = async (limit?: number): Promise<Sale[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('sales')
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

      // Map Supabase response to flat Sale objects
      const formattedSales = (data || []).map(sale => ({
        ...sale,
        product_name: (sale as any).products?.name
      }));

      // Cache to local DB
      await Promise.all(formattedSales.map(sale =>
        OfflineDB.saveSale(sale).catch(err =>
          console.warn('Failed to cache sale:', err)
        )
      ));

      return formattedSales;
    } else {
      return await OfflineDB.getAllSales();
    }
  } catch (error) {
    console.error('Error fetching sales, using offline cache:', error);
    return await OfflineDB.getAllSales();
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
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(sale => ({
        ...sale,
        product_name: (sale as any).products?.name
      }));
    } else {
      return await OfflineDB.getSalesByDateRange(startDate, endDate);
    }
  } catch (error) {
    console.error('Error fetching sales by date range:', error);
    return await OfflineDB.getSalesByDateRange(startDate, endDate);
  }
};

export const createSale = async (sale: SaleInsert): Promise<Sale> => {
  try {
    if (isOnline) {
      // Use RPC for atomic sale creation and stock check
      const { data, error } = await supabase.rpc('create_sale_with_stock_check', {
        p_product_id: sale.product_id,
        p_quantity: sale.quantity,
        p_unit_price: sale.unit_price,
        p_total_amount: sale.total_amount,
        p_profit: sale.profit,
        p_customer_info: sale.customer_info,
        p_sale_date: sale.sale_date,
        p_notes: sale.notes
      });

      if (error) throw error;

      // Update local product cache (stock changed)
      const products = await getProducts();
      
      // Cache the new sale
      await OfflineDB.saveSale(data);
      return data;
    } else {
      // Offline sale
      const newSale = await OfflineDB.createSale(sale as any);
      
      // Update local product stock
      const product = await OfflineDB.getProductById(sale.product_id!);
      if (product) {
        await OfflineDB.updateProduct(sale.product_id!, {
          stock_quantity: product.stock_quantity - sale.quantity!
        });
      }
      
      return newSale;
    }
  } catch (error) {
    console.error('Error creating sale online, saving offline:', error);
    return await OfflineDB.createSale(sale as any);
  }
};

export const updateSale = async (id: string, updates: Partial<SaleInsert>): Promise<Sale> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', id)
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

      const formattedSale = {
        ...data,
        product_name: (data as any).products?.name
      };

      // Update local cache
      await OfflineDB.saveSale(formattedSale);
      return formattedSale;
    } else {
      const updated = await OfflineDB.updateSale(id, updates as any);
      return updated;
    }
  } catch (error) {
    console.error('Error updating sale online, saving offline:', error);
    return await OfflineDB.updateSale(id, updates as any);
  }
};

export const deleteSale = async (id: string): Promise<boolean> => {
  try {
    if (isOnline) {
      // First, get the sale to know the quantity and product_id for stock restoration
      const { data: sale, error: getError } = await supabase
        .from('sales')
        .select('product_id, quantity')
        .eq('id', id)
        .single();

      if (!getError && sale) {
        // Try to restore stock online first
        const { data: product, error: prodError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', sale.product_id)
          .single();

        if (!prodError && product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity + sale.quantity })
            .eq('id', sale.product_id);
        }
      }

      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from local cache (OfflineDB.deleteSale also restores local stock)
      return await OfflineDB.deleteSale(id);
    } else {
      return await OfflineDB.deleteSale(id);
    }
  } catch (error) {
    console.error('Error deleting sale online, marking offline:', error);
    return await OfflineDB.deleteSale(id);
  }
};

// ==================== CATEGORIES ====================

export const getCategories = async (): Promise<Category[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      // Cache to local DB
      await Promise.all((data || []).map(cat =>
        OfflineDB.saveCategory(cat as any).catch(err =>
          console.warn('Failed to cache category:', err)
        )
      ));

      return data || [];
    } else {
      return await OfflineDB.getAllCategories();
    }
  } catch (error) {
    console.error('Error fetching categories, using offline cache:', error);
    return await OfflineDB.getAllCategories();
  }
};

// ==================== PARTY PURCHASES ====================

export const getPartyPurchases = async (): Promise<PartyPurchase[]> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('party_purchases')
        .select('*')
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cache to local DB
      await Promise.all((data || []).map(pp =>
        OfflineDB.savePartyPurchase(pp).catch(err =>
          console.warn('Failed to cache party purchase:', err)
        )
      ));

      return data || [];
    } else {
      return await OfflineDB.getAllPartyPurchases();
    }
  } catch (error) {
    console.error('Error fetching party purchases, using offline cache:', error);
    return await OfflineDB.getAllPartyPurchases();
  }
};

export const createPartyPurchase = async (purchase: PartyPurchaseInsert): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('party_purchases')
        .insert(purchase)
        .select()
        .single();

      if (error) throw error;

      // Cache to local DB
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

export const updatePartyPurchase = async (id: string, updates: Partial<PartyPurchaseInsert>): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await supabase.from('party_purchases')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.savePartyPurchase(data);
      return data;
    } else {
      const updated = await OfflineDB.updatePartyPurchase(id, updates);
      if (!updated) throw new Error('Party purchase not found locally');
      return updated;
    }
  } catch (error) {
    console.error('Error updating party purchase online, marking offline:', error);
    const updated = await OfflineDB.updatePartyPurchase(id, updates);
    if (!updated) throw new Error('Party purchase not found locally');
    return updated;
  }
};
