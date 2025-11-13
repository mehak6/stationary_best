# Offline Database Quick Reference Guide

## Quick Start

### Import Hooks
```typescript
import { useProducts, useSales, useCategories, usePartyPurchases, useAnalytics, useOfflineStatus } from '../hooks';
```

## Usage Examples

### 1. Products Management

```typescript
'use client';

import { useProducts } from '../hooks';

export default function ProductsPage() {
  const {
    products,
    loading,
    error,
    syncStatus,
    createProduct,
    updateProduct,
    deleteProduct
  } = useProducts();

  // Create product
  const handleCreate = async () => {
    try {
      const newProduct = await createProduct({
        name: 'Spiral Notebook',
        barcode: 'NB001',
        category_id: 'stationery',
        cost_price: 25,
        sale_price: 40,
        stock_quantity: 50,
        min_stock_level: 10,
        supplier: 'ABC Suppliers',
        description: 'A5 size, 200 pages'
      });
      console.log('Created:', newProduct);
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  // Update product
  const handleUpdate = async (id: string) => {
    await updateProduct(id, {
      stock_quantity: 100,
      sale_price: 45
    });
  };

  // Delete product
  const handleDelete = async (id: string) => {
    await deleteProduct(id);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Sync Status: {syncStatus}</p>
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>Stock: {product.stock_quantity}</p>
          <button onClick={() => handleUpdate(product.id)}>Update</button>
          <button onClick={() => handleDelete(product.id)}>Delete</button>
        </div>
      ))}
      <button onClick={handleCreate}>Add Product</button>
    </div>
  );
}
```

### 2. Sales Management (with Auto Stock Updates)

```typescript
'use client';

import { useSales, useProducts } from '../hooks';

export default function SalesPage() {
  const { sales, createSale, deleteSale } = useSales();
  const { products, refreshProducts } = useProducts();

  // Create sale (automatically reduces stock)
  const handleCreateSale = async () => {
    try {
      const sale = await createSale({
        product_id: 'product_123',
        quantity: 5,
        unit_price: 40,
        total_amount: 200,
        profit: 75
      });

      // Refresh products to see updated stock
      refreshProducts();

      console.log('Sale created:', sale);
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  // Delete sale (automatically restores stock)
  const handleDeleteSale = async (id: string) => {
    await deleteSale(id);
    refreshProducts(); // See restored stock
  };

  return (
    <div>
      {sales.map(sale => (
        <div key={sale.id}>
          <p>Product: {sale.product_id}</p>
          <p>Quantity: {sale.quantity}</p>
          <p>Total: ${sale.total_amount}</p>
          <button onClick={() => handleDeleteSale(sale.id)}>Delete</button>
        </div>
      ))}
      <button onClick={handleCreateSale}>Record Sale</button>
    </div>
  );
}
```

### 3. Analytics Dashboard

```typescript
'use client';

import { useAnalytics } from '../hooks';
import { useEffect, useState } from 'react';

export default function AnalyticsDashboard() {
  const {
    analytics,
    loading,
    fetchLowStockProducts,
    fetchSalesWithProducts,
    fetchDailySalesStats
  } = useAnalytics();

  const [lowStock, setLowStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [dailyStats, setDailyStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const low = await fetchLowStockProducts();
    setLowStock(low);

    const sales = await fetchSalesWithProducts(10);
    setRecentSales(sales);

    const today = new Date().toISOString().split('T')[0];
    const stats = await fetchDailySalesStats(today);
    setDailyStats(stats);
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div>
      <h2>Overview</h2>
      <div>
        <p>Total Products: {analytics.totalProducts}</p>
        <p>Total Sales: ${analytics.totalSales}</p>
        <p>Today's Sales: ${analytics.todaySales}</p>
        <p>Low Stock Items: {analytics.lowStockCount}</p>
      </div>

      <h2>Daily Stats</h2>
      {dailyStats && (
        <div>
          <p>Transactions: {dailyStats.transactionCount}</p>
          <p>Total: ${dailyStats.totalSales}</p>
          <p>Profit: ${dailyStats.totalProfit}</p>
          <p>Avg: ${dailyStats.avgTransactionValue.toFixed(2)}</p>
        </div>
      )}

      <h2>Low Stock Alert</h2>
      {lowStock.map(product => (
        <div key={product.id} style={{ color: 'red' }}>
          {product.name}: {product.stock_quantity} left
        </div>
      ))}

      <h2>Recent Sales</h2>
      {recentSales.map(sale => (
        <div key={sale.id}>
          <p>{sale.product?.name || 'Unknown'}</p>
          <p>Qty: {sale.quantity} - ${sale.total_amount}</p>
        </div>
      ))}
    </div>
  );
}
```

