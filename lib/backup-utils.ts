/**
 * Backup and Restore Utilities for Inventory Pro
 * Handles automatic backups and data restoration
 */

import { getProducts, getSales, getPartyPurchases } from './offline-adapter';

export interface BackupData {
  version: string;
  timestamp: string;
  products: any[];
  sales: any[];
  partyPurchases: any[];
  metadata: {
    totalProducts: number;
    totalSales: number;
    totalPartyPurchases: number;
    backupType: 'manual' | 'automatic';
  };
}

const BACKUP_VERSION = '1.0.0';
const BACKUP_INTERVAL_KEY = 'inventory_pro_backup_interval';
const LAST_BACKUP_KEY = 'inventory_pro_last_backup';

/**
 * Create a backup of all data
 */
export async function createBackup(backupType: 'manual' | 'automatic' = 'manual'): Promise<BackupData> {
  try {
    const [products, sales, partyPurchases] = await Promise.all([
      getProducts(),
      getSales(10000), // Get all sales
      getPartyPurchases()
    ]);

    const backup: BackupData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      products: products || [],
      sales: sales || [],
      partyPurchases: partyPurchases || [],
      metadata: {
        totalProducts: products?.length || 0,
        totalSales: sales?.length || 0,
        totalPartyPurchases: partyPurchases?.length || 0,
        backupType
      }
    };

    // Update last backup timestamp
    localStorage.setItem(LAST_BACKUP_KEY, backup.timestamp);

    return backup;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: BackupData): void {
  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date(backup.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `inventory_pro_backup_${dateStr}_${timeStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create and download backup in one step
 */
export async function createAndDownloadBackup(backupType: 'manual' | 'automatic' = 'manual'): Promise<void> {
  const backup = await createBackup(backupType);
  downloadBackup(backup);
}

/**
 * Read backup file and parse it
 */
export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Validate backup structure
        if (!data.version || !data.timestamp || !data.products) {
          throw new Error('Invalid backup file format');
        }

        resolve(data as BackupData);
      } catch (error) {
        reject(new Error('Failed to parse backup file. Please ensure it is a valid backup.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
}

/**
 * Check if automatic backup is due (every 10 days)
 */
export function isBackupDue(): boolean {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) return true;

  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const daysSinceBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);

  const interval = getBackupInterval();
  return daysSinceBackup >= interval;
}

/**
 * Get backup interval in days (default 10)
 */
export function getBackupInterval(): number {
  const interval = localStorage.getItem(BACKUP_INTERVAL_KEY);
  return interval ? parseInt(interval, 10) : 10;
}

/**
 * Set backup interval in days
 */
export function setBackupInterval(days: number): void {
  localStorage.setItem(BACKUP_INTERVAL_KEY, days.toString());
}

/**
 * Get last backup date
 */
export function getLastBackupDate(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

/**
 * Format date for display
 */
export function formatBackupDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get days until next backup
 */
export function getDaysUntilNextBackup(): number {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) return 0;

  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const daysSinceBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);
  const interval = getBackupInterval();

  return Math.max(0, Math.ceil(interval - daysSinceBackup));
}
