# Supabase Database Migration Instructions
## Step-by-Step Guide to Update Your Database

---

## 🎯 Overview

This guide will help you update your Supabase database with all necessary tables, triggers, views, and functions for the Stationery & Games Inventory Management System.

**Estimated Time**: 5-10 minutes
**Difficulty**: Easy
**Risk Level**: Low (script is idempotent - safe to re-run)

---

## 📋 Pre-Migration Checklist

Before you begin, ensure you have:

- [ ] Access to Supabase Dashboard (https://supabase.com/dashboard)
- [ ] Your project credentials in `.env.local`
- [ ] Backup of existing data (if any) - **Supabase auto-backups daily**
- [ ] Basic understanding of SQL (helpful but not required)

**Your Project**:
- **Project Name**: stationery-business
- **Project URL**: https://ccpvnpidhxkcbxeeyqeq.supabase.co
- **Region**: Configured

---

## 🚀 Migration Steps

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Click on your project: **stationery-business**

### Step 2: Navigate to SQL Editor

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)
3. You'll see an empty SQL editor

### Step 3: Prepare the Migration Script

1. Open the file: `SQL Scripts/complete_supabase_update.sql`
2. Select **ALL** content (Ctrl+A / Cmd+A)
3. Copy to clipboard (Ctrl+C / Cmd+C)

### Step 4: Execute the Migration

