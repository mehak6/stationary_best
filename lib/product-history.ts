'use client';

/**
 * Product History Tracker
 * Tracks when products are added and stock changes
 */

import * as OfflineDB from './offline-db';

export interface ProductHistoryEntry {
  id: string;
  product_id: string;
  product_name: string;
  action: 'created' | 'stock_added' | 'stock_updated';
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  date: string;
  notes?: string;
}

export const addProductHistory = async (historyEntry: Omit<ProductHistoryEntry, 'id' | 'date'>): Promise<void> => {
  try {
    const entry: ProductHistoryEntry = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...historyEntry,
      date: new Date().toISOString()
    };

    await OfflineDB.saveProductHistory(entry);
  } catch (error) {
    console.error('Error adding product history:', error);
    throw error;
  }
};

export const getProductHistory = async (productId: string): Promise<ProductHistoryEntry[]> => {
  try {
    const allHistory = await OfflineDB.getProductHistory(productId);
    return allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting product history:', error);
    return [];
  }
};
