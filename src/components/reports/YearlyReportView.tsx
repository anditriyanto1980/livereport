import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ShoppingBag,
  Eye,
  Package,
  Download,
  Trophy,
  AlertCircle,
  BarChart3,
  Sparkles,
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
import { LiveSession, Target } from '../../types';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  safeDivide,
  MONTH_NAMES_ID,
} from '../../utils/formatters';
import { calculateGrowth } from '../../utils/dateFilters';
import { exportToPDF, exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface YearlyReportViewProps {
  sessions: LiveSession[];
  targets: Target[];
}

export const YearlyReportView: React.FC<YearlyReportViewProps> = ({ sessions, targets }) => {
  // Available Years
  const availableYears = useMemo(() => {
    const set = new Set<number>([2024, 2025, 2026, 2027]);
    sessions.forEach((s) => {
      const yr = Number(s.businessDate?.slice(0, 4));
      if (!isNaN(yr) && yr > 2000) set.add(yr);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [sessions]);

  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Filter Sessions for this Year
  const yearSessions = useMemo(() => {
    return sessions.filter((s) => s.businessDate.startsWith(String(selectedYear)));
  }, [sessions, selectedYear]);

  // Annual Totals
  const annualSummary = useMemo(() => {
    let rev = 0;
    let ord = 0;
    let vw = 0;
    let uVw = 0;
    let prods = 0;
    let hrs = 0;

    yearSessions.forEach((s) => {
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
      totalRevenue: rev,
      totalOrders: ord,
      totalViewers: vw,
      totalProductsSold: prods,
      totalHours: Number(hrs.toFixed(1)),
      conversionRate: Number(cr.toFixed(2)),
      averageOrderValue: Math.round(aov),
      totalSessions: yearSessions.length,
    };
  }, [yearSessions]);

  // Yearly Target
  const yearlyTarget = useMemo(() => {
    const t = targets.find(
      (x) => x.period === 'yearly' && x.type === 'team' && x.year === selectedYear
    );
    return t ? t.targetValue : 1200000000; // Default 1.2M IDR per year
  }, [targets, selectedYear]);

  const targetAchievement = safeDivide(annualSummary.totalRevenue * 100, yearlyTarget, 0);

  // 12-Month Table Breakdown
  const monthlyBreakdown = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthPrefix = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const mSessions = yearSessions.filter((s) => s.businessDate.startsWith(monthPrefix));

      let rev = 0;
      let ord = 0;
      let vw = 0;
      let uVw = 0;
      let prods = 0;
      let hrs = 0;

      // Top streamer for this month
      const streamerRevMap: Record<string, number> = {};

      mSessions.forEach((s) => {
        rev += s.revenue || 0;
        ord += s.orders || 0;
        vw += s.viewers || 0;
        uVw += s.uniqueViewers || 0;
        prods += s.productsSold || 0;
        hrs += s.durationHours || 0;

        const stName = s.streamerName || 'Unknown';
        streamerRevMap[stName] = (streamerRevMap[stName] || 0) + (s.revenue || 0);
      });

      let topStreamer = '-';
      let maxRev = 0;
      Object.entries(streamerRevMap).forEach(([name, val]) => {
        if (val > maxRev) {
          maxRev = val;
          topStreamer = name;
        }
      });

      const trafficBase = uVw > 0 ? uVw : vw;
      const cr = safeDivide(ord * 100, trafficBase, 0);
      const aov = safeDivide(rev, ord, 0);

      return {
        monthIndex: monthNum,
        monthName: MONTH_NAMES_ID[i],
        revenue: rev,
        orders: ord,
        viewers: vw,
        productsSold: prods,
        hours: hrs,
        conversionRate: Number(cr.toFixed(2)),
        aov: Math.round(aov),
        sessionsCount: mSessions.length,
        topStreamer,
        growthMoM: 0, // calculated next
      };
    });

    // Calculate Month-over-Month Growth (MoM)
    for (let i = 0; i < 12; i++) {
      if (i === 0) {
        list[i].growthMoM = 0;
      } else {
        const prevRev = list[i - 1].revenue;
        const curRev = list[i].revenue;
        const { growthPct } = calculateGrowth(curRev, prevRev);
        list[i].growthMoM = prevRev > 0 ? growthPct : 0;
      }
    }

    return list;
  }, [yearSessions, selectedYear]);

  // Identify Best Month & Worst Month
  const { bestMonth, worstMonth } = useMemo(() => {
    const activeMonths = monthlyBreakdown.filter((m) => m.sessionsCount > 0);
    if (activeMonths.length === 0) {
      return { bestMonth: null, worstMonth: null };
    }

    let best = activeMonths[0];
    let worst = activeMonths[0];

    activeMonths.forEach((m) => {
      if (m.revenue > best.revenue) best = m;
      if (m.revenue < worst.revenue) worst = m;
    });

    return { bestMonth: best, worstMonth: worst };
  }, [monthlyBreakdown]);

  // Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      'Bulan',
      'Total Sesi',
      'Omset / Revenue (IDR)',
      'Pertumbuhan MoM (%)',
      'Orders',
      'Viewers',
      'Produk Terjual',
      'Conversion Rate',
      'AOV (IDR)',
      'Top Streamer',
    ];

    const rows = monthlyBreakdown.map((m) => [
      m.monthName,
      m.sessionsCount,
      m.revenue,
      `${m.growthMoM}%`,
      m.orders,
      m.viewers,
      m.productsSold,
      `${m.conversionRate}%`,
      m.aov,
      m.topStreamer,
    ]);

    const summaryKpis = [
      { label: 'Tahun Analisis', value: String(selectedYear) },
      { label: 'Total Omset Tahunan', value: formatIDR(annualSummary.totalRevenue) },
      { label: 'Target Tahunan', value: formatIDR(yearlyTarget) },
      { label: 'Pencapaian Target', value: `${targetAchievement.toFixed(1)}%` },
      { label: 'Total Orders', value: formatNumber(annualSummary.totalOrders) },
      { label: 'Total Viewers', value: formatNumber(annualSummary.totalViewers) },
      { label: 'Bulan Terlaris', value: bestMonth ? `${bestMonth.monthName} (${formatIDR(bestMonth.revenue)})` : '-' },
    ];

    const payload = {
      title: `Laporan Tahunan Kinerja LiveStream (Tahun ${selectedYear})`,
      periodDescription: `Tahun ${selectedYear} (12 Bulan)`,
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: `Yearly_Report_${selectedYear}`,
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header & Year Switcher */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-700 rounded-md border border-orange-200">
                  REKAP TAHUNAN
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">
                  Laporan Tahunan ({selectedYear})
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Rekapitulasi tahunan kinerja live stream Shopee selama 12 bulan penuh, tren MoM, dan evaluasi target tahunan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-slate-600 font-bold">Pilih Tahun:</span>
              <select
                id="yearly-select-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              id="yearly-export-pdf-btn"
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-rose-500" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              id="yearly-export-excel-btn"
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ANNUAL SUMMARY CARDS (4 BIG CARDS + TARGET PROGRESS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Omset Tahunan</span>
            <div className="w-8 h-8 rounded-xl clay-sphere-orange text-white flex items-center justify-center">
              <DollarSign className="w-4 h-4 drop-shadow-xs" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {formatIDR(annualSummary.totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Dari {annualSummary.totalSessions} sesi live selama tahun {selectedYear}
          </p>
        </div>

        <div className="clay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Pesanan (Orders)</span>
            <div className="w-8 h-8 rounded-xl clay-sphere-cyan text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 drop-shadow-xs" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {formatNumber(annualSummary.totalOrders)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            AOV Tahunan: <strong className="text-slate-800">{formatIDR(annualSummary.averageOrderValue)}</strong>
          </p>
        </div>

        <div className="clay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Penonton (Viewers)</span>
            <div className="w-8 h-8 rounded-xl clay-sphere-emerald text-white flex items-center justify-center">
              <Eye className="w-4 h-4 drop-shadow-xs" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {formatNumber(annualSummary.totalViewers)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Conversion Rate: <strong className="text-emerald-600">{annualSummary.conversionRate}%</strong>
          </p>
        </div>

        <div className="clay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Produk Terjual</span>
            <div className="w-8 h-8 rounded-xl clay-sphere-pink text-white flex items-center justify-center">
              <Package className="w-4 h-4 drop-shadow-xs" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {formatNumber(annualSummary.totalProductsSold)} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Total Jam Live: <strong className="text-slate-800">{annualSummary.totalHours} Jam</strong>
          </p>
        </div>
      </div>

      {/* ANNUAL TARGET & REALIZATION BAR */}
      <div className="clay-card p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Realisasi Target Tahunan {selectedYear}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Target tahunan ditetapkan sebesar <strong className="text-slate-800">{formatIDR(yearlyTarget)}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-blue-600">
              {targetAchievement.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500 font-bold block">Pencapaian Target</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              targetAchievement >= 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, targetAchievement))}%` }}
          />
        </div>
      </div>

      {/* BEST & WORST MONTH HIGHLIGHTS */}
      {bestMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Best Month Card */}
          <div className="clay-card p-5 flex items-center gap-4 border-emerald-200 bg-emerald-50/40">
            <div className="w-12 h-12 rounded-2xl clay-sphere-emerald text-white flex items-center justify-center shrink-0 shadow-xs">
              <Trophy className="w-6 h-6 drop-shadow-xs" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                BULAN TERLARIS (BEST PERFORMING MONTH)
              </span>
              <h4 className="text-lg font-black text-slate-800 mt-0.5">
                {bestMonth.monthName} {selectedYear}
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                Omset: <strong className="text-emerald-600 font-black">{formatIDR(bestMonth.revenue)}</strong> &bull;{' '}
                {bestMonth.orders} Orders &bull; Top Host: <strong className="text-slate-800">{bestMonth.topStreamer}</strong>
              </p>
            </div>
          </div>

          {/* Worst Month Card */}
          {worstMonth && (
            <div className="clay-card p-5 flex items-center gap-4 border-rose-200 bg-rose-50/40">
              <div className="w-12 h-12 rounded-2xl clay-sphere-pink text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-6 h-6 drop-shadow-xs" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
                  BULAN DENGAN OMSET TERENDAH
                </span>
                <h4 className="text-lg font-black text-slate-800 mt-0.5">
                  {worstMonth.monthName} {selectedYear}
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Omset: <strong className="text-rose-600 font-black">{formatIDR(worstMonth.revenue)}</strong> &bull;{' '}
                  {worstMonth.orders} Orders &bull; Perlu evaluasi program promo.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MONTHLY REVENUE BAR CHART (12 BULAN) */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Grafik Omset 12 Bulan ({selectedYear})
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 12-MONTH RECAPITULATION TABLE */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Tabel Rekapitulasi 12 Bulan ({selectedYear})
            </h3>
            <p className="text-xs text-slate-500 font-medium">Rincian performa bulanan, pertumbuhan MoM, dan top streamer</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3">Bulan</th>
                <th className="py-3 px-3 text-right">Omset / GMV (IDR)</th>
                <th className="py-3 px-3 text-center">MoM Growth</th>
                <th className="py-3 px-3 text-right">Orders</th>
                <th className="py-3 px-3 text-right">Viewers</th>
                <th className="py-3 px-3 text-right">Produk (Pcs)</th>
                <th className="py-3 px-3 text-right">Conversion</th>
                <th className="py-3 px-3 text-right">AOV (IDR)</th>
                <th className="py-3 px-3 text-center">Top Streamer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {monthlyBreakdown.map((m) => (
                <tr key={m.monthIndex} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                    <span>{m.monthName}</span>
                    {bestMonth?.monthIndex === m.monthIndex && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded">
                        TOP
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-blue-600">
                    {formatIDR(m.revenue)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {m.monthIndex === 1 ? (
                      <span className="text-slate-400 font-medium">-</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          m.growthMoM >= 0
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {m.growthMoM >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {m.growthMoM > 0 ? `+${m.growthMoM}%` : `${m.growthMoM}%`}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 font-semibold">{formatNumber(m.orders)}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatNumber(m.viewers)}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatNumber(m.productsSold)}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600">
                    {formatPercent(m.conversionRate)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 font-semibold">{formatIDR(m.aov)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-bold">
                      {m.topStreamer}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200">
              <tr>
                <td className="py-3 px-3 uppercase text-blue-600">TOTAL TAHUNAN</td>
                <td className="py-3 px-3 text-right text-blue-600 font-black">
                  {formatIDR(annualSummary.totalRevenue)}
                </td>
                <td className="py-3 px-3 text-center text-slate-400">-</td>
                <td className="py-3 px-3 text-right">{formatNumber(annualSummary.totalOrders)}</td>
                <td className="py-3 px-3 text-right">{formatNumber(annualSummary.totalViewers)}</td>
                <td className="py-3 px-3 text-right">{formatNumber(annualSummary.totalProductsSold)}</td>
                <td className="py-3 px-3 text-right text-emerald-600 font-black">
                  {formatPercent(annualSummary.conversionRate)}
                </td>
                <td className="py-3 px-3 text-right">{formatIDR(annualSummary.averageOrderValue)}</td>
                <td className="py-3 px-3 text-center text-slate-400">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
