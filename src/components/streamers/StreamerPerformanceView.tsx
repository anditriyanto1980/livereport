import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Users,
  DollarSign,
  ShoppingBag,
  Eye,
  Clock,
  Percent,
  Calculator,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { LiveSession, Streamer } from '../../types';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  safeDivide,
} from '../../utils/formatters';
import { exportToPDF, exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface StreamerPerformanceViewProps {
  sessions: LiveSession[];
  streamers: Streamer[];
}

export const StreamerPerformanceView: React.FC<StreamerPerformanceViewProps> = ({
  sessions,
  streamers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'conversion' | 'revPerHour'>('revenue');

  // Streamer performance aggregations
  const streamerStats = useMemo(() => {
    return streamers.map((st) => {
      const stSessions = sessions.filter(
        (s) => s.streamerId === st.id || s.streamerName?.toLowerCase() === st.name.toLowerCase()
      );

      let rev = 0;
      let ord = 0;
      let vw = 0;
      let uVw = 0;
      let chk = 0;
      let prods = 0;
      let hrs = 0;

      stSessions.forEach((s) => {
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
        ...st,
        sessionsCount: stSessions.length,
        revenue: rev,
        orders: ord,
        viewers: vw,
        checkout: chk,
        productsSold: prods,
        hours: Number(hrs.toFixed(1)),
        conversionRate: Number(cr.toFixed(2)),
        aov: Math.round(aov),
        revenuePerHour: Math.round(revPerHour),
      };
    });
  }, [streamers, sessions]);

  // Sorted and filtered stats
  const sortedStats = useMemo(() => {
    return [...streamerStats]
      .filter((st) => st.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'orders') return b.orders - a.orders;
        if (sortBy === 'conversion') return b.conversionRate - a.conversionRate;
        return b.revenuePerHour - a.revenuePerHour;
      });
  }, [streamerStats, searchQuery, sortBy]);

  // Export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      'Peringkat',
      'Nama Streamer',
      'Status',
      'Total Sesi',
      'Total Jam Live',
      'Total Omset (IDR)',
      'Orders',
      'Viewers',
      'Conversion Rate',
      'AOV (IDR)',
      'Rev/Jam (IDR)',
    ];

    const rows = sortedStats.map((s, idx) => [
      idx + 1,
      s.name,
      s.status === 'active' ? 'Aktif' : 'Non-aktif',
      s.sessionsCount,
      s.hours,
      s.revenue,
      s.orders,
      s.viewers,
      `${s.conversionRate}%`,
      s.aov,
      s.revenuePerHour,
    ]);

    const summaryKpis = [
      { label: 'Total Streamer', value: String(streamers.length) },
      { label: 'Top Performer', value: sortedStats[0] ? `${sortedStats[0].name} (${formatIDR(sortedStats[0].revenue)})` : '-' },
    ];

    const payload = {
      title: 'Laporan Performa & Peringkat Tim Live Streamer',
      periodDescription: 'Semua Periode',
      summaryKpis,
      headers,
      rows,
      fileNamePrefix: 'Streamer_Leaderboard',
    };

    if (format === 'pdf') exportToPDF(payload);
    else if (format === 'excel') exportToExcel(payload);
    else exportToCSV(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Trophy className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Streamer Performance & Leaderboard
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Peringkat efektivitas, omset total, rasio konversi, dan produktivitas tim host Shopee Live.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Filter and Sort controls */}
        <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama streamer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Urutkan Berdasarkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="revenue">Omset Tertinggi (Revenue)</option>
              <option value="orders">Jumlah Order Terbanyak</option>
              <option value="conversion">Conversion Rate Tertinggi</option>
              <option value="revPerHour">Revenue / Jam Tertinggi</option>
            </select>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM / HIGHLIGHT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedStats.slice(0, 3).map((st, idx) => {
          const podiumColors = [
            { bg: 'from-amber-50/90 to-orange-50/60 border-amber-300', badge: 'bg-amber-400 text-amber-950 font-black', sphere: 'clay-sphere-orange', title: '1st Champion (Gold)' },
            { bg: 'from-slate-50/90 to-sky-50/50 border-slate-300', badge: 'bg-slate-200 text-slate-800 font-black', sphere: 'clay-sphere-cyan', title: '2nd Runner Up (Silver)' },
            { bg: 'from-orange-50/80 to-amber-50/40 border-orange-200', badge: 'bg-amber-600 text-white font-black', sphere: 'clay-sphere-purple', title: '3rd Place (Bronze)' },
          ];
          const style = podiumColors[idx] || podiumColors[2];

          return (
            <div
              key={st.id}
              className={`clay-card bg-gradient-to-b ${style.bg} ${style.bg.includes('border') ? '' : ''} p-5 space-y-3 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-lg shadow-xs ${style.badge}`}>
                  {style.title}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {st.sessionsCount} Sesi Live
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">{st.name}</h3>
                <div className="text-xl font-black text-blue-600 mt-0.5">
                  {formatIDR(st.revenue)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Orders</span>
                  <strong className="text-slate-800 font-black">{formatNumber(st.orders)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Conversion</span>
                  <strong className="text-emerald-600 font-black">{st.conversionRate}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Rev / Jam</span>
                  <strong className="text-slate-800 font-black">{formatIDR(st.revenuePerHour)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Jam Live</span>
                  <strong className="text-slate-800 font-black">{st.hours} Jam</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Tabel Peringkat Streamer Lengkap
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3 text-center">Rank</th>
                <th className="py-3 px-3">Streamer</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Total Sesi</th>
                <th className="py-3 px-3 text-right">Total Jam</th>
                <th className="py-3 px-3 text-right">Gross GMV (IDR)</th>
                <th className="py-3 px-3 text-right">Orders</th>
                <th className="py-3 px-3 text-right">Viewers</th>
                <th className="py-3 px-3 text-right">CR (%)</th>
                <th className="py-3 px-3 text-right">AOV (IDR)</th>
                <th className="py-3 px-3 text-right">Rev/Jam (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedStats.map((st, idx) => (
                <tr key={st.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs shadow-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-amber-950 font-black'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800 font-black'
                          : idx === 2
                          ? 'bg-amber-600 text-white font-black'
                          : 'bg-slate-100 text-slate-600 font-bold'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800">{st.name}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                        st.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {st.status === 'active' ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 font-medium">{st.sessionsCount} Sesi</td>
                  <td className="py-3 px-3 text-right text-slate-600 font-medium">{st.hours} Jam</td>
                  <td className="py-3 px-3 text-right font-black text-blue-600">
                    {formatIDR(st.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 font-semibold">{formatNumber(st.orders)}</td>
                  <td className="py-3 px-3 text-right text-slate-600 font-medium">{formatNumber(st.viewers)}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600">
                    {formatPercent(st.conversionRate)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 font-medium">{formatIDR(st.aov)}</td>
                  <td className="py-3 px-3 text-right text-slate-600 font-medium">
                    {formatIDR(st.revenuePerHour)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
