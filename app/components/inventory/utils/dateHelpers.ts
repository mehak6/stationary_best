/**
 * Date utility functions for the Inventory Management System
 * Handles conversion between ISO format (yyyy-mm-dd) and display format (dd/mm/yyyy)
 */

/**
 * Format ISO date string to dd/mm/yyyy display format
 * @param isoDate - ISO date string (yyyy-mm-dd)
 * @returns Formatted date string (dd/mm/yyyy)
 */
export const formatDateToDDMMYYYY = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Parse dd/mm/yyyy display format to ISO date string
 * @param ddmmyyyy - Display date string (dd/mm/yyyy)
 * @returns ISO date string (yyyy-mm-dd)
 */
export const parseDDMMYYYYToISO = (ddmmyyyy: string): string => {
  if (!ddmmyyyy || !/^\d{2}\/\d{2}\/\d{4}$/.test(ddmmyyyy)) return '';
  const [day, month, year] = ddmmyyyy.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Format ISO date string to dd/mm/yy short format
 * @param dateString - ISO date string
 * @returns Formatted date string (dd/mm/yy)
 */
export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

/**
 * Get current date in ISO format (yyyy-mm-dd)
 * @returns Current date as ISO string
 */
export const getCurrentDateISO = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current date in dd/mm/yyyy display format
 * @returns Current date in display format
 */
export const getCurrentDateDisplay = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear());
  return `${day}/${month}/${year}`;
};
