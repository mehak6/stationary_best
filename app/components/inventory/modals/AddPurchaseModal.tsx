'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getProducts, createPartyPurchase } from 'lib/offline-adapter';
import type { PartyPurchase, PartyPurchaseInsert, Product } from 'supabase_client';

interface AddPurchaseModalProps {
  onClose: () => void;
  onPurchaseAdded: (purchase: PartyPurchase) => void;
}

export default function AddPurchaseModal({ onClose, onPurchaseAdded }: AddPurchaseModalProps) {
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

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  };

  const parseDisplayDate = (displayDate: string) => {
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
  const [products, setProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Product[]>([]);
  const itemNameRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    itemNameRef.current?.focus();
  }, []);

  const handleItemNameChange = (value: string) => {
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

  const selectSuggestion = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      item_name: product.name,
      barcode: product.barcode || '',
      purchase_price: product.purchase_price ? String(product.purchase_price) : '',
      selling_price: product.selling_price ? String(product.selling_price) : ''
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      localStorage.setItem('lastPartyName', formData.party_name);
      localStorage.setItem('lastPartyDate', formData.purchase_date);

      onPurchaseAdded(newPurchase);
      setFormData({
        ...formData,
        item_name: '',
        barcode: '',
        purchase_price: '',
        selling_price: '',
        purchased_quantity: '',
        notes: ''
      });
      itemNameRef.current?.focus();
    } catch (error) {
      console.error('Error adding purchase:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add Purchase Record</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Party Name *</label>
                <input type="text" required value={formData.party_name} onChange={(e) => setFormData({...formData, party_name: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date (dd/mm/yyyy) *</label>
                <input
                  type="text"
                  required
                  value={displayDate}
                  onChange={(e) => {
                    setDisplayDate(e.target.value);
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                      setFormData({...formData, purchase_date: parseDisplayDate(e.target.value)});
                    }
                  }}
                  className="input-field"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Item Name *</label>
              <input
                ref={itemNameRef}
                type="text"
                required
                value={formData.item_name}
                onChange={(e) => handleItemNameChange(e.target.value)}
                className="input-field uppercase"
              />
              {showSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                  {filteredSuggestions.map(p => (
                    <div key={p.id} onClick={() => selectSuggestion(p)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Purchase Price *</label>
                <input type="number" step="0.01" required value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Selling Price *</label>
                <input type="number" step="0.01" required value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="input-field" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity *</label>
              <input type="number" required min="1" value={formData.purchased_quantity} onChange={(e) => setFormData({...formData, purchased_quantity: e.target.value})} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="input-field" rows={2} />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Add Purchase</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
