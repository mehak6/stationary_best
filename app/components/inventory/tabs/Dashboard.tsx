'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  DollarSign,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import {
  getProducts,
  getSales,
  updateSale,
  deleteSale,
  getAnalytics
} from 'lib/offline-adapter';
import { 
  getFinancialYear, 
  getFYRange 
} from 'lib/date-utils';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO } from '../utils/dateHelpers';
import type { Product, Sale } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalProfit: 0,
    todaySales: 0,
    todayProfit: 0,
    lowStockProducts: 0
  });

  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [showAllSales, setShowAllSales] = useState(false);
  const [allSalesLoading, setAllSalesLoading] = useState(false);
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
  const [allSalesPage, setAllSalesPage] = useState(1);
  const SALES_PER_PAGE = 20;
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleData, setEditSaleData] = useState({
    quantity: 0,
    unit_price: 0,
    sale_date: ''
  });
  const [editSaleDateDisplay, setEditSaleDateDisplay] = useState('');

  // Fetch dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [analyticsData, productsData] = await Promise.all([
          getAnalytics(),
          getProducts()
        ]);
        setAnalytics(analyticsData || {
          totalProducts: 0,
          totalSales: 0,
          totalProfit: 0,
          todaySales: 0,
          todayProfit: 0,
          lowStockProducts: 0
        });

        // Filter low stock items
        const lowStock = (productsData || []).filter(p => p.stock_quantity <= p.min_stock_level);
        setLowStockItems(lowStock);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set empty states on error
        setLowStockItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    const isoDate = sale.sale_date.split('T')[0];
    setEditSaleData({
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      sale_date: isoDate
    });
    // Set display date in dd/mm/yyyy format
    setEditSaleDateDisplay(formatDateToDDMMYYYY(isoDate));
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    try {
      // Check if quantity is being increased
      const quantityDifference = editSaleData.quantity - editingSale.quantity;

      if (quantityDifference > 0) {
        // Get current product stock
        const products = await getProducts();
        const product = products.find(p => p.id === editingSale.product_id);

        if (!product) {
          showToast('Error: Product not found. Cannot update sale.', 'error');
          return;
        }

        // Check if sufficient stock is available
        if (product.stock_quantity < quantityDifference) {
          showToast(`Insufficient stock! Available: ${product.stock_quantity}, Required: ${quantityDifference}`, 'error', 5000);
          return;
        }
      }

      // Calculate new total and profit
      const totalAmount = editSaleData.quantity * editSaleData.unit_price;
      const purchasePrice = editingSale.products?.purchase_price || 0;
      const profit = totalAmount - (editSaleData.quantity * purchasePrice);

      const updates = {
        quantity: editSaleData.quantity,
        unit_price: editSaleData.unit_price,
        total_amount: totalAmount,
        profit: profit,
        sale_date: editSaleData.sale_date
      };

      await updateSale(editingSale.id, updates);

      // Refresh dashboard data to update analytics
      const [analyticsData] = await Promise.all([
        getAnalytics()
      ]);

      setAnalytics(analyticsData || {
        totalProducts: 0,
        totalSales: 0,
        totalProfit: 0,
        todaySales: 0,
        todayProfit: 0,
        lowStockProducts: 0
      });

      // Refresh All Sales if open
      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }

      // Show success message
      showToast(`Sale updated successfully for ${editingSale.products?.name}`, 'success');

      // Close edit modal
      setEditingSale(null);

    } catch (error) {
      console.error('Error updating sale:', error);
      showToast('Error updating sale. Please try again.', 'error');
    }
  };

  const handleDeleteSale = async (saleId: string, saleData: any) => {
    if (!confirm(`Are you sure you want to delete this sale of ${saleData.products?.name || 'Unknown Product'}? This action cannot be undone.`)) {
      return;
    }

    try {
      const success = await deleteSale(saleId);
      
      if (!success) {
        showToast('Failed to delete sale from database', 'error');
        return;
      }

      // Refresh dashboard data to update analytics
      const analyticsData = await getAnalytics();

      setAnalytics(analyticsData || {
        totalProducts: 0,
        totalSales: 0,
        totalProfit: 0,
        todaySales: 0,
        todayProfit: 0,
        lowStockProducts: 0
      });

      // Refresh All Sales if open
      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }

      showToast('Sale deleted successfully', 'success');

    } catch (error) {
      console.error('Error deleting sale:', error);
      showToast('Error deleting sale. Please try again.', 'error');
    }
  };

  // Fetch All Sales with filtering and pagination
  const fetchAllSales = async (page: number = 1) => {
    try {
      setAllSalesLoading(true);

      const { supabase } = await import('supabase_client');
      let query = supabase
        .from('sales')
        .select(`
          *,
          products (
            id,
            name
          )
        `, { count: 'exact' });

      // Apply date filtering
      // Default to current FY if no filters applied
      const range = getFYRange(getFinancialYear());
      
      const effectiveStart = startDate || range.start;
      const effectiveEnd = endDate || range.end;

      query = query.gte('sale_date', effectiveStart);
      query = query.lte('sale_date', effectiveEnd);

      // Apply pagination
      const from = (page - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;

      query = query
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error } = await query;

      if (error) throw error;

      setAllSales((data as Sale[]) || []);

    } catch (error) {
      console.error('Error fetching sales:', error);
      setAllSales([]);
    } finally {
      setAllSalesLoading(false);
    }
  };

  // Handle showing all sales section
  const handleShowAllSales = async () => {
    if (!showAllSales) {
      setShowAllSales(true);
      await fetchAllSales(1);
    } else {
      setShowAllSales(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = async () => {
    setAllSalesPage(1);
    await fetchAllSales(1);
  };

  // Handle pagination
  const handlePageChange = async (newPage: number) => {
    setAllSalesPage(newPage);
    await fetchAllSales(newPage);
  };

  if (loading && !showAllSales) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome! Here's your business overview.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Products</p>
              <p className="stat-value">{analytics.totalProducts}</p>
            </div>
            <Package className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Sales</p>
              <p className="stat-value">₹{analytics.totalSales.toLocaleString()}</p>
            </div>
            <DollarSign className="h-8 w-8 text-secondary-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Today's Sales</p>
              <p className="stat-value">₹{analytics.todaySales}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-accent-600" />
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
              <span className="badge-danger">{lowStockItems.length}</span>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="btn-outline text-sm bg-white hover:bg-orange-100"
            >
              Manage Stock
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-lg p-3 border-2 border-orange-300 hover:border-orange-400 transition-colors cursor-pointer"
                onClick={() => onNavigate('products')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">Min: {product.min_stock_level}</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-bold text-red-600 text-lg">{product.stock_quantity}</p>
                    <p className="text-xs text-gray-500">units left</p>
                  </div>
                </div>
                <div className="mt-2 bg-orange-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (product.stock_quantity / product.min_stock_level) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Sales Section */}
      <div className="card mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Sales</h3>
            <button
              onClick={handleShowAllSales}
              className="btn-outline text-sm"
              title={showAllSales ? "Hide All Sales" : "Show All Sales"}
            >
              {showAllSales ? 'Hide' : 'Show'} All Sales
            </button>
          </div>

          {showAllSales && (
            <div className="space-y-4">
              {/* Date Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">From:</label>
                  <input
                    type="text"
                    value={startDateDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                        setStartDateDisplay(value);
                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                          const isoDate = parseDDMMYYYYToISO(value);
                          if (isoDate) {
                            setStartDate(isoDate);
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value && !/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                        setStartDateDisplay(startDate ? formatDateToDDMMYYYY(startDate) : '');
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    className="input-field text-sm w-36 text-gray-900"
                    maxLength={10}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="text"
                    value={endDateDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                        setEndDateDisplay(value);
                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                          const isoDate = parseDDMMYYYYToISO(value);
                          if (isoDate) {
                            setEndDate(isoDate);
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value && !/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                        setEndDateDisplay(formatDateToDDMMYYYY(endDate));
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    className="input-field text-sm w-36 text-gray-900"
                    maxLength={10}
                  />
                </div>
                <button
                  onClick={handleFilterChange}
                  className="btn-primary text-sm"
                >
                  Apply Filter
                </button>
              </div>

              {/* Sales List - Grouped by Date */}
              <div className="space-y-4">
                {allSalesLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading sales...</p>
                  </div>
                ) : allSales.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No sales found for the selected date range</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {(() => {
                        const salesByDate: Record<string, Sale[]> = allSales.reduce((groups: Record<string, Sale[]>, sale) => {
                          const date = new Date(sale.sale_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          });
                          if (!groups[date]) {
                            groups[date] = [];
                          }
                          groups[date].push(sale);
                          return groups;
                        }, {});

                        const sortedDates = Object.keys(salesByDate).sort((a, b) => {
                          const dateA = new Date(salesByDate[a][0].sale_date);
                          const dateB = new Date(salesByDate[b][0].sale_date);
                          return dateB.getTime() - dateA.getTime();
                        });

                        return sortedDates.map(date => {
                          const dateSales = salesByDate[date];
                          const dateTotal = dateSales.reduce((sum, sale) => sum + sale.total_amount, 0);
                          const dateProfit = dateSales.reduce((sum, sale) => sum + sale.profit, 0);

                          return (
                            <div key={date} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-primary-100 border-b-2 border-primary-200 px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-gray-900 text-lg">{date}</p>
                                    <p className="text-sm text-gray-600">{dateSales.length} {dateSales.length === 1 ? 'sale' : 'sales'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-secondary-600 text-lg">₹{dateTotal.toFixed(2)}</p>
                                    <p className="text-sm text-accent-600">Profit: ₹{dateProfit.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white">
                                {dateSales.map(sale => (
                                  <div key={sale.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{sale.products?.name || 'Unknown Product'}</p>
                                      <p className="text-sm text-gray-500">Qty: {sale.quantity} • Unit: ₹{sale.unit_price}</p>
                                    </div>
                                    <div className="text-right mr-3">
                                      <p className="font-medium text-gray-900">₹{sale.total_amount}</p>
                                      <p className="text-sm text-secondary-600">+₹{sale.profit}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditSale(sale)}
                                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Sale"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSale(sale.id, sale)}
                                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Sale"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {allSales.length >= SALES_PER_PAGE && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          onClick={() => handlePageChange(Math.max(1, allSalesPage - 1))}
                          disabled={allSalesPage === 1}
                          className="btn-outline px-3 py-2 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-2 text-sm text-gray-700">Page {allSalesPage}</span>
                        <button
                          onClick={() => handlePageChange(allSalesPage + 1)}
                          disabled={allSales.length < SALES_PER_PAGE}
                          className="btn-outline px-3 py-2 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Quick Actions */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
        <button
          onClick={() => onNavigate('quick-sale')}
          className="group bg-primary-600 hover:bg-primary-700 text-white rounded-full p-5 shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Quick Sale"
        >
          <ShoppingCart className="h-7 w-7 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={() => onNavigate('products')}
          className="group bg-secondary-600 hover:bg-secondary-700 text-white rounded-full p-5 shadow-2xl hover:shadow-secondary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Go to Products"
        >
          <Plus className="h-7 w-7 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Sale</h3>
              <button
                onClick={() => setEditingSale(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product
                </label>
                <p className="text-base font-semibold text-gray-900">
                  {editingSale.products?.name || 'Unknown Product'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={editSaleData.quantity}
                  onChange={(e) => setEditSaleData({ ...editSaleData, quantity: parseInt(e.target.value) || 0 })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editSaleData.unit_price}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditSaleData({ ...editSaleData, unit_price: value === '' ? 0 : parseFloat(value) });
                  }}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Date (dd/mm/yyyy)
                </label>
                <input
                  type="text"
                  value={editSaleDateDisplay}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                      setEditSaleDateDisplay(value);
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                        const isoDate = parseDDMMYYYYToISO(value);
                        if (isoDate) {
                          setEditSaleData({ ...editSaleData, sale_date: isoDate });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                      setEditSaleDateDisplay(formatDateToDDMMYYYY(editSaleData.sale_date));
                    }
                  }}
                  placeholder="dd/mm/yyyy"
                  className="input-field w-full text-gray-900"
                  maxLength={10}
                />
              </div>

              <div className="bg-primary-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New Total:</span>
                  <span className="font-semibold text-gray-900">
                    ₹{(editSaleData.quantity * editSaleData.unit_price).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Estimated Profit:</span>
                  <span className="font-semibold text-secondary-600">
                    ₹{((editSaleData.quantity * editSaleData.unit_price) - (editSaleData.quantity * (editingSale.products?.purchase_price || 0))).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingSale(null)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSale}
                  className="btn-primary flex-1"
                >
                  Update Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