### 4. Offline Status Indicator

```typescript
'use client';

import { useOfflineStatus } from '../hooks';

export default function OfflineIndicator() {
  const { isOnline, wasOffline, lastOfflineTime } = useOfflineStatus();

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      padding: '10px',
      background: isOnline ? 'green' : 'red',
      color: 'white',
      borderRadius: '5px'
    }}>
      {isOnline ? '🟢 Online' : '🔴 Offline'}
      {wasOffline && lastOfflineTime && (
        <p style={{ fontSize: '12px', margin: '5px 0 0 0' }}>
          Last offline: {lastOfflineTime.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
```

### 5. Categories Management

```typescript
'use client';

import { useCategories } from '../hooks';

export default function CategoriesPage() {
  const {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory
  } = useCategories();

  const handleCreate = async () => {
    await createCategory({
      name: 'Stationery',
      description: 'Office and school supplies'
    });
  };

  return (
    <div>
      {loading ? 'Loading...' : (
        <>
          {categories.map(cat => (
            <div key={cat.id}>
              <h3>{cat.name}</h3>
              <p>{cat.description}</p>
            </div>
          ))}
          <button onClick={handleCreate}>Add Category</button>
        </>
      )}
    </div>
  );
}
```

### 6. Party Purchases (with Auto Stock Updates)

```typescript
'use client';

import { usePartyPurchases, useProducts } from '../hooks';

export default function PartyPurchasesPage() {
  const { partyPurchases, createPartyPurchase } = usePartyPurchases();
  const { refreshProducts } = useProducts();

  // Create purchase (automatically increases stock)
  const handleCreate = async () => {
    await createPartyPurchase({
      product_id: 'product_123',
      party_name: 'Wholesale Supplier Ltd',
      quantity: 100,
      unit_price: 20,
      total_amount: 2000,
      payment_status: 'paid',
      payment_date: new Date().toISOString()
    });

    // Refresh to see increased stock
    refreshProducts();
  };

  return (
    <div>
      {partyPurchases.map(purchase => (
        <div key={purchase.id}>
          <p>Party: {purchase.party_name}</p>
          <p>Qty: {purchase.quantity}</p>
          <p>Total: ${purchase.total_amount}</p>
          <p>Status: {purchase.payment_status}</p>
        </div>
      ))}
      <button onClick={handleCreate}>Record Purchase</button>
    </div>
  );
}
```

## Common Patterns

### Loading State
```typescript
const { loading } = useProducts();

if (loading) {
  return <LoadingSpinner />;
}
```

### Error Handling
```typescript
const { error, createProduct } = useProducts();

const handleSubmit = async (data) => {
  try {
    await createProduct(data);
    toast.success('Product created!');
  } catch (err) {
    toast.error(error || 'Failed to create product');
  }
};
```

### Sync Status Indicator
```typescript
const { syncStatus } = useProducts();

return (
  <div>
    {syncStatus === 'pending' && '⏳ Pending sync...'}
    {syncStatus === 'syncing' && '🔄 Syncing...'}
    {syncStatus === 'synced' && '✅ Synced'}
  </div>
);
```

### Manual Refresh
```typescript
const { refreshProducts } = useProducts();

// Call after external changes
useEffect(() => {
  const interval = setInterval(refreshProducts, 30000); // Every 30s
  return () => clearInterval(interval);
}, [refreshProducts]);
```

