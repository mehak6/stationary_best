'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Check } from 'lucide-react';
import { createPartyPurchase } from 'lib/offline-adapter';
import type { PartyPurchase } from 'supabase_client';

interface FileUploadModalProps {
  onClose: () => void;
  onFileProcessed: (purchases: PartyPurchase[]) => void;
}

export default function FileUploadModal({ onClose, onFileProcessed }: FileUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      alert('Unsupported file format. Please upload CSV or Excel files.');
      return;
    }

    setUploading(true);
    setUploadingStatus('Starting file processing...');
    setProcessingProgress(10);

    try {
      let parsedData: any[] = [];

      if (fileExtension === 'csv') {
        setUploadingStatus('Reading CSV file...');
        const text = await file.text();
        const Papa = await import('papaparse');
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
        setProcessingProgress(100);
      } else {
        // Excel processing would go here
        setUploadingStatus('Excel processing not fully implemented for offline mode.');
        setUploading(false);
        return;
      }

      const processedPurchases = parsedData.map((row, index) => ({
        party_name: row.party_name || row.Supplier || 'Import',
        item_name: row.item_name || row.Product || `Item ${index + 1}`,
        barcode: row.barcode || row.SKU || '',
        purchase_price: parseFloat(row.purchase_price || row.Rate || 0) || 0,
        selling_price: parseFloat(row.selling_price || row.MRP || 0) || 0,
        purchased_quantity: parseInt(row.quantity || row.Qty || 1) || 1,
        remaining_quantity: parseInt(row.quantity || row.Qty || 1) || 1,
        purchase_date: row.purchase_date || row.Date || new Date().toISOString().split('T')[0],
        notes: row.notes || 'Imported'
      }));

      const savedPurchases = [];
      for (const p of processedPurchases) {
        const saved = await createPartyPurchase(p);
        savedPurchases.push(saved);
      }
      
      onFileProcessed(savedPurchases);
      onClose();
    } catch (error) {
      console.error('Error:', error);
      setUploading(false);
      alert('Failed to process file. Please ensure it follows the correct format.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Upload Bulk Purchases</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {!uploading ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              handleFileUpload(file);
            }}
            className={`border-3 border-dashed rounded-xl p-10 text-center transition-all ${
              dragOver ? 'border-primary-500 bg-primary-50 scale-105' : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-primary-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">
              Drop your file here
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Supports CSV and Excel files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-primary-100 rounded-full"></div>
              <div 
                className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"
                style={{ clipPath: `inset(0 0 0 0)` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-primary-700">
                {Math.round(processingProgress)}%
              </div>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">{uploadingStatus}</p>
            <p className="text-sm text-gray-500">Please wait while we process your data...</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Required Columns (CSV):
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed">
            item_name, party_name, purchase_price, selling_price, quantity, barcode
          </p>
        </div>
      </div>
    </div>
  );
}
