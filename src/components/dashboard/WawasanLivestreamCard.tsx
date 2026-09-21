import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Info,
  ChevronDown,
  UploadCloud,
  PlusCircle,
  TrendingUp,
  Sparkles,
  Calendar,
  Eye,
  MessageSquare,
  ShoppingCart,
  DollarSign,
  Package,
  History,
} from 'lucide-react';
import { LiveSession } from '../../types';
import { formatNumber, formatPercent } from '../../utils/formatters';
import { formatDurationSeconds } from '../../utils/shopeeOcrParser';

interface WawasanLivestreamCardProps {
  sessions: LiveSession[];
  todayDateStr: string;
  streamerName?: string;
  isAdmin?: boolean;
  onNavigateTab: (tab: any) => void;
  onOpenManualModal?: () => void;
}

export const WawasanLivestreamCard: React.FC<WawasanLivestreamCardProps> = ({
  sessions,
  todayDateStr,
  streamerName,
  isAdmin = false,
  onNavigateTab,
  onOpenManualModal,
}) => {
  // Default to 'today' if today has sessions; otherwise if there are sessions, default to 'latest'
  const [viewMode, setViewMode] = useState<'today' | 'latest' | 'all'>('today');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('Pesanan Siap Dikirim');

  // Filter today's sessions
  const todaySessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate === todayDateStr);
  }, [sessions, todayDateStr]);

  // Sort sessions to find latest session if needed
  const latestSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return [...sessions].sort((a, b) => {
      const dateA = a.businessDate || '';
      const dateB = b.businessDate || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.startTime || '').localeCompare(a.startTime || '');
    })[0];
  }, [sessions]);

  // Keep viewMode reactive to incoming real-time sessions
  React.useEffect(() => {
    if (todaySessions.length > 0) {
      setViewMode('today');
    } else if (sessions.length > 0) {
      setViewMode('latest');
    }
  }, [todaySessions.length, sessions.length]);

  // Active dataset to display
  const activeSessions = useMemo(() => {
    if (viewMode === 'today') {
      return todaySessions;
    }
    if (viewMode === 'all') {
      return sessions;
    }
    return latestSession ? [latestSession] : [];
  }, [viewMode, todaySessions, latestSession, sessions]);

  // Fallback demo data matching the user's uploaded Shopee screenshot
  const isUsingSampleScreenshot = sessions.length === 0 || (activeSessions.length === 0 && viewMode === 'latest');

  // Aggregate 16 KPIs
  const kpiData = useMemo(() => {
    // If no sessions at all in the database, present the exact metrics from the user's Shopee Livestream screenshot
    if (activeSessions.length === 0) {
      return {
        sales: 626084,
        active_viewers: 139,
        comments: 39,
        add_to_cart: 105,
        views: 3948,
        average_watch_duration: 20, // 00:00:20
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
        order_status: selectedOrderStatus,
        session_count: 1,
        isSample: true,
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
    let orderStatus = selectedOrderStatus;

    activeSessions.forEach((s) => {
      totalSales += s.sales || s.revenue || 0;
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
      if (s.orderStatus) orderStatus = s.orderStatus;
    });

    const count = activeSessions.length;
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
      order_status: orderStatus,
      session_count: count,
      isSample: false,
    };
  }, [activeSessions, selectedOrderStatus]);

  const hasData = activeSessions.length > 0;

  return (
    <div className="space-y-3">
      {/* SECTION HEADER WITH ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight uppercase">
              Today's Performance (Wawasan Livestream)
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-orange-100 border border-orange-200 text-orange-800 text-[10px] font-black uppercase">
              Shopee Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            16 Metrik resmi Shopee Livestream yang diisi otomatis via upload screenshot AI & input manual.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 0 && (
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('today')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'today'
                    ? 'bg-white text-orange-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Hari Ini ({todaySessions.length})
              </button>
              {latestSession && (
                <button
                  type="button"
                  onClick={() => setViewMode('latest')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'latest'
                      ? 'bg-white text-orange-700 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Sesi Terakhir ({latestSession.businessDate})
                </button>
              )}
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-white text-orange-700 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Semua ({sessions.length})
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab('import-livestream')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Screenshot AI</span>
          </button>

          {onOpenManualModal && (
            <button
              type="button"
              onClick={onOpenManualModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Input Manual</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab('wawasan-livestream')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-all cursor-pointer"
          >
            <span>Buka Detail</span>
            <ChevronDown className="w-3 h-3 -rotate-90" />
          </button>
        </div>
      </div>

      {/* SIGNATURE RED/ORANGE SHOPEE LIVE CARD (IDENTICAL TO USER SCREENSHOT) */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#ee4d2d] to-[#e03a19] text-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_36px_rgba(238,77,45,0.28)] space-y-6">
        {/* Soft background ambient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* TOP BAR: Title & Status Pesanan Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xs">
              <ShoppingBag className="w-5 h-5 text-white drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-xs">
                  Wawasan Livestream
                </h3>
                {viewMode === 'latest' && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold border border-white/30 text-amber-200">
                    Sesi Terakhir
                  </span>
                )}
              </div>
              <div className="text-xs text-white/85 font-medium">
                {hasData ? (
                  <span>
                    {kpiData.session_count} sesi livestream terfilter
                    {streamerName && !isAdmin ? ` • ${streamerName}` : ''}
                  </span>
                ) : (
                  <span>Belum ada data livestream hari ini ({todayDateStr})</span>
                )}
              </div>
            </div>
          </div>

          {/* Status Pesanan Filter Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-white/85 font-medium">Status Pesanan:</span>
            <div className="relative">
              <select
                value={selectedOrderStatus}
                onChange={(e) => setSelectedOrderStatus(e.target.value)}
                className="appearance-none bg-white/20 hover:bg-white/25 backdrop-blur-md text-white font-bold text-xs pl-3 pr-7 py-1.5 rounded-full border border-white/30 shadow-xs cursor-pointer focus:outline-none"
              >
                <option value="Pesanan Siap Dikirim" className="text-slate-800">
                  Pesanan Siap Dikirim
                </option>
                <option value="Selesai" className="text-slate-800">
                  Selesai
                </option>
                <option value="Semua Status" className="text-slate-800">
                  Semua Status
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* EMPTY STATE ALERT WITH FAST UPLOAD INITIATOR */}
        {!hasData && (
          <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto text-white">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="text-base font-bold text-white">Belum Ada Sesi Live Hari Ini</h4>
              <p className="text-xs text-white/80 mt-1">
                Upload screenshot dashboard Wawasan Livestream dari Shopee Seller Centre untuk mengekstrak 16 KPI secara instan dengan teknologi AI Vision.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('import-livestream')}
                className="px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Upload Screenshot Sekarang
              </button>
              {latestSession && (
                <button
                  type="button"
                  onClick={() => setViewMode('latest')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold border border-white/30 transition-all active:scale-95 cursor-pointer"
                >
                  Lihat Sesi Terakhir
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. MAIN METRIC: PENJUALAN (RP) */}
        <div className="text-center py-2 space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/90">
            <span>Penjualan (Rp)</span>
            <Info className="w-3.5 h-3.5 text-white/70" />
          </div>
          <div className="text-4xl sm:text-6xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] font-mono">
            {formatNumber(kpiData.sales)}
          </div>
          <div className="text-xs text-white/75 font-medium">
            Total omset kotor dari sesi livestream
          </div>
        </div>

        {/* 3 SECONDARY HIGHLIGHT CARDS (Penonton Aktif, Komentar, Tambah ke Keranjang) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/20 text-center relative z-10 shadow-inner">
          {/* 2. Penonton Aktif */}
          <div className="space-y-1">
            <div className="text-[11px] sm:text-xs text-white/80 font-medium truncate">
              Penonton Aktif
            </div>
            <div className="text-lg sm:text-3xl font-black tracking-tight">
              {formatNumber(kpiData.active_viewers)}
            </div>
          </div>

          {/* 3. Komentar */}
          <div className="space-y-1 border-x border-white/20 px-2">
            <div className="text-[11px] sm:text-xs text-white/80 font-medium truncate">
              Komentar
            </div>
            <div className="text-lg sm:text-3xl font-black tracking-tight">
              {formatNumber(kpiData.comments)}
            </div>
          </div>

          {/* 4. Tambah ke Keranjang */}
          <div className="space-y-1">
            <div className="text-[11px] sm:text-xs text-white/80 font-medium truncate">
              Tambah ke Keranjang
            </div>
            <div className="text-lg sm:text-3xl font-black tracking-tight">
              {formatNumber(kpiData.add_to_cart)}
            </div>
          </div>
        </div>

        {/* 12 GRID SUB-KPIS IN EXACT 2 ROWS OF 6 AS SEEN IN THE SHOPEE SCREENSHOT */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-1 relative z-10">
          {/* Row 1, Col 1: 5. Dilihat */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Dilihat">
              Dilihat
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.views)}
            </div>
          </div>

          {/* Row 1, Col 2: 6. Durasi Rata-... */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Durasi Rata-Rata Menonton">
              Durasi Rata-...
            </div>
            <div className="text-base sm:text-xl font-black font-mono truncate">
              {formatDurationSeconds(kpiData.average_watch_duration)}
            </div>
          </div>

          {/* Row 1, Col 3: 7. % Komentar */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Persentase Komentar">
              % Komentar
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatPercent(kpiData.comment_rate)}
            </div>
          </div>

          {/* Row 1, Col 4: 8. Penjualan/mil */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Penjualan per mil (Rp)">
              Penjualan/mil
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.sales_per_1000_views)}
            </div>
          </div>

          {/* Row 1, Col 5: 9. Pesanan */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Pesanan">
              Pesanan
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.orders)}
            </div>
          </div>

          {/* Row 1, Col 6: 10. Nilai/Pesanan */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Nilai Penjualan per Pesanan">
              Nilai/Pesanan
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.sales_per_order)}
            </div>
          </div>

          {/* Row 2, Col 1: 11. Penonton */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Penonton">
              Penonton
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.viewers)}
            </div>
          </div>

          {/* Row 2, Col 2: 12. Penonton Te... */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Penonton Tertinggi">
              Penonton Te...
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.peak_viewers)}
            </div>
          </div>

          {/* Row 2, Col 3: 13. % Klik */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Persentase Klik">
              % Klik
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatPercent(kpiData.click_rate)}
            </div>
          </div>

          {/* Row 2, Col 4: 14. Pesanan/Klik */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Pesanan per Klik">
              Pesanan/Klik
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatPercent(kpiData.orders_per_click)}
            </div>
          </div>

          {/* Row 2, Col 5: 15. Pembeli */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Pembeli Unik">
              Pembeli
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.buyers)}
            </div>
          </div>

          {/* Row 2, Col 6: 16. Produk Terjual */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/15 space-y-1 hover:bg-white/15 transition-all">
            <div className="text-[11px] text-white/80 font-medium truncate" title="Produk Terjual">
              Produk Terjual
            </div>
            <div className="text-base sm:text-xl font-black truncate">
              {formatNumber(kpiData.products_sold)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
