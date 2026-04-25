'use client';

import React, { useState, useEffect } from 'react';
import {
  getProducts,
  getSales,
  getPartyPurchases,
  getSalesByDateRange,
  getClosingStockForYear
} from 'lib/offline-adapter';
import { 
  getFinancialYear, 
  getFYRange, 
  getFYList,
  formatFYLabel
} from 'lib/date-utils';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO } from '../utils/dateHelpers';
import type { Product, Sale, PartyPurchase } from 'supabase_client';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Calendar, 
  Filter, 
  Download,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';

interface ReportsProps {
  onNavigate: (view: string) => void;
}

export default function Reports({ onNavigate }: ReportsProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [historicalStock, setHistoricalStock] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);

  const isCurrentYear = financialYear === '2026-27';

  useEffect(() => {
    // Set default date range based on financial year
    if (financialYear === '2025-26') {
      setStartDate('2025-04-01');
      setEndDate('2026-03-19');
      setStartDateDisplay('01/04/2025');
      setEndDateDisplay('19/03/2026');
    } else {
      setStartDate('2026-03-20');
      const today = new Date().toISOString().split('T')[0];
      // End date for 2026-27 is 2027-03-20
      setEndDate(today > '2027-03-20' ? '2027-03-20' : today);
      setStartDateDisplay('20/03/2026');
      
      const d = new Date();
      const displayDate = today > '2027-03-20' ? '20/03/2027' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      setEndDateDisplay(displayDate);
    }
    fetchReportsData(financialYear);
  }, [financialYear]);

  const fetchReportsData = async (year: string) => {
    try {
      setLoading(true);
      const start = year === '2025-26' ? '2025-04-01' : '2026-03-20';
      const end = year === '2025-26' ? '2026-03-19' : '2027-03-20';

      const [productsData, salesData, partyData, closingData] = await Promise.all([
        getProducts(),
        getSalesByDateRange(start, end),
        getPartyPurchases(),
        year === '2025-26' ? getClosingStockForYear(year) : Promise.resolve({})
      ]);

      setProducts(productsData || []);
      setSales(salesData || []);
      setPartyPurchases(partyData || []);
      setHistoricalStock(closingData || {});
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = async () => {
    if (startDate && endDate) {
      try {
        setLoading(true);
        const filteredSales = await getSalesByDateRange(startDate, endDate);
        setSales(filteredSales || []);
        setFilterApplied(true);
      } catch (error) {
        console.error('Error applying date filter:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const clearFilter = async () => {
    setFilterApplied(false);
    fetchReportsData(financialYear);
  };

  const downloadReport = () => {
    // Calculate monthly breakdown
    const monthlyData: Record<string, { revenue: number, profit: number, count: number }> = {};
    sales.forEach(sale => {
      const month = new Date(sale.sale_date).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0, count: 0 };
      monthlyData[month].revenue += Number(sale.total_amount);
      monthlyData[month].profit += Number(sale.profit);
      monthlyData[month].count += 1;
    });

    const reportData = {
      financial_year: financialYear,
      generated_at: new Date().toISOString(),
      business_summary: {
        total_sales_revenue: totalSalesRevenue,
        total_net_profit: totalProfit,
        profit_margin_percent: profitMargin.toFixed(2),
        total_inventory_investment: totalInvestment,
        current_inventory_value: currentInventoryValue,
        total_items_sold: totalQuantitySold,
        average_sale_value: avgSaleValue,
        total_transactions: sales.length
      },
      monthly_performance: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data
      })),
      top_performing_products: topProducts.map(p => ({
        name: p.name,
        quantity_sold: p.salesData.quantity,
        revenue: p.salesData.revenue,
        profit: p.salesData.profit
      })),
      period_covered: {
        start: startDateDisplay,
        end: endDateDisplay
      }
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `business_performance_backup_${financialYear}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate investment based on either current stock or historical closing stock
  const getStockForProduct = (p: Product) => isCurrentYear ? p.stock_quantity : (historicalStock[p.id] ?? 0);

  const totalProductInvestment = products.reduce((sum, p) => sum + (p.purchase_price * getStockForProduct(p)), 0);
  const totalPartyInvestment = isCurrentYear ? partyPurchases.reduce((sum, pp) => sum + (pp.purchase_price * pp.remaining_quantity), 0) : 0;
  const totalInvestment = totalProductInvestment + totalPartyInvestment;
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const profitMargin = totalSalesRevenue > 0 ? (totalProfit / totalSalesRevenue) * 100 : 0;
  const currentInventoryValue = products.reduce((sum, p) => sum + (p.selling_price * getStockForProduct(p)), 0);

  const productSalesMap = sales.reduce((acc: Record<string, any>, sale) => {
    if (!acc[sale.product_id]) acc[sale.product_id] = { revenue: 0, profit: 0, quantity: 0 };
    acc[sale.product_id].revenue += sale.total_amount;
    acc[sale.product_id].profit += sale.profit;
    acc[sale.product_id].quantity += sale.quantity;
    return acc;
  }, {});

  const topProducts = products
    .map(p => ({ ...p, salesData: productSalesMap[p.id] || { revenue: 0, profit: 0, quantity: 0 } }))
    .filter(p => p.salesData.revenue > 0)
    .sort((a, b) => b.salesData.revenue - a.salesData.revenue)
    .slice(0, 5);

  const totalQuantitySold = sales.reduce((sum, s) => sum + s.quantity, 0);
  const avgSaleValue = sales.length > 0 ? totalSalesRevenue / sales.length : 0;
  const totalItemsInInventory = products.reduce((sum, p) => sum + getStockForProduct(p), 0);

  if (loading) return <div className="p-6 text-center">Loading reports...</div>;

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Yearly Performance</h1>
            <p className="text-gray-600 mt-2">Business summary for financial year {financialYear}</p>
          </div>
          <div className="bg-white border-2 border-primary-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
            <Calendar className="h-5 w-5 text-primary-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Financial Year</span>
              <select 
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-transparent text-sm font-bold text-primary-900 focus:outline-none cursor-pointer"
              >
                {getFYList().map(fy => (
                  <option key={fy} value={fy}>{formatFYLabel(fy)}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={downloadReport}
            className="btn-primary flex items-center gap-2"
            title="Download Performance Data"
          >
            <Download className="h-5 w-5" />
            <span>Download Report</span>
          </button>
        </div>
        {!isCurrentYear && (
          <div className="mt-4 sm:mt-0 px-4 py-2 bg-orange-100 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-800 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Historical Archive View
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Core Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">FY {financialYear}</span>
            </div>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-2">Total money from all sales</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+{profitMargin.toFixed(1)}%</span>
            </div>
            <p className="text-sm font-medium text-gray-500">Total Net Profit</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalProfit.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-2">Earnings after purchase costs</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Inventory Investment</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalInvestment.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-2">Cost of unsold stock</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Total Items Sold</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalQuantitySold.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-2">Volume across {sales.length} transactions</p>
          </div>
        </div>

        {/* Detailed Performance Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Financial Breakdown
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Total Gross Revenue:</span>
                <span className="font-bold text-lg">₹{totalSalesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Total Net Profit:</span>
                <span className="font-bold text-lg text-green-600">₹{totalProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Average Sale Value:</span>
                <span className="font-bold">₹{avgSaleValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Profit Margin:</span>
                <span className="font-bold text-primary-600">{profitMargin.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Inventory Valuation
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Total Current Stock Value:</span>
                <span className="font-bold text-lg text-blue-600">₹{currentInventoryValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Total Cost of Stock:</span>
                <span className="font-bold text-lg">₹{totalInvestment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Potential Profit in Stock:</span>
                <span className="font-bold text-green-600">₹{(currentInventoryValue - totalProductInvestment).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Total Quantity in Hand:</span>
                <span className="font-bold">{totalItemsInInventory.toLocaleString()} items</span>
              </div>
            </div>
          </div>
        </div>

        {/* Period Summary Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Period Overview</h3>
            <div className="flex gap-2">
              <div className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                {startDateDisplay} - {endDateDisplay}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-xs uppercase font-bold border-b border-gray-100">
                  <th className="pb-3 px-2">Performance Metric</th>
                  <th className="pb-3 px-2 text-right">Value</th>
                  <th className="pb-3 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr className="text-sm">
                  <td className="py-4 px-2 font-medium text-gray-700">Total Sales Transactions</td>
                  <td className="py-4 px-2 text-right font-bold">{sales.length}</td>
                  <td className="py-4 px-2 text-right text-xs font-bold text-green-600 uppercase">Tracked</td>
                </tr>
                <tr className="text-sm">
                  <td className="py-4 px-2 font-medium text-gray-700">Total Profit Generated</td>
                  <td className="py-4 px-2 text-right font-bold text-green-600">₹{totalProfit.toLocaleString()}</td>
                  <td className="py-4 px-2 text-right text-xs font-bold text-blue-600 uppercase">Growth</td>
                </tr>
                <tr className="text-sm">
                  <td className="py-4 px-2 font-medium text-gray-700">Total Inventory Investment</td>
                  <td className="py-4 px-2 text-right font-bold text-orange-600">₹{totalInvestment.toLocaleString()}</td>
                  <td className="py-4 px-2 text-right text-xs font-bold text-orange-600 uppercase">Assets</td>
                </tr>
                <tr className="text-sm">
                  <td className="py-4 px-2 font-medium text-gray-700">Highest Individual Transaction</td>
                  <td className="py-4 px-2 text-right font-bold">
                    ₹{sales.length > 0 ? Math.max(...sales.map(s => s.total_amount)).toLocaleString() : 0}
                  </td>
                  <td className="py-4 px-2 text-right text-xs font-bold text-purple-600 uppercase">Peak</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
