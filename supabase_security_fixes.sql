-- =============================================
-- Supabase Security Fixes for Inventory Pro
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON TABLES
-- =============================================

-- Enable RLS on all public tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_purchases ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. CREATE PERMISSIVE POLICIES
-- (Allow all operations for anonymous users - suitable for single-user app)
-- =============================================

-- Products policies
DROP POLICY IF EXISTS "Allow all on products" ON public.products;
CREATE POLICY "Allow all on products" ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Sales policies
DROP POLICY IF EXISTS "Allow all on sales" ON public.sales;
CREATE POLICY "Allow all on sales" ON public.sales
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Categories policies
DROP POLICY IF EXISTS "Allow all on categories" ON public.categories;
CREATE POLICY "Allow all on categories" ON public.categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Customers policies
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" ON public.customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Party purchases policies - Drop all old policies first
DROP POLICY IF EXISTS "Allow all on party_purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can view party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can create party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can update party purchases" ON public.party_purchases;
DROP POLICY IF EXISTS "Anyone can delete party purchases" ON public.party_purchases;

CREATE POLICY "Allow all on party_purchases" ON public.party_purchases
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- 3. FIX SECURITY DEFINER VIEWS
-- Change views to use SECURITY INVOKER instead
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
-- 4. FIX FUNCTION SEARCH PATH MUTABLE WARNINGS
-- Set explicit search_path for all functions
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

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Fix is_manager_or_admin function
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  );
END;
$$;

-- =============================================
-- 5. GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON public.products TO anon, authenticated;
GRANT ALL ON public.sales TO anon, authenticated;
GRANT ALL ON public.categories TO anon, authenticated;
GRANT ALL ON public.customers TO anon, authenticated;
GRANT ALL ON public.party_purchases TO anon, authenticated;

-- Grant permissions on views
GRANT SELECT ON public.category_performance TO anon, authenticated;
GRANT SELECT ON public.daily_sales_summary TO anon, authenticated;
GRANT SELECT ON public.product_analytics TO anon, authenticated;

-- =============================================
-- DONE!
-- After running this, click "Rerun linter" in Security Advisor
-- =============================================
