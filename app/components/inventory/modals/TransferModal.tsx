'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getProducts, updateProduct, createProduct, updatePartyPurchase } from 'lib/offline-adapter';
import type { PartyPurchase, Product } from 'supabase_client';

interface TransferModalProps {
  purchase: PartyPurchase;
  onClose: () => void;
  onTransferComplete: (updatedPurchase: PartyPurchase) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning', duration?: number) => void;
}

export default function TransferModal({ purchase, onClose, onTransferComplete, showToast }: TransferModalProps) {
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkExistingProduct = async () => {
      try {
        const allProducts = await getProducts();
        const existing = allProducts.find(p =>
          p.name.toUpperCase() === purchase.item_name.toUpperCase()
        );
        setExistingProduct(existing || null);
      } catch (error) {
        console.error('Error checking for existing product:', error);
      } finally {
        setLoading(false);
      }
    };
    checkExistingProduct();
  }, [purchase.item_name]);

  const handleTransfer = async () => {
    if (transferQuantity > purchase.remaining_quantity) return;

    try {
      if (existingProduct) {
        const newStockQuantity = existingProduct.stock_quantity + transferQuantity;
        await updateProduct(existingProduct.id, { stock_quantity: newStockQuantity });
        showToast(`Added ${transferQuantity} units to "${existingProduct.name}"`, 'success');
      } else {
        await createProduct({
          name: purchase.item_name,
          barcode: purchase.barcode || null,
          purchase_price: purchase.purchase_price,
          selling_price: purchase.selling_price,
          stock_quantity: transferQuantity,
          min_stock_level: 5,
          description: `Transferred from ${purchase.party_name} purchase`,
          category_id: null
        });
        showToast(`Created new product "${purchase.item_name}"`, 'success');
      }

      const updatedPurchase = await updatePartyPurchase(purchase.id, {
        remaining_quantity: purchase.remaining_quantity - transferQuantity
      });
      onTransferComplete(updatedPurchase);
    } catch (error) {
      console.error('Error transferring:', error);
      showToast('Error transferring to products', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Transfer to Products</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-bold">{purchase.item_name}</p>
              <p className="text-sm">Available: {purchase.remaining_quantity} units</p>
            </div>
            {existingProduct && (
              <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
                ⚠️ Product already exists. Transfer will merge stock.
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={() => setTransferQuantity(Math.max(1, transferQuantity - 1))} className="btn-outline px-3">-</button>
              <input type="number" value={transferQuantity} onChange={(e) => setTransferQuantity(Math.min(purchase.remaining_quantity, parseInt(e.target.value) || 1))} className="input-field text-center w-20" />
              <button onClick={() => setTransferQuantity(Math.min(purchase.remaining_quantity, transferQuantity + 1))} className="btn-outline px-3">+</button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleTransfer} disabled={loading} className="btn-success flex-1">Transfer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
