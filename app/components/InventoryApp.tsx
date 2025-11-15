import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  BarChart3,
  DollarSign,
  Edit,
  Trash2,
  X,
  Check,
  Users,
  Upload,
  Menu,
  ArrowLeft,
  Home
} from 'lucide-react';

// Import offline-aware database functions
import {
  getProducts,
  getSales,
  createProduct,
  createSale,
  updateProduct,
  updateSale,
  deleteProduct,
  deleteSale,
  getSalesByDateRange,
  getSalesByDate,
  getAnalytics,
  getPartyPurchases,
  createPartyPurchase,
  updatePartyPurchase,
  deletePartyPurchase
} from '../../lib/offline-adapter';

// Import types from Supabase
import type {
  Product,
  Sale,
  PartyPurchase,
  PartyPurchaseInsert
} from '../../supabase_client';

// Import PWA components
import InstallPrompt from './InstallPrompt';
import SyncIndicator from './SyncIndicator';
import SyncSettingsModal from './SyncSettingsModal';
import OfflineIndicator from './OfflineIndicator';

// No more mock data - using real Supabase data throughout the application

// Dashboard Component
function Dashboard({ onNavigate }) {
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalProfit: 0,
    todaySales: 0,
    todayProfit: 0,
    lowStockProducts: 0
  });

  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSales, setAllSales] = useState([]);
  const [showAllSales, setShowAllSales] = useState(false);
  const [allSalesLoading, setAllSalesLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [allSalesPage, setAllSalesPage] = useState(1);
  const SALES_PER_PAGE = 20;
  const [editingSale, setEditingSale] = useState(null);
  const [editSaleData, setEditSaleData] = useState({
    quantity: 0,
    unit_price: 0,
    sale_date: ''
  });

  // Fetch dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [analyticsData, salesData, productsData] = await Promise.all([
          getAnalytics(),
          getSales(5), // Get recent 5 sales
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
    setEditSaleData({
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      sale_date: sale.sale_date.split('T')[0] // Format date for input field
    });
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    try {
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

      // Close edit modal
      setEditingSale(null);
      
    } catch (error) {
      console.error('Error updating sale:', error);
    }
  };

  const handleDeleteSale = async (saleId: string, saleData: any) => {
    if (!confirm(`Are you sure you want to delete this sale of ${saleData.products?.name || 'Unknown Product'}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteSale(saleId);

      // Note: Recent sales removed from dashboard

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

    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  };

  // Fetch All Sales with filtering and pagination
  const fetchAllSales = async (page: number = 1) => {
    try {
      setAllSalesLoading(true);

      const { supabase } = await import('../../supabase_client');
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
      if (startDate) {
        query = query.gte('sale_date', startDate);
      }
      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      // Apply pagination
      const from = (page - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;

      query = query
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;


      setAllSales(data || []);

    } catch (error) {
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

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome! Here's your business overview.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Low Stock Alert</p>
              <p className="stat-value text-danger-600">{analytics.lowStockProducts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-danger-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
            <button 
              onClick={() => onNavigate('products')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage Stock
            </button>
          </div>
          <div className="space-y-4">
            {lowStockItems.map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-danger-50 rounded-lg border border-danger-200">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-danger-600">{product.stock_quantity} left</p>
                  <p className="text-sm text-gray-500">Min: {product.min_stock_level}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Sales Section */}
        <div className="lg:col-span-2 card mt-8">
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
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field text-sm w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field text-sm w-36"
                  />
                </div>
                <button
                  onClick={handleFilterChange}
                  className="btn-primary text-sm"
                >
                  Apply Filter
                </button>
              </div>

              {/* Sales List */}
              <div className="space-y-3">
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
                    <div className="max-h-96 overflow-y-auto">
                      {allSales.map(sale => (
                        <div key={sale.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{sale.products?.name || 'Unknown Product'}</p>
                            <p className="text-sm text-gray-500">Qty: {sale.quantity} • ₹{sale.unit_price}</p>
                            <p className="text-xs text-gray-400">Date: {new Date(sale.sale_date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="font-medium text-gray-900">₹{sale.total_amount}</p>
                            <p className="text-sm text-secondary-600">Profit: ₹{sale.profit}</p>
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

                    {/* Pagination */}
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
      </div>

      {/* Quick Actions - Improved with better visibility */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
        <button
          onClick={() => onNavigate('quick-sale')}
          className="group bg-primary-600 hover:bg-primary-700 text-white rounded-full p-5 shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Quick Sale"
          style={{ pointerEvents: 'auto' }}
        >
          <ShoppingCart className="h-7 w-7 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={() => onNavigate('products')}
          className="group bg-secondary-600 hover:bg-secondary-700 text-white rounded-full p-5 shadow-2xl hover:shadow-secondary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Go to Products"
          style={{ pointerEvents: 'auto' }}
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
                  onChange={(e) => setEditSaleData({ ...editSaleData, unit_price: parseFloat(e.target.value) || 0 })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={editSaleData.sale_date}
                  onChange={(e) => setEditSaleData({ ...editSaleData, sale_date: e.target.value })}
                  className="input-field w-full"
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

// Product Management Component
function ProductManagement({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  // Start editing a field
  const startEditing = (productId, fieldName, currentValue) => {
    setEditingProduct(productId);
    setEditingField(fieldName);
    setTempValue(currentValue.toString());
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProduct(null);
    setEditingField(null);
    setTempValue('');
  };

  // Save the edited value
  const saveEdit = async (productId, fieldName, newValue) => {
    if (!newValue.trim() || newValue === '') {
      return;
    }

    setSaving(true);
    try {
      // Parse numeric values
      let processedValue = newValue;
      if (fieldName === 'purchase_price' || fieldName === 'selling_price') {
        processedValue = parseFloat(newValue);
        if (isNaN(processedValue) || processedValue < 0) {
          setSaving(false);
          return;
        }
      } else if (fieldName === 'stock_quantity' || fieldName === 'min_stock_level') {
        processedValue = parseInt(newValue);
        if (isNaN(processedValue) || processedValue < 0) {
          setSaving(false);
          return;
        }
      } else if (fieldName === 'name') {
        // Keep as string but trim whitespace and convert to uppercase
        processedValue = newValue.trim().toUpperCase();
        if (processedValue.length < 2) {
          setSaving(false);
          return;
        }
      }

      // Update the product
      const updatedProduct = {
        ...products.find(p => p.id === productId),
        [fieldName]: processedValue
      };

      await updateProduct(productId, updatedProduct);

      // Update local state
      setProducts(products.map(p =>
        p.id === productId ? { ...p, [fieldName]: processedValue } : p
      ));

      // Clear editing state
      cancelEditing();

    } catch (error) {
      console.error('Error updating product:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle key press in edit mode
  const handleKeyPress = (e, productId, fieldName) => {
    if (e.key === 'Enter') {
      saveEdit(productId, fieldName, tempValue);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      {/* Header - Hidden on mobile since it's in nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 hidden md:flex">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage your inventory items</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowBulkEntry(true)}
            className="btn-outline flex items-center"
          >
            <Package className="h-5 w-5 mr-2" />
            Bulk Entry
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'card'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Card View"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="List View"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Display */}
      {loading ? (
        <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6' : 'space-y-3'}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton-card mb-4"></div>
              <div className="skeleton-title mb-2"></div>
              <div className="skeleton-text mb-2 w-3/4"></div>
              <div className="skeleton-text mb-4 w-1/2"></div>
              <div className="flex justify-between items-center">
                <div className="skeleton-text w-1/3"></div>
                <div className="skeleton-text w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {/* List View Header */}
          <div className="card bg-gray-50 border-b-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center">
                <div className="sm:col-span-2">
                  <h3 className="font-semibold text-gray-700 text-sm">Product Name</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Purchase Price</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Selling Price</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Stock</h3>
                </div>
              </div>
              <div className="w-20 text-center">
                <h3 className="font-semibold text-gray-700 text-sm">Actions</h3>
              </div>
            </div>
          </div>

          {filteredProducts.map(product => (
            <div key={product.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center">
                  <div className="sm:col-span-2">
                    {editingProduct === product.id && editingField === 'name' ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                        className="w-full px-2 py-1 border border-blue-300 rounded font-semibold uppercase text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                        placeholder="PRODUCT NAME"
                      />
                    ) : (
                      <div>
                        <h3
                          className="font-semibold text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block hover:text-blue-700 transition-colors text-sm sm:text-base"
                          onClick={() => startEditing(product.id, 'name', product.name)}
                          title="Click to edit"
                        >
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500">Code: {product.barcode}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">₹</span>
                    {editingProduct === product.id && editingField === 'purchase_price' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'purchase_price')}
                        className="w-20 px-2 py-1 border border-primary-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="font-medium cursor-pointer hover:bg-primary-50 px-2 py-1 rounded text-primary-700"
                        onClick={() => startEditing(product.id, 'purchase_price', product.purchase_price)}
                      >
                        {product.purchase_price}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">₹</span>
                    {editingProduct === product.id && editingField === 'selling_price' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'selling_price')}
                        className="w-20 px-2 py-1 border border-secondary-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="font-medium cursor-pointer hover:bg-secondary-50 px-2 py-1 rounded text-secondary-700"
                        onClick={() => startEditing(product.id, 'selling_price', product.selling_price)}
                      >
                        {product.selling_price}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {editingProduct === product.id && editingField === 'stock_quantity' ? (
                      <input
                        type="number"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'stock_quantity')}
                        className="w-16 px-2 py-1 border border-accent-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`font-medium cursor-pointer hover:bg-accent-50 px-2 py-1 rounded ${
                          product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-accent-700'
                        }`}
                        onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                      >
                        {product.stock_quantity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingProduct === product.id && (
                    <>
                      <button
                        onClick={() => saveEdit(editingProduct, editingField, tempValue)}
                        disabled={saving}
                        className="p-1 text-green-600 hover:text-green-800"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 text-gray-400 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map(product => (
          <div key={product.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-gray-500">
                {editingProduct === product.id ? 'Editing...' : 'Click values to edit'}
              </div>
              <div className="flex gap-2">
                {editingProduct === product.id && (
                  <>
                    <button 
                      onClick={() => saveEdit(editingProduct, editingField, tempValue)}
                      disabled={saving}
                      className="p-1 text-green-600 hover:text-green-800"
                      title="Save (Enter)"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={cancelEditing}
                      disabled={saving}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Cancel (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleDeleteProduct(product.id)}
                  className="p-1 text-gray-400 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              {editingProduct === product.id && editingField === 'name' ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                    className="flex-1 px-2 py-1 border border-blue-300 rounded font-semibold uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    placeholder="PRODUCT NAME"
                  />
                </div>
              ) : (
                <h3
                  className="font-semibold text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block hover:text-blue-700 transition-colors"
                  onClick={() => startEditing(product.id, 'name', product.name)}
                  title="Click to edit product name"
                >
                  {product.name}
                </h3>
              )}
              <p className="text-sm text-gray-500">Code: {product.barcode}</p>
            </div>

            <div className="space-y-2">
              {/* Purchase Price */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Purchase:</span>
                {editingProduct === product.id && editingField === 'purchase_price' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, product.id, 'purchase_price')}
                      className="w-20 px-2 py-1 border border-primary-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span 
                    className="font-medium cursor-pointer hover:bg-primary-50 px-2 py-1 rounded text-primary-700 hover:text-primary-800"
                    onClick={() => startEditing(product.id, 'purchase_price', product.purchase_price)}
                    title="Click to edit purchase price"
                  >
                    ₹{product.purchase_price}
                  </span>
                )}
              </div>

              {/* Selling Price */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Selling:</span>
                {editingProduct === product.id && editingField === 'selling_price' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, product.id, 'selling_price')}
                      className="w-20 px-2 py-1 border border-secondary-300 rounded text-sm focus:ring-1 focus:ring-secondary-500 focus:border-secondary-500"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span 
                    className="font-medium text-secondary-600 cursor-pointer hover:bg-secondary-50 px-2 py-1 rounded hover:text-secondary-800"
                    onClick={() => startEditing(product.id, 'selling_price', product.selling_price)}
                    title="Click to edit selling price"
                  >
                    ₹{product.selling_price}
                  </span>
                )}
              </div>

              {/* Stock Quantity */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Stock:</span>
                {editingProduct === product.id && editingField === 'stock_quantity' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, product.id, 'stock_quantity')}
                      className="w-16 px-2 py-1 border border-accent-300 rounded text-sm focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
                      autoFocus
                    />
                    <span className="text-sm">units</span>
                  </div>
                ) : (
                  <span 
                    className={`font-medium cursor-pointer px-2 py-1 rounded ${
                      product.stock_quantity <= product.min_stock_level 
                        ? 'text-danger-600 hover:bg-danger-50 hover:text-danger-800' 
                        : 'text-gray-900 hover:bg-accent-50 hover:text-accent-800'
                    }`}
                    onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                    title="Click to edit stock quantity"
                  >
                    {product.stock_quantity} units
                  </span>
                )}
              </div>
            </div>

            {product.stock_quantity <= product.min_stock_level && (
              <div className="mt-3 p-2 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">Low Stock Alert!</p>
              </div>
            )}

            {saving && editingProduct === product.id && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium flex items-center">
                  <div className="loading-spinner h-3 w-3 mr-2"></div>
                  Saving changes...
                </p>
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {/* Floating Add Button - Mobile Only */}
      <div className="md:hidden fixed bottom-6 right-6 z-[9999]">
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <AddProductModal
          onClose={() => setShowAddForm(false)}
          onProductAdded={(newProduct) => {
            setProducts([newProduct, ...products]);
            setShowAddForm(false);
          }}
        />
      )}

      {showBulkEntry && (
        <BulkProductEntryModal
          onClose={() => setShowBulkEntry(false)}
          onProductsAdded={(newProducts) => {
            setProducts([...newProducts, ...products]);
          }}
        />
      )}
    </div>
  );
}

// Add Product Modal Component  
function AddProductModal({ onClose, onProductAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '5',
    description: ''
  });

  const productNameRef = useRef(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  // Prevent body scroll and autofocus product name
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Autofocus the product name field
    setTimeout(() => {
      if (productNameRef.current) {
        productNameRef.current.focus();
      }
    }, 100);
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Convert form data to proper types
      const productData = {
        name: formData.name,
        category_id: null,
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: parseInt(formData.min_stock_level) || 5,
        description: formData.description || null
      };

      // Create product in Supabase
      const newProduct = await createProduct(productData);
      
      onProductAdded(newProduct);
      
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto mx-4 my-8">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                ref={productNameRef}
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                className="input-field uppercase"
                placeholder="Enter product name"
              />
            </div>


            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Scan or enter barcode"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Stock Quantity *</label>
                <input
                  type="number"
                  required
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Level</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                  className="input-field"
                  placeholder="5"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="input-field"
                rows={3}
                placeholder="Product description (optional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Add Product
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Bulk Product Entry Modal Component
function BulkProductEntryModal({ onClose, onProductsAdded }) {
  const [entries, setEntries] = useState([
    { id: 1, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }
  ]);
  const [saving, setSaving] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const addNewRow = () => {
    const newId = Math.max(...entries.map(e => e.id)) + 1;
    setEntries([...entries, { id: newId, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }]);
  };

  const removeRow = (id) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id, field, value) => {
    setEntries(entries.map(e =>
      e.id === id ? { ...e, [field]: field === 'name' ? value.toUpperCase() : value } : e
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Filter out empty entries
    const validEntries = entries.filter(entry => entry.name.trim() && entry.purchase_price && entry.selling_price && entry.stock_quantity);

    if (validEntries.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const createdProducts = [];

      for (const entry of validEntries) {
        const productData = {
          name: entry.name.trim().toUpperCase(),
          category_id: null,
          barcode: entry.barcode || null,
          purchase_price: parseFloat(entry.purchase_price),
          selling_price: parseFloat(entry.selling_price),
          stock_quantity: parseInt(entry.stock_quantity),
          min_stock_level: parseInt(entry.min_stock_level) || 5,
          description: null
        };

        const newProduct = await createProduct(productData);
        createdProducts.push(newProduct);
      }

      onProductsAdded(createdProducts);
      onClose();
    } catch (error) {
      console.error('Error adding products:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Bulk Product Entry</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Product Name *</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Barcode</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Purchase ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Selling ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Stock *</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Min Stock</th>
                    <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateEntry(entry.id, 'name', e.target.value)}
                          className="input-field text-sm uppercase"
                          placeholder="PRODUCT NAME"
                          required
                          autoFocus={index === 0}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={entry.barcode}
                          onChange={(e) => updateEntry(entry.id, 'barcode', e.target.value)}
                          className="input-field text-sm"
                          placeholder="Code"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.purchase_price}
                          onChange={(e) => updateEntry(entry.id, 'purchase_price', e.target.value)}
                          className="input-field text-sm"
                          placeholder="0.00"
                          required
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.selling_price}
                          onChange={(e) => updateEntry(entry.id, 'selling_price', e.target.value)}
                          className="input-field text-sm"
                          placeholder="0.00"
                          required
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={entry.stock_quantity}
                          onChange={(e) => updateEntry(entry.id, 'stock_quantity', e.target.value)}
                          className="input-field text-sm"
                          placeholder="0"
                          required
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={entry.min_stock_level}
                          onChange={(e) => updateEntry(entry.id, 'min_stock_level', e.target.value)}
                          className="input-field text-sm"
                          placeholder="5"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(entry.id)}
                          className="p-1 text-gray-400 hover:text-danger-600"
                          disabled={entries.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={addNewRow}
                className="btn-outline text-sm flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : `Save ${entries.filter(e => e.name.trim()).length} Products`}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Quick Sale Component
function QuickSale({ onNavigate }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSales, setDateSales] = useState([]);
  const [dateSummary, setDateSummary] = useState({ totalQuantity: 0, totalAmount: 0, totalProfit: 0 });

  // Helper function to format date as dd/mm/yy
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Helper function to format date as dd/mm/yyyy for display
  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  };

  // Helper function to convert dd/mm/yyyy to yyyy-mm-dd
  const parseDisplayDate = (displayDate) => {
    const parts = displayDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  // State for display date in dd/mm/yyyy format
  const [displayDate, setDisplayDate] = useState(formatDateFull(new Date().toISOString().split('T')[0]));

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Fetch sales for selected date
  useEffect(() => {
    const fetchDateSales = async () => {
      try {
        const salesData = await getSalesByDate(saleDate);
        setDateSales(salesData || []);
        
        // Calculate summary
        const summary = (salesData || []).reduce((acc, sale) => {
          acc.totalQuantity += sale.quantity;
          acc.totalAmount += sale.total_amount;
          acc.totalProfit += sale.profit;
          return acc;
        }, { totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
        
        setDateSummary(summary);
      } catch (error) {
        console.error('Error fetching date sales:', error);
        setDateSales([]);
        setDateSummary({ totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
      }
    };

    fetchDateSales();
  }, [saleDate]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSale = async () => {
    if (!selectedProduct) {
      return;
    }

    if (quantity > selectedProduct.stock_quantity) {
      return;
    }

    try {
      const actualSalePrice = salePrice || selectedProduct.selling_price;
      const totalAmount = actualSalePrice * quantity;
      const profit = (actualSalePrice - selectedProduct.purchase_price) * quantity;

      // Create sale record
      const saleData = {
        product_id: selectedProduct.id,
        quantity: parseInt(quantity.toString()),
        unit_price: parseFloat(actualSalePrice),
        total_amount: totalAmount,
        profit: profit,
        customer_info: null,
        sale_date: saleDate,
        notes: null
      };

      await createSale(saleData);

      // Update product stock
      const newStockQuantity = selectedProduct.stock_quantity - quantity;
      await updateProduct(selectedProduct.id, {
        stock_quantity: newStockQuantity
      });

      // Update local product state
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === selectedProduct.id 
            ? { ...p, stock_quantity: newStockQuantity }
            : p
        )
      );

      // Refresh date sales to show updated data
      const updatedSalesData = await getSalesByDate(saleDate);
      setDateSales(updatedSalesData || []);
      
      // Update date summary
      const newSummary = (updatedSalesData || []).reduce((acc, sale) => {
        acc.totalQuantity += sale.quantity;
        acc.totalAmount += sale.total_amount;
        acc.totalProfit += sale.profit;
        return acc;
      }, { totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
      setDateSummary(newSummary);

      
      // Reset form (keep the same date)
      setSelectedProduct(null);
      setQuantity(1);
      setSalePrice(0);
      setSearchTerm('');

    } catch (error) {
      console.error('Error processing sale:', error);
    }
  };

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quick Sale</h1>
        <p className="text-gray-600 mt-2">Process sales quickly and efficiently</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Product</h3>
          
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setSalePrice(product.selling_price);
                }}
                className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors touch-target ${
                  selectedProduct?.id === product.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{product.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{product.barcode}</p>
                    <p className="text-sm font-medium text-secondary-600">₹{product.selling_price}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-xs sm:text-sm ${product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-gray-600'}`}>
                      {product.stock_quantity} in stock
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sale Details */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Details</h3>
          
          {selectedProduct ? (
            <div className="space-y-6">
              {/* Selected Product */}
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <h4 className="font-medium text-gray-900">{selectedProduct.name}</h4>
                <p className="text-sm text-gray-500">{selectedProduct.categories?.name || 'No Category'}</p>
                <p className="text-lg font-semibold text-primary-600">₹{selectedProduct.selling_price}</p>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="btn-outline px-3 py-2"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock_quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="input-field text-center w-20"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(selectedProduct.stock_quantity, quantity + 1))}
                    className="btn-outline px-3 py-2"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Available: {selectedProduct.stock_quantity} units
                </p>
              </div>

              {/* Sale Price */}
              <div className="form-group">
                <label className="form-label">Sale Price</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    className="input-field flex-1"
                    placeholder={`Default: ₹${selectedProduct?.selling_price || 0}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSalePrice(selectedProduct.selling_price)}
                    className="btn-outline text-xs px-2 py-1"
                    title="Reset to default price"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Default price: ₹{selectedProduct?.selling_price}
                </p>
              </div>

              {/* Sale Date */}
              <div className="form-group">
                <label className="form-label">Sale Date (dd/mm/yyyy)</label>
                <input
                  type="text"
                  value={displayDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDisplayDate(value);
                    // Try to parse and update the actual date if valid
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                      const parsed = parseDisplayDate(value);
                      setSaleDate(parsed);
                    }
                  }}
                  onBlur={() => {
                    // Validate and fix format on blur
                    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) {
                      setDisplayDate(formatDateFull(saleDate));
                    }
                  }}
                  className="input-field"
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                />
              </div>

              {/* Sale Summary */}
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Unit Price:</span>
                    <span>₹{salePrice || selectedProduct.selling_price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹{((salePrice || selectedProduct.selling_price) * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-secondary-600">
                    <span>Profit:</span>
                    <span>₹{(((salePrice || selectedProduct.selling_price) - selectedProduct.purchase_price) * quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setQuantity(1);
                    const today = new Date().toISOString().split('T')[0];
                    setSaleDate(today);
                    setDisplayDate(formatDateFull(today));
                  }}
                  className="btn-outline flex-1"
                >
                  Clear
                </button>
                <button
                  onClick={handleSale}
                  className="btn-success flex-1"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Complete Sale
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a product to start a sale</p>
            </div>
          )}
        </div>

        {/* Date Sales Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sales for {formatDate(saleDate)}
          </h3>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-primary-50 p-4 rounded-lg">
              <p className="text-sm text-primary-600 font-medium">Total Items Sold</p>
              <p className="text-2xl font-bold text-primary-700">{dateSummary.totalQuantity}</p>
            </div>
            <div className="bg-secondary-50 p-4 rounded-lg">
              <p className="text-sm text-secondary-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-secondary-700">₹{dateSummary.totalAmount.toFixed(2)}</p>
            </div>
            <div className="bg-accent-50 p-4 rounded-lg">
              <p className="text-sm text-accent-600 font-medium">Total Profit</p>
              <p className="text-2xl font-bold text-accent-700">₹{dateSummary.totalProfit.toFixed(2)}</p>
            </div>
          </div>

          {/* Sales List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <h4 className="font-medium text-gray-900">Sales Details</h4>
            {dateSales.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No sales recorded for this date</p>
              </div>
            ) : (
              dateSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{sale.products?.name || 'Unknown Product'}</p>
                    <p className="text-xs text-gray-500">Qty: {sale.quantity} • Unit: ₹{sale.unit_price}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 text-sm">₹{sale.total_amount}</p>
                    <p className="text-xs text-secondary-600">+₹{sale.profit}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Party Management Component
function PartyManagement({ onNavigate }) {
  const [partyPurchases, setPartyPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editingNotes, setEditingNotes] = useState(null); // ID of purchase being edited
  const [editNotesValue, setEditNotesValue] = useState('');

  // Fetch party purchases on component mount
  useEffect(() => {

    const fetchData = async () => {
      try {
        setLoading(true);

        const purchasesData = await getPartyPurchases();

        const safeData = purchasesData || [];
        setPartyPurchases(safeData);

      } catch (error) {
        console.error('Error fetching party purchases:', error);
        setPartyPurchases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPurchases = partyPurchases.filter(purchase => {
    const matchesSearch = purchase.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.party_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.barcode?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });


  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to delete this purchase record?')) {
      return;
    }

    try {
      await deletePartyPurchase(purchaseId);
      setPartyPurchases(partyPurchases.filter(p => p.id !== purchaseId));
    } catch (error) {
      console.error('Error deleting purchase:', error);
    }
  };

  // Handle bulk selection
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredPurchases.map(p => p.id));
      setSelectedItems(allIds);
      setSelectAll(true);
    }
  };

  const handleItemSelect = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setSelectAll(newSelected.size === filteredPurchases.length);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedItems.size} purchase record(s)? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedItems).map(id => deletePartyPurchase(id));
      await Promise.all(deletePromises);

      setPartyPurchases(partyPurchases.filter(p => !selectedItems.has(p.id)));
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error deleting purchases:', error);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Handle edit notes
  const handleEditNotes = (purchase) => {
    setEditingNotes(purchase.id);
    setEditNotesValue(purchase.notes || '');
  };

  const handleSaveNotes = async (purchaseId) => {
    try {
      await updatePartyPurchase(purchaseId, { notes: editNotesValue });
      setPartyPurchases(partyPurchases.map(p =>
        p.id === purchaseId ? { ...p, notes: editNotesValue } : p
      ));
      setEditingNotes(null);
      setEditNotesValue('');
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handleCancelEditNotes = () => {
    setEditingNotes(null);
    setEditNotesValue('');
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      {/* Header - Hidden on mobile since it's in nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 hidden md:flex">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Party Purchases</h1>
          <p className="text-gray-600 mt-2">Manage your purchased inventory from suppliers</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Purchase
          </button>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search purchases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          
          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedItems.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="btn-danger text-sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedItems.size}`}
              </button>
            </div>
          )}
        </div>
        
        {/* Select All */}
        {filteredPurchases.length > 0 && (
          <div className="flex items-center mt-4 pt-4 border-t border-gray-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                Select all ({filteredPurchases.length} items)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Purchases Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton-title mb-2"></div>
              <div className="skeleton-text mb-2 w-3/4"></div>
              <div className="skeleton-text mb-4 w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPurchases.map(purchase => (
            <div key={purchase.id} className={`card hover:shadow-md transition-shadow ${selectedItems.has(purchase.id) ? 'ring-2 ring-primary-500 bg-primary-25' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(purchase.id)}
                    onChange={() => handleItemSelect(purchase.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="badge-info">{purchase.party_name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditNotes(purchase)}
                    className="p-1 text-gray-400 hover:text-accent-600"
                    title="Edit Description"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPurchase(purchase);
                      setShowTransferModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="Transfer to Products"
                  >
                    <Package className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePurchase(purchase.id)}
                    className="p-1 text-gray-400 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">{purchase.item_name}</h3>
                <p className="text-sm text-gray-500">
                  {purchase.barcode && `Code: ${purchase.barcode}`}
                </p>
                <p className="text-xs text-gray-400">
                  Purchase Date: {new Date(purchase.purchase_date).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Purchase:</span>
                  <span className="font-medium">₹{purchase.purchase_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Selling:</span>
                  <span className="font-medium text-secondary-600">₹{purchase.selling_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Purchased:</span>
                  <span className="font-medium text-gray-900">{purchase.purchased_quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Remaining:</span>
                  <span className={`font-medium ${purchase.remaining_quantity <= 0 ? 'text-danger-600' : 'text-accent-600'}`}>
                    {purchase.remaining_quantity} units
                  </span>
                </div>
              </div>

              {/* Description/Notes Section */}
              <div className="mt-3">
                {editingNotes === purchase.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotesValue}
                      onChange={(e) => setEditNotesValue(e.target.value)}
                      className="input-field w-full"
                      rows={3}
                      placeholder="Add description (e.g., '5 boxes purchased, each box contains 10 units')"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveNotes(purchase.id)}
                        className="btn-primary text-xs px-3 py-1 flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditNotes}
                        className="btn-outline text-xs px-3 py-1 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleEditNotes(purchase)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      purchase.notes
                        ? 'bg-primary-50 hover:bg-primary-100'
                        : 'bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300'
                    }`}
                  >
                    {purchase.notes ? (
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{purchase.notes}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Click to add description (boxes, packaging details, etc.)</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Purchase Modal */}
      {showAddForm && (
        <AddPurchaseModal 
          onClose={() => setShowAddForm(false)}
          onPurchaseAdded={(newPurchase) => {
            setPartyPurchases([newPurchase, ...partyPurchases]);
            setShowAddForm(false);
          }}
        />
      )}

      {/* Transfer to Products Modal */}
      {showTransferModal && selectedPurchase && (
        <TransferModal 
          purchase={selectedPurchase}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedPurchase(null);
          }}
          onTransferComplete={(updatedPurchase) => {
            setPartyPurchases(partyPurchases.map(p => 
              p.id === updatedPurchase.id ? updatedPurchase : p
            ));
            setShowTransferModal(false);
            setSelectedPurchase(null);
          }}
        />
      )}

      {/* Floating Action Button - Mobile Only */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAddForm(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn-primary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow touch-target active:scale-95"
          title="Add Purchase"
          style={{
            minHeight: '56px',
            minWidth: '56px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Plus className="h-6 w-6 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}

// Add Purchase Modal Component
function AddPurchaseModal({ onClose, onPurchaseAdded }) {
  // Load remembered party name and date from localStorage
  const getRememberedData = () => {
    try {
      const savedPartyName = localStorage.getItem('lastPartyName') || '';
      const savedDate = localStorage.getItem('lastPartyDate') || new Date().toISOString().split('T')[0];
      return { partyName: savedPartyName, date: savedDate };
    } catch {
      return { partyName: '', date: new Date().toISOString().split('T')[0] };
    }
  };

  const rememberedData = getRememberedData();

  const [formData, setFormData] = useState({
    party_name: rememberedData.partyName,
    item_name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    purchased_quantity: '',
    purchase_date: rememberedData.date,
    notes: ''
  });

  // Helper function to format date as dd/mm/yyyy for display
  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  };

  // Helper function to convert dd/mm/yyyy to yyyy-mm-dd
  const parseDisplayDate = (displayDate) => {
    const parts = displayDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const [displayDate, setDisplayDate] = useState(formatDateFull(rememberedData.date));
  const [products, setProducts] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const itemNameRef = useRef(null);

  // Fetch products for autocomplete
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsData = await getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Handle item name change with autocomplete
  const handleItemNameChange = (value) => {
    const upperValue = value.toUpperCase();
    setFormData({...formData, item_name: upperValue});

    if (upperValue.length > 0) {
      const suggestions = products.filter(p =>
        p.name.toUpperCase().includes(upperValue)
      ).slice(0, 5);
      setFilteredSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (product) => {
    setFormData({
      ...formData,
      item_name: product.name,
      barcode: product.barcode || '',
      purchase_price: product.purchase_price || '',
      selling_price: product.selling_price || ''
    });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const purchaseData: PartyPurchaseInsert = {
        party_name: formData.party_name,
        item_name: formData.item_name,
        barcode: formData.barcode || undefined,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        purchased_quantity: parseInt(formData.purchased_quantity),
        remaining_quantity: parseInt(formData.purchased_quantity),
        purchase_date: formData.purchase_date,
        notes: formData.notes || undefined
      };

      const newPurchase = await createPartyPurchase(purchaseData);

      // Save party name and date to localStorage for next time
      try {
        localStorage.setItem('lastPartyName', formData.party_name);
        localStorage.setItem('lastPartyDate', formData.purchase_date);
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }

      // Reset only the product-specific fields, keep party name and date
      setFormData({
        party_name: formData.party_name,
        item_name: '',
        barcode: '',
        purchase_price: '',
        selling_price: '',
        purchased_quantity: '',
        purchase_date: formData.purchase_date,
        notes: ''
      });

      onPurchaseAdded(newPurchase);

      // Focus the item name field for quick next entry
      setTimeout(() => {
        if (itemNameRef.current) {
          itemNameRef.current.focus();
        }
      }, 100);
      // Don't close the modal, just reset the form for quick entry
    } catch (error) {
      console.error('Error adding purchase:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add Purchase Record</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input
                  type="text"
                  required
                  value={formData.party_name}
                  onChange={(e) => setFormData({...formData, party_name: e.target.value})}
                  className="input-field"
                  placeholder="Supplier name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Purchase Date (dd/mm/yyyy) *</label>
                <input
                  type="text"
                  required
                  value={displayDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDisplayDate(value);
                    // Try to parse and update the actual date if valid
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                      const parsed = parseDisplayDate(value);
                      setFormData({...formData, purchase_date: parsed});
                    }
                  }}
                  onBlur={() => {
                    // Validate and fix format on blur
                    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) {
                      setDisplayDate(formatDateFull(formData.purchase_date));
                    }
                  }}
                  className="input-field"
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="form-group relative">
              <label className="form-label">Item Name *</label>
              <input
                ref={itemNameRef}
                type="text"
                required
                value={formData.item_name}
                onChange={(e) => handleItemNameChange(e.target.value)}
                onFocus={() => {
                  if (formData.item_name.length > 0 && filteredSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="input-field uppercase"
                placeholder="PRODUCT NAME"
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => selectSuggestion(product)}
                      className="px-3 py-2 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>{product.barcode || 'No barcode'}</span>
                        <span>₹{product.selling_price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Product code"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Purchased Quantity *</label>
              <input
                type="number"
                required
                value={formData.purchased_quantity}
                onChange={(e) => setFormData({...formData, purchased_quantity: e.target.value})}
                className="input-field"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="input-field"
                rows={3}
                placeholder="Additional notes (optional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Add Purchase
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Transfer Modal Component
function TransferModal({ purchase, onClose, onTransferComplete }) {
  const [transferQuantity, setTransferQuantity] = useState(1);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);
  
  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleTransfer = async () => {
    if (transferQuantity > purchase.remaining_quantity) {
      return;
    }

    try {
      // Create product in main inventory
      const productData = {
        name: purchase.item_name,
        category_id: null,
        barcode: purchase.barcode || null,
        purchase_price: purchase.purchase_price,
        selling_price: purchase.selling_price,
        stock_quantity: transferQuantity,
        min_stock_level: 5,
        description: `Transferred from ${purchase.party_name} purchase`
      };

      await createProduct(productData);

      // Update remaining quantity in party purchase
      const newRemainingQuantity = purchase.remaining_quantity - transferQuantity;
      const updatedPurchase = await updatePartyPurchase(purchase.id, {
        remaining_quantity: newRemainingQuantity
      });

      onTransferComplete(updatedPurchase);
    } catch (error) {
      console.error('Error transferring to products:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl max-w-md w-full my-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Transfer to Products</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <h3 className="font-medium text-gray-900">{purchase.item_name}</h3>
              <p className="text-sm text-gray-500">From: {purchase.party_name}</p>
              <p className="text-sm text-gray-500">Available: {purchase.remaining_quantity} units</p>
            </div>


            <div className="form-group">
              <label className="form-label">Transfer Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTransferQuantity(Math.max(1, transferQuantity - 1))}
                  className="btn-outline px-3 py-2"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={purchase.remaining_quantity}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                  className="input-field text-center w-20"
                />
                <button
                  type="button"
                  onClick={() => setTransferQuantity(Math.min(purchase.remaining_quantity, transferQuantity + 1))}
                  className="btn-outline px-3 py-2"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="btn-success flex-1"
                disabled={transferQuantity <= 0 || transferQuantity > purchase.remaining_quantity}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced PDF Text Parsing Function with better pattern recognition
function parsePDFText(text) {
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const parsedData = [];
  
  // Enhanced patterns with more variations and better matching
  const patterns = {
    // Supplier/Party patterns
    party: /(?:(?:from|supplier|vendor|party|sold\s*by|dealer|distributor|company)\s*:?\s*([A-Za-z0-9\s&\.,-]+))(?:\n|\r|$)/i,
    
    // Item/Product patterns with better context recognition
    item: /(?:(?:item|product|description|name|article|goods?)\s*:?\s*([A-Za-z0-9\s\.,\-\/()&]+))(?:\n|\r|$|\s{2,})/i,
    
    // Enhanced price patterns with currency support
    purchasePrice: /(?:(?:purchase|cost|buy|wholesale|cp|rate)\s*(?:price)?\s*:?\s*(?:[₹$]?\s*)?([0-9,]+(?:\.[0-9]{1,2})?))/i,
    sellingPrice: /(?:(?:sell|sale|retail|selling|mrp|sp|rate)\s*(?:price)?\s*:?\s*(?:[₹$]?\s*)?([0-9,]+(?:\.[0-9]{1,2})?))/i,
    
    // Quantity patterns
    quantity: /(?:(?:quantity|qty|amount|units?|nos?|pieces?|pcs?)\s*:?\s*([0-9,]+))/i,
    
    // Barcode/SKU patterns
    barcode: /(?:(?:barcode|code|sku|item\s*code|product\s*id|id)\s*:?\s*([A-Za-z0-9\-_\/]+))/i,
    
    // Date patterns with multiple formats
    date: /(?:(?:date|purchased|bought|invoice\s*date|bill\s*date)\s*:?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2}))/i,
    
    // Notes/Description patterns
    notes: /(?:(?:notes?|remarks?|description|details?)\s*:?\s*([^\n\r]+))/i
  };
  
  // Table detection patterns
  const tableHeaders = /(?:item|product|description|name|qty|quantity|rate|price|amount|total|code|barcode)/i;
  
  let currentRecord = {};
  let isInTable = false;
  let headers = [];
  let tableRows = [];
  
  
  // First pass: Detect table structure
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip headers, footers, and irrelevant lines
    if (!line || line.match(/^(page\s*\d*|total|subtotal|grand\s*total|invoice|receipt|bill|thank\s*you)/i)) {
      continue;
    }
    
    // Check for potential table headers
    if (line.match(tableHeaders) && line.split(/\s{2,}|\t|\|/).length > 2) {
      const potentialHeaders = line.split(/\s{2,}|\t|\|/).map(h => h.trim().toLowerCase());
      if (potentialHeaders.some(h => h.match(/item|product|qty|price|amount/))) {
        headers = potentialHeaders;
        isInTable = true;
        continue;
      }
    }
    
    // If in table, collect rows
    if (isInTable && headers.length > 0) {
      const values = line.split(/\s{2,}|\t|\|/).map(v => v.trim());
      if (values.length >= Math.max(2, headers.length - 2)) {
        tableRows.push(values);
        continue;
      } else if (values.length === 1 && values[0].length < 10) {
        // Likely end of table
        isInTable = false;
        break;
      }
    }
  }
  
  // Process table data
  if (tableRows.length > 0 && headers.length > 0) {
    
    tableRows.forEach((values, rowIndex) => {
      const record = {};
      
      // Map headers to values
      headers.forEach((header, colIndex) => {
        if (colIndex < values.length && values[colIndex]) {
          const value = values[colIndex].trim();
          
          if (header.match(/party|supplier|vendor/)) record.party_name = value;
          else if (header.match(/item|product|description|name/)) record.item_name = value;
          else if (header.match(/purchase|cost|wholesale|cp/)) record.purchase_price = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
          else if (header.match(/sell|sale|retail|mrp|sp|rate|price/) && !header.match(/purchase|cost/)) record.selling_price = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
          else if (header.match(/qty|quantity|units?|nos?|pieces?/)) record.quantity = parseInt(value.replace(/[^\d]/g, '')) || 1;
          else if (header.match(/code|barcode|sku/)) record.barcode = value;
          else if (header.match(/date/)) record.date = value;
        }
      });
      
      // If no explicit purchase/selling price columns, try to infer from price columns
      if (!record.purchase_price && !record.selling_price) {
        headers.forEach((header, colIndex) => {
          if (header.match(/price|rate|amount/) && colIndex < values.length) {
            const price = parseFloat(values[colIndex].replace(/[^\d.]/g, '')) || 0;
            if (price > 0) {
              if (!record.selling_price) record.selling_price = price;
              else if (!record.purchase_price) record.purchase_price = price * 0.8; // Estimate 20% margin
            }
          }
        });
      }
      
      
      // Validate and add record
      if (record.item_name && (record.purchase_price > 0 || record.selling_price > 0)) {
        parsedData.push({
          party_name: record.party_name || 'Table Import',
          item_name: record.item_name,
          barcode: record.barcode || '',
          purchase_price: record.purchase_price || 0,
          selling_price: record.selling_price || 0,
          quantity: record.quantity || 1,
          date: record.date || '',
          notes: 'Imported from PDF table'
        });
      }
    });
  }
  
  // If no table data found, try pattern matching
  if (parsedData.length === 0) {
    
    let globalPartyName = '';
    let currentRecord = {};
    
    // Extract global party name first
    const partyMatch = text.match(/(?:from|supplier|vendor|sold\s*by|dealer)\s*:?\s*([A-Za-z0-9\s&\.,\-]+)(?:\n|address|phone|email|\d{6})/i);
    if (partyMatch) {
      globalPartyName = partyMatch[1].trim().split(/\n|address|phone|email/)[0].trim();
    }
    
    // Pattern matching approach
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.length < 3) continue;
      
      // Try each pattern
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          
          switch (key) {
            case 'party':
              if (!globalPartyName) globalPartyName = value;
              break;
            case 'item':
              if (currentRecord.item_name && Object.keys(currentRecord).length >= 2) {
                // Save previous record and start new one
                if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
                  parsedData.push({
                    party_name: globalPartyName || currentRecord.party_name || 'PDF Import',
                    ...currentRecord,
                    quantity: currentRecord.quantity || 1,
                    notes: 'Extracted from PDF patterns'
                  });
                }
                currentRecord = {};
              }
              currentRecord.item_name = value;
              break;
            case 'purchasePrice':
              currentRecord.purchase_price = parseFloat(value.replace(/,/g, '')) || 0;
              break;
            case 'sellingPrice':
              currentRecord.selling_price = parseFloat(value.replace(/,/g, '')) || 0;
              break;
            case 'quantity':
              currentRecord.quantity = parseInt(value.replace(/,/g, '')) || 1;
              break;
            case 'barcode':
              currentRecord.barcode = value;
              break;
            case 'date':
              currentRecord.date = value;
              break;
            case 'notes':
              currentRecord.notes = value;
              break;
          }
        }
      }
    }
    
    // Add the last record
    if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
      parsedData.push({
        party_name: globalPartyName || currentRecord.party_name || 'PDF Import',
        ...currentRecord,
        quantity: currentRecord.quantity || 1,
        notes: 'Extracted from PDF patterns'
      });
    }
  }
  
  // Fallback: Extract any price information
  if (parsedData.length === 0) {
    
    const priceMatches = text.match(/[₹$]?\s*[0-9,]+(?:\.[0-9]{1,2})?/g);
    const itemMatches = text.match(/[A-Za-z][A-Za-z0-9\s]{3,30}(?=\s*[₹$]?[0-9])/g);
    
    if (priceMatches && priceMatches.length >= 2 && itemMatches && itemMatches.length > 0) {
      const cleanPrices = priceMatches.map(p => parseFloat(p.replace(/[^\d.]/g, ''))).filter(p => p > 0);
      
      itemMatches.slice(0, Math.min(3, cleanPrices.length)).forEach((item, index) => {
        if (cleanPrices[index * 2] || cleanPrices[index * 2 + 1]) {
          parsedData.push({
            party_name: 'PDF Extraction',
            item_name: item.trim(),
            purchase_price: cleanPrices[index * 2] || 0,
            selling_price: cleanPrices[index * 2 + 1] || cleanPrices[index * 2] || 0,
            quantity: 1,
            notes: 'Auto-extracted from PDF - please verify details'
          });
        }
      });
    }
  }
  
  parsedData.forEach((record, index) => {
  });
  
  return parsedData;
}

// Advanced PDF data processing function
async function processPDFExtractedData(extractedData) {
  
  const parsedItems = [];
  const { fullText, pages } = extractedData;
  
  // Enhanced patterns focused on purchase documents (invoices, purchase orders)
  const patterns = {
    // Supplier/Party patterns - comprehensive for purchase documents
    supplier: /(?:(?:from|supplier|vendor|party|sold\s*by|dealer|distributor|company|bill\s*from|invoice\s*from)\s*:?\s*([A-Za-z0-9\s&\.,\-'\"]+))(?:\n|address|phone|email|\d{5,6})/gi,
    
    // Item patterns optimized for purchase documents
    itemName: /(?:(?:item|product|description|article|goods?|part|material)\s*(?:name|no\.?|#|code)?\s*:?\s*([A-Za-z0-9\s\.,\-\/()&'\"]+))(?=\s*(?:[₹$]|\d+|qty|quantity|rate|price|amount))/gi,
    
    // Purchase-focused price patterns (unit rates, costs, amounts)
    unitPrice: /(?:(?:rate|unit\s*price|price|cost|amount)\s*:?\s*[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?))/gi,
    totalAmount: /(?:(?:total|amount|sum)\s*:?\s*[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?))/gi,
    
    // Purchase-specific pricing (avoid selling/MRP terms)
    purchasePrice: /(?:(?:purchase|cost|buy|wholesale|cp|rate|unit\s*rate)\s*(?:price)?\s*:?\s*[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?))/gi,
    
    // Quantity patterns for purchase documents
    quantity: /(?:(?:qty|quantity|units?|nos?|pieces?|pcs?|count)\s*:?\s*([0-9,]+))/gi,
    
    // Table headers common in purchase documents
    tableHeader: /(item|product|description|material|qty|quantity|rate|unit\s*price|price|amount|total|code|part\s*no)/gi,
    
    // Invoice/Purchase document date patterns
    date: /(?:(?:date|dated|invoice\s*date|bill\s*date|purchase\s*date|order\s*date)\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}|[0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2}))/gi,
    
    // Invoice/Order numbers
    invoiceNo: /(?:(?:invoice|bill|order|ref)\s*(?:no|number|#)\s*:?\s*([A-Za-z0-9\-\/]+))/gi
  };
  
  // Step 1: Extract global supplier information
  let globalSupplier = '';
  const supplierMatches = [...fullText.matchAll(patterns.supplier)];
  if (supplierMatches.length > 0) {
    // Take the first supplier mention, clean it up
    globalSupplier = supplierMatches[0][1]
      .trim()
      .split(/\n|address|phone|email|\d{5,}/)[0]
      .trim()
      .replace(/[\r\n]+/g, ' ')
      .substring(0, 100); // Limit length
  }
  
  // Step 2: Try table-based extraction first (most reliable)
  for (const page of pages) {
    const tableData = extractTableData(page.textItems);
    if (tableData.length > 0) {
      parsedItems.push(...tableData.map(item => ({
        ...item,
        party_name: item.party_name || globalSupplier || 'PDF Import',
        source: 'table'
      })));
    }
  }
  
  // Step 3: If no table data, try pattern-based extraction
  if (parsedItems.length === 0) {
    
    const patternData = extractPatternData(fullText, patterns, globalSupplier);
    if (patternData.length > 0) {
      parsedItems.push(...patternData);
    }
  }
  
  // Step 4: Fallback - structured text analysis
  if (parsedItems.length === 0) {
    
    const structuredData = extractStructuredData(fullText, globalSupplier);
    if (structuredData.length > 0) {
      parsedItems.push(...structuredData);
    }
  }
  
  // Step 5: Clean and validate extracted data
  const validatedItems = parsedItems
    .map(item => validateAndCleanItem(item))
    .filter(item => item !== null);
  
  return validatedItems;
}

// Table extraction function using positioning data
function extractTableData(textItems) {
  if (!textItems || textItems.length === 0) return [];
  
  // Group text items by Y position (rows) with tolerance
  const rows = [];
  const yTolerance = 5;
  
  textItems.forEach(item => {
    let foundRow = rows.find(row => Math.abs(row.y - item.y) <= yTolerance);
    if (!foundRow) {
      foundRow = { y: item.y, items: [] };
      rows.push(foundRow);
    }
    foundRow.items.push(item);
  });
  
  // Sort rows by Y position (top to bottom)
  rows.sort((a, b) => b.y - a.y);
  
  // Sort items within each row by X position (left to right)
  rows.forEach(row => {
    row.items.sort((a, b) => a.x - b.x);
  });
  
  // Find header row (contains table keywords)
  const headerKeywords = /item|product|description|name|qty|quantity|rate|price|amount|total|code|barcode/i;
  let headerRowIndex = -1;
  
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowText = rows[i].items.map(item => item.text).join(' ');
    if (headerKeywords.test(rowText)) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) return [];
  
  const headerRow = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1);
  
  // Map header columns
  const columns = headerRow.items.map(item => ({
    text: item.text.toLowerCase(),
    x: item.x,
    type: getColumnType(item.text)
  }));
  
  
  // Extract data from each row
  const extractedItems = [];
  
  for (const row of dataRows) {
    if (row.items.length < 2) continue; // Skip rows with too few items
    
    const item = {
      party_name: '',
      item_name: '',
      barcode: '',
      purchase_price: 0,
      selling_price: 0,
      quantity: 1,
      notes: 'Extracted from PDF table'
    };
    
    // Map row items to columns based on X position
    row.items.forEach(textItem => {
      const nearestColumn = columns.reduce((prev, curr) => 
        Math.abs(curr.x - textItem.x) < Math.abs(prev.x - textItem.x) ? curr : prev
      );
      
      const value = textItem.text.trim();
      if (!value) return;
      
      switch (nearestColumn.type) {
        case 'item':
          if (!item.item_name && value.length > 2) item.item_name = value;
          break;
        case 'price':
          const price = parseFloat(value.replace(/[^\d.]/g, ''));
          if (price > 0) {
            // In purchase documents, prices are typically purchase/unit prices
            if (!item.purchase_price) item.purchase_price = price;
          }
          break;
        case 'quantity':
          const qty = parseInt(value.replace(/[^\d]/g, ''));
          if (qty > 0) item.quantity = qty;
          break;
        case 'code':
          if (!item.barcode && /^[A-Za-z0-9\-_]+$/.test(value)) item.barcode = value;
          break;
      }
    });
    
    // Validate item has minimum required data
    if (item.item_name && (item.selling_price > 0 || item.purchase_price > 0)) {
      extractedItems.push(item);
    }
  }
  
  return extractedItems;
}

function getColumnType(text) {
  text = text.toLowerCase();
  if (/item|product|description|name|article|material|goods/.test(text)) return 'item';
  if (/rate|unit\s*price|price|cost|amount|value/.test(text)) return 'price';
  if (/qty|quantity|units?|nos?|pieces?|count/.test(text)) return 'quantity';
  if (/code|barcode|sku|id|part\s*no/.test(text)) return 'code';
  if (/supplier|party|vendor|from/.test(text)) return 'supplier';
  if (/total/.test(text)) return 'total'; // For line totals
  return 'unknown';
}

// Pattern-based extraction for non-table data
function extractPatternData(text, patterns, globalSupplier) {
  const items = [];
  const lines = text.split('\n').filter(line => line.trim().length > 3);
  
  let currentItem = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip obvious non-data lines
    if (isHeaderOrFooter(trimmedLine)) continue;
    
    // Look for item names
    const itemMatches = [...trimmedLine.matchAll(patterns.itemName)];
    if (itemMatches.length > 0) {
      // Save previous item if valid
      if (currentItem && isValidItem(currentItem)) {
        items.push(currentItem);
      }
      
      // Start new item
      currentItem = {
        party_name: globalSupplier || 'PDF Import',
        item_name: itemMatches[0][1].trim(),
        barcode: '',
        purchase_price: 0,
        selling_price: 0,
        quantity: 1,
        notes: 'Extracted from PDF patterns',
        source: 'pattern'
      };
    }
    
    if (currentItem) {
      // Look for purchase prices (unit price, rate, cost)
      const purchasePriceMatches = [...trimmedLine.matchAll(patterns.purchasePrice)];
      if (purchasePriceMatches.length > 0) {
        const price = parseFloat(purchasePriceMatches[0][1].replace(/,/g, ''));
        if (price > 0) currentItem.purchase_price = price;
      }
      
      // Look for general unit prices if no specific purchase price found
      if (!currentItem.purchase_price) {
        const unitPriceMatches = [...trimmedLine.matchAll(patterns.unitPrice)];
        if (unitPriceMatches.length > 0) {
          const price = parseFloat(unitPriceMatches[0][1].replace(/,/g, ''));
          if (price > 0) currentItem.purchase_price = price;
        }
      }
      
      // Look for quantities
      const qtyMatches = [...trimmedLine.matchAll(patterns.quantity)];
      if (qtyMatches.length > 0) {
        const qty = parseInt(qtyMatches[0][1].replace(/,/g, ''));
        if (qty > 0) currentItem.quantity = qty;
      }
    }
  }
  
  // Add the last item
  if (currentItem && isValidItem(currentItem)) {
    items.push(currentItem);
  }
  
  return items;
}

// Structured text analysis for complex purchase document layouts
function extractStructuredData(text, globalSupplier) {
  const items = [];
  
  // Look for item-quantity-price patterns common in purchase invoices
  const complexPattern = /([A-Za-z][A-Za-z0-9\s\.,\-\/()&'\"]{5,50})\s+([0-9]+)\s+[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/g;
  const matches = [...text.matchAll(complexPattern)];
  
  matches.forEach(match => {
    const [, itemName, qty, price] = match;
    const parsedPrice = parseFloat(price.replace(/,/g, ''));
    const parsedQty = parseInt(qty);
    
    if (parsedPrice > 0 && parsedQty > 0 && itemName.trim().length > 3) {
      items.push({
        party_name: globalSupplier || 'PDF Import',
        item_name: itemName.trim(),
        barcode: '',
        purchase_price: parsedPrice, // This is the unit purchase price
        selling_price: 0, // Will be set by user during import
        quantity: parsedQty,
        notes: 'Extracted from purchase document - set selling price during import',
        source: 'structured'
      });
    }
  });
  
  return items;
}

// Helper functions
function isHeaderOrFooter(line) {
  return /^(page|total|subtotal|grand\s*total|invoice|receipt|bill|thank\s*you|footer|header)/i.test(line);
}

function isValidItem(item) {
  return item.item_name && 
         item.item_name.length > 2 && 
         item.purchase_price > 0 && // Purchase documents must have purchase price
         item.quantity > 0;
}

function validateAndCleanItem(item) {
  if (!isValidItem(item)) return null;
  
  // Clean up item name
  item.item_name = item.item_name
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
  
  // Clean up party name
  item.party_name = (item.party_name || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100) || 'PDF Import';
  
  // For purchase documents, selling price will be set by user during import
  // No need to estimate selling price from purchase price
  
  return {
    party_name: item.party_name,
    item_name: item.item_name,
    barcode: item.barcode || '',
    purchase_price: item.purchase_price || 0,
    selling_price: 0, // User will set this when importing to products
    quantity: Math.max(1, item.quantity || 1),
    purchase_date: new Date().toISOString().split('T')[0],
    notes: (item.notes || 'Imported from purchase document') + ' - Set selling price during product import'
  };
}

// File Upload Modal Component
function FileUploadModal({ onClose, onFileProcessed }) {
  const [uploading, setUploading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editableData, setEditableData] = useState([]);
  const fileInputRef = useRef(null);
  
  // Reset states when modal opens
  useEffect(() => {
    setUploadingStatus('');
    setProcessingProgress(0);
    setExtractedData(null);
    setShowPreview(false);
    setEditableData([]);
  }, []);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && !uploading) {
        onClose();
      }
    };
    
    // Add event listener
    document.addEventListener('keydown', handleEscapeKey);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, uploading]);
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(fileExtension)) {
      return;
    }

    setUploading(true);
    setUploadingStatus('Starting file processing...');
    setProcessingProgress(10);
    
    try {
      let parsedData = [];

      if (fileExtension === 'csv') {
        // Parse CSV file
        setUploadingStatus('Reading CSV file...');
        setProcessingProgress(30);
        
        const text = await file.text();
        const Papa = await import('papaparse');
        
        setUploadingStatus('Parsing CSV data...');
        setProcessingProgress(50);
        
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
        
      } else if (fileExtension === 'pdf') {
        // 🚀 Full PDF Processing Activated!
        try {
          setUploadingStatus('🚀 Initializing PDF processor...');
          setProcessingProgress(5);
          
          // Use a more compatible approach - load PDF.js via CDN
          if (!window.pdfjsLib) {
            // Load PDF.js from CDN if not already loaded
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            document.head.appendChild(script);
            
            // Wait for load
            await new Promise((resolve, reject) => {
              script.onload = resolve;
              script.onerror = reject;
            });
          }
          
          const pdfjsLib = window.pdfjsLib;
          
          // Configure PDF.js worker
          if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
          }
          
          setUploadingStatus('📄 Loading PDF document...');
          setProcessingProgress(15);
          
          const arrayBuffer = await file.arrayBuffer();
          
          // Load PDF with proper configuration
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/standard_fonts/',
            disableFontFace: false,
            disableRange: false,
            disableStream: false
          });
          
          const pdf = await loadingTask.promise;
          
          setUploadingStatus(`📊 Extracting text from ${pdf.numPages} page(s)...`);
          setProcessingProgress(25);
          
          let extractedData = {
            fullText: '',
            pages: [],
            metadata: {
              numPages: pdf.numPages,
              title: file.name,
              fileSize: file.size
            }
          };
          
          // Process each page with enhanced extraction
          const maxPages = Math.min(pdf.numPages, 15); // Process up to 15 pages
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            setUploadingStatus(`🔍 Analyzing page ${pageNum} of ${maxPages}...`);
            
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              // Extract text with positioning and formatting info
              const pageTextItems = textContent.items
                .map(item => {
                  if (item.str && item.str.trim()) {
                    return {
                      text: item.str,
                      x: item.transform ? item.transform[4] : 0,
                      y: item.transform ? item.transform[5] : 0,
                      width: item.width || 0,
                      height: item.height || 0,
                      fontName: item.fontName || '',
                      fontSize: (item.transform && item.transform[0]) || 12
                    };
                  }
                  return null;
                })
                .filter(item => item !== null);
              
              // Combine text with proper spacing
              const pageText = pageTextItems
                .sort((a, b) => b.y - a.y || a.x - b.x) // Sort by position
                .map(item => item.text)
                .join(' ')
                .replace(/\\s+/g, ' ')
                .trim();
              
              extractedData.pages.push({
                pageNumber: pageNum,
                text: pageText,
                textItems: pageTextItems,
                itemCount: pageTextItems.length
              });
              
              extractedData.fullText += pageText + '\\n\\n';
              
              // Update progress
              const progress = 25 + (50 * pageNum / maxPages);
              setProcessingProgress(Math.round(progress));
              
              
            } catch (pageError) {
              extractedData.pages.push({
                pageNumber: pageNum,
                text: '',
                textItems: [],
                error: pageError.message
              });
            }
          }
          
          
          if (extractedData.fullText.trim().length < 30) {
            throw new Error(`📄 PDF contains minimal extractable text (${extractedData.fullText.length} characters).\\n\\nThis might be:\\n• A scanned/image-based PDF\\n• An encrypted or protected PDF\\n• A PDF with mostly graphics\\n\\n💡 Try:\\n• Converting to text-based PDF\\n• Using OCR software first\\n• Converting to CSV/Excel format`);
          }
          
          setUploadingStatus('🧠 Analyzing content with AI patterns...');
          setProcessingProgress(80);
          
          // Process extracted data with our advanced algorithms
          parsedData = await processPDFExtractedData(extractedData);
          
          
          if (parsedData.length === 0) {
            const preview = extractedData.fullText.substring(0, 1000);
            const previewLines = preview.split('\\n').slice(0, 15).join('\\n');
            
            throw new Error(`🔍 No purchase data found in PDF.\\n\\n📋 Text Preview:\\n${previewLines}${extractedData.fullText.length > 1000 ? '\\n\\n[...more text...]' : ''}\\n\\n💡 Expected data:\\n• Item/Product names\\n• Price information\\n• Quantity values\\n• Supplier details\\n\\n🔄 Try converting to CSV/Excel for guaranteed import.`);
          }
          
          // Success!
          
          setProcessingProgress(95);
          
        } catch (error) {
          
          // Enhanced error handling with helpful messages
          let errorMessage = '🚨 PDF Processing Error\\n\\n';
          
          if (error.name === 'InvalidPDFException' || error.message.includes('Invalid PDF')) {
            errorMessage += '📄 Invalid PDF: File appears to be corrupted or not a valid PDF document.';
          } else if (error.name === 'MissingPDFException') {
            errorMessage += '📄 Empty PDF: The PDF file is empty or missing content.';
          } else if (error.name === 'UnexpectedResponseException') {
            errorMessage += '📄 Loading Error: Unable to load the PDF file. It may be corrupted.';
          } else if (error.name === 'PasswordException') {
            errorMessage += '🔒 Protected PDF: This PDF is password-protected and cannot be processed.';
          } else if (error.message.includes('Cannot resolve module')) {
            errorMessage += '⚙️ System Error: PDF processor loading failed. Please try again.';
          } else {
            errorMessage += error.message;
          }
          
          errorMessage += `\\n\\n📊 File Info:\\n• Name: ${file.name}\\n• Size: ${(file.size / 1024 / 1024).toFixed(2)} MB\\n\\n💡 Alternative: Convert to CSV/Excel format for reliable import.`;
          
          return;
        }
      } else {
        // Unsupported file type
        return;
      }

      // Process parsed data
      setUploadingStatus('Processing extracted data...');
      setProcessingProgress(70);
      
      const processedPurchases = [];
      const currentDate = new Date().toISOString().split('T')[0];

      parsedData.forEach((row, index) => {
        try {
          let purchase;
          
          if (fileExtension === 'pdf') {
            // For PDF data, the structure is already parsed
            purchase = {
              party_name: row.party_name || 'PDF Import',
              item_name: row.item_name || `Item ${index + 1}`,
              barcode: row.barcode || '',
              purchase_price: row.purchase_price || 0,
              selling_price: row.selling_price || 0,
              purchased_quantity: row.quantity || 1,
              remaining_quantity: row.quantity || 1,
              purchase_date: row.date || currentDate,
              notes: row.notes || 'Imported from PDF'
            };
          } else {

            // Map common column names for Excel/CSV (flexible mapping)
            const itemName = row['Item Name'] || row['item_name'] || row['Product'] || row['product'] || row['Product Name'];
            const partyName = row['Party Name'] || row['party_name'] || row['Supplier'] || row['supplier'];
            const purchasePrice = row['Purchase Price'] || row['purchase_price'] || row['Cost Price'] || row['cost_price'];
            const sellingPrice = row['Selling Price'] || row['selling_price'] || row['Sale Price'] || row['sale_price'];
            const quantity = row['Quantity'] || row['quantity'] || row['Purchased Quantity'] || row['purchased_quantity'];
            const barcode = row['Barcode'] || row['barcode'] || row['Code'] || row['code'];

            purchase = {
              party_name: partyName || 'Unknown Party',
              item_name: itemName || `Item ${index + 1}`,
              barcode: barcode || '',
              purchase_price: purchasePrice ? parseFloat(String(purchasePrice).replace(/[^\d.]/g, '')) || 0 : 0,
              selling_price: sellingPrice ? parseFloat(String(sellingPrice).replace(/[^\d.]/g, '')) || 0 : 0,
              purchased_quantity: quantity ? parseInt(String(quantity)) || 1 : 1,
              remaining_quantity: quantity ? parseInt(String(quantity)) || 1 : 1,
              purchase_date: row['Purchase Date'] || row['purchase_date'] || row['Date'] || row['date'] || currentDate,
              notes: row['Notes'] || row['notes'] || row['Description'] || row['description'] || ''
            };
          }


          // Validate required fields
          if (purchase.item_name && (purchase.purchase_price > 0 || purchase.selling_price > 0) && purchase.purchased_quantity > 0) {
            processedPurchases.push(purchase);
          }
        } catch (error) {
          console.warn(`Skipping row ${index + 1} due to error:`, error);
        }
      });

      if (processedPurchases.length === 0) {
        return;
      }

      // For PDF files, show preview for editing
      if (fileExtension === 'pdf') {
        setUploadingStatus('✅ Extraction complete! Review and edit data below...');
        setProcessingProgress(100);
        setExtractedData(processedPurchases);
        setEditableData([...processedPurchases]); // Create editable copy
        setShowPreview(true);
        setUploading(false);
        return;
      }

      // For CSV/Excel files, save directly to database
      setUploadingStatus('Saving to database...');
      setProcessingProgress(90);
      
      const savedPurchases = [];
      for (let i = 0; i < processedPurchases.length; i++) {
        const purchase = processedPurchases[i];
        try {
          const savedPurchase = await createPartyPurchase(purchase);
          savedPurchases.push(savedPurchase);
          
          // Update progress
          const progress = 90 + (10 * (i + 1) / processedPurchases.length);
          setProcessingProgress(Math.round(progress));
        } catch (error) {
          console.error('Error saving purchase:', error);
        }
      }

      onFileProcessed(savedPurchases);

    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setUploading(false);
      setUploadingStatus('');
      setProcessingProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Handle editing extracted data
  const handleDataEdit = (index, field, value) => {
    const newData = [...editableData];
    if (field === 'purchased_quantity' || field === 'remaining_quantity') {
      // Ensure quantity is a positive integer
      const numValue = Math.max(0, parseInt(value) || 0);
      newData[index][field] = numValue;
      // Keep remaining quantity in sync with purchased quantity
      if (field === 'purchased_quantity') {
        newData[index].remaining_quantity = numValue;
      }
    } else {
      newData[index][field] = value;
    }
    setEditableData(newData);
  };

  // Save edited data to database
  const handleSaveEditedData = async () => {
    if (editableData.length === 0) return;

    setUploading(true);
    setUploadingStatus('Saving corrected data to database...');
    setProcessingProgress(0);

    const savedPurchases = [];
    for (let i = 0; i < editableData.length; i++) {
      const purchase = editableData[i];
      try {
        const savedPurchase = await createPartyPurchase(purchase);
        savedPurchases.push(savedPurchase);
        
        // Update progress
        const progress = (100 * (i + 1)) / editableData.length;
        setProcessingProgress(Math.round(progress));
      } catch (error) {
        console.error('Error saving purchase:', error);
      }
    }

    onFileProcessed(savedPurchases);
    
    // Reset states
    setUploading(false);
    setShowPreview(false);
    setExtractedData(null);
    setEditableData([]);
    onClose();
  };

  // Go back to file upload
  const handleBackToUpload = () => {
    setShowPreview(false);
    setExtractedData(null);
    setEditableData([]);
    setUploadingStatus('');
    setProcessingProgress(0);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => {
        // Close modal when clicking backdrop (but not when uploading)
        if (e.target === e.currentTarget && !uploading) {
          onClose();
        }
      }}
    >
      <div className={`bg-white rounded-xl w-full my-8 max-h-[90vh] overflow-y-auto ${showPreview ? 'max-w-6xl' : 'max-w-lg'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {showPreview ? `Review PDF Data (${editableData.length} items)` : 'Upload Purchase File'}
            </h2>
            <button 
              onClick={onClose} 
              disabled={uploading}
              className={`text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
              }`}
              title={uploading ? 'Cannot close while uploading' : 'Close (Esc)'}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!showPreview ? (
            // Upload Interface
            <div>
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                
                <Upload className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} />
                
                {uploading ? (
                  <div>
                    <div className="mb-4">
                      <div className="loading-spinner mx-auto mb-4"></div>
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-2">Processing file...</p>
                    <p className="text-sm text-gray-500 mb-3">{uploadingStatus || 'Please wait while we import your purchases'}</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out" 
                        style={{ width: `${processingProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 text-center">{processingProgress}%</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium text-gray-900 mb-2">Drop your file here or click to browse</p>
                    <p className="text-sm text-gray-500 mb-4">Supports Excel (.xlsx, .xls), CSV (.csv), and PDF (.pdf) files</p>
                    <button className="btn-primary">
                      Choose File
                    </button>
                  </div>
                )}
              </div>

              {/* Expected Format Info */}
              <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Expected Purchase Document Data:</h3>
                <p className="text-sm text-gray-600 mb-2">PDF processing focuses on purchase/invoice data with these fields:</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-3">
                  <li>• <strong>Supplier/Vendor:</strong> Company name (from invoice header)</li>
                  <li>• <strong>Item/Product Name:</strong> Product descriptions</li>
                  <li>• <strong>Unit Price/Rate:</strong> Purchase cost per item</li>
                  <li>• <strong>Quantity:</strong> Number of units purchased</li>
                  <li>• <strong>Product Code:</strong> Part numbers, SKUs (optional)</li>
                  <li>• <strong>Invoice Date:</strong> Purchase date (optional)</li>
                </ul>
                <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                  <strong>💡 Note:</strong> Selling prices are NOT extracted from purchase documents. You'll set your own selling prices when importing items to your product catalog.
                </div>
              </div>
              
              <div className="mt-4">
                <div className="text-xs text-gray-500 bg-green-50 p-3 rounded mb-2">
                  <strong>🚀 Purchase Document Processing - ACTIVE!</strong> 
                  <ul className="mt-1 space-y-1">
                    <li>• ✅ Supplier invoice and purchase order processing</li>
                    <li>• 🧠 Smart table detection for item lists</li>
                    <li>• 🎯 Purchase price and quantity extraction</li>
                    <li>• 📊 Multi-page document support (up to 15 pages)</li>
                    <li>• 🔍 Automatic supplier and item validation</li>
                    <li>• 💰 Selling prices set by YOU during import</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-amber-50 p-2 rounded">
                  <strong>💡 Tip:</strong> For scanned PDFs or image-based documents, convert to text first or use CSV/Excel format for better results.
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={onClose} 
                  disabled={uploading}
                  className={`btn-outline flex-1 ${
                    uploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={uploading ? 'Cannot cancel while uploading' : ''}
                >
                  {uploading ? 'Processing...' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            // Preview Interface for PDF Data
            <div>
              {/* Status and Instructions */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <Check className="h-5 w-5 text-green-600 mr-2" />
                  <p className="font-medium text-green-800">PDF data extracted successfully!</p>
                </div>
                <p className="text-sm text-green-700">
                  Review and edit the extracted data below. Pay special attention to quantities as OCR might have errors.
                </p>
              </div>

              {/* Editable Data Table */}
              <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                        <span className="text-orange-600 ml-1">⚠️</span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editableData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.party_name}
                            onChange={(e) => handleDataEdit(index, 'party_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleDataEdit(index, 'item_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.purchase_price}
                            onChange={(e) => handleDataEdit(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={item.purchased_quantity}
                            onChange={(e) => handleDataEdit(index, 'purchased_quantity', e.target.value)}
                            className="w-full px-2 py-1 border-2 border-orange-300 bg-orange-50 rounded text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-medium"
                            title="⚠️ Check this quantity - OCR might have errors"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.barcode || ''}
                            onChange={(e) => handleDataEdit(index, 'barcode', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={item.purchase_date}
                            onChange={(e) => handleDataEdit(index, 'purchase_date', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={handleBackToUpload} 
                  disabled={uploading}
                  className="btn-outline"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Upload
                </button>
                <button 
                  onClick={handleSaveEditedData} 
                  disabled={uploading || editableData.length === 0}
                  className="btn-primary flex-1"
                >
                  {uploading ? (
                    <>
                      <div className="loading-spinner h-4 w-4 mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save {editableData.length} Items
                    </>
                  )}
                </button>
              </div>
              
              {uploading && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">{uploadingStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main App Component
function InventoryApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewHistory, setViewHistory] = useState(['dashboard']);

  // Initialize offline database on mount
  useEffect(() => {
    const initOfflineDB = async () => {
      try {
        const { initializeDatabases } = await import('../../lib/pouchdb-client');
        await initializeDatabases();
        console.log('Offline database initialized');
      } catch (error) {
        console.error('Error initializing offline database:', error);
      }
    };

    initOfflineDB();
  }, []);

  const handleNavigate = (view) => {
    // Prevent duplicate entries in history
    if (view !== currentView) {
      setViewHistory(prev => [...prev, view]);
      setCurrentView(view);
      setMobileMenuOpen(false);
    }
  };

  const handleBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop(); // Remove current view
      const previousView = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentView(previousView);
    } else {
      // If no history, go to dashboard
      setCurrentView('dashboard');
      setViewHistory(['dashboard']);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event) => {
      event.preventDefault();
      handleBack();
    };

    // Add browser history entry
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: currentView }, '', `#${currentView}`);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [currentView]);

  const getViewTitle = (view) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'products': return 'Products';
      case 'quick-sale': return 'Quick Sale';
      case 'party': return 'Party Purchases';
      default: return 'Dashboard';
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'products':
        return <ProductManagement onNavigate={handleNavigate} />;
      case 'quick-sale':
        return <QuickSale onNavigate={handleNavigate} />;
      case 'party':
        return <PartyManagement onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-50">
      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Offline Status Indicator */}
      <OfflineIndicator />

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Mobile Back Button */}
              <div className="flex md:hidden mr-3">
                {currentView !== 'dashboard' ? (
                  <button
                    onClick={handleBack}
                    className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-primary-50 touch-target"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="text-xl font-bold text-primary-600 hover:text-primary-700"
                >
                  Inventory Pro
                </button>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className={`nav-link ${currentView === 'dashboard' ? 'nav-link-active' : ''}`}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleNavigate('products')}
                    className={`nav-link ${currentView === 'products' ? 'nav-link-active' : ''}`}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Products
                  </button>
                  <button
                    onClick={() => handleNavigate('quick-sale')}
                    className={`nav-link ${currentView === 'quick-sale' ? 'nav-link-active' : ''}`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Quick Sale
                  </button>
                  <button
                    onClick={() => handleNavigate('party')}
                    className={`nav-link ${currentView === 'party' ? 'nav-link-active' : ''}`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Party
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-primary-50 touch-target"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button
                onClick={() => handleNavigate('dashboard')}
                className={`mobile-nav-link ${currentView === 'dashboard' ? 'mobile-nav-link-active' : ''}`}
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </button>
              <button
                onClick={() => handleNavigate('products')}
                className={`mobile-nav-link ${currentView === 'products' ? 'mobile-nav-link-active' : ''}`}
              >
                <Package className="h-5 w-5 mr-3" />
                Products
              </button>
              <button
                onClick={() => handleNavigate('quick-sale')}
                className={`mobile-nav-link ${currentView === 'quick-sale' ? 'mobile-nav-link-active' : ''}`}
              >
                <ShoppingCart className="h-5 w-5 mr-3" />
                Quick Sale
              </button>
              <button
                onClick={() => handleNavigate('party')}
                className={`mobile-nav-link ${currentView === 'party' ? 'mobile-nav-link-active' : ''}`}
              >
                <Users className="h-5 w-5 mr-3" />
                Party Purchases
              </button>
            </div>
          </div>
        )}
      </nav>
      
      {/* Mobile Page Title */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">{getViewTitle(currentView)}</h1>
      </div>

      {/* Main Content */}
      <main>
        {renderCurrentView()}
      </main>

      {/* Sync Indicator */}
      <SyncIndicator />
    </div>
  );
}

export default InventoryApp;