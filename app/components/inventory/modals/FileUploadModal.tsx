'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, ArrowLeft } from 'lucide-react';
import { createPartyPurchase } from 'lib/offline-adapter';
import { processPDFExtractedData } from '../utils/pdfParser';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO } from '../utils/dateHelpers';
import type { PartyPurchase } from 'supabase_client';

interface FileUploadModalProps {
  onClose: () => void;
  onFileProcessed: (purchases: PartyPurchase[]) => void;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function FileUploadModal({ onClose, onFileProcessed }: FileUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [editableData, setEditableData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(fileExtension || '')) {
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
      } else if (fileExtension === 'pdf') {
        setUploadingStatus('Initializing PDF processor...');
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
          document.head.appendChild(script);
          await new Promise((resolve) => { script.onload = resolve; });
        }
        
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let extractedData: any = { fullText: '', pages: [] };
        const maxPages = Math.min(pdf.numPages, 15);
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageTextItems = textContent.items.map((item: any) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5]
          }));
          const pageText = pageTextItems.map((i: any) => i.text).join(' ');
          extractedData.pages.push({ pageNumber: pageNum, text: pageText, textItems: pageTextItems });
          extractedData.fullText += pageText + '\n';
          setProcessingProgress(25 + (50 * pageNum / maxPages));
        }
        
        parsedData = await processPDFExtractedData(extractedData);
      }

      const processedPurchases = parsedData.map((row, index) => ({
        party_name: row.party_name || 'Import',
        item_name: row.item_name || `Item ${index + 1}`,
        barcode: row.barcode || '',
        purchase_price: parseFloat(row.purchase_price) || 0,
        selling_price: parseFloat(row.selling_price) || 0,
        purchased_quantity: parseInt(row.quantity) || 1,
        remaining_quantity: parseInt(row.quantity) || 1,
        purchase_date: row.purchase_date || new Date().toISOString().split('T')[0],
        notes: row.notes || 'Imported'
      }));

      if (fileExtension === 'pdf') {
        setEditableData(processedPurchases);
        setShowPreview(true);
        setUploading(false);
      } else {
        const savedPurchases = [];
        for (const p of processedPurchases) {
          const saved = await createPartyPurchase(p);
          savedPurchases.push(saved);
        }
        onFileProcessed(savedPurchases);
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      setUploading(false);
    }
  };

  const handleSaveEditedData = async () => {
    setUploading(true);
    const savedPurchases = [];
    for (const p of editableData) {
      const saved = await createPartyPurchase(p);
      savedPurchases.push(saved);
    }
    onFileProcessed(savedPurchases);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className={`bg-white rounded-xl w-full max-h-[90vh] overflow-y-auto ${showPreview ? 'max-w-6xl' : 'max-w-lg'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{showPreview ? 'Review Extracted Data' : 'Upload File'}</h2>
            <button onClick={onClose} disabled={uploading} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>

          {!showPreview ? (
            <div
              className={`border-2 border-dashed p-8 text-center rounded-lg ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {uploading ? (
                <div>
                  <p className="font-medium">{uploadingStatus}</p>
                  <div className="w-full bg-gray-200 h-2 rounded-full mt-4">
                    <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${processingProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <p>Drop file or click to browse (Excel, CSV, PDF)</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">Supplier</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">Item Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">Purchase Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableData.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <input type="text" value={item.party_name} onChange={(e) => {
                            const d = [...editableData]; d[idx].party_name = e.target.value; setEditableData(d);
                          }} className="w-full border rounded px-1" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="text" value={item.item_name} onChange={(e) => {
                            const d = [...editableData]; d[idx].item_name = e.target.value; setEditableData(d);
                          }} className="w-full border rounded px-1" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={item.purchase_price} onChange={(e) => {
                            const d = [...editableData]; d[idx].purchase_price = e.target.value; setEditableData(d);
                          }} className="w-full border rounded px-1" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={item.purchased_quantity} onChange={(e) => {
                            const d = [...editableData]; d[idx].purchased_quantity = parseInt(e.target.value); setEditableData(d);
                          }} className="w-full border rounded px-1" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)} className="btn-outline flex items-center"><ArrowLeft className="h-4 w-4 mr-2" /> Back</button>
                <button onClick={handleSaveEditedData} className="btn-primary flex-1 flex items-center justify-center"><Check className="h-4 w-4 mr-2" /> Save All</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
