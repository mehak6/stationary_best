/**
 * Financial Year (FY) Utilities
 * Defines FY as starting from March 20th and ending on March 20th of the next year.
 */

export interface FYRange {
  start: string; // ISO date string (YYYY-MM-DD)
  end: string;   // ISO date string (YYYY-MM-DD)
  label: string; // e.g., "2026-27"
}

/**
 * Gets the financial year for a given date
 * @param date Default is current date
 */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // If date is before March 20th, it belongs to the previous FY
  // FY starts on March 20th (month 2, day 20)
  if (month < 2 || (month === 2 && day < 20)) {
    const startYear = year - 1;
    const endYear = year % 100;
    return `${startYear}-${String(endYear).padStart(2, '0')}`;
  } else {
    const startYear = year;
    const endYear = (year + 1) % 100;
    return `${startYear}-${String(endYear).padStart(2, '0')}`;
  }
}

/**
 * Gets the full date range for a specific financial year
 * @param fyLabel e.g., "2026-27"
 */
export function getFYRange(fyLabel: string): FYRange {
  const [startYearStr] = fyLabel.split('-');
  const startYear = parseInt(startYearStr);
  
  if (isNaN(startYear)) {
    throw new Error(`Invalid FY label format: ${fyLabel}`);
  }

  return {
    start: `${startYear}-03-20`,
    end: `${startYear + 1}-03-21`, // March 20th inclusive
    label: fyLabel
  };
}

/**
 * Checks if a date falls within a specific financial year
 */
export function isDateInFY(dateStr: string, fyLabel: string): boolean {
  const range = getFYRange(fyLabel);
  return dateStr >= range.start && dateStr <= range.end;
}

/**
 * Formats a financial year for display (e.g., "2026-27 (Current)")
 */
export function formatFYLabel(fyLabel: string): string {
  const currentFY = getFinancialYear();
  if (fyLabel === currentFY) {
    return `${fyLabel} (Current)`;
  }
  return fyLabel;
}

/**
 * Gets a list of financial years for selection
 */
export function getFYList(startYear: number = 2024): string[] {
  const currentFY = getFinancialYear();
  const [currentYearStr] = currentFY.split('-');
  const currentYear = parseInt(currentYearStr);
  
  const list: string[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    const label = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
    list.push(label);
  }
  return list;
}

/**
 * Formats a YYYY-MM-DD date to dd/mm/yyyy
 */
export function formatDateToDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

/**
 * Parses a dd/mm/yyyy date to YYYY-MM-DD
 */
export function parseDisplayDate(displayDate: string): string {
  const parts = displayDate.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    // Basic validation
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}
