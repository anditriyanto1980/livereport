import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  Filter,
  Calendar,
  DollarSign,
  ShoppingBag,
  Eye,
  Package,
  Clock,
  Percent,
  Download,
} from 'lucide-react';
import { LiveSession, Streamer } from '../../types';
import { formatIDR, formatNumber, formatPercent, safeDivide } from '../../utils/formatters';
import { getJakartaDate } from '../../utils/shiftLogic';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

interface AnalyticsViewProps {
  sessions: LiveSession[];
  streamers: Streamer[];
}

const COLORS = ['#ea580c', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sessions, streamers }) => {
  const [selectedStreamer, setSelectedStreamer] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'all' | '30d' | '7d'>('all');

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const today = getJakartaDate();
    let cutoff = '';
    if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 7 : 30;
      const [y, m, d] = today.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - days);
      const cy = dt.getFullYear();
      const cm = String(dt.getMonth() + 1).padStart(2, '0');
      const cd = String(dt.getDate()).padStart(2, '0');
      cutoff = `${cy}-${cm}-${cd}`;
    }

    return sessions.filter((s) => {
      if (selectedStreamer !== 'ALL' && s.streamerId !== selectedStreamer) return false;
      if (selectedShift !== 'ALL' && s.shiftId !== selectedShift) return false;
      if (cutoff && s.businessDate < cutoff) return false;
      return true;
    });
  }, [sessions, selectedStreamer, selectedShift, timeframe]);

  // Aggregate by Date for Trends (Revenue, Orders, Viewers, Products Sold)
  const dateAggregates = useMemo(() => {
    const map: Record<
      string,
      {
        date: string;
        revenue: number;
        orders: number;
        viewers: number;
        productsSold: number;
        hours: number;
      }
    > = {};

    filteredSessions.forEach((s) => {
      const d = s.businessDate;
      if (!map[d]) {
        map[d] = {
          date: d.slice(5), // MM-DD
          revenue: 0,
          orders: 0,
          viewers: 0,
          productsSold: 0,
          hours: 0,
        };
      }
      map[d].revenue += s.revenue || 0;
      map[d].orders += s.orders || 0;
      map[d].viewers += s.viewers || 0;
      map[d].productsSold += s.productsSold || 0;
      map[d].hours += s.durationHours || 0;
    });

    return Object.keys(map)
      .sort()
      .map((k) => map[k]);
  }, [filteredSessions]);

  // 5. Revenue by Streamer
  const streamerData = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        revenue: number;
        orders: number;
        viewers: number;
        hours: number;
        revenuePerHour: number;
        conversionRate: number;
      }
    > = {};

    filteredSessions.forEach((s) => {
      const name = s.streamerName || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          revenue: 0,
          orders: 0,
          viewers: 0,
          hours: 0,
          revenuePerHour: 0,
          conversionRate: 0,
        };
      }
      map[name].revenue += s.revenue || 0;
      map[name].orders += s.orders || 0;
      map[name].viewers += s.viewers || 0;
      map[name].hours += s.durationHours || 0;
    });

    return Object.values(map)
      .map((st) => ({
        ...st,
        revenuePerHour: Math.round(safeDivide(st.revenue, st.hours, 0)),
        conversionRate: Number(safeDivide(st.orders * 100, st.viewers, 0).toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSessions]);

  // 6. Revenue by Shift
  const shiftData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orders: number; hours: number }> = {
      'Shift 1': { name: 'Shift 1 (06:00-15:00)', revenue: 0, orders: 0, hours: 0 },
      'Shift 2': { name: 'Shift 2 (12:00-21:00)', revenue: 0, orders: 0, hours: 0 },
      'Shift 3': { name: 'Shift 3 (21:00-06:00)', revenue: 0, orders: 0, hours: 0 },
    };

    filteredSessions.forEach((s) => {
      let key = 'Shift 1';
      if (s.shiftName?.includes('2') || s.shiftId?.includes('2')) key = 'Shift 2';
      else if (s.shiftName?.includes('3') || s.shiftId?.includes('3')) key = 'Shift 3';

      map[key].revenue += s.revenue || 0;
      map[key].orders += s.orders || 0;
      map[key].hours += s.durationHours || 0;
    });

    return Object.values(map);
  }, [filteredSessions]);

  // 10. Product Performance Aggregates
  const productAggregates = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; quantity: number }> = {};
    filteredSessions.forEach((s) => {
      s.productDetails?.forEach((item) => {
        const name = item.productName || 'Produk';
        if (!map[name]) {
          map[name] = { name, revenue: 0, quantity: 0 };
        }
        map[name].revenue += item.revenue || 0;
        map[name].quantity += item.quantity || 0;
      });
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [filteredSessions]);

  // Export Analytics
  const handleExportAnalytics = () => {
    const headers = ['Tanggal', 'Omset (IDR)', 'Orders', 'Viewers', 'Produk Terjual', 'Durasi (Jam)'];
    const rows = dateAggregates.map((d) => [
      d.date,
      d.revenue,
      d.orders,
      d.viewers,
      d.productsSold,
      d.hours,
    ]);

    const totalRev = dateAggregates.reduce((acc, x) => acc + x.revenue, 0);
    const totalOrd = dateAggregates.reduce((acc, x) => acc + x.orders, 0);

    exportToExcel({
      title: 'Laporan Analytics Live Streaming Shopee',
      periodDescription: timeframe === '7d' ? '7 Hari Terakhir' : timeframe === '30d' ? '30 Hari Terakhir' : 'Semua Periode',
      summaryKpis: [
        { label: 'Total Sesi Teranalisis', value: `${filteredSessions.length} Sesi` },
        { label: 'Total Omset Teranalisis', value: formatIDR(totalRev) },
        { label: 'Total Orders', value: formatNumber(totalOrd) },
      ],
      headers,
      rows,
      fileNamePrefix: `Analytics_Report_${timeframe}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Control Bar */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
                <BarChart3 className="w-5 h-5 drop-shadow-xs" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                  Analytics Dashboard (10 Charts)
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Analisis komprehensif performa traffic, revenue, konversi, shift, dan produk live Shopee.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl">
              {filteredSessions.length} Sesi Teranalisis
            </span>
            <button
              type="button"
              onClick={handleExportAnalytics}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-bold">Filter Streamer:</span>
              <select
                id="analytics-streamer-filter"
                value={selectedStreamer}
                onChange={(e) => setSelectedStreamer(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold shadow-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Streamer (All)</option>
                {streamers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-bold">Filter Shift:</span>
              <select
                id="analytics-shift-filter"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold shadow-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Shift (All)</option>
                <option value="shift-1">Shift 1 (06:00 - 15:00)</option>
                <option value="shift-2">Shift 2 (12:00 - 21:00)</option>
                <option value="shift-3">Shift 3 (21:00 - 06:00)</option>
              </select>
            </div>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                timeframe === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('30d')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                timeframe === '30d' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('7d')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                timeframe === '7d' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7 Hari
            </button>
          </div>
        </div>
      </div>

      {/* 10 ANALYTICS CHARTS GRID IN CLAY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Revenue Trend (Area Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                1. Revenue Trend (Tren Omset)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Pertumbuhan omset live per tanggal</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dateAggregates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#ea580c" fill="#ea580c" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Orders Trend (Bar Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                2. Orders Trend (Tren Pesanan)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Jumlah checkout order per tanggal</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dateAggregates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Orders']}
                />
                <Bar dataKey="orders" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: Viewer Trend (Line Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                3. Viewer Trend (Tren Penonton)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Total penonton live per tanggal</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-purple flex items-center justify-center text-white">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dateAggregates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Viewers']}
                />
                <Line type="monotone" dataKey="viewers" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 4: Products Sold Trend (Bar Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                4. Products Sold Trend (Kuantitas Terjual)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Jumlah produk (pcs) terjual per sesi</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-pink flex items-center justify-center text-white">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dateAggregates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [`${formatNumber(Number(v))} pcs`, 'Produk Terjual']}
                />
                <Bar dataKey="productsSold" fill="#db2777" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 5: Revenue by Streamer (Bar Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                5. Revenue by Streamer (Omset Tiap Host)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Perbandingan perolehan omset per streamer</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-emerald flex items-center justify-center text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streamerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 6: Revenue by Shift (Donut Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                6. Revenue by Shift (Shift 1, 2, 3)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Distribusi omset berdasarkan jam shift live</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shiftData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {shiftData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatIDR(Number(v)), 'Omset']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#475569' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 7: Orders by Streamer (Horizontal Bar Chart) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                7. Orders by Streamer (Volume Pesanan)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Total pesanan yang dihasilkan masing-masing streamer</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-purple flex items-center justify-center text-white">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streamerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Orders']}
                />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 8: Conversion by Streamer */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                8. Conversion Rate by Streamer (%)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Efektivitas closing per penonton live</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-cyan flex items-center justify-center text-white">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streamerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [`${v}%`, 'Conversion Rate']}
                />
                <Bar dataKey="conversionRate" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 9: Revenue per Hour */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                9. Revenue per Hour by Streamer (Produktivitas)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Rata-rata omset yang dihasilkan per jam tayang</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-orange flex items-center justify-center text-white">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streamerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Jt`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [formatIDR(Number(v)), 'Rev/Jam']}
                />
                <Bar dataKey="revenuePerHour" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 10: Product Performance (Top Product Revenue) */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                10. Product Performance (Top SKU Revenue)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Produk dengan omset tertinggi saat sesi live</p>
            </div>
            <div className="w-8 h-8 rounded-full clay-sphere-pink flex items-center justify-center text-white">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="h-60 w-full">
            {productAggregates.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada rincian produk pada sesi terpilih.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productAggregates} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: any) => [formatIDR(Number(v)), 'Omset Produk']}
                  />
                  <Bar dataKey="revenue" fill="#f43f5e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
