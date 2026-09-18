import React, { useState, useMemo } from 'react';
import {
  Calendar,
  DollarSign,
  ShoppingBag,
  Eye,
  Clock,
  Download,
  Percent,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
} from 'lucide-react';
import { LiveSession, Streamer } from '../../types';
import { getJakartaDate } from '../../utils/shiftLogic';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  formatDateID,
  safeDivide,
} from '../../utils/formatters';
import { calculateGrowth } from '../../utils/dateFilters';
import { exportToPDF, exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { deleteLiveSession } from '../../services/firestoreService';

interface DailyReportViewProps {
  sessions: LiveSession[];
  streamers: Streamer[];
  onOpenEditModal: (session: LiveSession) => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  sessions,
  streamers,
  onOpenEditModal,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const todayStr = getJakartaDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filter Sessions for selected Date
  const daySessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate === selectedDate);
  }, [sessions, selectedDate]);

  // Yesterday date & sessions for comparison
  const { yesterdaySessions, yesterdayDateStr } = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    const prevY = prev.getFullYear();
    const prevM = String(prev.getMonth() + 1).padStart(2, '0');
    const prevD = String(prev.getDate()).padStart(2, '0');
    const pStr = `${prevY}-${prevM}-${prevD}`;
    return {
      yesterdayDateStr: pStr,
      yesterdaySessions: sessions.filter((s) => s.businessDate === pStr),
    };
  }, [sessions, selectedDate]);

  // Daily Aggregate Calculations
  const dailyKpis = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let chk = 0;
    let prods = 0;
    let hrs = 0;

    daySessions.forEach((s) => {
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
      sessionsCount: daySessions.length,
    };
  }, [daySessions]);

  // Yesterday Totals
  const yesterdayRevenue = useMemo(() => {
    return yesterdaySessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  }, [yesterdaySessions]);

  const revGrowth = calculateGrowth(dailyKpis.revenue, yesterdayRevenue);

  // Shift Breakdown
  const shiftBreakdown = useMemo(() => {
    const shifts = [
      { id: 'shift-1', name: 'Shift 1 (06:00 - 15:00)' },
      { id: 'shift-2', name: 'Shift 2 (12:00 - 21:00)' },
      { id: 'shift-3', name: 'Shift 3 (21:00 - 06:00)' },
    ];

    return shifts.map((sh) => {
      const sMatches = daySessions.filter((s) => s.shiftId === sh.id);
      const rev = sMatches.reduce((sum, x) => sum + (x.revenue || 0), 0);
      const ord = sMatches.reduce((sum, x) => sum + (x.orders || 0), 0);
      const vw = sMatches.reduce((sum, x) => sum + (x.viewers || 0), 0);
      const streamers = sMatches.map((x) => x.streamerName).join(', ') || 'Belum ada sesi';

      return {
        id: sh.id,
        name: sh.name,
        revenue: rev,
        orders: ord,
        viewers: vw,
        streamers,
        hasSession: sMatches.length > 0,
      };
    });
  }, [daySessions]);

  // Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      'Shift',
      'Streamer',
      'Jam Live',
      'Durasi',
      'Viewers',
      'Checkout',
      'Orders',
      'Produk Terjual',
      'Gross Revenue (IDR)',
      'Conversion Rate',
      'AOV (IDR)',
    ];

    const rows = daySessions.map((s) => [
      s.shiftName,
      s.streamerName,
      `${s.startTime} - ${s.endTime}`,
      `${s.durationHours} Jam`,
      s.viewers,
      s.checkout,
      s.orders,
      s.productsSold,
      s.revenue,
      `${s.conversionRate}%`,
      s.averageOrderValue,
    ]);

    const summaryKpis = [
      { label: 'Tanggal Laporan', value: formatDateID(selectedDate) },
      { label: 'Total Omset Harian', value: formatIDR(dailyKpis.revenue) },
      { label: 'Pertumbuhan vs Kemarin', value: `${revGrowth.growthPct}%` },
      { label: 'Total Orders', value: formatNumber(dailyKpis.orders) },
      { label: 'Total Viewers', value: formatNumber(dailyKpis.viewers) },
      { label: 'Conversion Rate', value: formatPercent(dailyKpis.conversionRate) },
      { label: 'AOV', value: formatIDR(dailyKpis.averageOrderValue) },
    ];

    const payload = {
      title: `Laporan Harian LiveStream (${selectedDate})`,
      periodDescription: formatDateID(selectedDate),
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: `Daily_Report_${selectedDate}`,
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus sesi live ${name}?`)) {
      await deleteLiveSession(id, name, currentUser?.displayName || 'Admin', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Picker */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Laporan Harian (Daily Report)
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Rincian seluruh sesi live stream Shopee pada satu hari kalender bisnis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-slate-600 font-bold">Pilih Tanggal:</span>
              <input
                type="date"
                id="daily-date-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-orange-500" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* DAILY KPI METRICS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Omset Harian</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <DollarSign className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(dailyKpis.revenue)}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span
              className={`font-bold ${
                revGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {revGrowth.growthPct > 0 ? `+${revGrowth.growthPct}%` : `${revGrowth.growthPct}%`}
            </span>
            <span className="text-slate-400 font-medium">vs kemarin</span>
          </div>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Orders</span>
            <div className="w-6 h-6 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
              <ShoppingBag className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatNumber(dailyKpis.orders)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Checkout: {dailyKpis.checkout}</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Viewers</span>
            <div className="w-6 h-6 rounded-full clay-sphere-purple flex items-center justify-center text-white">
              <Eye className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatNumber(dailyKpis.viewers)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Unique: {formatNumber(dailyKpis.uniqueViewers)}</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Conversion Rate</span>
            <div className="w-6 h-6 rounded-full clay-sphere-emerald flex items-center justify-center text-white">
              <Percent className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600">
            {formatPercent(dailyKpis.conversionRate)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Orders / Penonton</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">AOV</span>
            <div className="w-6 h-6 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(dailyKpis.averageOrderValue)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Rata-rata Order</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Jam Live</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <Clock className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {dailyKpis.liveHours} Jam
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {formatIDR(dailyKpis.revenuePerHour)}/jam
          </span>
        </div>
      </div>

      {/* SHIFT 1, 2, 3 BREAKDOWN CARDS */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
          Ringkasan Berdasarkan Shift ({formatDateID(selectedDate)})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shiftBreakdown.map((sh) => (
            <div
              key={sh.id}
              className="clay-card p-5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">{sh.name}</span>
                {sh.hasSession ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-lg">
                    Tidak Ada
                  </span>
                )}
              </div>
              <div className="text-lg font-black text-blue-600">{formatIDR(sh.revenue)}</div>
              <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-2 border-t border-slate-100">
                <span>{sh.orders} Orders &bull; {sh.viewers} Views</span>
                <span className="text-slate-700 font-bold truncate max-w-[120px]">
                  {sh.streamers}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DETAILED SESSIONS TABLE */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Daftar Sesi Live ({daySessions.length} Sesi)
            </h3>
            <p className="text-xs text-slate-500 font-medium">Data sesi live stream yang tercatat pada {selectedDate}</p>
          </div>
        </div>

        {daySessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Tidak ada laporan live pada tanggal {selectedDate}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-3.5">Shift & Waktu</th>
                  <th className="py-3 px-3.5">Streamer</th>
                  <th className="py-3 px-3.5">Gross GMV (IDR)</th>
                  <th className="py-3 px-3.5">Orders</th>
                  <th className="py-3 px-3.5">Viewers</th>
                  <th className="py-3 px-3.5">Produk Terjual</th>
                  <th className="py-3 px-3.5">CR (%)</th>
                  <th className="py-3 px-3.5">AOV (IDR)</th>
                  <th className="py-3 px-3.5">Rev/Jam (IDR)</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {daySessions.map((session) => (
                  <tr key={session.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{session.shiftName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {session.startTime} - {session.endTime} ({session.durationHours} jam)
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-700">
                      {session.streamerName}
                    </td>
                    <td className="py-3 px-3.5 font-extrabold text-blue-600">
                      {formatIDR(session.revenue)}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 font-semibold">{formatNumber(session.orders)}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-medium">{formatNumber(session.viewers)}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-medium">{formatNumber(session.productsSold)}</td>
                    <td className="py-3 px-3.5 font-bold text-emerald-600">
                      {formatPercent(session.conversionRate)}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 font-semibold">{formatIDR(session.averageOrderValue)}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-medium">{formatIDR(session.revenuePerHour)}</td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(session)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(session.id, `${session.streamerName} - ${session.shiftName}`)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
