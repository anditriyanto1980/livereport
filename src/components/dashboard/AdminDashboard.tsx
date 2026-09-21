import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Eye,
  ShoppingCart,
  Package,
  Clock,
  Percent,
  Calculator,
  Calendar,
  Filter,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Download,
  Plus,
  CheckCircle2,
  Trash2,
  Edit2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { LiveSession, Streamer, Schedule, DateFilterPreset } from '../../types';
import {
  getDateRange,
  filterSessionsByDate,
  getPreviousPeriodRange,
  calculateGrowth,
} from '../../utils/dateFilters';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  formatDateID,
  safeDivide,
  MONTH_NAMES_ID,
} from '../../utils/formatters';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { deleteLiveSession } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface AdminDashboardProps {
  sessions: LiveSession[];
  streamers: Streamer[];
  schedules: Schedule[];
  onOpenNewLiveModal: (sessionToEdit?: LiveSession) => void;
  onNavigateTab: (tab: any) => void;
  onOpenResetModal?: () => void;
}

const COLORS = ['#ea580c', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  sessions,
  streamers,
  schedules,
  onOpenNewLiveModal,
  onNavigateTab,
  onOpenResetModal,
}) => {
  const { currentUser } = useAuth();

  // Date Filter states
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('thisMonth');
  const [customStart, setCustomStart] = useState<string>('2026-09-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-09-30');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9);

  // Dynamic years list based on data and current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2024, 2025, 2026, 2027]);
    sessions.forEach((s) => {
      const yr = Number(s.businessDate?.slice(0, 4));
      if (!isNaN(yr) && yr > 2000) yearsSet.add(yr);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sessions]);

  // Current Date Range calculation
  const dateRange = useMemo(() => {
    return getDateRange(filterPreset, {
      customStart,
      customEnd,
      selectedYear,
      selectedMonth,
    });
  }, [filterPreset, customStart, customEnd, selectedYear, selectedMonth]);

  // Filtered Sessions for Current Period
  const currentSessions = useMemo(() => {
    return filterSessionsByDate(sessions, dateRange.startDate, dateRange.endDate);
  }, [sessions, dateRange]);

  // Previous Period Sessions for Growth calculation
  const prevSessions = useMemo(() => {
    const { prevStart, prevEnd } = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);
    return filterSessionsByDate(sessions, prevStart, prevEnd);
  }, [sessions, dateRange]);

  // KPI Calculations Current
  const currentKpis = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let chk = 0;
    let prods = 0;
    let hrs = 0;

    currentSessions.forEach((s) => {
      rev += s.revenue || 0;
      ord += s.orders || 0;
      vw += s.viewers || 0;
      uVw += s.uniqueViewers || 0;
      chk += s.checkout || 0;
      prods += s.productsSold || 0;
      hrs += s.durationHours || 0;
    });

    const trafficBase = uVw > 0 ? uVw : vw;
    const cr = safeDivide(ord * 100, trafficBase, 0);
    const aov = safeDivide(rev, ord, 0);
    const revPerHour = safeDivide(rev, hrs, 0);

    return {
      revenue: rev,
      orders: ord,
      viewers: vw,
      uniqueViewers: uVw,
      checkout: chk,
      productsSold: prods,
      liveHours: Number(hrs.toFixed(1)),
      conversionRate: Number(cr.toFixed(2)),
      averageOrderValue: Math.round(aov),
      revenuePerHour: Math.round(revPerHour),
      count: currentSessions.length,
    };
  }, [currentSessions]);

  // KPI Calculations Previous for Growth
  const prevKpis = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let chk = 0;
    let prods = 0;
    let hrs = 0;

    prevSessions.forEach((s) => {
      rev += s.revenue || 0;
      ord += s.orders || 0;
      vw += s.viewers || 0;
      uVw += s.uniqueViewers || 0;
      chk += s.checkout || 0;
      prods += s.productsSold || 0;
      hrs += s.durationHours || 0;
    });

    const trafficBase = uVw > 0 ? uVw : vw;
    const cr = safeDivide(ord * 100, trafficBase, 0);
    const aov = safeDivide(rev, ord, 0);

    return {
      revenue: rev,
      orders: ord,
      viewers: vw,
      checkout: chk,
      productsSold: prods,
      liveHours: Number(hrs.toFixed(1)),
      conversionRate: Number(cr.toFixed(2)),
      averageOrderValue: Math.round(aov),
    };
  }, [prevSessions]);

  // Growth percentages
  const revGrowth = calculateGrowth(currentKpis.revenue, prevKpis.revenue);
  const ordGrowth = calculateGrowth(currentKpis.orders, prevKpis.orders);
  const vwGrowth = calculateGrowth(currentKpis.viewers, prevKpis.viewers);
  const chkGrowth = calculateGrowth(currentKpis.checkout, prevKpis.checkout);
  const prodGrowth = calculateGrowth(currentKpis.productsSold, prevKpis.productsSold);
  const hrsGrowth = calculateGrowth(currentKpis.liveHours, prevKpis.liveHours);
  const crGrowth = calculateGrowth(currentKpis.conversionRate, prevKpis.conversionRate);
  const aovGrowth = calculateGrowth(currentKpis.averageOrderValue, prevKpis.averageOrderValue);

  // Pending reports: Schedules that are missed or completed without a live report
  const pendingSchedules = useMemo(() => {
    return schedules.filter((s) => !s.hasReport && (s.status === 'Missed' || s.status === 'Completed'));
  }, [schedules]);

  // Revenue trend by date data for chart
  const revenueTrendData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number; viewers: number }> = {};
    currentSessions.forEach((s) => {
      if (!map[s.businessDate]) {
        map[s.businessDate] = {
          date: s.businessDate.slice(5), // MM-DD
          revenue: 0,
          orders: 0,
          viewers: 0,
        };
      }
      map[s.businessDate].revenue += s.revenue || 0;
      map[s.businessDate].orders += s.orders || 0;
      map[s.businessDate].viewers += s.viewers || 0;
    });

    return Object.keys(map)
      .sort()
      .map((k) => map[k]);
  }, [currentSessions]);

  // Revenue by Streamer data
  const revenueByStreamerData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orders: number }> = {};
    currentSessions.forEach((s) => {
      const name = s.streamerName || 'Unknown';
      if (!map[name]) {
        map[name] = { name, revenue: 0, orders: 0 };
      }
      map[name].revenue += s.revenue || 0;
      map[name].orders += s.orders || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [currentSessions]);

  // Revenue by Shift data
  const revenueByShiftData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; sessions: number }> = {
      'Shift 1': { name: 'Shift 1 (06:00-15:00)', revenue: 0, sessions: 0 },
      'Shift 2': { name: 'Shift 2 (12:00-21:00)', revenue: 0, sessions: 0 },
      'Shift 3': { name: 'Shift 3 (21:00-06:00)', revenue: 0, sessions: 0 },
    };

    currentSessions.forEach((s) => {
      let key = 'Shift 1';
      if (s.shiftName?.includes('2') || s.shiftId?.includes('2')) key = 'Shift 2';
      else if (s.shiftName?.includes('3') || s.shiftId?.includes('3')) key = 'Shift 3';

      map[key].revenue += s.revenue || 0;
      map[key].sessions += 1;
    });

    return Object.values(map);
  }, [currentSessions]);

  // Handle Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      'Tanggal',
      'Streamer',
      'Shift',
      'Durasi (Jam)',
      'Viewer',
      'Checkout',
      'Orders',
      'Produk Terjual',
      'Gross Revenue (IDR)',
      'Conversion Rate',
      'AOV (IDR)',
      'Rev/Jam (IDR)',
    ];

    const rows = currentSessions.map((s) => [
      s.businessDate,
      s.streamerName,
      s.shiftName,
      s.durationHours,
      s.viewers,
      s.checkout,
      s.orders,
      s.productsSold,
      s.revenue,
      `${s.conversionRate}%`,
      s.averageOrderValue,
      s.revenuePerHour,
    ]);

    const summaryKpis = [
      { label: 'Total Revenue', value: formatIDR(currentKpis.revenue) },
      { label: 'Total Orders', value: formatNumber(currentKpis.orders) },
      { label: 'Total Viewers', value: formatNumber(currentKpis.viewers) },
      { label: 'Products Sold', value: formatNumber(currentKpis.productsSold) },
      { label: 'Conversion Rate', value: formatPercent(currentKpis.conversionRate) },
      { label: 'AOV', value: formatIDR(currentKpis.averageOrderValue) },
    ];

    const payload = {
      title: 'Laporan Eksekutif LiveStream Performance',
      periodDescription: dateRange.label,
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: 'Admin_Dashboard_Report',
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  const handleDeleteSession = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus laporan sesi live ${name}?`)) {
      await deleteLiveSession(id, name, currentUser?.displayName || 'Admin', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* 3D NOTEBOOK BINDER COVER HERO CARD (Directly matching image.png) */}
      <div className="relative clay-card-blue p-6 sm:p-8 text-white space-y-6 overflow-hidden">
        {/* Layered paper / binder corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[4rem] pointer-events-none -mr-4 -mt-4 blur-xs" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header: Title & AI+ Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                Shopee Live Report
              </h1>
              <div className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-[11px] font-black tracking-wider text-cyan-200 shadow-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                <span>AI+</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-blue-100/90 font-medium mt-1">
              AI-Powered Performance Analysis &bull; Shopee Live Executive Dashboard
            </p>
          </div>

          {/* Export & Quick Actions */}
          <div className="flex items-center gap-2">
            {onOpenResetModal && (
              <button
                type="button"
                onClick={onOpenResetModal}
                title="Reset Database Menjadi 0 Data (Khusus Admin Berkata Sandi)"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-100 hover:text-white bg-rose-600/80 hover:bg-rose-600 border border-rose-400/50 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span className="hidden xs:inline">Reset ke 0</span>
              </button>
            )}
            <button
              type="button"
              id="admin-export-pdf-btn"
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-blue-50 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              id="admin-export-excel-btn"
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-blue-50 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              id="admin-add-report-btn"
              onClick={() => onOpenNewLiveModal()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-xl shadow-[0_4px_12px_rgba(249,115,22,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Live</span>
            </button>
          </div>
        </div>

        {/* Profile Card & Radial Performance Score Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
          {/* 3D Profile Card */}
          <div className="md:col-span-2 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-inner">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-white/20 flex items-center justify-center text-2xl font-black text-white">
                  {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-cyan-400 text-blue-950 p-1 rounded-full border-2 border-white shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {currentUser?.displayName || 'Admin Executive Shopee'}
                </h3>
                <span className="px-2 py-0.5 bg-white/20 text-cyan-200 text-[10px] font-extrabold rounded-md uppercase">
                  Verified
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-blue-100/80">
                <span>ID: #SL-2026-HQ</span>
                <span>Role: Executive Manager</span>
                <span>Total Sesi: {currentKpis.count} Live</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-semibold text-emerald-300">
                  Sistem Real-Time Monitoring Aktif
                </span>
              </div>
            </div>
          </div>

          {/* 3D Circular Performance Gauge Card (Matching Health Score from screenshot) */}
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Performance Score
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  94
                </span>
                <span className="text-xs font-bold text-cyan-200">Excellent</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+8.5% vs bulan lalu</span>
              </div>
            </div>

            {/* Circular Gauge Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/20"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  strokeDasharray="94, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-white">94%</span>
            </div>
          </div>
        </div>

        {/* 4 3D Mini Stat Pills (Matching Heart Rate, Blood Sugar, Oxygen, Steps) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          {/* Stat 1: GMV / Revenue */}
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-pink flex items-center justify-center text-white shrink-0">
              <DollarSign className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Total GMV</div>
              <div className="text-sm font-black text-white truncate">
                {formatIDR(currentKpis.revenue)}
              </div>
            </div>
          </div>

          {/* Stat 2: Orders */}
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-cyan flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Total Orders</div>
              <div className="text-sm font-black text-white truncate">
                {formatNumber(currentKpis.orders)} <span className="text-[10px] font-semibold">pesanan</span>
              </div>
            </div>
          </div>

          {/* Stat 3: Viewers */}
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-emerald flex items-center justify-center text-white shrink-0">
              <Eye className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Total Viewers</div>
              <div className="text-sm font-black text-white truncate">
                {formatNumber(currentKpis.viewers)} <span className="text-[10px] font-semibold">mata</span>
              </div>
            </div>
          </div>

          {/* Stat 4: Products Sold */}
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-purple flex items-center justify-center text-white shrink-0">
              <Package className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Produk Terjual</div>
              <div className="text-sm font-black text-white truncate">
                {formatNumber(currentKpis.productsSold)} <span className="text-[10px] font-semibold">pcs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Big Trend Chart & AI Insights Row (Inside the Blue Cover like screenshot) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
          {/* Live Performance Trend Chart */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Tren Penjualan Live</span>
                  <span className="px-2 py-0.5 text-[9px] bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 rounded-full">
                    {dateRange.label}
                  </span>
                </h4>
                <p className="text-[11px] text-blue-100">Fluktuasi omset harian sesi live Shopee</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-cyan-300">
                  {formatIDR(currentKpis.revenue)}
                </span>
              </div>
            </div>

            <div className="h-52 w-full">
              {revenueTrendData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-blue-200">
                  Belum ada data di rentang tanggal ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#93c5fd" fontSize={10} />
                    <YAxis
                      stroke="#93c5fd"
                      fontSize={10}
                      tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Jt`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e3a8a',
                        borderColor: '#60a5fa',
                        color: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                      }}
                      formatter={(val: any) => [formatIDR(Number(val)), 'Omset']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#ffffff', stroke: '#06b6d4', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#22d3ee' }}
                      fillOpacity={1}
                      fill="url(#heroRevGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* AI Insights Card (Styled like the 3D Brain AI Card in screenshot) */}
          <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-xl border border-white/25 rounded-2xl p-5 flex flex-col justify-between shadow-inner">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">AI Insights</h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/10 text-cyan-200 rounded-full">
                  Live Coach
                </span>
              </div>

              <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/10">
                <p className="text-xs text-blue-50 leading-relaxed font-medium">
                  {currentKpis.conversionRate > 2
                    ? `Performa tim sangat memuaskan dengan Conversion Rate ${formatPercent(currentKpis.conversionRate)}. Host live paling efektif di Shift 2 & 3 dengan rata-rata omset ${formatIDR(currentKpis.revenuePerHour)}/jam.`
                    : 'Tingkatkan interaksi audiens pada 15 menit awal sesi live untuk mendongkrak Conversion Rate & Checkout keranjang oranye.'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100">
              <span>Rekomendasi Host:</span>
              <button
                type="button"
                onClick={() => onNavigateTab('streamer-performance')}
                className="font-bold text-cyan-300 hover:text-white flex items-center gap-1"
              >
                <span>Lihat Leaderboard</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Actions Bottom Porcelain Clay Bar (Matching screenshot's bottom bar) */}
        <div className="clay-card p-3 sm:p-4 text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Aksi Cepat:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenNewLiveModal()}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 shadow-xs transition-all active:scale-95"
            >
              <div className="w-5 h-5 rounded-full clay-sphere-orange flex items-center justify-center text-white">
                <Plus className="w-3 h-3" />
              </div>
              <span>Input Live</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('schedules')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 shadow-xs transition-all active:scale-95"
            >
              <div className="w-5 h-5 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
                <Clock className="w-3 h-3" />
              </div>
              <span>Jadwal Shift</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('targets')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 shadow-xs transition-all active:scale-95"
            >
              <div className="w-5 h-5 rounded-full clay-sphere-emerald flex items-center justify-center text-white">
                <TrendingUp className="w-3 h-3" />
              </div>
              <span>Target Bulan Ini</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 shadow-xs transition-all active:scale-95"
            >
              <div className="w-5 h-5 rounded-full clay-sphere-purple flex items-center justify-center text-white">
                <Sparkles className="w-3 h-3" />
              </div>
              <span>10 Charts Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* GLOBAL DATE FILTER BAR IN CLAY CARD */}
      <div className="clay-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Rentang Waktu Analisis:</span>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Periode: <strong className="text-blue-600 font-bold">{dateRange.label}</strong> ({dateRange.startDate} s/d {dateRange.endDate}) &bull; {currentKpis.count} Sesi Live
          </div>
        </div>

        {/* Global Date Filter Presets */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {[
            { key: 'today' as DateFilterPreset, label: 'Hari Ini' },
            { key: 'yesterday' as DateFilterPreset, label: 'Kemarin' },
            { key: 'thisWeek' as DateFilterPreset, label: 'Minggu Ini' },
            { key: 'thisMonth' as DateFilterPreset, label: 'Bulan Ini' },
            { key: 'thisYear' as DateFilterPreset, label: 'Tahun Ini' },
            { key: 'selectMonth' as DateFilterPreset, label: 'Pilih Bulan' },
            { key: 'selectYear' as DateFilterPreset, label: 'Pilih Tahun' },
            { key: 'custom' as DateFilterPreset, label: 'Custom Tanggal' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              id={`filter-preset-${item.key}`}
              onClick={() => setFilterPreset(item.key)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                filterPreset === item.key
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]'
                  : 'bg-white text-slate-600 hover:bg-blue-50/70 hover:text-blue-700 border border-slate-200/90 shadow-xs'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Extended controls for Select Month / Select Year / Custom Date */}
        {filterPreset === 'selectMonth' && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Pilih Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-xs"
              >
                {MONTH_NAMES_ID.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-xs"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {filterPreset === 'selectYear' && (
          <div className="flex items-center gap-3 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs">
            <span className="text-slate-600 font-semibold">Pilih Tahun Analitik:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-sm shadow-xs"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 italic">
              *Tahun bersifat dinamis sesuai data Firestore
            </span>
          </div>
        )}

        {filterPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Dari:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* PENDING REPORTS ALERT */}
      {pendingSchedules.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                Peringatan: {pendingSchedules.length} Sesi Shift Belum Memiliki Laporan Live!
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Ada jadwal live yang sudah selesai tetapi streamer belum menginput metrik Shopee Live.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="view-pending-schedules-btn"
            onClick={() => onNavigateTab('schedules')}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs self-start sm:self-center transition-all active:scale-95"
          >
            Lihat Jadwal Tertunda
          </button>
        </div>
      )}

      {/* 8 KPI CARDS WITH GROWTH COMPARISON IN CLAY CARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Total Revenue / GMV
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-orange text-white flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatIDR(currentKpis.revenue)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  revGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {revGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {revGrowth.growthPct > 0 ? `+${revGrowth.growthPct}%` : `${revGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">vs periode lalu</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              2. Total Orders
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-cyan text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatNumber(currentKpis.orders)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  ordGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {ordGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {ordGrowth.growthPct > 0 ? `+${ordGrowth.growthPct}%` : `${ordGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">vs periode lalu</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Viewers */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              3. Total Viewers
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-emerald text-white flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatNumber(currentKpis.viewers)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  vwGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {vwGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {vwGrowth.growthPct > 0 ? `+${vwGrowth.growthPct}%` : `${vwGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">
                Unique: {formatNumber(currentKpis.uniqueViewers)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Total Checkout */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              4. Total Checkout
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-purple text-white flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatNumber(currentKpis.checkout)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  chkGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {chkGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {chkGrowth.growthPct > 0 ? `+${chkGrowth.growthPct}%` : `${chkGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">Keranjang oranye</span>
            </div>
          </div>
        </div>

        {/* KPI 5: Products Sold */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              5. Products Sold
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-pink text-white flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatNumber(currentKpis.productsSold)} <span className="text-xs font-normal text-slate-500">pcs</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  prodGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {prodGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {prodGrowth.growthPct > 0 ? `+${prodGrowth.growthPct}%` : `${prodGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">Barang terkirim</span>
            </div>
          </div>
        </div>

        {/* KPI 6: Live Hours */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              6. Live Hours
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-orange text-white flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {currentKpis.liveHours} <span className="text-xs font-normal text-slate-500">Jam</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  hrsGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {hrsGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {hrsGrowth.growthPct > 0 ? `+${hrsGrowth.growthPct}%` : `${hrsGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">
                Rev/Jam: {formatIDR(currentKpis.revenuePerHour)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 7: Conversion Rate */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              7. Conversion Rate
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-emerald text-white flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              {formatPercent(currentKpis.conversionRate)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  crGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {crGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {crGrowth.growthPct > 0 ? `+${crGrowth.growthPct}%` : `${crGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">Orders / Viewer</span>
            </div>
          </div>
        </div>

        {/* KPI 8: Average Order Value (AOV) */}
        <div className="clay-card p-5 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              8. Average Order Value
            </span>
            <div className="w-9 h-9 rounded-xl clay-sphere-cyan text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatIDR(currentKpis.averageOrderValue)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  aovGrowth.isPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {aovGrowth.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {aovGrowth.growthPct > 0 ? `+${aovGrowth.growthPct}%` : `${aovGrowth.growthPct}%`}
              </span>
              <span className="text-[11px] text-slate-400">Revenue / Orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Revenue Trend (Area Chart) in Clay Card */}
        <div className="lg:col-span-2 clay-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Tren Omset Harian (Revenue Trend)
              </h3>
              <p className="text-xs text-slate-500">Perkembangan omset live per hari di periode terpilih</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
              Total: {formatIDR(currentKpis.revenue)}
            </span>
          </div>

          <div className="h-64 w-full">
            {revenueTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Tidak ada data pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Jt`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                    formatter={(val: any) => [formatIDR(Number(val)), 'Omset']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue by Shift (Donut Chart) in Clay Card */}
        <div className="clay-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Kontribusi Per Shift
            </h3>
            <p className="text-xs text-slate-500">Perbandingan Shift 1, Shift 2, & Shift 3</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueByShiftData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {revenueByShiftData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                  formatter={(val: any) => [formatIDR(Number(val)), 'Omset']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            {revenueByShiftData.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-slate-600 font-medium">{s.name}</span>
                </div>
                <span className="font-bold text-slate-900">{formatIDR(s.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP STREAMERS PREVIEW & RECENT LIVE SESSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Streamers Performance Card in Clay Card */}
        <div className="clay-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Peringkat Streamer
            </h3>
            <button
              type="button"
              id="view-all-streamers-btn"
              onClick={() => onNavigateTab('streamer-performance')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
            >
              <span>Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {revenueByStreamerData.map((st, idx) => {
              const pct = safeDivide(st.revenue * 100, currentKpis.revenue, 0);
              return (
                <div key={idx} className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{st.name}</span>
                    </div>
                    <span className="text-xs font-extrabold text-blue-600">
                      {formatIDR(st.revenue)}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{st.orders} Orders</span>
                    <span>{pct.toFixed(1)}% Kontribusi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Live Sessions Table in Clay Card */}
        <div className="lg:col-span-2 clay-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Daftar Sesi Live Terbaru ({currentSessions.length})
              </h3>
              <p className="text-xs text-slate-500">Rincian sesi live stream Shopee yang telah tercatat</p>
            </div>
            <button
              type="button"
              id="view-daily-report-btn"
              onClick={() => onNavigateTab('daily-report')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
            >
              <span>Laporan Lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 font-bold">Tanggal & Shift</th>
                  <th className="py-3 px-3.5 font-bold">Streamer</th>
                  <th className="py-3 px-3.5 font-bold">Revenue (GMV)</th>
                  <th className="py-3 px-3.5 font-bold">Orders</th>
                  <th className="py-3 px-3.5 font-bold">Viewers</th>
                  <th className="py-3 px-3.5 font-bold">Conversion</th>
                  <th className="py-3 px-3.5 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentSessions.slice(0, 6).map((session) => (
                  <tr key={session.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">{session.businessDate}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{session.shiftName}</div>
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-slate-700">
                      {session.streamerName}
                      {session.isDemo && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-blue-50 text-blue-600 border border-blue-200 rounded font-bold">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-extrabold text-blue-600">
                      {formatIDR(session.revenue)}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 font-semibold">{formatNumber(session.orders)}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-semibold">{formatNumber(session.viewers)}</td>
                    <td className="py-3 px-3.5 text-emerald-600 font-bold">
                      {formatPercent(session.conversionRate)}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenNewLiveModal(session)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Laporan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session.id, `${session.streamerName} - ${session.businessDate}`)}
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
