'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllProducts,
  getProductById,
  createProduct as createProductDB,
  updateProduct as updateProductDB,
  deleteProduct as deleteProductDB,
  type Product
} from '../lib/offline-db';
import { initializeDatabases } from '../lib/pouchdb-client';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');

  // Initialize databases on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeDatabases();
      loadProducts();
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const newProduct = await createProductDB(product);
      setProducts(prev => [...prev, newProduct]);
      setSyncStatus('synced');
      return newProduct;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const updated = await updateProductDB(id, updates);
      if (updated) {
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
      }
      setSyncStatus('synced');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const success = await deleteProductDB(id);
      if (success) {
        setProducts(prev => prev.filter(p => p.id !== id));
      }
      setSyncStatus('synced');
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const getProduct = useCallback(async (id: string) => {
    try {
      return await getProductById(id);
    } catch (err) {
      console.error('Error getting product:', err);
      return null;
    }
  }, []);

  const refreshProducts = useCallback(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    syncStatus,
    createProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    refreshProducts
  };
};
