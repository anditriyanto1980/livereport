import React, { useState, useMemo } from 'react';
import {
  Calendar,
  DollarSign,
  ShoppingBag,
  Eye,
  Package,
  Clock,
  Download,
  Percent,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { LiveSession, Target as TargetType } from '../../types';
import { getJakartaDate } from '../../utils/shiftLogic';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  formatDateID,
  safeDivide,
  MONTH_NAMES_ID,
} from '../../utils/formatters';
import { calculateGrowth } from '../../utils/dateFilters';
import { exportToPDF, exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface MonthlyReportViewProps {
  sessions: LiveSession[];
  targets: TargetType[];
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ sessions, targets }) => {
  const todayStr = getJakartaDate();
  const [currY, currM] = todayStr.split('-').map(Number);

  const [selectedYear, setSelectedYear] = useState<number>(currY);
  const [selectedMonth, setSelectedMonth] = useState<number>(currM);

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Previous month prefix
  const { prevMonthPrefix, prevMonthName, prevYearNum } = useMemo(() => {
    let pM = selectedMonth - 1;
    let pY = selectedYear;
    if (pM < 1) {
      pM = 12;
      pY -= 1;
    }
    return {
      prevMonthPrefix: `${pY}-${String(pM).padStart(2, '0')}`,
      prevMonthName: MONTH_NAMES_ID[pM - 1],
      prevYearNum: pY,
    };
  }, [selectedYear, selectedMonth]);

  // Current Month Sessions
  const currentMonthSessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate.startsWith(monthPrefix));
  }, [sessions, monthPrefix]);

  // Previous Month Sessions
  const prevMonthSessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate.startsWith(prevMonthPrefix));
  }, [sessions, prevMonthPrefix]);

  // Current Month Aggregates
  const currentSummary = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let prods = 0;
    let hrs = 0;

    currentMonthSessions.forEach((s) => {
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
      count: currentMonthSessions.length,
    };
  }, [currentMonthSessions]);

  // Prev Month Revenue
  const prevMonthRevenue = useMemo(() => {
    return prevMonthSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  }, [prevMonthSessions]);

  const momGrowth = calculateGrowth(currentSummary.revenue, prevMonthRevenue);

  // Monthly Target
  const monthlyTargetObj = useMemo(() => {
    const t = targets.find(
      (x) =>
        x.period === 'monthly' &&
        x.type === 'team' &&
        x.year === selectedYear &&
        (x.month === selectedMonth || !x.month)
    );
    return t ? t.targetValue : 100000000; // default 100M IDR
  }, [targets, selectedYear, selectedMonth]);

  const targetAchievement = safeDivide(currentSummary.revenue * 100, monthlyTargetObj, 0);

  // Daily Trend in this month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dailyBreakdown = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dNum = i + 1;
      const dStr = `${monthPrefix}-${String(dNum).padStart(2, '0')}`;
      const match = currentMonthSessions.filter((s) => s.businessDate === dStr);

      let rev = 0;
      let ord = 0;
      let vw = 0;

      match.forEach((s) => {
        rev += s.revenue || 0;
        ord += s.orders || 0;
        vw += s.viewers || 0;
      });

      return {
        day: `Tgl ${dNum}`,
        fullDate: dStr,
        revenue: rev,
        orders: ord,
        viewers: vw,
        sessionsCount: match.length,
      };
    });
  }, [daysInMonth, monthPrefix, currentMonthSessions]);

  // Streamer performance in this month
  const streamerBreakdown = useMemo(() => {
    const map: Record<
      string,
      { name: string; revenue: number; orders: number; sessions: number }
    > = {};

    currentMonthSessions.forEach((s) => {
      const name = s.streamerName || 'Unknown';
      if (!map[name]) map[name] = { name, revenue: 0, orders: 0, sessions: 0 };
      map[name].revenue += s.revenue || 0;
      map[name].orders += s.orders || 0;
      map[name].sessions += 1;
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [currentMonthSessions]);

  // Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = ['Tanggal', 'Jumlah Sesi', 'Omset (IDR)', 'Orders', 'Viewers'];

    const rows = dailyBreakdown.map((d) => [
      d.fullDate,
      d.sessionsCount,
      d.revenue,
      d.orders,
      d.viewers,
    ]);

    const summaryKpis = [
      { label: 'Bulan Laporan', value: `${MONTH_NAMES_ID[selectedMonth - 1]} ${selectedYear}` },
      { label: 'Total Omset Bulanan', value: formatIDR(currentSummary.revenue) },
      { label: 'Pertumbuhan MoM', value: `${momGrowth.growthPct}%` },
      { label: 'Pencapaian Target', value: `${targetAchievement.toFixed(1)}%` },
      { label: 'Total Orders', value: formatNumber(currentSummary.orders) },
      { label: 'Total Viewers', value: formatNumber(currentSummary.viewers) },
    ];

    const payload = {
      title: `Laporan Bulanan LiveStream (${MONTH_NAMES_ID[selectedMonth - 1]} ${selectedYear})`,
      periodDescription: `Bulan ${MONTH_NAMES_ID[selectedMonth - 1]} ${selectedYear}`,
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: `Monthly_Report_${selectedYear}_${selectedMonth}`,
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header & Month/Year Switcher */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Laporan Bulanan (Monthly Report)
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Performa lengkap bulan <strong className="text-orange-600 font-bold">{MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}</strong> &bull; Perbandingan MoM dan target realisasi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <Calendar className="w-4 h-4 text-orange-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500"
              >
                {MONTH_NAMES_ID.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
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

      {/* MONTHLY SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Omset Bulanan</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <DollarSign className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(currentSummary.revenue)}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span
              className={`font-bold ${
                momGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {momGrowth.growthPct > 0 ? `+${momGrowth.growthPct}%` : `${momGrowth.growthPct}%`}
            </span>
            <span className="text-slate-400 font-medium">vs {prevMonthName}</span>
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
          <span className="text-[10px] text-slate-400 font-medium">Bulan Ini</span>
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
          <span className="text-[10px] text-slate-400 font-medium">Penonton</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Produk Terjual</span>
            <div className="w-6 h-6 rounded-full clay-sphere-emerald flex items-center justify-center text-white">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatNumber(currentSummary.productsSold)} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Barang</span>
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
          <span className="text-[10px] text-slate-400 font-medium">Rata-rata</span>
        </div>

        <div className="clay-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">AOV Bulanan</span>
            <div className="w-6 h-6 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <Clock className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {formatIDR(currentSummary.averageOrderValue)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Per Transaksi</span>
        </div>
      </div>

      {/* TARGET REALIZATION PROGRESS */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Realisasi Target Bulan {MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Target bulanan tim: <strong className="text-slate-800 font-bold">{formatIDR(monthlyTargetObj)}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-blue-600">
              {targetAchievement.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-semibold block">Tercapai</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              targetAchievement >= 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, targetAchievement))}%` }}
          />
        </div>
      </div>

      {/* DAILY TREND IN THIS MONTH (CHART) */}
      <div className="clay-card p-6 space-y-3">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Grafik Omset Harian Bulan {MONTH_NAMES_ID[selectedMonth - 1]}
        </h3>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STREAMER CONTRIBUTIONS THIS MONTH */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Kontribusi Streamer Bulan Ini
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {streamerBreakdown.map((st, idx) => {
            const pct = safeDivide(st.revenue * 100, currentSummary.revenue, 0);
            return (
              <div key={idx} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">{st.name}</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{pct.toFixed(1)}%</span>
                </div>
                <div className="text-base font-black text-slate-900">{formatIDR(st.revenue)}</div>
                <div className="text-xs text-slate-500 font-medium">
                  {st.orders} Orders &bull; {st.sessions} Sesi Live
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
