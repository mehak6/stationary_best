'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  BarChart3,
  Edit,
  Trash2,
  X,
  Check,
  History
} from 'lucide-react';
import {
  getProducts,
  updateProduct,
  deleteProduct,
  createProduct
} from 'lib/offline-adapter';
import { addProductHistory } from 'lib/product-history';
import type { Product, ProductInsert } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface ProductManagementProps {
  onNavigate: (view: string) => void;
}

export default function ProductManagement({ onNavigate }: ProductManagementProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [undoData, setUndoData] = useState<{
    productId: string;
    fieldName: string;
    oldValue: any;
    newValue: any;
    productName: string;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);

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
      showToast('Product deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('Error deleting product', 'error');
    }
  };

  const startEditing = (productId: string, fieldName: string, currentValue: any) => {
    setEditingProduct(productId);
    setEditingField(fieldName);
    setTempValue(currentValue?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditingField(null);
    setTempValue('');
  };

  const saveEdit = async (productId: string, fieldName: string, newValue: string) => {
    if (!newValue.trim() || newValue === '') {
      cancelEditing();
      return;
    }

    setSaving(true);
    try {
      let processedValue: any = newValue;
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
        processedValue = newValue.trim().toUpperCase();
        if (processedValue.length < 2) {
          setSaving(false);
          return;
        }
      }

      const currentProduct = products.find(p => p.id === productId);
      if (!currentProduct) return;

      const updates: Partial<ProductInsert> = {
        [fieldName]: processedValue
      };

      await updateProduct(productId, updates);

      if (fieldName === 'stock_quantity') {
        const stockBefore = currentProduct.stock_quantity;
        const stockAfter = processedValue;
        const change = stockAfter - stockBefore;

        if (change !== 0) {
          await addProductHistory({
            product_id: productId,
            product_name: currentProduct.name,
            action: change > 0 ? 'stock_added' : 'stock_updated',
            quantity_change: change,
            stock_before: stockBefore,
            stock_after: stockAfter,
            notes: change > 0
              ? `Added ${change} units to stock`
              : `Reduced stock by ${Math.abs(change)} units`
          });
        }
      }

      setProducts(products.map(p =>
        p.id === productId ? { ...p, [fieldName]: processedValue } : p
      ));

      setUndoData({
        productId: productId,
        fieldName: fieldName,
        oldValue: (currentProduct as any)[fieldName],
        newValue: processedValue,
        productName: currentProduct.name
      });

      setShowUndo(true);
      setTimeout(() => {
        setShowUndo(false);
        setUndoData(null);
      }, 5000);

      cancelEditing();
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('Error updating product. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!undoData) return;

    try {
      const { productId, fieldName, oldValue, productName } = undoData;
      await updateProduct(productId, { [fieldName]: oldValue });
      setProducts(products.map(p =>
        p.id === productId ? { ...p, [fieldName]: oldValue } : p
      ));
      setShowUndo(false);
      setUndoData(null);
      showToast(`Undone: ${productName} - ${fieldName} reverted to previous value`, 'success');
    } catch (error) {
      console.error('Error undoing change:', error);
      showToast('Error undoing change. Please try again.', 'error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, productId: string, fieldName: string) => {
    if (e.key === 'Enter') {
      saveEdit(productId, fieldName, tempValue);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
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

      {loading ? (
        <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6' : 'space-y-3'}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-gray-100"></div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          <div className="card bg-gray-50 border-b-2 border-gray-200 hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                <div className="col-span-2">
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
              <div className="w-24 text-center">
                <h3 className="font-semibold text-gray-700 text-sm">Actions</h3>
              </div>
            </div>
          </div>

          {filteredProducts.map(product => (
            <div key={product.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center">
                  <div className="sm:col-span-2">
                    {editingProduct === product.id && editingField === 'name' ? (
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                        className="w-full px-2 py-1 border border-blue-300 rounded font-semibold uppercase text-sm focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <h3
                          className="font-semibold text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block hover:text-blue-700 transition-colors text-sm sm:text-base"
                          onClick={() => startEditing(product.id, 'name', product.name)}
                        >
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500">Code: {product.barcode || 'N/A'}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 sm:hidden">Purchase: </span>
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
                    <span className="text-gray-500 sm:hidden">Selling: </span>
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
                    <span className="text-gray-500 sm:hidden">Stock: </span>
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
                          product.stock_quantity <= product.min_stock_level ? 'text-red-600' : 'text-accent-700'
                        }`}
                        onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                      >
                        {product.stock_quantity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  {editingProduct === product.id && (
                    <>
                      <button
                        onClick={() => saveEdit(editingProduct!, editingField!, tempValue)}
                        disabled={saving}
                        className="p-1 text-green-600 hover:text-green-800"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedProductForHistory(product);
                      setShowHistory(true);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="View History"
                  >
                    <History className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete Product"
                  >
                    <Trash2 className="h-5 w-5" />
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
                        onClick={() => saveEdit(editingProduct!, editingField!, tempValue)}
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
                    onClick={() => {
                      setSelectedProductForHistory(product);
                      setShowHistory(true);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                {editingProduct === product.id && editingField === 'name' ? (
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                    className="w-full px-2 py-1 border border-blue-300 rounded font-semibold uppercase"
                    autoFocus
                  />
                ) : (
                  <h3
                    className="font-semibold text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block"
                    onClick={() => startEditing(product.id, 'name', product.name)}
                  >
                    {product.name}
                  </h3>
                )}
                <p className="text-sm text-gray-500">Code: {product.barcode || 'N/A'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Purchase:</span>
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
                      ₹{product.purchase_price}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Selling:</span>
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
                      className="font-medium text-secondary-600 cursor-pointer hover:bg-secondary-50 px-2 py-1 rounded"
                      onClick={() => startEditing(product.id, 'selling_price', product.selling_price)}
                    >
                      ₹{product.selling_price}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Stock:</span>
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
                      className={`font-medium cursor-pointer px-2 py-1 rounded ${
                        product.stock_quantity <= product.min_stock_level ? 'text-red-600' : 'text-gray-900'
                      }`}
                      onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                    >
                      {product.stock_quantity} units
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
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
            setShowBulkEntry(false);
          }}
        />
      )}

      {showHistory && selectedProductForHistory && (
        <ProductHistoryModal
          product={selectedProductForHistory}
          onClose={() => {
            setShowHistory(false);
            setSelectedProductForHistory(null);
          }}
        />
      )}

      {/* Undo Toast */}
      {showUndo && undoData && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span>Updated {undoData.productName}</span>
            <button
              onClick={handleUndo}
              className="text-primary-400 font-bold hover:text-primary-300"
            >
              UNDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal Modal Components
function ProductHistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { getProductHistory } = await import('lib/product-history');
        const historyData = await getProductHistory(product.id);
        setHistory(historyData);
      } catch (error) {
        console.error('Error fetching product history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [product.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Product History</h2>
              <p className="text-sm text-gray-600 mt-1">{product.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <p className="text-center py-8 text-gray-500">Loading history...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No history recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="border-l-4 border-primary-500 bg-gray-50 p-4 rounded-r-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase text-primary-600">{entry.action.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-500">{new Date(entry.date).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Stock: {entry.stock_before} → {entry.stock_after} 
                        <span className={`ml-2 font-bold ${entry.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({entry.quantity_change >= 0 ? '+' : ''}{entry.quantity_change})
                        </span>
                      </div>
                      {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddProductModal({ onClose, onProductAdded }: { onClose: () => void; onProductAdded: (p: Product) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '5',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const productData: ProductInsert = {
        name: formData.name.toUpperCase(),
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: parseInt(formData.min_stock_level) || 5,
        description: formData.description || null,
        category_id: null
      };

      const newProduct = await createProduct(productData);
      
      await addProductHistory({
        product_id: newProduct.id,
        product_name: newProduct.name,
        action: 'created',
        quantity_change: newProduct.stock_quantity,
        stock_before: 0,
        stock_after: newProduct.stock_quantity,
        notes: `Product created with initial stock of ${newProduct.stock_quantity}`
      });

      onProductAdded(newProduct);
    } catch (error) {
      console.error('Error adding product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                className="input-field uppercase"
                placeholder="Enter product name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Scan or enter barcode"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock *</label>
                <input
                  type="number"
                  required
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BulkProductEntryModal({ onClose, onProductsAdded }: { onClose: () => void; onProductsAdded: (p: Product[]) => void }) {
  const [entries, setEntries] = useState([
    { id: 1, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }
  ]);
  const [saving, setSaving] = useState(false);

  const addNewRow = () => {
    const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;
    setEntries([...entries, { id: newId, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }]);
  };

  const removeRow = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: number, field: string, value: string) => {
    setEntries(entries.map(e =>
      e.id === id ? { ...e, [field]: field === 'name' ? value.toUpperCase() : value } : e
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter(entry => entry.name.trim() && entry.purchase_price && entry.selling_price && entry.stock_quantity);
    if (validEntries.length === 0) return;

    setSaving(true);
    try {
      const createdProducts = [];
      for (const entry of validEntries) {
        const productData: ProductInsert = {
          name: entry.name.trim().toUpperCase(),
          barcode: entry.barcode || null,
          purchase_price: parseFloat(entry.purchase_price),
          selling_price: parseFloat(entry.selling_price),
          stock_quantity: parseInt(entry.stock_quantity),
          min_stock_level: parseInt(entry.min_stock_level) || 5,
          category_id: null
        };

        const newProduct = await createProduct(productData);
        createdProducts.push(newProduct);

        await addProductHistory({
          product_id: newProduct.id,
          product_name: newProduct.name,
          action: 'created',
          quantity_change: newProduct.stock_quantity,
          stock_before: 0,
          stock_after: newProduct.stock_quantity,
          notes: `Product created via bulk entry`
        });
      }
      onProductsAdded(createdProducts);
    } catch (error) {
      console.error('Error in bulk entry:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Bulk Product Entry</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm">Product Name *</th>
                    <th className="text-left py-2 px-2 text-sm">Barcode</th>
                    <th className="text-left py-2 px-2 text-sm">Purchase ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm">Selling ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm">Stock *</th>
                    <th className="text-left py-2 px-2 text-sm">Min Stock</th>
                    <th className="text-center py-2 px-2 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 px-2">
                        <input type="text" value={entry.name} onChange={(e) => updateEntry(entry.id, 'name', e.target.value)} className="input-field text-sm uppercase" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="text" value={entry.barcode} onChange={(e) => updateEntry(entry.id, 'barcode', e.target.value)} className="input-field text-sm" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.purchase_price} onChange={(e) => updateEntry(entry.id, 'purchase_price', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.selling_price} onChange={(e) => updateEntry(entry.id, 'selling_price', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.stock_quantity} onChange={(e) => updateEntry(entry.id, 'stock_quantity', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.min_stock_level} onChange={(e) => updateEntry(entry.id, 'min_stock_level', e.target.value)} className="input-field text-sm" />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button type="button" onClick={() => removeRow(entry.id)} className="p-1 text-gray-400 hover:text-red-600" disabled={entries.length === 1}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={addNewRow} className="btn-outline flex items-center text-sm"><Plus className="h-4 w-4 mr-1" /> Add Row</button>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
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
