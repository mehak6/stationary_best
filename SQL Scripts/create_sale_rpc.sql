-- RPC function to create a sale and check stock in a single transaction
CREATE OR REPLACE FUNCTION create_sale_with_stock_check(
    p_product_id UUID,
    p_quantity INTEGER,
    p_unit_price DECIMAL,
    p_total_amount DECIMAL,
    p_profit DECIMAL,
    p_sale_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    p_customer_info JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_sale_id UUID;
    v_new_stock INTEGER;
BEGIN
    -- 1. Check if product exists and has enough stock
    -- Note: The trigger also checks this, but doing it here allows for a cleaner error message
    -- before the insert attempt.
    SELECT stock_quantity INTO v_new_stock
    FROM products
    WHERE id = p_product_id;

    IF v_new_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_new_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_new_stock, p_quantity;
    END IF;

    -- 2. Insert the sale
    -- This will trigger the update_product_stock_after_sale() trigger
    INSERT INTO sales (
        product_id,
        quantity,
        unit_price,
        total_amount,
        profit,
        sale_date,
        notes,
        customer_info
    ) VALUES (
        p_product_id,
        p_quantity,
        p_unit_price,
        p_total_amount,
        p_profit,
        p_sale_date,
        p_notes,
        p_customer_info
    ) RETURNING id INTO v_sale_id;

    -- 3. Get the new stock level (after trigger execution)
    SELECT stock_quantity INTO v_new_stock
    FROM products
    WHERE id = p_product_id;

    -- 4. Return success data
    RETURN json_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'new_stock_quantity', v_new_stock
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;
