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

  notes?: string;
  isDemo?: boolean;

  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

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
