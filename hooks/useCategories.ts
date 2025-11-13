'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllCategories,
  getCategoryById,
  createCategory as createCategoryDB,
  updateCategory as updateCategoryDB,
  deleteCategory as deleteCategoryDB,
  type Category
} from '../lib/offline-db';
import { initializeDatabases } from '../lib/pouchdb-client';

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');

  // Initialize databases on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeDatabases();
      loadCategories();
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllCategories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (category: Omit<Category, 'id' | 'created_at'>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const newCategory = await createCategoryDB(category);
      setCategories(prev => [...prev, newCategory]);
      setSyncStatus('synced');
      return newCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const updated = await updateCategoryDB(id, updates);
      if (updated) {
        setCategories(prev => prev.map(c => c.id === id ? updated : c));
      }
      setSyncStatus('synced');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const success = await deleteCategoryDB(id);
      if (success) {
        setCategories(prev => prev.filter(c => c.id !== id));
      }
      setSyncStatus('synced');
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const getCategory = useCallback(async (id: string) => {
    try {
      return await getCategoryById(id);
    } catch (err) {
      console.error('Error getting category:', err);
      return null;
    }
  }, []);

  const refreshCategories = useCallback(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    loading,
    error,
    syncStatus,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategory,
    refreshCategories
  };
};
