'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Package,
  Search,
  Plus,
  X,
  BarChart3,
  Calendar
} from 'lucide-react';
import {
  getProducts,
  getSalesByDate,
  createSale,
  updateProduct,
  getClosingStockForYear
} from 'lib/offline-adapter';
import { formatDateToDDMMYYYY } from '../utils/dateHelpers';
import type { Product, Sale, SaleInsert } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface QuickSaleProps {
  onNavigate: (view: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  salePrice: number;
  saleDate: string;
}

export default function QuickSale({ onNavigate }: QuickSaleProps) {
  const { showToast } = useToast();
  const [financialYear, setFinancialYear] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('inventory_pro_fy') || '2026-27';
    }
    return '2026-27';
  });
  const isCurrentYear = financialYear === '2026-27';
  const [historicalStock, setHistoricalStock] = useState<Record<string, number>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleDateDisplay, setSaleDateDisplay] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear());
    return `${day}/${month}/${year}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateSales, setDateSales] = useState<Sale[]>([]);
  const [dateSummary, setDateSummary] = useState({ totalProducts: 0, totalAmount: 0, totalProfit: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddPrefillName, setQuickAddPrefillName] = useState('');

  // Sync FY to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_pro_fy', financialYear);
  }, [financialYear]);

  // Fetch products and historical stock
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);

        if (!isCurrentYear) {
          const closingData = await getClosingStockForYear(financialYear);
          setHistoricalStock(closingData || {});
        } else {
          setHistoricalStock({});
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [financialYear, isCurrentYear]);

  const getDisplayStock = (product: Product) => {
    if (isCurrentYear) return product.stock_quantity;
    return historicalStock[product.id] ?? 0;
  };

  // Fetch sales for selected date
  useEffect(() => {
    const fetchDateSales = async () => {
      try {
        const salesData = await getSalesByDate(saleDate);
        setDateSales(salesData || []);
        
        const uniqueProducts = new Set((salesData || []).map(sale => sale.product_id));
        const summary = (salesData || []).reduce((acc, sale) => {
          acc.totalAmount += sale.total_amount;
          acc.totalProfit += sale.profit;
          return acc;
        }, { totalProducts: uniqueProducts.size, totalAmount: 0, totalProfit: 0 });
        
        setDateSummary(summary);
      } catch (error) {
        console.error('Error fetching date sales:', error);
        setDateSales([]);
        setDateSummary({ totalProducts: 0, totalAmount: 0, totalProfit: 0 });
      }
    };

    fetchDateSales();
  }, [saleDate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const noResults = searchTerm.trim().length > 0 && filteredProducts.length === 0;

  const handleSaleDateChange = (displayValue: string) => {
    setSaleDateDisplay(displayValue);
    const parts = displayValue.split('/');
    if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        const isoDate = `${year}-${month}-${day}`;
        setSaleDate(isoDate);
        setCart(prevCart => prevCart.map(item => ({ ...item, saleDate: isoDate })));
      }
    }
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item =>
        item.product.id === product.id && item.salePrice === product.selling_price
      );
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && item.salePrice === product.selling_price
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          product: product,
          quantity: 1,
          salePrice: product.selling_price,
          saleDate: saleDate
        }];
      }
    });
    setSearchTerm('');
  };

  const updateCartItem = (index: number, field: string, value: any) => {
    setCart(prevCart =>
      prevCart.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeFromCart = (index: number) => {
    setCart(prevCart => prevCart.filter((_, i) => i !== index));
  };

  const handleAddNewProduct = (name: string) => {
    setQuickAddPrefillName(name);
    setShowQuickAddModal(true);
  };

  const handleQuickAddProductAdded = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    addToCart(newProduct);
    setShowQuickAddModal(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0 || processing) return;

    const insufficientStock = cart.find(item => item.quantity > item.product.stock_quantity);
    if (insufficientStock) {
      showToast(`Insufficient stock for ${insufficientStock.product.name}`, 'error');
      return;
    }

    try {
      setProcessing(true);
      for (const item of cart) {
        const totalAmount = item.salePrice * item.quantity;
        const profit = (item.salePrice - item.product.purchase_price) * item.quantity;

        const saleData: SaleInsert = {
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.salePrice,
          total_amount: totalAmount,
          profit: profit,
          sale_date: item.saleDate,
        };

        // This call now handles stock update atomically (via RPC/Trigger online or offline-db logic)
        await createSale(saleData);

        // Update local products state for immediate UI feedback
        const newStockQuantity = item.product.stock_quantity - item.quantity;
        setProducts(prev => prev.map(p => 
          p.id === item.product.id ? { ...p, stock_quantity: newStockQuantity } : p
        ));
      }

      const updatedSalesData = await getSalesByDate(saleDate);
      setDateSales(updatedSalesData || []);
      setCart([]);
      showToast('Sale completed successfully!', 'success');
    } catch (error) {
      console.error('Error processing sale:', error);
      showToast('Error processing sale', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddStock = async () => {
    if (!addStockProduct || addStockQuantity <= 0) return;
    try {
      const newStockQuantity = addStockProduct.stock_quantity + addStockQuantity;
      await updateProduct(addStockProduct.id, { stock_quantity: newStockQuantity });
      setProducts(prev => prev.map(p => p.id === addStockProduct.id ? { ...p, stock_quantity: newStockQuantity } : p));
      setCart(prev => prev.map(item => item.product.id === addStockProduct.id ? { ...item, product: { ...item.product, stock_quantity: newStockQuantity } } : item));
      setShowAddStockModal(false);
      showToast('Stock added successfully', 'success');
    } catch (error) {
      showToast('Error adding stock', 'error');
    }
  };

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quick Sale</h1>
          <p className="text-gray-600 mt-1">Process sales and manage daily transactions</p>
        </div>
        <div className="bg-white border-2 border-primary-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm mt-4 sm:mt-0">
          <Calendar className="h-5 w-5 text-primary-600" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Financial Year</span>
            <select 
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="bg-transparent text-sm font-bold text-primary-900 focus:outline-none cursor-pointer"
            >
              <option value="2025-26">2025-26 (Legacy)</option>
              <option value="2026-27">2026-27 (Current)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {!isCurrentYear && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800 text-sm">
                You are viewing historical data for <strong>{financialYear}</strong>. 
                New sales and stock additions are only allowed in the <strong>Current Year (2026-27)</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="card bg-primary-600 text-white p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium mb-1 opacity-80">Sale Date</label>
              <input
                type="text"
                value={saleDateDisplay}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                className="input-field w-36 text-gray-900 font-semibold"
                placeholder="DD/MM/YYYY"
                disabled={!isCurrentYear}
              />
            </div>
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isCurrentYear ? "Search products or scan barcode..." : "View-only mode for historical records"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-full text-gray-900"
                disabled={!isCurrentYear}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {isCurrentYear ? 'Quick Access' : `Historical Stock (${financialYear})`}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {filteredProducts.slice(0, 10).map(product => {
              const displayStock = getDisplayStock(product);
              return (
                <div
                  key={product.id}
                  onClick={() => isCurrentYear && addToCart(product)}
                  className={`flex-shrink-0 w-36 p-3 border-2 border-gray-200 rounded-lg transition-all text-center ${isCurrentYear ? 'cursor-pointer hover:border-primary-500' : 'opacity-80 bg-gray-50'}`}
                >
                  <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                  <p className="text-lg font-bold text-primary-600">₹{product.selling_price}</p>
                  <p className={`text-xs ${displayStock <= product.min_stock_level ? 'text-red-600' : 'text-gray-500'}`}>
                    {displayStock} left
                  </p>
                </div>
              );
            })}
          </div>

          {isCurrentYear && noResults && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <button
                onClick={() => handleAddNewProduct(searchTerm)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" /> Add "{searchTerm.toUpperCase()}"
              </button>
            </div>
          )}
        </div>

        <div className="card bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Current Sale</h3>
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-dashed rounded-lg">
              <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={`${item.product.id}-${index}`} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{item.product.name}</p>
                      <p className="text-xs text-gray-500">Stock: {item.product.stock_quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartItem(index, 'quantity', Math.max(1, item.quantity - 1))} className="w-8 h-8 border border-primary-500 rounded text-primary-600">-</button>
                      <input type="number" value={item.quantity} onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-12 text-center border rounded" />
                      <button onClick={() => updateCartItem(index, 'quantity', item.quantity + 1)} className="w-8 h-8 border border-primary-500 rounded text-primary-600">+</button>
                    </div>
                    <div className="w-24">
                      <input type="number" value={item.salePrice} onChange={(e) => updateCartItem(index, 'salePrice', parseFloat(e.target.value) || 0)} className="w-full border rounded px-2" />
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{(item.salePrice * item.quantity).toFixed(2)}</p>
                      <button onClick={() => removeFromCart(index)} className="text-red-500"><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                  {item.quantity > item.product.stock_quantity && (
                    <div className="mt-2 text-red-600 text-xs flex items-center gap-2">
                      <span>Insufficient stock!</span>
                      <button onClick={() => {setAddStockProduct(item.product); setAddStockQuantity(item.quantity - item.product.stock_quantity); setShowAddStockModal(true);}} className="bg-primary-500 text-white px-2 py-0.5 rounded">Add Stock</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card bg-secondary-600 text-white text-center p-6">
              <p className="text-sm opacity-80">TOTAL</p>
              <p className="text-4xl font-bold">₹{cart.reduce((s, i) => s + (i.salePrice * i.quantity), 0).toFixed(2)}</p>
            </div>
            <button 
              onClick={handleCompleteSale} 
              disabled={processing || !isCurrentYear} 
              className={`card bg-primary-600 text-white text-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 ${!isCurrentYear ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {processing ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        )}

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Summary for {formatDateToDDMMYYYY(saleDate)}</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-primary-50 p-4 rounded text-center">
              <p className="text-xs text-primary-600">Sold</p>
              <p className="text-xl font-bold">{dateSummary.totalProducts}</p>
            </div>
            <div className="bg-secondary-50 p-4 rounded text-center">
              <p className="text-xs text-secondary-600">Revenue</p>
              <p className="text-xl font-bold">₹{dateSummary.totalAmount.toFixed(2)}</p>
            </div>
            <div className="bg-accent-50 p-4 rounded text-center">
              <p className="text-xs text-accent-600">Profit</p>
              <p className="text-xl font-bold">₹{dateSummary.totalProfit.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {showAddStockModal && addStockProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Add Stock: {addStockProduct.name}</h3>
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setAddStockQuantity(Math.max(1, addStockQuantity - 1))} className="btn-outline px-3">-</button>
              <input type="number" value={addStockQuantity} onChange={(e) => setAddStockQuantity(parseInt(e.target.value) || 1)} className="input-field text-center" />
              <button onClick={() => setAddStockQuantity(addStockQuantity + 1)} className="btn-outline px-3">+</button>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddStock} className="btn-primary flex-1">Add Stock</button>
              <button onClick={() => setShowAddStockModal(false)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showQuickAddModal && (
        <QuickAddProductModal
          onClose={() => setShowQuickAddModal(false)}
          onProductAdded={handleQuickAddProductAdded}
          prefillName={quickAddPrefillName}
        />
      )}
    </div>
  );
}

function QuickAddProductModal({ onClose, onProductAdded, prefillName }: { onClose: () => void; onProductAdded: (p: Product) => void; prefillName: string }) {
  const [formData, setFormData] = useState({
    name: prefillName.toUpperCase(),
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: ProductInsert = {
        name: formData.name,
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: 5,
        category_id: null
      };
      const newProduct = await createProduct(data);
      onProductAdded(newProduct);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Quick Add Product</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})} className="input-field" placeholder="Name" required />
          <input type="text" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="input-field" placeholder="Barcode" />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="input-field" placeholder="Purchase Price" required />
            <input type="number" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="input-field" placeholder="Selling Price" required />
          </div>
          <input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})} className="input-field" placeholder="Initial Stock" required />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">Add & Continue</button>
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