1. Paste the SQL into Supabase SQL Editor (Ctrl+V / Cmd+V)
2. Review the script (optional - it's safe to run)
3. Click **"Run"** button or press **Ctrl+Enter**
4. Wait for execution to complete (usually 5-15 seconds)

### Step 5: Verify Success

Look for the completion message in the output panel:

```
========================================
SUPABASE DATABASE UPDATE COMPLETE
========================================

Tables Created/Updated:
  ✓ categories
  ✓ products
  ✓ customers
  ✓ sales
  ✓ party_purchases

Current Database State:
  • Categories: 5
  • Products: 8
  • Customers: 5
  • Sales: 0
  • Party Purchases: 0
```

If you see this message, **migration successful!** ✅

### Step 6: Visual Verification

1. Click **"Table Editor"** in the left sidebar
2. You should see 5 tables:
   - `categories`
   - `products`
   - `customers`
   - `sales`
   - `party_purchases`
3. Click on each table to view sample data

### Step 7: Test Database Functions

Run this test query in SQL Editor:

```sql
-- Test dashboard stats function
SELECT * FROM get_dashboard_stats();
```

**Expected Output**:
```
total_products: 8
total_sales: 0.00
today_sales: 0.00
low_stock_count: 0
```

### Step 8: Test Analytics Views

```sql
-- View all analytics views
SELECT * FROM product_analytics LIMIT 5;
SELECT * FROM daily_sales_summary LIMIT 5;
SELECT * FROM category_performance;
SELECT * FROM low_stock_products;
```

If these queries run without errors, **all views are working!** ✅

### Step 9: Test Stock Management Trigger

```sql
-- 1. Check initial stock for Blue Pen
SELECT name, stock_quantity FROM products WHERE barcode = 'ST001';
-- Should show: 50

-- 2. Create a test sale (stock should auto-decrement)
INSERT INTO sales (product_id, quantity, unit_price, total_amount, profit)
SELECT id, 5, 8.00, 40.00, 15.00 FROM products WHERE barcode = 'ST001';

-- 3. Check stock again
SELECT name, stock_quantity FROM products WHERE barcode = 'ST001';
-- Should show: 45 (decreased by 5)

-- 4. Delete the test sale (stock should auto-restore)
DELETE FROM sales WHERE id = (
  SELECT id FROM sales ORDER BY created_at DESC LIMIT 1
);

-- 5. Verify stock restored
SELECT name, stock_quantity FROM products WHERE barcode = 'ST001';
-- Should show: 50 (back to original)
```

If stock changes automatically, **triggers are working!** ✅

### Step 10: Update Your App (Optional)

The migration is complete! Your app should now work with the updated database.

**No code changes needed** - the app already uses all these tables.

---

## 🔍 What Was Updated?

### Tables Created/Updated

| Table | Purpose | Sample Data |
|-------|---------|-------------|
| **categories** | Product categorization | 5 categories |
| **products** | Main inventory | 8 sample products |
| **customers** | Customer database | 5 sample customers |
| **sales** | Transaction history | Empty (ready for your sales) |
| **party_purchases** | Supplier purchases | Empty (ready for your data) |

### Indexes Created (15+)

Performance indexes for:
- Product name search
- Barcode lookups
- Category filtering
- Date-based queries
- Low stock alerts
- Sales analytics

### Triggers Created (4)

| Trigger | Purpose |
|---------|---------|
| `update_products_updated_at` | Auto-updates product timestamps |
| `update_party_purchases_updated_at` | Auto-updates purchase timestamps |
| `trigger_update_stock_after_sale` | Decrements stock on sale |
| `trigger_restore_stock_after_sale_delete` | Restores stock on delete |

### Views Created (6)

| View | Purpose |
|------|---------|
| `product_analytics` | Product performance metrics |
| `daily_sales_summary` | Daily sales aggregation |
| `category_performance` | Category-level analytics |
| `low_stock_products` | Products needing restock |
| `monthly_sales_trends` | Month-over-month trends |
| `party_purchases_summary` | Supplier purchase summary |

### Functions Created (2)

| Function | Purpose |
|----------|---------|
| `get_dashboard_stats()` | Quick dashboard KPIs |
| `check_product_availability(id, qty)` | Stock validation |

---

## 🛡️ Security & Permissions

### Current Setup: Single-User Mode

- **RLS**: Disabled on all tables
- **Authentication**: Not required
- **Access**: Anyone with anon key has full access

**This is perfect for**:
- Internal business use
- Private deployments
- Single-user applications

### If You Want Multi-User Access Later

1. Run `supabase_sql_setup.sql` instead
2. Enable authentication in your app
3. Add user management UI

---

## 🧪 Testing Checklist

After migration, verify:

- [ ] All 5 tables exist in Table Editor
- [ ] Sample data loaded (categories, products, customers)
- [ ] `get_dashboard_stats()` returns data
- [ ] Analytics views can be queried
- [ ] Stock decrements on sale creation
- [ ] Stock restores on sale deletion
- [ ] Timestamps auto-update
- [ ] Your app connects successfully

---

## ❌ Troubleshooting

### Error: "permission denied for schema public"

**Cause**: Insufficient permissions
**Solution**: Ensure you're logged in as project owner

### Error: "relation already exists"

**Cause**: Tables already created
**Solution**: This is normal! Script uses `IF NOT EXISTS` - safe to continue

### Error: "syntax error near..."

**Cause**: Incomplete script copy
**Solution**: Re-copy the entire script from start to end

### No sample data appears

**Cause**: Previous run with data already exists
**Solution**: Sample inserts use `ON CONFLICT DO NOTHING` - this is expected

### Triggers not firing

**Check**:
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

Should show 4 triggers. If missing, re-run the migration.

### Views not found

**Check**:
```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';
```

Should show 6 views. If missing, re-run the migration.

---

## 🔄 Re-Running the Migration

**It's safe to re-run the migration script multiple times!**

The script is **idempotent**, meaning:
- ✅ Creates tables only if they don't exist
- ✅ Creates or replaces functions/triggers/views
- ✅ Preserves existing data
- ✅ Adds sample data only if not present

To re-run:
1. Open SQL Editor
2. Paste script again
3. Click Run

---

## 📊 Post-Migration: View Your Data

### Using Supabase Dashboard

**Table Editor**:
1. Click "Table Editor"
2. Select a table from dropdown
3. View/edit data in spreadsheet format
4. Use filters and sorting

**SQL Editor**:
```sql
-- View all products with categories
SELECT
  p.name as product,
  c.name as category,
  p.stock_quantity,
  p.selling_price
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

-- View sales summary
SELECT
  DATE(sale_date) as date,
  COUNT(*) as transactions,
  SUM(total_amount) as revenue,
  SUM(profit) as profit
FROM sales
GROUP BY DATE(sale_date)
ORDER BY date DESC;

-- View low stock products
SELECT name, stock_quantity, min_stock_level
FROM products
WHERE stock_quantity <= min_stock_level;
```

### Using Your App

1. Start your app: `npm run dev`
2. Open: http://localhost:3000
3. Navigate through:
   - **Dashboard**: View KPIs and alerts
   - **Products**: Browse inventory
   - **Quick Sale**: Make test sales
   - **Party Management**: Add supplier purchases

---

## 📈 Next Steps

### Recommended Actions

1. **Customize Sample Data**
   - Edit categories to match your business
   - Update product names and prices
   - Add your actual customers

2. **Test All Features**
   - Create a few test sales
   - Try product search and filtering
   - Test file uploads (CSV, Excel, PDF)
   - Verify low stock alerts

3. **Configure for Production**
   - Review environment variables
   - Set up proper backups
   - Consider enabling authentication
   - Add monitoring/alerts

4. **Learn the System**
   - Read: `SUPABASE_DATABASE_GUIDE.md`
   - Explore analytics views
   - Try helper functions
   - Review business logic

---

## 🆘 Need Help?

### Documentation
- **Database Guide**: `SUPABASE_DATABASE_GUIDE.md`
- **SQL Script**: `SQL Scripts/complete_supabase_update.sql`
- **Type Definitions**: `lib/database.types.ts`

### Supabase Resources
- **Dashboard**: https://supabase.com/dashboard
- **Docs**: https://supabase.com/docs
- **Support**: https://supabase.com/support

### Project Files
- **Supabase Client**: `supabase_client.ts`
- **Environment**: `.env.local`
- **App Component**: `app/components/InventoryApp.tsx`

---

## ✅ Migration Complete!

Congratulations! Your Supabase database is now fully configured with:

- ✅ **5 Tables** with proper schemas
- ✅ **15+ Indexes** for performance
- ✅ **4 Triggers** for automation
- ✅ **6 Views** for analytics
- ✅ **2 Functions** for utilities
- ✅ **Sample Data** for testing

**Your inventory management system is ready to use!** 🎉

---

## 📝 Migration Log

Document your migration:

```
Migration Date: _____________
Executed By: _____________
Database State Before:
  - Tables: _____________
  - Data: _____________

Migration Result:
  ✅ Success / ❌ Issues

Notes:
_________________________________
_________________________________
```

---

**Generated by**: Claude Code Deep Analysis
**Version**: 1.0
**Status**: Production Ready ✓
**Last Updated**: 2024
