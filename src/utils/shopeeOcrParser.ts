import { LiveSession, ShopeeRawExtractedData } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldStatus: Record<string, 'ok' | 'warning' | 'error'>;
  fieldMessages: Record<string, string>;
}

/**
 * Validate extracted Shopee Livestream KPIs according to business logic rules:
 * - sales / orders ≈ sales_per_order
 * - products_sold >= orders
 * - buyers <= orders (in standard Shopee buyer definition)
 * - comment_rate between 0 and 100
 * - click_rate between 0 and 100
 * - orders_per_click between 0 and 100
 * - all non-negative numbers
 */
export function validateShopeeKpis(data: Partial<ShopeeRawExtractedData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldStatus: Record<string, 'ok' | 'warning' | 'error'> = {};
  const fieldMessages: Record<string, string> = {};

  const setStatus = (field: string, status: 'warning' | 'error', msg: string) => {
    fieldStatus[field] = status;
    fieldMessages[field] = msg;
    if (status === 'error') errors.push(msg);
    else warnings.push(msg);
  };

  // 1. Non-negative checks
  const numericFields: (keyof ShopeeRawExtractedData)[] = [
    'sales',
    'active_viewers',
    'comments',
    'add_to_cart',
    'views',
    'average_watch_duration',
    'comment_rate',
    'sales_per_1000_views',
    'orders',
    'sales_per_order',
    'viewers',
    'peak_viewers',
    'click_rate',
    'orders_per_click',
    'buyers',
    'products_sold',
  ];

  numericFields.forEach((key) => {
    const val = data[key];
    if (val !== null && val !== undefined && typeof val === 'number') {
      if (val < 0) {
        setStatus(key as string, 'error', `Nilai ${key} tidak boleh negatif (${val})`);
      } else {
        if (!fieldStatus[key as string]) fieldStatus[key as string] = 'ok';
      }
    }
  });

  const sales = data.sales ?? 0;
  const orders = data.orders ?? 0;
  const productsSold = data.products_sold ?? 0;
  const buyers = data.buyers ?? 0;
  const salesPerOrder = data.sales_per_order ?? 0;
  const commentRate = data.comment_rate ?? 0;
  const clickRate = data.click_rate ?? 0;
  const ordersPerClick = data.orders_per_click ?? 0;

  // 2. Products sold vs orders
  if (productsSold > 0 && orders > 0 && productsSold < orders) {
    setStatus(
      'products_sold',
      'warning',
      `Produk terjual (${productsSold}) lebih sedikit dari jumlah pesanan (${orders}). Biasanya 1 pesanan minimal berisi 1 produk.`
    );
  }

  // 3. Buyers vs orders
  if (buyers > 0 && orders > 0 && buyers > orders) {
    setStatus(
      'buyers',
      'warning',
      `Jumlah pembeli (${buyers}) lebih banyak dari jumlah pesanan (${orders}). Periksa kembali angka screenshot.`
    );
  }

  // 4. Rate bounds (0% to 100%)
  if (commentRate < 0 || commentRate > 100) {
    setStatus('comment_rate', 'error', `Persentase komentar harus antara 0% s/d 100% (terbaca: ${commentRate}%)`);
  }
  if (clickRate < 0 || clickRate > 100) {
    setStatus('click_rate', 'error', `Persentase klik harus antara 0% s/d 100% (terbaca: ${clickRate}%)`);
  }
  if (ordersPerClick < 0 || ordersPerClick > 100) {
    setStatus('orders_per_click', 'error', `Pesanan per klik harus antara 0% s/d 100% (terbaca: ${ordersPerClick}%)`);
  }

  // 5. Mathematical consistency: sales / orders ≈ sales_per_order
  if (orders > 0 && sales > 0 && salesPerOrder > 0) {
    const calculatedAov = sales / orders;
    const diff = Math.abs(calculatedAov - salesPerOrder);
    const diffPct = (diff / salesPerOrder) * 100;
    // Allow up to 15% rounding margin
    if (diffPct > 15) {
      setStatus(
        'sales_per_order',
        'warning',
        `Nilai Penjualan per Pesanan (Rp ${salesPerOrder.toLocaleString('id-ID')}) berselisih ${diffPct.toFixed(1)}% dari Penjualan / Pesanan (Rp ${Math.round(calculatedAov).toLocaleString('id-ID')})`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fieldStatus,
    fieldMessages,
  };
}

/**
 * Format seconds into HH:MM:SS format
 */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Check if a session is likely a duplicate in the database
 */
export function findDuplicateSession(
  candidate: {
    host_id: string;
    session_date: string;
    sales: number;
    orders: number;
    views: number;
    products_sold: number;
  },
  existingSessions: LiveSession[]
): LiveSession | null {
  return (
    existingSessions.find((s) => {
      const sameHost = s.streamerId === candidate.host_id;
      const sameDate = s.businessDate === candidate.session_date;
      const sameSales = Math.abs((s.revenue || 0) - candidate.sales) < 100;
      const sameOrders = (s.orders || 0) === candidate.orders;
      const sameViews = (s.viewers || 0) === candidate.views || (s.productImpressions || 0) === candidate.views;
      const sameProducts = (s.productsSold || 0) === candidate.products_sold;

      return sameHost && sameDate && sameSales && sameOrders && (sameViews || sameProducts);
    }) || null
  );
}

/**
 * Mock reference data matching the exact uploaded user screenshot
 * Used for instant testing and fallback when no network or testing demo mode
 */
export const SAMPLE_SHOPEE_SCREENSHOT_DATA: ShopeeRawExtractedData = {
  platform: 'shopee',
  order_status: 'Pesanan Siap Dikirim',
  sales: 626084,
  active_viewers: 139,
  comments: 39,
  add_to_cart: 105,
  views: 3948,
  average_watch_duration: 20,
  comment_rate: 1.0,
  sales_per_1000_views: 158583,
  orders: 15,
  sales_per_order: 41739,
  viewers: 3341,
  peak_viewers: 32,
  click_rate: 6.7,
  orders_per_click: 5.7,
  buyers: 15,
  products_sold: 25,
  confidence: {
    sales: 0.99,
    active_viewers: 0.98,
    comments: 0.98,
    add_to_cart: 0.98,
    views: 0.98,
    average_watch_duration: 0.95,
    comment_rate: 0.95,
    sales_per_1000_views: 0.95,
    orders: 0.98,
    sales_per_order: 0.98,
    viewers: 0.98,
    peak_viewers: 0.98,
    click_rate: 0.95,
    orders_per_click: 0.95,
    buyers: 0.98,
    products_sold: 0.98,
  },
  extracted_date: '2026-09-21',
  extracted_time: '08:27',
};
