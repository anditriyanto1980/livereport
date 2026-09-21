import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Calendar,
  User,
  Filter,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Eye,
  MessageSquare,
  ShoppingCart,
  DollarSign,
  Package,
  PlusCircle,
  HelpCircle,
  Sparkles,
  Info,
  ChevronDown,
  RefreshCw,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Streamer, LiveSession } from '../../types';
import { getJakartaDate } from '../../utils/shiftLogic';
import { formatIDR, formatNumber, formatPercent } from '../../utils/formatters';
import { formatDurationSeconds } from '../../utils/shopeeOcrParser';

interface WawasanLivestreamViewProps {
  streamers: Streamer[];
  sessions: LiveSession[];
  onNavigateTab: (tab: any) => void;
  onRefreshSessions?: () => Promise<void>;
}

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export const WawasanLivestreamView: React.FC<WawasanLivestreamViewProps> = ({
  streamers,
  sessions,
  onNavigateTab,
  onRefreshSessions,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters (Section 19)
  // Smart default: if today has sessions, show 'today'; otherwise if there are sessions, show 'all'
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    const today = getJakartaDate();
    const hasToday = sessions.some((s) => s.businessDate === today);
    if (hasToday) return 'today';
    if (sessions.length > 0) return 'all';
    return 'today';
  });
  const [customStart, setCustomStart] = useState<string>(getJakartaDate());
  const [customEnd, setCustomEnd] = useState<string>(getJakartaDate());

  // Default to 'all' so any uploaded livestream data from any laptop/device is immediately visible
  const [selectedHostId, setSelectedHostId] = useState<string>('all');

  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('all');

  const handleManualSync = async () => {
    if (!onRefreshSessions || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshSessions();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Filter sessions based on criteria
  const filteredSessions = useMemo(() => {
    const today = getJakartaDate();

    // Calculate start & end date strings
    let startDate = today;
    let endDate = today;

    if (datePreset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      startDate = d.toISOString().split('T')[0];
      endDate = startDate;
    } else if (datePreset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
      endDate = today;
    } else if (datePreset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      startDate = d.toISOString().split('T')[0];
      endDate = today;
    } else if (datePreset === 'all') {
      startDate = '2000-01-01';
      endDate = '2099-12-31';
    } else if (datePreset === 'custom') {
      startDate = customStart;
      endDate = customEnd;
    }

    return sessions.filter((s) => {
      // Date filter
      const sessionDate = s.businessDate || s.startTime?.split('T')[0] || '';
      if (datePreset !== 'all' && (sessionDate < startDate || sessionDate > endDate)) {
        return false;
      }

      // Host filter (allows selecting any host or all hosts so all devices stay in sync)
      if (selectedHostId !== 'all') {
        if (s.streamerId !== selectedHostId) return false;
      }

      // Platform filter
      if (selectedPlatform !== 'all') {
        const p = s.platform?.toLowerCase() || 'shopee';
        if (p !== selectedPlatform.toLowerCase()) return false;
      }

      // Order status filter
      if (selectedOrderStatus !== 'all') {
        const st = s.orderStatus?.toLowerCase() || '';
        if (!st.includes(selectedOrderStatus.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    sessions,
    datePreset,
    customStart,
    customEnd,
    selectedHostId,
    selectedPlatform,
    selectedOrderStatus,
  ]);

  // Aggregated 16 KPIs from actual database records (No hardcoding!)
  const aggregatedKpis = useMemo(() => {
    if (filteredSessions.length === 0) {
      return {
        sales: 0,
        active_viewers: 0,
        comments: 0,
        add_to_cart: 0,
        views: 0,
        average_watch_duration: 0,
        comment_rate: 0,
        sales_per_1000_views: 0,
        orders: 0,
        sales_per_order: 0,
        viewers: 0,
        peak_viewers: 0,
        click_rate: 0,
        orders_per_click: 0,
        buyers: 0,
        products_sold: 0,
        session_count: 0,
      };
    }

    let totalSales = 0;
    let totalActiveViewers = 0;
    let totalComments = 0;
    let totalAddToCart = 0;
    let totalViews = 0;
    let totalDurationSeconds = 0;
    let totalOrders = 0;
    let totalViewers = 0;
    let maxPeakViewers = 0;
    let totalBuyers = 0;
    let totalProductsSold = 0;
    let totalClicks = 0;

    filteredSessions.forEach((s) => {
      const salesVal = s.sales || s.revenue || 0;
      totalSales += salesVal;
      totalActiveViewers += s.activeViewers || s.averageViewers || 0;
      totalComments += s.comments || 0;
      totalAddToCart += s.checkout || 0;
      totalViews += s.productImpressions || s.viewers || 0;
      totalDurationSeconds += s.averageWatchDuration || (s.durationMinutes ? s.durationMinutes * 60 : 0);
      totalOrders += s.orders || 0;
      totalViewers += s.viewers || 0;
      if ((s.peakViewers || 0) > maxPeakViewers) maxPeakViewers = s.peakViewers || 0;
      totalBuyers += s.buyers || s.orders || 0;
      totalProductsSold += s.productsSold || 0;
      totalClicks += s.productClicks || Math.round(((s.clickRate || 0) * (s.viewers || 0)) / 100);
    });

    const count = filteredSessions.length;
    const avgDuration = Math.round(totalDurationSeconds / count);
    const commentRate = totalViews > 0 ? (totalComments / totalViews) * 100 : 0;
    const salesPer1000 = totalViews > 0 ? Math.round((totalSales / totalViews) * 1000) : 0;
    const salesPerOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const clickRate = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    const ordersPerClick = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
    const avgActiveViewers = Math.round(totalActiveViewers / count);

    return {
      sales: totalSales,
      active_viewers: avgActiveViewers,
      comments: totalComments,
      add_to_cart: totalAddToCart,
      views: totalViews,
      average_watch_duration: avgDuration,
      comment_rate: Number(commentRate.toFixed(1)),
      sales_per_1000_views: salesPer1000,
      orders: totalOrders,
      sales_per_order: salesPerOrder,
      viewers: totalViewers,
      peak_viewers: maxPeakViewers,
      click_rate: Number(clickRate.toFixed(1)),
      orders_per_click: Number(ordersPerClick.toFixed(1)),
      buyers: totalBuyers,
      products_sold: totalProductsSold,
      session_count: count,
    };
  }, [filteredSessions]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* TOP HEADER & REALTIME CLOUD STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-800 text-xs font-black uppercase tracking-wider">
              <ShoppingBag className="w-3.5 h-3.5" />
              Shopee Live Insight
            </div>
            {/* REALTIME SYNC INDICATOR */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Cloud Realtime Aktif ({sessions.length} Sesi Tersimpan)</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Wawasan Livestream
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dashboard metrik resmi Shopee Live tersinkronisasi otomatis antar semua perangkat & laptop melalui Firebase Cloud.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onRefreshSessions && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isRefreshing}
              title="Perbarui data langsung dari server Firebase"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-600' : ''}`} />
              <span>{isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab('import-livestream')}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-2xl text-xs font-black shadow-[0_4px_14px_rgba(249,115,22,0.35)] transition-all cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Import Screenshot Shopee
          </button>
        </div>
      </div>

      {/* ZERO DATA NOTIFICATION WITH QUICK ACTION IF SESSIONS EXIST IN DATABASE */}
      {filteredSessions.length === 0 && sessions.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tidak ada sesi livestream untuk filter saat ini. Namun ada <strong>{sessions.length} sesi livestream</strong> tersimpan di cloud dari perangkat lain.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDatePreset('all');
              setSelectedHostId('all');
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            Tampilkan Semua Sesi ({sessions.length})
          </button>
        </div>
      )}

      {/* FILTER BAR (Section 19) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Filter className="w-4 h-4 text-orange-500" />
            <span>Filter Wawasan:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['today', 'yesterday', '7days', '30days', 'all', 'custom'] as DatePreset[]).map((p) => {
              const labels: Record<DatePreset, string> = {
                today: 'Hari ini',
                yesterday: 'Kemarin',
                '7days': '7 hari terakhir',
                '30days': '30 hari terakhir',
                all: 'Semua Tanggal',
                custom: 'Kustom Tanggal',
              };
              const active = datePreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDatePreset(p)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Custom Date Inputs */}
          {datePreset === 'custom' && (
            <div className="sm:col-span-2 flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-500">Dari:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800"
              />
              <span className="font-bold text-slate-500">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          )}

          {/* Host Filter - Open for all devices so reports uploaded on any laptop are visible */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
              Host Streamer
            </label>
            <select
              value={selectedHostId}
              onChange={(e) => setSelectedHostId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Host ({streamers.length})</option>
              {streamers.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {currentUser?.streamerId === st.id ? '(Anda)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
              Platform
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
            >
              <option value="all">Semua Platform</option>
              <option value="Shopee">Shopee Live</option>
              <option value="TikTok">TikTok Shop</option>
              <option value="Tokopedia">Tokopedia Live</option>
            </select>
          </div>

          {/* Order Status Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
              Status Pesanan
            </label>
            <select
              value={selectedOrderStatus}
              onChange={(e) => setSelectedOrderStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="Pesanan Siap Dikirim">Pesanan Siap Dikirim</option>
              <option value="Selesai">Selesai</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* SIGNATURE SHOPEE WAWASAN LIVESTREAM ORANGE CARD */}
      <div className="bg-gradient-to-b from-[#ee4d2d] to-[#e03a19] text-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_36px_rgba(238,77,45,0.3)] space-y-6">
        {/* Card Header & Order Status Filter badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">Wawasan Livestream</h2>
              <div className="text-xs text-white/80">
                {filteredSessions.length} sesi livestream terfilter
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 font-medium">Status Pesanan:</span>
            <div className="px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-bold border border-white/30 flex items-center gap-1.5">
              <span>{selectedOrderStatus === 'all' ? 'Pesanan Siap Dikirim' : selectedOrderStatus}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/80" />
            </div>
          </div>
        </div>

        {/* 1. MAIN METRIC: PENJUALAN (RP) */}
        <div className="text-center py-2 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/90">
            <span>Penjualan (Rp)</span>
            <Info className="w-3.5 h-3.5 text-white/70" />
          </div>
          <div className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-xs">
            {formatNumber(aggregatedKpis.sales)}
          </div>
          <div className="text-xs text-white/70">
            Total omset kotor dari sesi livestream
          </div>
        </div>

        {/* 3 SECONDARY METRICS (ACTIVE VIEWERS, COMMENTS, ADD TO CART) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white/10 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-white/20 text-center">
          {/* 2. Penonton Aktif */}
          <div className="space-y-1">
            <div className="text-xs text-white/80 font-medium truncate">Penonton Aktif</div>
            <div className="text-lg sm:text-2xl font-black">
              {formatNumber(aggregatedKpis.active_viewers)}
            </div>
          </div>

          {/* 3. Komentar */}
          <div className="space-y-1 border-x border-white/20 px-2">
            <div className="text-xs text-white/80 font-medium truncate">Komentar</div>
            <div className="text-lg sm:text-2xl font-black">
              {formatNumber(aggregatedKpis.comments)}
            </div>
          </div>

          {/* 4. Tambah ke Keranjang */}
          <div className="space-y-1">
            <div className="text-xs text-white/80 font-medium truncate">Tambah ke Keranjang</div>
            <div className="text-lg sm:text-2xl font-black">
              {formatNumber(aggregatedKpis.add_to_cart)}
            </div>
          </div>
        </div>

        {/* 12 GRID SUB-KPIS IN PURE SHOPEE STYLE */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-2">
          {/* 5. Dilihat */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Dilihat</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.views)}
            </div>
          </div>

          {/* 6. Durasi Rata-Rata Menonton */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Durasi Rata-Rata</div>
            <div className="text-base sm:text-lg font-black">
              {formatDurationSeconds(aggregatedKpis.average_watch_duration)}
            </div>
          </div>

          {/* 7. Persentase Komentar */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">% Komentar</div>
            <div className="text-base sm:text-lg font-black">
              {formatPercent(aggregatedKpis.comment_rate)}
            </div>
          </div>

          {/* 8. Penjualan per mil (Rp) */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Penjualan/mil</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.sales_per_1000_views)}
            </div>
          </div>

          {/* 9. Pesanan */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Pesanan</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.orders)}
            </div>
          </div>

          {/* 10. Nilai Penjualan per Pesanan */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Nilai/Pesanan</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.sales_per_order)}
            </div>
          </div>

          {/* 11. Penonton */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Penonton</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.viewers)}
            </div>
          </div>

          {/* 12. Penonton Tertinggi */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Penonton Tertinggi</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.peak_viewers)}
            </div>
          </div>

          {/* 13. Persentase Klik */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">% Klik</div>
            <div className="text-base sm:text-lg font-black">
              {formatPercent(aggregatedKpis.click_rate)}
            </div>
          </div>

          {/* 14. Pesanan per Klik */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Pesanan/Klik</div>
            <div className="text-base sm:text-lg font-black">
              {formatPercent(aggregatedKpis.orders_per_click)}
            </div>
          </div>

          {/* 15. Pembeli */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Pembeli</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.buyers)}
            </div>
          </div>

          {/* 16. Produk Terjual */}
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/15 space-y-1">
            <div className="text-[11px] text-white/80 font-medium truncate">Produk Terjual</div>
            <div className="text-base sm:text-lg font-black">
              {formatNumber(aggregatedKpis.products_sold)}
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL SESI LIVESTREAM TABLE */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Daftar Sesi Terkait ({filteredSessions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Data sesi yang berkontribusi terhadap perhitungan Wawasan Livestream di atas.
            </p>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">Belum Ada Data Livestream</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tidak ada sesi live yang cocok dengan filter tanggal atau host terpilih. Upload screenshot Shopee untuk mengisi data.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('import-livestream')}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Upload Screenshot Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase border-b border-slate-200">
                  <th className="py-3 px-3">Tanggal / Sesi</th>
                  <th className="py-3 px-3">Host Streamer</th>
                  <th className="py-3 px-3">Status / Platform</th>
                  <th className="py-3 px-3 text-right">Penjualan</th>
                  <th className="py-3 px-3 text-right">Pesanan</th>
                  <th className="py-3 px-3 text-right">Produk</th>
                  <th className="py-3 px-3 text-right">Penonton</th>
                  <th className="py-3 px-3 text-center">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-orange-50/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{s.businessDate}</div>
                      <div className="text-[11px] text-slate-400">
                        {s.startTime} - {s.endTime} ({s.shiftName})
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{s.streamerName}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200">
                        {s.platform || 'Shopee'} &bull; {s.orderStatus || 'Siap Dikirim'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatIDR(s.sales || s.revenue || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">{s.orders || 0}</td>
                    <td className="py-3 px-3 text-right">{s.productsSold || 0}</td>
                    <td className="py-3 px-3 text-right">{formatNumber(s.viewers || 0)}</td>
                    <td className="py-3 px-3 text-center">
                      {s.source === 'shopee_screenshot_ocr' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          AI OCR
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          Manual
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
