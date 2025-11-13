'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  calculateAnalytics,
  getLowStockProducts,
  getSalesWithProducts,
  calculateDailySalesStats,
  type Analytics
} from '../lib/analytics-local';
import type { Product, Sale } from '../lib/offline-db';
import { initializeDatabases } from '../lib/pouchdb-client';

export const useAnalytics = () => {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalProducts: 0,
    totalSales: 0,
    todaySales: 0,
    lowStockCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize databases on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeDatabases();
      loadAnalytics();
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await calculateAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLowStockProducts = useCallback(async (): Promise<Product[]> => {
    try {
      setError(null);
      return await getLowStockProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch low stock products');
      console.error('Error fetching low stock products:', err);
      return [];
    }
  }, []);

  const fetchSalesWithProducts = useCallback(async (limit?: number): Promise<(Sale & { product?: Product })[]> => {
    try {
      setError(null);
      return await getSalesWithProducts(limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales with products');
      console.error('Error fetching sales with products:', err);
      return [];
    }
  }, []);

  const fetchDailySalesStats = useCallback(async (date: string) => {
    try {
      setError(null);
      return await calculateDailySalesStats(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily sales stats');
      console.error('Error fetching daily sales stats:', err);
      return {
        totalSales: 0,
        totalProfit: 0,
        transactionCount: 0,
        avgTransactionValue: 0
      };
    }
  }, []);

  const refreshAnalytics = useCallback(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    error,
    fetchLowStockProducts,
    fetchSalesWithProducts,
    fetchDailySalesStats,
    refreshAnalytics
  };
};
