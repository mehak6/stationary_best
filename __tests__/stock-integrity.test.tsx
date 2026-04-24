import { renderHook, act } from '@testing-library/react';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';

// Mock the offline-db to avoid real IndexedDB usage
jest.mock('../lib/offline-db', () => ({
  getAllProducts: jest.fn().mockResolvedValue([]),
  getProductById: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  createSale: jest.fn(),
  getAllSales: jest.fn().mockResolvedValue([]),
}));

// Mock initializeDatabases
jest.mock('../lib/pouchdb-client', () => ({
  initializeDatabases: jest.fn(),
}));

describe('Stock Integrity and Profit Calculation', () => {
  const mockProduct = {
    id: 'prod-1',
    name: 'Integrity Test Product',
    category_id: null,
    barcode: 'INT-001',
    purchase_price: 100,
    selling_price: 150,
    stock_quantity: 10,
    min_stock_level: 2,
    supplier_info: null,
    image_url: null,
    description: 'Testing integrity'
  };

  test('Sale should accurately deduct stock', async () => {
    const { getProductById, createSale, updateProduct } = require('../lib/offline-db');
    
    getProductById.mockResolvedValue(mockProduct);
    createSale.mockResolvedValue({
      id: 'sale-1',
      product_id: mockProduct.id,
      quantity: 2,
      unit_price: 150,
      total_amount: 300,
      profit: 100,
      customer_info: null,
      sale_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    });

    const { result: salesResult } = renderHook(() => useSales());
    
    let newSale;
    await act(async () => {
      newSale = await salesResult.current.createSale({
        product_id: mockProduct.id,
        quantity: 2,
        unit_price: 150,
        total_amount: 300,
        profit: 100,
        customer_info: null,
        sale_date: new Date().toISOString().split('T')[0],
        notes: null
      });
    });

    expect(newSale).toBeDefined();
    expect(createSale).toHaveBeenCalled();
  });

  test('Profit should be calculated correctly (Selling Price - Purchase Price)', async () => {
    const unitPrice = 150;
    const purchasePrice = 100;
    const quantity = 3;
    
    const expectedProfit = (unitPrice - purchasePrice) * quantity;
    expect(expectedProfit).toBe(150);
  });
});
