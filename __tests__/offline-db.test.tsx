/**
 * Offline Database CRUD Operations Test
 *
 * This test file demonstrates and verifies all offline CRUD operations.
 * Run this test in a browser environment with IndexedDB support.
 *
 * To run manual tests:
 * 1. Open browser DevTools
 * 2. Go to Application > IndexedDB
 * 3. Verify databases: inventory_products, inventory_sales, etc.
 * 4. Run operations from browser console
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useCategories } from '../hooks/useCategories';
import { usePartyPurchases } from '../hooks/usePartyPurchases';
import { useAnalytics } from '../hooks/useAnalytics';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

describe('Offline Database - Products', () => {
  it('should create, read, update, and delete products', async () => {
    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // CREATE
    let newProduct;
    await act(async () => {
      newProduct = await result.current.createProduct({
        name: 'Test Notebook',
        barcode: 'TEST123',
        category_id: 'test-category',
        cost_price: 10,
        sale_price: 15,
        stock_quantity: 100,
        min_stock_level: 10,
        supplier: 'Test Supplier',
        description: 'Test Description'
      });
    });

    expect(newProduct).toBeDefined();
    expect(newProduct?.name).toBe('Test Notebook');
    expect(result.current.products.length).toBeGreaterThan(0);

    // READ
    const productId = newProduct!.id;
    const fetchedProduct = await result.current.getProduct(productId);
    expect(fetchedProduct).toBeDefined();
    expect(fetchedProduct?.id).toBe(productId);

    // UPDATE
    await act(async () => {
      await result.current.updateProduct(productId, {
        stock_quantity: 150
      });
    });

    const updatedProduct = result.current.products.find(p => p.id === productId);
    expect(updatedProduct?.stock_quantity).toBe(150);

    // DELETE
    await act(async () => {
      await result.current.deleteProduct(productId);
    });

    const deletedProduct = result.current.products.find(p => p.id === productId);
    expect(deletedProduct).toBeUndefined();
  });
});

describe('Offline Database - Sales', () => {
  it('should create and manage sales with automatic stock updates', async () => {
    const { result: productsResult } = renderHook(() => useProducts());
    const { result: salesResult } = renderHook(() => useSales());

    await waitFor(() => {
      expect(productsResult.current.loading).toBe(false);
      expect(salesResult.current.loading).toBe(false);
    });

    // Create a product first
    let testProduct;
    await act(async () => {
      testProduct = await productsResult.current.createProduct({
        name: 'Test Product for Sale',
        barcode: 'SALE123',
        category_id: 'test-category',
        cost_price: 10,
        sale_price: 20,
        stock_quantity: 100,
        min_stock_level: 10,
        supplier: 'Test Supplier'
      });
    });

    // Create a sale
    await act(async () => {
      await salesResult.current.createSale({
        product_id: testProduct!.id,
        quantity: 5,
        unit_price: 20,
        total_amount: 100,
        profit: 50
      });
    });

    // Verify stock was automatically reduced
    await act(async () => {
      await productsResult.current.refreshProducts();
    });

    const updatedProduct = productsResult.current.products.find(
      p => p.id === testProduct!.id
    );
    expect(updatedProduct?.stock_quantity).toBe(95); // 100 - 5

    // Clean up
    await act(async () => {
      await productsResult.current.deleteProduct(testProduct!.id);
    });
  });
});

describe('Offline Database - Categories', () => {
  it('should manage categories', async () => {
    const { result } = renderHook(() => useCategories());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Create
    let newCategory;
    await act(async () => {
      newCategory = await result.current.createCategory({
        name: 'Test Category',
        description: 'Test Description'
      });
    });

    expect(newCategory).toBeDefined();
    expect(newCategory?.name).toBe('Test Category');

    // Update
    await act(async () => {
      await result.current.updateCategory(newCategory!.id, {
        description: 'Updated Description'
      });
    });

    const updated = result.current.categories.find(c => c.id === newCategory!.id);
    expect(updated?.description).toBe('Updated Description');

    // Delete
    await act(async () => {
      await result.current.deleteCategory(newCategory!.id);
    });
  });
});

describe('Offline Database - Party Purchases', () => {
  it('should manage party purchases with automatic stock updates', async () => {
    const { result: productsResult } = renderHook(() => useProducts());
    const { result: purchasesResult } = renderHook(() => usePartyPurchases());

    await waitFor(() => {
      expect(productsResult.current.loading).toBe(false);
      expect(purchasesResult.current.loading).toBe(false);
    });

    // Create product
    let testProduct;
    await act(async () => {
      testProduct = await productsResult.current.createProduct({
        name: 'Test Product for Purchase',
        barcode: 'PURCHASE123',
        category_id: 'test-category',
        cost_price: 10,
        sale_price: 20,
        stock_quantity: 50,
        min_stock_level: 10,
        supplier: 'Test Supplier'
      });
    });

    // Create party purchase
    await act(async () => {
      await purchasesResult.current.createPartyPurchase({
        product_id: testProduct!.id,
        party_name: 'Test Party',
        quantity: 20,
        unit_price: 10,
        total_amount: 200,
        payment_status: 'paid'
      });
    });

    // Verify stock was automatically increased
    await act(async () => {
      await productsResult.current.refreshProducts();
    });

    const updatedProduct = productsResult.current.products.find(
      p => p.id === testProduct!.id
    );
    expect(updatedProduct?.stock_quantity).toBe(70); // 50 + 20

    // Clean up
    await act(async () => {
      await productsResult.current.deleteProduct(testProduct!.id);
    });
  });
});

describe('Analytics', () => {
  it('should calculate analytics from offline data', async () => {
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.analytics).toBeDefined();
    expect(result.current.analytics.totalProducts).toBeGreaterThanOrEqual(0);
    expect(result.current.analytics.totalSales).toBeGreaterThanOrEqual(0);
    expect(result.current.analytics.todaySales).toBeGreaterThanOrEqual(0);
    expect(result.current.analytics.lowStockCount).toBeGreaterThanOrEqual(0);

    // Test low stock products
    const lowStockProducts = await result.current.fetchLowStockProducts();
    expect(Array.isArray(lowStockProducts)).toBe(true);

    // Test sales with products
    const salesWithProducts = await result.current.fetchSalesWithProducts(10);
    expect(Array.isArray(salesWithProducts)).toBe(true);

    // Test daily sales stats
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await result.current.fetchDailySalesStats(today);
    expect(dailyStats).toBeDefined();
    expect(dailyStats.totalSales).toBeGreaterThanOrEqual(0);
  });
});

describe('Offline Status', () => {
  it('should track online/offline status', () => {
    const { result } = renderHook(() => useOfflineStatus());

    expect(result.current.isOnline).toBeDefined();
    expect(typeof result.current.isOnline).toBe('boolean');
    expect(result.current.wasOffline).toBeDefined();
    expect(typeof result.current.wasOffline).toBe('boolean');
  });
});

// Browser Console Manual Test Functions
// Copy and paste these into browser console to test manually

export const manualTests = {
  // Test 1: Create Product
  async testCreateProduct() {
    const { createProduct } = useProducts();
    const product = await createProduct({
      name: 'Manual Test Product',
      barcode: 'MANUAL123',
      category_id: 'test',
      cost_price: 10,
      sale_price: 15,
      stock_quantity: 100,
      min_stock_level: 10,
      supplier: 'Test'
    });
    console.log('Created product:', product);
    return product;
  },

  // Test 2: Create Sale (updates stock)
  async testCreateSale(productId: string) {
    const { createSale } = useSales();
    const sale = await createSale({
      product_id: productId,
      quantity: 5,
      unit_price: 15,
      total_amount: 75,
      profit: 25
    });
    console.log('Created sale:', sale);
    console.log('Product stock should be reduced by 5');
    return sale;
  },

  // Test 3: View Analytics
  async testAnalytics() {
    const { analytics, fetchLowStockProducts } = useAnalytics();
    console.log('Analytics:', analytics);
    const lowStock = await fetchLowStockProducts();
    console.log('Low stock products:', lowStock);
  },

  // Test 4: Test Offline Status
  testOfflineStatus() {
    const { isOnline, wasOffline, lastOnlineTime } = useOfflineStatus();
    console.log('Online status:', isOnline);
    console.log('Was offline:', wasOffline);
    console.log('Last online:', lastOnlineTime);
  }
};