### Search/Filter Products
```typescript
const { products } = useProducts();
const [search, setSearch] = useState('');

const filtered = products.filter(p =>
  p.name.toLowerCase().includes(search.toLowerCase()) ||
  p.barcode.includes(search)
);
```

### Get Single Product
```typescript
const { getProduct } = useProducts();

const loadProduct = async (id: string) => {
  const product = await getProduct(id);
  if (product) {
    console.log('Found:', product);
  }
};
```

### Sales by Date
```typescript
const { getSalesByDateRange } = useSales();

const loadTodaySales = async () => {
  const today = new Date().toISOString().split('T')[0];
  const sales = await getSalesByDateRange(today);
  console.log('Today sales:', sales);
};
```

## Data Types

### Product
```typescript
{
  id: string
  name: string
  barcode: string
  category_id: string
  cost_price: number
  sale_price: number
  stock_quantity: number
  min_stock_level: number
  supplier: string
  description?: string
  created_at: string
  updated_at?: string
}
```

### Sale
```typescript
{
  id: string
  product_id: string
  quantity: number
  unit_price: number
  total_amount: number
  profit: number
  created_at: string
}
```

### Category
```typescript
{
  id: string
  name: string
  description?: string
  created_at: string
}
```

### PartyPurchase
```typescript
{
  id: string
  product_id: string
  party_name: string
  quantity: number
  unit_price: number
  total_amount: number
  payment_status: 'paid' | 'pending' | 'partial'
  payment_date?: string
  notes?: string
  created_at: string
}
```

### Analytics
```typescript
{
  totalProducts: number
  totalSales: number
  todaySales: number
  lowStockCount: number
}
```

## Best Practices

1. **Always handle loading state**
   ```typescript
   if (loading) return <Spinner />;
   ```

2. **Show error messages**
   ```typescript
   {error && <Alert>{error}</Alert>}
   ```

3. **Display sync status**
   ```typescript
   <SyncIndicator status={syncStatus} />
   ```

4. **Refresh after related changes**
   ```typescript
   await createSale(...);
   refreshProducts(); // Stock changed
   ```

5. **Use try-catch for operations**
   ```typescript
   try {
     await createProduct(data);
   } catch (err) {
     handleError(err);
   }
   ```

## Browser DevTools Inspection

1. **View Databases:**
   - F12 → Application → IndexedDB
   - Expand `inventory_products`, `inventory_sales`, etc.

2. **View Documents:**
   - Click database → Click document store
   - See all stored documents

3. **Check Indexes:**
   - Look for index by_name, by_barcode, etc.

4. **Monitor Size:**
   - Application → Storage
   - See total IndexedDB usage

## Testing Offline Mode

1. Open app in browser
2. F12 → Network tab
3. Change "Online" to "Offline"
4. Test CRUD operations
5. Verify data persists
6. Go back "Online"
7. Operations should sync (Phase 3)

## Performance Tips

- Use `limit` parameter for large datasets:
  ```typescript
  const { sales } = useSales();
  await loadSales(100); // Only load 100
  ```

- Debounce search/filter:
  ```typescript
  const debouncedSearch = useMemo(
    () => debounce(setSearch, 300),
    []
  );
  ```

- Lazy load analytics:
  ```typescript
  const loadAnalytics = useCallback(async () => {
    if (!analyticsVisible) return;
    await fetchAnalytics();
  }, [analyticsVisible]);
  ```

## Troubleshooting

**Products not loading?**
- Check console for errors
- Verify `initializeDatabases()` was called
- Check IndexedDB in DevTools

**Stock not updating?**
- Verify sale/purchase was created successfully
- Call `refreshProducts()` after changes
- Check `updateProductStock()` in offline-db.ts

**Sync status stuck?**
- Check for errors in console
- Verify network connectivity
- Phase 3 will add proper sync

---

**Need help?** Check [PWA_PHASE2_COMPLETE.md](./PWA_PHASE2_COMPLETE.md) for detailed documentation.
