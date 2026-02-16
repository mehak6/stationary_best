'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  Check,
  X,
  Undo2
} from 'lucide-react';
import {
  getPartyPurchases,
  deletePartyPurchase,
  updatePartyPurchase
} from 'lib/offline-adapter';
import type { PartyPurchase } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

// Import modals
import AddPurchaseModal from '../modals/AddPurchaseModal';
import TransferModal from '../modals/TransferModal';
import RevertModal from '../modals/RevertModal';
import FileUploadModal from '../modals/FileUploadModal';

interface PartyManagementProps {
  onNavigate: (view: string) => void;
}

export default function PartyManagement({ onNavigate }: PartyManagementProps) {
  const { showToast } = useToast();
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PartyPurchase | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingPurchase, setEditingPurchase] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getPartyPurchases();
        setPartyPurchases(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPurchases = partyPurchases.filter(p =>
    p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.party_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeletePurchase = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deletePartyPurchase(id);
      setPartyPurchases(prev => prev.filter(p => p.id !== id));
      showToast('Purchase deleted', 'success');
    } catch (error) {
      showToast('Error deleting purchase', 'error');
    }
  };

  const startEditing = (id: string, field: string, val: any) => {
    setEditingPurchase(id);
    setEditingField(field);
    setEditValue(val.toString());
  };

  const saveEdit = async (id: string, field: string, val: string) => {
    try {
      let processed: any = val;
      if (field === 'purchased_quantity') processed = parseInt(val);
      if (field === 'purchase_price' || field === 'selling_price') processed = parseFloat(val);
      
      await updatePartyPurchase(id, { [field]: processed });
      setPartyPurchases(prev => prev.map(p => p.id === id ? { ...p, [field]: processed } : p));
      setEditingPurchase(null);
    } catch (error) {
      showToast('Error updating', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Party Purchases</h1>
          <p className="text-gray-600 mt-2">Manage your purchased inventory from suppliers</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button onClick={() => setShowFileUpload(true)} className="btn-outline">Import File</button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary"><Plus className="h-5 w-5 mr-2" /> Add Purchase</button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search purchases..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field pl-10" />
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPurchases.map(purchase => (
            <div key={purchase.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between mb-2">
                <span className="badge-info">{purchase.party_name}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedPurchase(purchase); setShowTransferModal(true); }} className="p-1 text-gray-400 hover:text-primary-600" title="Transfer"><Package className="h-4 w-4" /></button>
                  <button onClick={() => handleDeletePurchase(purchase.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 uppercase">{purchase.item_name}</h3>
              <p className="text-xs text-gray-500 mb-4">{new Date(purchase.purchase_date).toLocaleDateString()}</p>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Purchased:</span>
                  <span className="font-medium">{purchase.purchased_quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining:</span>
                  <span className={`font-bold ${purchase.remaining_quantity <= 0 ? 'text-red-600' : 'text-accent-600'}`}>{purchase.remaining_quantity} units</span>
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <span className="font-semibold text-gray-700">Total:</span>
                  <span className="font-bold text-orange-600">₹{(purchase.purchase_price * purchase.purchased_quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && <AddPurchaseModal onClose={() => setShowAddForm(false)} onPurchaseAdded={(p) => { setPartyPurchases([p, ...partyPurchases]); setShowAddForm(false); }} />}
      {showFileUpload && <FileUploadModal onClose={() => setShowFileUpload(false)} onFileProcessed={(ps) => { setPartyPurchases([...ps, ...partyPurchases]); }} />}
      {showTransferModal && selectedPurchase && (
        <TransferModal
          purchase={selectedPurchase}
          onClose={() => { setShowTransferModal(false); setSelectedPurchase(null); }}
          onTransferComplete={(p) => { setPartyPurchases(prev => prev.map(old => old.id === p.id ? p : old)); setShowTransferModal(false); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
