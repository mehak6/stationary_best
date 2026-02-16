/**
 * PDF Parsing utilities for Party Purchases
 */

export interface ExtractedPurchase {
  party_name: string;
  item_name: string;
  barcode: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  date: string;
  notes: string;
}

export function parsePDFText(text: string): ExtractedPurchase[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const parsedData: ExtractedPurchase[] = [];
  
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
  
  let headers: string[] = [];
  let tableRows: string[][] = [];
  let isInTable = false;
  
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
    tableRows.forEach((values) => {
      const record: any = {};
      
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
    let currentRecord: any = {};
    
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
  
  return parsedData;
}

export async function processPDFExtractedData(extractedData: any): Promise<any[]> {
  const parsedItems: any[] = [];
  const { fullText, pages } = extractedData;
  
  // Enhanced patterns focused on purchase documents
  const patterns = {
    supplier: /(?:(?:from|supplier|vendor|party|sold\s*by|dealer|distributor|company|bill\s*from|invoice\s*from)\s*:?\s*([A-Za-z0-9\s&\.,\-'\"]+))(?:\n|address|phone|email|\d{5,6})/gi,
    itemName: /(?:(?:item|product|description|article|goods?|part|material)\s*(?:name|no\.?|#|code)?\s*:?\s*([A-Za-z0-9\s\.,\-\/()&'\"]+))(?=\s*(?:[₹$]|\d+|qty|quantity|rate|price|amount))/gi,
    unitPrice: /(?:(?:rate|unit\s*price|price|cost|amount)\s*:?\s*[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?))/gi,
    purchasePrice: /(?:(?:purchase|cost|buy|wholesale|cp|rate|unit\s*rate)\s*(?:price)?\s*:?\s*[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?))/gi,
    quantity: /(?:(?:qty|quantity|units?|nos?|pieces?|pcs?|count)\s*:?\s*([0-9,]+))/gi,
  };
  
  // Step 1: Extract global supplier information
  let globalSupplier = '';
  const supplierMatches = [...fullText.matchAll(patterns.supplier)];
  if (supplierMatches.length > 0) {
    globalSupplier = supplierMatches[0][1]
      .trim()
      .split(/\n|address|phone|email|\d{5,}/)[0]
      .trim()
      .replace(/[\r\n]+/g, ' ')
      .substring(0, 100);
  }
  
  // Step 2: Try table-based extraction first
  for (const page of pages) {
    const tableData = extractTableData(page.textItems);
    if (tableData.length > 0) {
      parsedItems.push(...tableData.map((item: any) => ({
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
  return parsedItems
    .map(item => validateAndCleanItem(item))
    .filter(item => item !== null);
}

function extractTableData(textItems: any[]) {
  if (!textItems || textItems.length === 0) return [];
  const rows: any[] = [];
  const yTolerance = 5;
  
  textItems.forEach(item => {
    let foundRow = rows.find(row => Math.abs(row.y - item.y) <= yTolerance);
    if (!foundRow) {
      foundRow = { y: item.y, items: [] };
      rows.push(foundRow);
    }
    foundRow.items.push(item);
  });
  
  rows.sort((a, b) => b.y - a.y);
  rows.forEach(row => row.items.sort((a: any, b: any) => a.x - b.x));
  
  const headerKeywords = /item|product|description|name|qty|quantity|rate|price|amount|total|code|barcode/i;
  let headerRowIndex = -1;
  
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowText = rows[i].items.map((item: any) => item.text).join(' ');
    if (headerKeywords.test(rowText)) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) return [];
  const headerRow = rows[headerRowIndex];
  const columns = headerRow.items.map((item: any) => ({
    text: item.text.toLowerCase(),
    x: item.x,
    type: getColumnType(item.text)
  }));
  
  const extractedItems = [];
  for (const row of rows.slice(headerRowIndex + 1)) {
    if (row.items.length < 2) continue;
    const item: any = { party_name: '', item_name: '', barcode: '', purchase_price: 0, selling_price: 0, quantity: 1, notes: 'Extracted from PDF table' };
    row.items.forEach((textItem: any) => {
      const nearestColumn = columns.reduce((prev: any, curr: any) => 
        Math.abs(curr.x - textItem.x) < Math.abs(prev.x - textItem.x) ? curr : prev
      );
      const value = textItem.text.trim();
      if (!value) return;
      switch (nearestColumn.type) {
        case 'item': if (!item.item_name && value.length > 2) item.item_name = value; break;
        case 'price':
          const price = parseFloat(value.replace(/[^\d.]/g, ''));
          if (price > 0 && !item.purchase_price) item.purchase_price = price;
          break;
        case 'quantity':
          const qty = parseInt(value.replace(/[^\d]/g, ''));
          if (qty > 0) item.quantity = qty;
          break;
        case 'code': if (!item.barcode && /^[A-Za-z0-9\-_]+$/.test(value)) item.barcode = value; break;
      }
    });
    if (item.item_name && (item.selling_price > 0 || item.purchase_price > 0)) extractedItems.push(item);
  }
  return extractedItems;
}

function getColumnType(text: string) {
  text = text.toLowerCase();
  if (/item|product|description|name|article|material|goods/.test(text)) return 'item';
  if (/rate|unit\s*price|price|cost|amount|value/.test(text)) return 'price';
  if (/qty|quantity|units?|nos?|pieces?|count/.test(text)) return 'quantity';
  if (/code|barcode|sku|id|part\s*no/.test(text)) return 'code';
  return 'unknown';
}

function extractPatternData(text: string, patterns: any, globalSupplier: string) {
  const items = [];
  const lines = text.split('\n').filter(line => line.trim().length > 3);
  let currentItem: any = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (/^(page|total|subtotal|grand\s*total|invoice|receipt|bill|thank\s*you)/i.test(trimmedLine)) continue;
    
    const itemMatches = [...trimmedLine.matchAll(patterns.itemName)];
    if (itemMatches.length > 0) {
      if (currentItem && isValidItem(currentItem)) items.push(currentItem);
      currentItem = { party_name: globalSupplier || 'PDF Import', item_name: itemMatches[0][1].trim(), barcode: '', purchase_price: 0, selling_price: 0, quantity: 1, notes: 'Extracted from PDF patterns', source: 'pattern' };
    }
    
    if (currentItem) {
      const purchasePriceMatches = [...trimmedLine.matchAll(patterns.purchasePrice)];
      if (purchasePriceMatches.length > 0) {
        const price = parseFloat(purchasePriceMatches[0][1].replace(/,/g, ''));
        if (price > 0) currentItem.purchase_price = price;
      }
      const qtyMatches = [...trimmedLine.matchAll(patterns.quantity)];
      if (qtyMatches.length > 0) {
        const qty = parseInt(qtyMatches[0][1].replace(/,/g, ''));
        if (qty > 0) currentItem.quantity = qty;
      }
    }
  }
  if (currentItem && isValidItem(currentItem)) items.push(currentItem);
  return items;
}

function extractStructuredData(text: string, globalSupplier: string) {
  const items = [];
  const complexPattern = /([A-Za-z][A-Za-z0-9\s\.,\-\/()&'\"]{5,50})\s+([0-9]+)\s+[₹$]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/g;
  const matches = [...text.matchAll(complexPattern)];
  matches.forEach(match => {
    const [, itemName, qty, price] = match;
    const pPrice = parseFloat(price.replace(/,/g, ''));
    const pQty = parseInt(qty);
    if (pPrice > 0 && pQty > 0 && itemName.trim().length > 3) {
      items.push({ party_name: globalSupplier || 'PDF Import', item_name: itemName.trim(), barcode: '', purchase_price: pPrice, selling_price: 0, quantity: pQty, notes: 'Extracted from purchase document', source: 'structured' });
    }
  });
  return items;
}

function isValidItem(item: any) {
  return item.item_name && item.item_name.length > 2 && item.purchase_price > 0 && item.quantity > 0;
}

function validateAndCleanItem(item: any) {
  if (!isValidItem(item)) return null;
  return {
    party_name: item.party_name.trim().substring(0, 100) || 'PDF Import',
    item_name: item.item_name.trim().substring(0, 200),
    barcode: item.barcode || '',
    purchase_price: item.purchase_price || 0,
    selling_price: 0,
    quantity: Math.max(1, item.quantity || 1),
    purchase_date: new Date().toISOString().split('T')[0],
    notes: (item.notes || 'Imported from PDF')
  };
}
