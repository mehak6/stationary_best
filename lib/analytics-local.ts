'use client';

import {
  getAllProducts,
  getAllSales,
  getSalesByDate,
  type Product,
  type Sale
} from './offline-db';

export interface Analytics {
  totalProducts: number;
  totalSales: number;
  todaySales: number;
  lowStockCount: number;
}

export const calculateAnalytics = async (): Promise<Analytics> => {
  try {
    const products = await getAllProducts();
    const sales = await getAllSales();
    const today = new Date().toISOString().split('T')[0];
    const todaySales = await getSalesByDate(today);

    const totalProducts = products.length;
    const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const todaySalesAmount = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const lowStockCount = products.filter(
      p => p.stock_quantity <= p.min_stock_level
    ).length;

    return {
      totalProducts,
      totalSales,
      todaySales: todaySalesAmount,
      lowStockCount
    };
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return {
      totalProducts: 0,
      totalSales: 0,
      todaySales: 0,
      lowStockCount: 0
    };
  }
};

export const getLowStockProducts = async (): Promise<Product[]> => {
  try {
    const products = await getAllProducts();
    return products.filter(p => p.stock_quantity <= p.min_stock_level);
  } catch (error) {
    console.error('Error getting low stock products:', error);
    return [];
  }
};

export const getSalesWithProducts = async (limit?: number): Promise<(Sale & { product?: Product })[]> => {
  try {
    const sales = await getAllSales(limit);
    const products = await getAllProducts();
    const productsMap = new Map(products.map(p => [p.id, p]));

    return sales.map(sale => ({
      ...sale,
      product: productsMap.get(sale.product_id)
    }));
  } catch (error) {
    console.error('Error getting sales with products:', error);
    return [];
  }
};

export const calculateDailySalesStats = async (date: string) => {
  try {
    const sales = await getSalesByDate(date);

    return {
      totalSales: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
      totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
      transactionCount: sales.length,
      avgTransactionValue: sales.length > 0
        ? sales.reduce((sum, sale) => sum + sale.total_amount, 0) / sales.length
        : 0
    };
  } catch (error) {
    console.error('Error calculating daily sales stats:', error);
    return {
      totalSales: 0,
      totalProfit: 0,
      transactionCount: 0,
      avgTransactionValue: 0
    };
  }
};
