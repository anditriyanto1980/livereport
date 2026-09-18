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
  Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { LiveSession } from '../../types';
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

interface WeeklyReportViewProps {
  sessions: LiveSession[];
}

const DAY_NAMES_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({ sessions }) => {
  const todayStr = getJakartaDate();
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);

  // Compute Monday & Sunday for selected reference date
  const { weekStartStr, weekEndStr, daysArray, prevWeekStartStr, prevWeekEndStr } = useMemo(() => {
    const [y, m, d] = referenceDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const day = curr.getDay(); // 0 is Sun, 1 is Mon
    const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);

    const mon = new Date(curr.setDate(diffToMon));
    const days: { dateStr: string; dayName: string; dayIndex: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const dt = new Date(mon);
      dt.setDate(dt.getDate() + i);
      const dy = dt.getFullYear();
      const dm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      days.push({
        dateStr: `${dy}-${dm}-${dd}`,
        dayName: DAY_NAMES_ID[i],
        dayIndex: i,
      });
    }

    const start = days[0].dateStr;
    const end = days[6].dateStr;

    // Previous week
    const pMon = new Date(mon);
    pMon.setDate(pMon.getDate() - 7);
    const pSun = new Date(pMon);
    pSun.setDate(pSun.getDate() + 6);

    const formatD = (date: Date) => {
      const yy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const ddd = String(date.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${ddd}`;
    };

    return {
      weekStartStr: start,
      weekEndStr: end,
      daysArray: days,
      prevWeekStartStr: formatD(pMon),
      prevWeekEndStr: formatD(pSun),
    };
  }, [referenceDate]);

  // Current Week Sessions
  const currentWeekSessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate >= weekStartStr && s.businessDate <= weekEndStr);
  }, [sessions, weekStartStr, weekEndStr]);

  // Previous Week Sessions
  const prevWeekSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.businessDate >= prevWeekStartStr && s.businessDate <= prevWeekEndStr
    );
  }, [sessions, prevWeekStartStr, prevWeekEndStr]);

  // Weekly Aggregates
  const currentSummary = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let prods = 0;
    let hrs = 0;

    currentWeekSessions.forEach((s) => {
      rev += s.revenue || 0;
      ord += s.orders || 0;
      vw += s.viewers || 0;
      uVw += s.uniqueViewers || 0;
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
      productsSold: prods,
      liveHours: Number(hrs.toFixed(1)),
      conversionRate: Number(cr.toFixed(2)),
      averageOrderValue: Math.round(aov),
      count: currentWeekSessions.length,
    };
  }, [currentWeekSessions]);

  // Prev Week Revenue
  const prevWeekRevenue = useMemo(() => {
    return prevWeekSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  }, [prevWeekSessions]);

  const revGrowth = calculateGrowth(currentSummary.revenue, prevWeekRevenue);

  // Day by day table data
  const dayByDayData = useMemo(() => {
    return daysArray.map((day) => {
      const match = currentWeekSessions.filter((s) => s.businessDate === day.dateStr);

      let rev = 0;
      let ord = 0;
      let vw = 0;
      let prods = 0;
      let hrs = 0;

      match.forEach((s) => {
        rev += s.revenue || 0;
        ord += s.orders || 0;
        vw += s.viewers || 0;
        prods += s.productsSold || 0;
        hrs += s.durationHours || 0;
      });

      const cr = safeDivide(ord * 100, vw, 0);

      return {
        dateStr: day.dateStr,
        dayName: day.dayName,
        label: `${day.dayName} (${day.dateStr.slice(5)})`,
        revenue: rev,
        orders: ord,
        viewers: vw,
        productsSold: prods,
        hours: hrs,
        conversionRate: Number(cr.toFixed(2)),
        sessionsCount: match.length,
      };
    });
  }, [daysArray, currentWeekSessions]);

  // Best day of the week
  const bestDay = useMemo(() => {
    const active = dayByDayData.filter((d) => d.revenue > 0);
    if (active.length === 0) return null;
    return active.reduce((max, d) => (d.revenue > max.revenue ? d : max), active[0]);
  }, [dayByDayData]);

  // Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      'Hari',
      'Tanggal',
      'Sesi Live',
      'Omset (IDR)',
      'Orders',
      'Viewers',
      'Produk Terjual',
      'Conversion Rate',
    ];

    const rows = dayByDayData.map((d) => [
      d.dayName,
      d.dateStr,
      d.sessionsCount,
      d.revenue,
      d.orders,
      d.viewers,
      d.productsSold,
      `${d.conversionRate}%`,
    ]);

    const summaryKpis = [
      { label: 'Periode Minggu', value: `${weekStartStr} s/d ${weekEndStr}` },
      { label: 'Total Omset Mingguan', value: formatIDR(currentSummary.revenue) },
      { label: 'Pertumbuhan vs Minggu Lalu', value: `${revGrowth.growthPct}%` },
      { label: 'Total Orders', value: formatNumber(currentSummary.orders) },
      { label: 'Total Viewers', value: formatNumber(currentSummary.viewers) },
      { label: 'Hari Terlaris', value: bestDay ? `${bestDay.dayName} (${formatIDR(bestDay.revenue)})` : '-' },
    ];

    const payload = {
      title: `Laporan Mingguan LiveStream (${weekStartStr} - ${weekEndStr})`,
      periodDescription: `${weekStartStr} s/d ${weekEndStr}`,
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: `Weekly_Report_${weekStartStr}`,
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header & Week Selector */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Laporan Mingguan (Weekly Report)
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Periode: <strong className="text-orange-600 font-bold">{weekStartStr}</strong> s/d{' '}
                <strong className="text-orange-600 font-bold">{weekEndStr}</strong> &bull; Performa 7 hari (Senin - Minggu)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-slate-600 font-bold">Pilih Tanggal:</span>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
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

      {/* WEEKLY KPI SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Omset Minggu Ini</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(currentSummary.revenue)}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span
              className={`font-bold ${
                revGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {revGrowth.growthPct > 0 ? `+${revGrowth.growthPct}%` : `${revGrowth.growthPct}%`}
            </span>
            <span className="text-slate-400 font-medium">vs minggu lalu</span>
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
            {formatNumber(currentSummary.orders)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Pesanan Masuk</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Viewers</span>
            <div className="w-6 h-6 rounded-full clay-sphere-purple flex items-center justify-center text-white">
              <Eye className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatNumber(currentSummary.viewers)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Penonton Live</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Produk Terjual</span>
            <div className="w-6 h-6 rounded-full clay-sphere-emerald flex items-center justify-center text-white">
              <Trophy className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatNumber(currentSummary.productsSold)} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Kuantitas Barang</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Conversion Rate</span>
            <div className="w-6 h-6 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
              <Percent className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600">
            {formatPercent(currentSummary.conversionRate)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Orders / Penonton</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">AOV Rata-rata</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(currentSummary.averageOrderValue)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Per Transaksi</span>
        </div>
      </div>

      {/* BEST DAY HIGHLIGHT */}
      {bestDay && (
        <div className="clay-card border-orange-200/90 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/70 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl clay-sphere-orange text-white flex items-center justify-center shrink-0 shadow-xs">
            <Trophy className="w-6 h-6 drop-shadow-xs" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">
              HARI DENGAN OMSET TERTINGGI (BEST DAY OF THE WEEK)
            </span>
            <h4 className="text-base font-extrabold text-slate-800 mt-0.5">
              {bestDay.dayName} ({bestDay.dateStr}) &bull; <span className="text-blue-600">{formatIDR(bestDay.revenue)}</span>
            </h4>
            <p className="text-xs text-slate-600 font-medium">
              Menghasilkan {bestDay.orders} orders dengan conversion rate {bestDay.conversionRate}%.
            </p>
          </div>
        </div>
      )}

      {/* 7-DAY REVENUE BAR CHART */}
      <div className="clay-card p-6 space-y-3">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Grafik Omset 7 Hari (Senin - Minggu)
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayByDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DAY-BY-DAY TABLE */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Tabel Rincian Harian (Senin - Minggu)
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3.5">Hari</th>
                <th className="py-3 px-3.5">Tanggal</th>
                <th className="py-3 px-3.5">Sesi</th>
                <th className="py-3 px-3.5 text-right">Omset (IDR)</th>
                <th className="py-3 px-3.5 text-right">Orders</th>
                <th className="py-3 px-3.5 text-right">Viewers</th>
                <th className="py-3 px-3.5 text-right">Produk (Pcs)</th>
                <th className="py-3 px-3.5 text-right">Conversion (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dayByDayData.map((d, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-slate-800">{d.dayName}</td>
                  <td className="py-3 px-3.5 text-slate-500 font-medium">{d.dateStr}</td>
                  <td className="py-3 px-3.5 text-slate-600 font-medium">{d.sessionsCount} Sesi</td>
                  <td className="py-3 px-3.5 text-right font-extrabold text-blue-600">
                    {formatIDR(d.revenue)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-slate-700 font-semibold">{formatNumber(d.orders)}</td>
                  <td className="py-3 px-3.5 text-right text-slate-600 font-medium">{formatNumber(d.viewers)}</td>
                  <td className="py-3 px-3.5 text-right text-slate-600 font-medium">{formatNumber(d.productsSold)}</td>
                  <td className="py-3 px-3.5 text-right font-bold text-emerald-600">
                    {formatPercent(d.conversionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200">
              <tr>
                <td className="py-3.5 px-3.5 uppercase text-blue-600 font-extrabold" colSpan={3}>
                  TOTAL MINGGU INI
                </td>
                <td className="py-3.5 px-3.5 text-right text-blue-600 font-black text-sm">
                  {formatIDR(currentSummary.revenue)}
                </td>
                <td className="py-3.5 px-3.5 text-right">{formatNumber(currentSummary.orders)}</td>
                <td className="py-3.5 px-3.5 text-right">{formatNumber(currentSummary.viewers)}</td>
                <td className="py-3.5 px-3.5 text-right">{formatNumber(currentSummary.productsSold)}</td>
                <td className="py-3.5 px-3.5 text-right text-emerald-600">
                  {formatPercent(currentSummary.conversionRate)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
