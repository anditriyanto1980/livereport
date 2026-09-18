import { Shift } from '../types';
import { safeDivide } from './formatters';

export const SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    name: 'Shift 1 (Pagi)',
    code: 'SHIFT 1',
    startTime: '06:00',
    endTime: '15:00',
    durationHours: 9,
    isOvernight: false,
    description: '06:00 - 15:00 WIB (9 Jam)',
  },
  {
    id: 'shift-2',
    name: 'Shift 2 (Siang - Sore)',
    code: 'SHIFT 2',
    startTime: '12:00',
    endTime: '21:00',
    durationHours: 9,
    isOvernight: false,
    description: '12:00 - 21:00 WIB (9 Jam)',
  },
  {
    id: 'shift-3',
    name: 'Shift 3 (Malam - Dini Hari)',
    code: 'SHIFT 3',
    startTime: '21:00',
    endTime: '06:00',
    durationHours: 9,
    isOvernight: true,
    description: '21:00 - 06:00 WIB (9 Jam, Melewati Tengah Malam)',
  },
];

/**
 * Calculates live duration in minutes and hours between startTime and endTime.
 * Handles overnight transitions seamlessly (e.g. 21:00 to 06:00).
 */
export function calculateDuration(startTime: string, endTime: string): { durationMinutes: number; durationHours: number } {
  if (!startTime || !endTime) {
    return { durationMinutes: 540, durationHours: 9 };
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return { durationMinutes: 540, durationHours: 9 };
  }

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    // Crosses midnight (e.g., 21:00 to 06:00)
    endMinutes += 24 * 60;
  }

  const durationMinutes = Math.max(0, endMinutes - startMinutes);
  const durationHours = durationMinutes / 60;

  return {
    durationMinutes,
    durationHours: Number(durationHours.toFixed(2)),
  };
}

/**
 * Determine the correct businessDate based on shift start date.
 * CRITICAL RULE: For Shift 3, even if it completes on the next calendar day,
 * the businessDate MUST be the calendar date on which the shift started.
 */
export function determineBusinessDate(startDateStr: string, _shiftCode?: string): string {
  // Always anchor to the date the live started
  return startDateStr;
}

export interface CalculatedMetricsInput {
  revenue: number;
  orders: number;
  viewers: number;
  uniqueViewers: number;
  durationHours: number;
}

export interface CalculatedMetricsOutput {
  averageOrderValue: number;
  conversionRate: number;
  revenuePerHour: number;
  ordersPerHour: number;
  viewersPerHour: number;
  revenuePerViewer: number;
}

/**
 * Computes all calculated metrics strictly according to specifications:
 * - AOV: Revenue / Orders
 * - Conversion Rate: Orders / Unique Viewer * 100 (or Orders / Viewer * 100 if Unique Viewer unavailable)
 * - Revenue Per Hour: Revenue / Live Hours
 * - Orders Per Hour: Orders / Live Hours
 * - Viewer Per Hour: Viewer / Live Hours
 * - Revenue Per Viewer: Revenue / Viewer
 * Never returns NaN or Infinity.
 */
export function calculateLiveMetrics(input: CalculatedMetricsInput): CalculatedMetricsOutput {
  const { revenue, orders, viewers, uniqueViewers, durationHours } = input;
  const liveHours = durationHours > 0 ? durationHours : 1;

  // AOV: Revenue / Orders
  const averageOrderValue = safeDivide(revenue, orders, 0);

  // Conversion Rate: Orders / (Unique Viewer > 0 ? Unique Viewer : Viewer) * 100
  const trafficBase = uniqueViewers > 0 ? uniqueViewers : viewers;
  const conversionRate = safeDivide(orders * 100, trafficBase, 0);

  // Per hour metrics
  const revenuePerHour = safeDivide(revenue, liveHours, 0);
  const ordersPerHour = safeDivide(orders, liveHours, 0);
  const viewersPerHour = safeDivide(viewers, liveHours, 0);

  // Revenue per viewer
  const revenuePerViewer = safeDivide(revenue, viewers, 0);

  return {
    averageOrderValue: Math.round(averageOrderValue),
    conversionRate: Number(conversionRate.toFixed(2)),
    revenuePerHour: Math.round(revenuePerHour),
    ordersPerHour: Number(ordersPerHour.toFixed(1)),
    viewersPerHour: Math.round(viewersPerHour),
    revenuePerViewer: Math.round(revenuePerViewer),
  };
}

/**
 * Returns current Jakarta (WIB) date string YYYY-MM-DD
 */
export function getJakartaDate(): string {
  try {
    const now = new Date();
    // Use Intl to get date in Asia/Jakarta
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now); // returns YYYY-MM-DD
  } catch {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}
