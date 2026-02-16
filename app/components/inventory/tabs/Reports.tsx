'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import {
  getProducts,
  getSales,
  getPartyPurchases,
  getSalesByDateRange
} from 'lib/offline-adapter';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO } from '../utils/dateHelpers';
import type { Product, Sale, PartyPurchase } from 'supabase_client';

interface ReportsProps {
  onNavigate: (view: string) => void;
}

export default function Reports({ onNavigate }: ReportsProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear());
    return `${day}/${month}/${year}`;
  });
  const [filterApplied, setFilterApplied] = useState(false);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const [productsData, salesData, partyData] = await Promise.all([
        getProducts(),
        getSales(),
        getPartyPurchases()
      ]);
      setProducts(productsData || []);
      setSales(salesData || []);
      setPartyPurchases(partyData || []);
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
    setStartDate('');
    setEndDate(new Date().toISOString().split('T')[0]);
    setFilterApplied(false);
    fetchReportsData();
  };

  const totalProductInvestment = products.reduce((sum, p) => sum + (p.purchase_price * p.stock_quantity), 0);
  const totalPartyInvestment = partyPurchases.reduce((sum, pp) => sum + (pp.purchase_price * pp.remaining_quantity), 0);
  const totalInvestment = totalProductInvestment + totalPartyInvestment;
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const profitMargin = totalSalesRevenue > 0 ? (totalProfit / totalSalesRevenue) * 100 : 0;
  const currentInventoryValue = products.reduce((sum, p) => sum + (p.selling_price * p.stock_quantity), 0);

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

  if (loading) return <div className="p-6 text-center">Loading reports...</div>;

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-orange-600 text-white">
            <p className="text-sm opacity-80">Total Investment</p>
            <p className="text-2xl font-bold">₹{totalInvestment.toLocaleString('en-IN')}</p>
          </div>
          <div className="card bg-green-600 text-white">
            <p className="text-sm opacity-80">Total Revenue</p>
            <p className="text-2xl font-bold">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
          </div>
          <div className="card bg-blue-600 text-white">
            <p className="text-sm opacity-80">Total Profit</p>
            <p className="text-2xl font-bold">₹{totalProfit.toLocaleString('en-IN')}</p>
          </div>
          <div className="card bg-purple-600 text-white">
            <p className="text-sm opacity-80">Profit Margin</p>
            <p className="text-2xl font-bold">{profitMargin.toFixed(2)}%</p>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Date Filter</h3>
          <div className="flex gap-4">
            <input type="text" placeholder="Start DD/MM/YYYY" value={startDateDisplay} onChange={e => {
              setStartDateDisplay(e.target.value);
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) setStartDate(parseDDMMYYYYToISO(e.target.value));
            }} className="input-field" />
            <input type="text" placeholder="End DD/MM/YYYY" value={endDateDisplay} onChange={e => {
              setEndDateDisplay(e.target.value);
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) setEndDate(parseDDMMYYYYToISO(e.target.value));
            }} className="input-field" />
            <button onClick={applyDateFilter} className="btn-primary">Apply</button>
            {filterApplied && <button onClick={clearFilter} className="btn-outline">Clear</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold mb-4">Top 5 Products</h3>
            <div className="space-y-2">
              {topProducts.map(p => (
                <div key={p.id} className="flex justify-between border-b pb-2">
                  <span>{p.name}</span>
                  <span className="font-bold">₹{p.salesData.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="font-bold mb-4">Inventory Value</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Potential Revenue:</span>
                <span className="font-bold text-green-600">₹{currentInventoryValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Potential Profit:</span>
                <span className="font-bold text-blue-600">₹{(currentInventoryValue - totalProductInvestment).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
