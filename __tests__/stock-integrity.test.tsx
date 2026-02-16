/**
 * Stock Integrity and Sale Tests
 * 
 * This file contains tests for stock underflow prevention and duplicate sale handling.
 * These tests can be run manually in the browser console or integrated into a test suite.
 */

import * as OfflineDB from '../lib/offline-db';

export const runStockIntegrityTests = async () => {
  console.log('🚀 Starting Stock Integrity Tests...');
  let testsPassed = 0;
  let testsFailed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      testsFailed++;
    }
  };

  try {
    // Setup: Create a test product
    const testProduct = await OfflineDB.createProduct({
      name: 'INTEGRITY TEST PRODUCT',
      barcode: 'INT-TEST-001',
      category_id: null,
      purchase_price: 10,
      selling_price: 20,
      stock_quantity: 10,
      min_stock_level: 2,
      supplier_info: null,
      image_url: null,
      description: 'Test product for integrity checks'
    });

    console.log('Test Product Created:', testProduct);

    // Test 1: Stock Underflow Prevention
    console.log('
--- Test 1: Stock Underflow ---');
    try {
      await OfflineDB.createSale({
        product_id: testProduct.id,
        quantity: 15, // More than available (10)
        unit_price: 20,
        total_amount: 300,
        profit: 150,
        customer_info: null,
        sale_date: new Date().toISOString(),
        notes: 'This should fail'
      });
      assert(false, 'Should have thrown error for insufficient stock');
    } catch (error: any) {
      assert(error.message.includes('Insufficient stock'), `Caught expected error: ${error.message}`);
    }

    // Verify stock hasn't changed
    const productAfterFail = await OfflineDB.getProductById(testProduct.id);
    assert(productAfterFail?.stock_quantity === 10, `Stock remains 10: ${productAfterFail?.stock_quantity}`);

    // Test 2: Successful Sale and Stock Deduction
    console.log('
--- Test 2: Successful Sale ---');
    const validSale = await OfflineDB.createSale({
      product_id: testProduct.id,
      quantity: 4,
      unit_price: 20,
      total_amount: 80,
      profit: 40,
      customer_info: null,
      sale_date: new Date().toISOString(),
      notes: 'This should succeed'
    });
    assert(!!validSale, 'Sale created successfully');
    
    const productAfterSuccess = await OfflineDB.getProductById(testProduct.id);
    assert(productAfterSuccess?.stock_quantity === 6, `Stock reduced to 6: ${productAfterSuccess?.stock_quantity}`);

    // Test 3: Duplicate Sale Submission (Idempotency)
    // Note: In a real app, we might use idempotency keys. 
    // For now, we'll simulate a retry logic check if we can.
    console.log('
--- Test 3: Multiple Sales in Rapid Succession ---');
    try {
      // Attempt two sales that would collectively exceed stock
      // Remaining: 6. Requesting 4 and 4.
      const p1 = OfflineDB.createSale({
        product_id: testProduct.id,
        quantity: 4,
        unit_price: 20,
        total_amount: 80,
        profit: 40,
        customer_info: null,
        sale_date: new Date().toISOString(),
        notes: 'Rapid 1'
      });
      
      const p2 = OfflineDB.createSale({
        product_id: testProduct.id,
        quantity: 4,
        unit_price: 20,
        total_amount: 80,
        profit: 40,
        customer_info: null,
        sale_date: new Date().toISOString(),
        notes: 'Rapid 2'
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      assert(fulfilled === 1 && rejected === 1, `One sale succeeded and one failed: ${fulfilled} ok, ${rejected} fail`);
    } catch (error) {
      console.error('Unexpected error in Test 3:', error);
    }

    // Final stock check
    const finalProduct = await OfflineDB.getProductById(testProduct.id);
    assert(finalProduct?.stock_quantity === 2, `Final stock is 2: ${finalProduct?.stock_quantity}`);

    // Cleanup
    await OfflineDB.deleteProduct(testProduct.id);
    console.log('
--- Cleanup ---');
    console.log('Test product deleted.');

  } catch (error) {
    console.error('CRITICAL TEST ERROR:', error);
  }

  console.log(`
📊 TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed.`);
};
