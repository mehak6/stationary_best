'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Calendar, 
  Filter, 
  Download,
  AlertCircle
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

  if (loading) return <div className="p-6 text-center">Loading reports...</div>;

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-2">Financial performance & inventory analytics</p>
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
                <option value="2025-26">2025-26</option>
                <option value="2026-27">2026-27</option>
              </select>
            </div>
          </div>
        </div>
        {!isCurrentYear && (
          <div className="mt-4 sm:mt-0 px-4 py-2 bg-orange-100 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-800 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Historical View
          </div>
        )}
      </div>

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
