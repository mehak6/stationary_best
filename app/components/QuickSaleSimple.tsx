'use client'

import React from 'react';

export default function QuickSaleSimple({ onNavigate }) {
  return (
    <div className="p-6 bg-primary-50 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Quick Sale</h1>
        <p className="text-xl text-gray-600 mb-4">Component is being rebuilt</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
