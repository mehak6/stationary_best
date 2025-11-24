-- =============================================
-- Supabase Authentication & Security Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON TABLES
-- =============================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_purchases ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. DROP OLD PERMISSIVE POLICIES (if any)
-- =============================================

-- Products policies
DROP POLICY IF EXISTS "Allow all on products" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products can be inserted by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products can be updated by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products can be deleted by authenticated users" ON public.products;

-- Sales policies
DROP POLICY IF EXISTS "Allow all on sales" ON public.sales;
DROP POLICY IF EXISTS "Sales are viewable by authenticated users" ON public.sales;
DROP POLICY IF EXISTS "Sales can be inserted by authenticated users" ON public.sales;
DROP POLICY IF EXISTS "Sales can be updated by authenticated users" ON public.sales;
DROP POLICY IF EXISTS "Sales can be deleted by authenticated users" ON public.sales;

-- Categories policies
DROP POLICY IF EXISTS "Allow all on categories" ON public.categories;
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Categories can be inserted by authenticated users" ON public.categories;

-- Customers policies
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON public.customers;

-- Party purchases policies
DROP POLICY IF EXISTS "Allow all on party_purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can view party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can create party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can update party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can delete party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Party purchases are viewable by authenticated users" ON public.party_purchases;
DROP POLICY IF EXISTS "Party purchases can be inserted by authenticated users" ON public.party_purchases;
DROP POLICY IF EXISTS "Party purchases can be updated by authenticated users" ON public.party_purchases;
DROP POLICY IF EXISTS "Party purchases can be deleted by authenticated users" ON public.party_purchases;

-- =============================================
-- 3. CREATE NEW AUTHENTICATED-ONLY POLICIES
-- =============================================

-- Products policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert products" ON public.products
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products" ON public.products
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete products" ON public.products
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Sales policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view sales" ON public.sales
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sales" ON public.sales
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sales" ON public.sales
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sales" ON public.sales
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Categories policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view categories" ON public.categories
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert categories" ON public.categories
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update categories" ON public.categories
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete categories" ON public.categories
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Customers policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert customers" ON public.customers
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update customers" ON public.customers
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete customers" ON public.customers
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Party purchases policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view party purchases" ON public.party_purchases
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert party purchases" ON public.party_purchases
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update party purchases" ON public.party_purchases
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete party purchases" ON public.party_purchases
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- 4. FIX SECURITY DEFINER VIEWS
-- =============================================

-- Drop and recreate category_performance view
DROP VIEW IF EXISTS public.category_performance;
CREATE VIEW public.category_performance
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  COUNT(p.id) as product_count,
  COALESCE(SUM(p.stock_quantity), 0) as total_stock,
  COALESCE(SUM(s.total_amount), 0) as total_sales
FROM public.categories c
LEFT JOIN public.products p ON p.category_id = c.id
LEFT JOIN public.sales s ON s.product_id = p.id
GROUP BY c.id, c.name;

-- Drop and recreate daily_sales_summary view
DROP VIEW IF EXISTS public.daily_sales_summary;
CREATE VIEW public.daily_sales_summary
WITH (security_invoker = true)
AS
SELECT
  sale_date,
  COUNT(*) as total_transactions,
  SUM(quantity) as total_items_sold,
  SUM(total_amount) as total_revenue,
  SUM(profit) as total_profit
FROM public.sales
GROUP BY sale_date
ORDER BY sale_date DESC;

-- Drop and recreate product_analytics view
DROP VIEW IF EXISTS public.product_analytics;
CREATE VIEW public.product_analytics
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.stock_quantity,
  p.min_stock_level,
  p.selling_price,
  p.purchase_price,
  COALESCE(SUM(s.quantity), 0) as total_sold,
  COALESCE(SUM(s.total_amount), 0) as total_revenue,
  COALESCE(SUM(s.profit), 0) as total_profit
FROM public.products p
LEFT JOIN public.sales s ON s.product_id = p.id
GROUP BY p.id, p.name, p.stock_quantity, p.min_stock_level, p.selling_price, p.purchase_price;

-- =============================================
-- 5. FIX FUNCTION SEARCH PATH
-- =============================================

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_product_stock_after_sale function
CREATE OR REPLACE FUNCTION public.update_product_stock_after_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix restore_product_stock_after_sale_delete function
CREATE OR REPLACE FUNCTION public.restore_product_stock_after_sale_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + OLD.quantity,
      updated_at = NOW()
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$;

-- =============================================
-- 6. GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema to authenticated users only
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables to authenticated users only
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.party_purchases TO authenticated;

-- Grant permissions on views to authenticated users only
GRANT SELECT ON public.category_performance TO authenticated;
GRANT SELECT ON public.daily_sales_summary TO authenticated;
GRANT SELECT ON public.product_analytics TO authenticated;

-- Revoke all permissions from anon role (unauthenticated users)
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.sales FROM anon;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.party_purchases FROM anon;
REVOKE ALL ON public.category_performance FROM anon;
REVOKE ALL ON public.daily_sales_summary FROM anon;
REVOKE ALL ON public.product_analytics FROM anon;

-- =============================================
-- DONE!
-- After running this, click "Rerun linter" in Security Advisor
-- All data is now protected - only authenticated users can access it
-- =============================================
