/**
 * Formatting utilities for Indonesian currency, numbers, and dates
 */

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Format currency to IDR: Rp 15.750.000
 */
export function formatIDR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Format standard number with Indonesian thousand separators (e.g., 12.450)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('id-ID').format(Math.round(num));
}

/**
 * Format decimal numbers (e.g. 12.5)
 */
export function formatDecimal(num: number | null | undefined, digits = 1): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

/**
 * Format percentage (e.g. 8.5%)
 */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(digits)}%`;
}

/**
 * Format date string (YYYY-MM-DD) into Indonesian standard date: "18 September 2026"
 */
export function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const monthName = MONTH_NAMES_ID[month - 1] || '';
    return `${day} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format short date (YYYY-MM-DD) to "18 Sep"
 */
export function formatShortDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!month || !day) return dateStr;
    const monthName = MONTH_NAMES_SHORT[month - 1] || '';
    return `${day} ${monthName}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format timestamp to time HH:mm
 */
export function formatTimeID(timeStr: string): string {
  return timeStr || '-';
}

/**
 * Safe division preventing NaN, Infinity, -Infinity, undefined
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || denominator === 0 || !numerator || isNaN(numerator)) {
    return fallback;
  }
  const result = numerator / denominator;
  if (!isFinite(result) || isNaN(result)) {
    return fallback;
  }
  return result;
}

/**
 * Safe string metric display, returns "-" if invalid or zero denominator
 */
export function displayMetric(value: number | string | null | undefined, formatter?: (v: number) => string): string {
  if (value === null || value === undefined || value === '-' || isNaN(Number(value))) {
    return '-';
  }
  const num = Number(value);
  if (!isFinite(num)) return '-';
  if (formatter) return formatter(num);
  return formatNumber(num);
}
