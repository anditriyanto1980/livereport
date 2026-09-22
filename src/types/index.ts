export type UserRole = 'ADMIN' | 'STREAMER';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  streamerId?: string;
  photoURL?: string;
}

export interface Streamer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  avatar?: string;
  joinDate?: string;
  joinedDate?: string;
  notes?: string;
  baseSalary?: number;
  commissionRate?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Shift {
  id: string;
  name: string;
  code: 'SHIFT 1' | 'SHIFT 2' | 'SHIFT 3';
  startTime: string; // "06:00", "12:00", "21:00"
  endTime: string;   // "15:00", "21:00", "06:00"
  durationHours: number; // 9
  isOvernight: boolean; // true for Shift 3
  description?: string;
}

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  streamerId: string;
  streamerName: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Missed' | 'Cancelled';
  hasReport?: boolean;
  reportId?: string;
  notes?: string;
  createdAt?: any;
}

export interface ProductItemSale {
  productId: string;
  productName: string;
  sku?: string;
  price?: number;
  quantity: number;
  revenue: number;
}

export interface LiveSession {
  id: string;
  streamerId: string;
  streamerName: string;
  businessDate: string; // YYYY-MM-DD (start of shift, e.g. Shift 3 21:00 remains start date!)
  shiftId: string;
  shiftName: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  durationHours: number;

  // Traffic
  viewers: number;
  uniqueViewers: number;
  peakViewers: number;
  averageViewers: number;
  newFollowers: number;
  totalFollowers: number;

  // Engagement
  likes: number;
  comments: number;
  shares: number;
  productClicks: number;
  productImpressions: number;

  // Commerce
  checkout: number;
  orders: number;
  productsSold: number;
  revenue: number; // Gross Revenue / GMV
  cancelledOrders: number;
  refundOrders: number;
  refundAmount: number;

  // Optional
  voucherUsed?: number;
  affiliateOrders?: number;
  affiliateRevenue?: number;
  adsSpend?: number;

  // Product sales detail
  productDetails?: ProductItemSale[];

  // Calculated Metrics (stored for indexing and fast analytics)
  conversionRate: number; // Orders / UniqueViewers * 100
  revenuePerHour: number; // Revenue / LiveHours
  ordersPerHour: number;  // Orders / LiveHours
  viewersPerHour: number; // Viewers / LiveHours
  revenuePerViewer: number; // Revenue / Viewers
  averageOrderValue: number; // Revenue / Orders

  // Shopee Wawasan Livestream Specific Metrics
  platform?: 'Shopee' | 'TikTok' | 'Tokopedia' | string;
  orderStatus?: string;
  source?: 'shopee_screenshot_ocr' | 'manual' | string;
  sales?: number; // Mapped to revenue
  activeViewers?: number;
  averageWatchDuration?: number; // In seconds
  commentRate?: number; // Percentage, e.g. 1.0
  salesPer1000Views?: number; // In IDR
  salesPerOrder?: number; // Mapped to averageOrderValue
  clickRate?: number; // Percentage, e.g. 6.7
  ordersPerClick?: number; // Percentage, e.g. 5.7
  buyers?: number;

  notes?: string;
  isDemo?: boolean;

  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface ShopeeConfidenceMap {
  sales: number;
  active_viewers: number;
  comments: number;
  add_to_cart: number;
  views: number;
  average_watch_duration: number;
  comment_rate: number;
  sales_per_1000_views: number;
  orders: number;
  sales_per_order: number;
  viewers: number;
  peak_viewers: number;
  click_rate: number;
  orders_per_click: number;
  buyers: number;
  products_sold: number;
}

export interface ShopeeRawExtractedData {
  platform: string;
  order_status: string | null;
  sales: number | null;
  active_viewers: number | null;
  comments: number | null;
  add_to_cart: number | null;
  views: number | null;
  average_watch_duration: number | null;
  comment_rate: number | null;
  sales_per_1000_views: number | null;
  orders: number | null;
  sales_per_order: number | null;
  viewers: number | null;
  peak_viewers: number | null;
  click_rate: number | null;
  orders_per_click: number | null;
  buyers: number | null;
  products_sold: number | null;
  confidence: ShopeeConfidenceMap;
  extracted_date?: string | null;
  extracted_time?: string | null;
  modelUsed?: string;
  isDemo?: boolean;
}

export type NavTabKey =
  | 'dashboard'
  | 'wawasan-livestream'
  | 'import-livestream'
  | 'input-live'
  | 'analytics'
  | 'daily-report'
  | 'weekly-report'
  | 'monthly-report'
  | 'yearly-report'
  | 'streamer-performance'
  | 'shift-analytics'
  | 'schedules'
  | 'products'
  | 'targets'
  | 'streamers-mgmt'
  | 'audit-logs';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock?: number;
  status: 'active' | 'inactive';
  createdAt?: any;
}

export interface Target {
  id: string;
  type: 'individual' | 'team';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  targetValue: number; // In Rupiah (or orders/viewers)
  metric?: 'revenue' | 'orders' | 'viewers';
  streamerId?: string; // empty if team target
  streamerName?: string;
  year: number;
  month?: number; // 1-12
  startDate?: string;
  endDate?: string;
  actualValue?: number;
  currency?: string;
}

export interface NotificationItem {
  id: string;
  userId: string; // streamerId or 'ALL' or 'ADMIN'
  title: string;
  message: string;
  type: 'shift' | 'reminder' | 'report' | 'target' | 'admin' | 'system';
  read: boolean;
  createdAt: any;
  actionUrl?: string;
}

export interface AuditLog {
  id: string;
  user?: string;
  userName?: string;
  userId?: string;
  action: string;
  record?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  timestamp?: any;
  createdAt?: any;
}

export type DateFilterPreset = 
  | 'today' 
  | 'yesterday' 
  | 'thisWeek' 
  | 'thisMonth' 
  | 'thisYear' 
  | 'custom'
  | 'selectMonth'
  | 'selectYear';

export type MetricRankKey = 
  | 'revenue' 
  | 'orders' 
  | 'productsSold' 
  | 'viewers' 
  | 'conversionRate' 
  | 'revenuePerHour' 
  | 'averageOrderValue';
