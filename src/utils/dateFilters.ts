import { LiveSession } from '../types';
import { getJakartaDate } from './shiftLogic';

export interface DateFilterRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

/**
 * Generates start and end date based on preset or custom selections in Asia/Jakarta
 */
export function getDateRange(
  preset: string,
  options?: { customStart?: string; customEnd?: string; selectedYear?: number; selectedMonth?: number }
): DateFilterRange {
  const todayStr = getJakartaDate();
  const [currY, currM, currD] = todayStr.split('-').map(Number);
  const today = new Date(currY, currM - 1, currD);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr, label: 'Hari Ini (Today)' };

    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatDateObj(y);
      return { startDate: yStr, endDate: yStr, label: 'Kemarin (Yesterday)' };
    }

    case 'thisWeek': {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return {
        startDate: formatDateObj(monday),
        endDate: formatDateObj(sunday),
        label: 'Minggu Ini (This Week)',
      };
    }

    case 'thisMonth': {
      const firstDay = new Date(currY, currM - 1, 1);
      const lastDay = new Date(currY, currM, 0);
      return {
        startDate: formatDateObj(firstDay),
        endDate: formatDateObj(lastDay),
        label: 'Bulan Ini (This Month)',
      };
    }

    case 'thisYear': {
      return {
        startDate: `${currY}-01-01`,
        endDate: `${currY}-12-31`,
        label: `Tahun Ini (${currY})`,
      };
    }

    case 'selectMonth': {
      const yr = options?.selectedYear || currY;
      const mo = options?.selectedMonth || currM;
      const firstDay = new Date(yr, mo - 1, 1);
      const lastDay = new Date(yr, mo, 0);
      return {
        startDate: formatDateObj(firstDay),
        endDate: formatDateObj(lastDay),
        label: `Bulan ${mo}/${yr}`,
      };
    }

    case 'selectYear': {
      const yr = options?.selectedYear || currY;
      return {
        startDate: `${yr}-01-01`,
        endDate: `${yr}-12-31`,
        label: `Tahun ${yr}`,
      };
    }

    case 'custom':
      return {
        startDate: options?.customStart || todayStr,
        endDate: options?.customEnd || todayStr,
        label: `${options?.customStart} - ${options?.customEnd}`,
      };

    default:
      return { startDate: todayStr, endDate: todayStr, label: 'Hari Ini' };
  }
}

function formatDateObj(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Filter sessions by businessDate range inclusive
 */
export function filterSessionsByDate(
  sessions: LiveSession[],
  startDate: string,
  endDate: string
): LiveSession[] {
  return sessions.filter((s) => {
    return s.businessDate >= startDate && s.businessDate <= endDate;
  });
}

/**
 * Calculate previous date range of equal duration for growth percentage calculation
 */
export function getPreviousPeriodRange(startDate: string, endDate: string): { prevStart: string; prevEnd: string } {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const prevE = new Date(s);
  prevE.setDate(prevE.getDate() - 1);
  const prevS = new Date(prevE);
  prevS.setDate(prevS.getDate() - (diffDays - 1));

  return {
    prevStart: formatDateObj(prevS),
    prevEnd: formatDateObj(prevE),
  };
}

/**
 * Calculate percentage growth: ((current - previous) / previous) * 100
 */
export function calculateGrowth(current: number, previous: number): { growthPct: number; isPositive: boolean } {
  if (!previous || previous === 0) {
    return { growthPct: current > 0 ? 100 : 0, isPositive: current >= 0 };
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  return {
    growthPct: Number(pct.toFixed(1)),
    isPositive: pct >= 0,
  };
}
