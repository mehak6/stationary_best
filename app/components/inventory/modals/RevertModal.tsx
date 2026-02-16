'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { getProducts, updateProduct, updatePartyPurchase } from 'lib/offline-adapter';
import { addProductHistory } from 'lib/product-history';
import type { PartyPurchase } from 'supabase_client';

interface RevertModalProps {
  purchase: PartyPurchase;
  onClose: () => void;
  onRevertComplete: (updatedPurchase: PartyPurchase) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning', duration?: number) => void;
}

export default function RevertModal({ purchase, onClose, onRevertComplete, showToast }: RevertModalProps) {
  const [revertQuantity, setRevertQuantity] = useState(1);
  const transferredQty = purchase.purchased_quantity - purchase.remaining_quantity;

  const handleRevert = async () => {
    if (revertQuantity > transferredQty) return;

    try {
      const updatedPurchase = await updatePartyPurchase(purchase.id, {
        remaining_quantity: purchase.remaining_quantity + revertQuantity
      });

      const products = await getProducts();
      const matchingProduct = products.find(p => p.name.toUpperCase() === purchase.item_name.toUpperCase());

      if (matchingProduct) {
        const newStockQuantity = Math.max(0, matchingProduct.stock_quantity - revertQuantity);
        await updateProduct(matchingProduct.id, { stock_quantity: newStockQuantity });
        await addProductHistory({
          product_id: matchingProduct.id,
          product_name: matchingProduct.name,
          action: 'stock_reduced',
          quantity_change: -revertQuantity,
          stock_before: matchingProduct.stock_quantity,
          stock_after: newStockQuantity,
          notes: `Reverted transfer from party purchase - ${purchase.party_name}`
        });
      }

      onRevertComplete(updatedPurchase);
      showToast('Transfer reverted successfully', 'success');
    } catch (error) {
      console.error('Error reverting:', error);
      showToast('Failed to revert transfer', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Revert Transfer</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="font-bold">{purchase.item_name}</p>
              <p className="text-sm">Transferred: {transferredQty} units</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setRevertQuantity(Math.max(1, revertQuantity - 1))} className="btn-outline px-3">-</button>
              <input type="number" value={revertQuantity} onChange={(e) => setRevertQuantity(Math.min(transferredQty, parseInt(e.target.value) || 1))} className="input-field text-center w-20" />
              <button onClick={() => setRevertQuantity(Math.min(transferredQty, revertQuantity + 1))} className="btn-outline px-3">+</button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleRevert} className="bg-orange-600 text-white rounded-lg flex-1 hover:bg-orange-700">Revert</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
