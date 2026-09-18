import React, { useMemo } from 'react';
import {
  Clock,
  DollarSign,
  ShoppingBag,
  Eye,
  Percent,
  Calculator,
  Info,
  Trophy,
  BarChart3,
  Moon,
  Sun,
  Sunset,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { LiveSession } from '../../types';
import { SHIFTS } from '../../utils/shiftLogic';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  safeDivide,
} from '../../utils/formatters';

interface ShiftAnalyticsViewProps {
  sessions: LiveSession[];
}

export const ShiftAnalyticsView: React.FC<ShiftAnalyticsViewProps> = ({ sessions }) => {
  // Aggregate data for Shift 1, Shift 2, Shift 3
  const shiftAggregates = useMemo(() => {
    const shiftDefs = [
      { id: 'shift-1', name: 'Shift 1 (Pagi)', time: '06:00 - 15:00 WIB', icon: Sun, color: '#f59e0b' },
      { id: 'shift-2', name: 'Shift 2 (Sore)', time: '12:00 - 21:00 WIB', icon: Sunset, color: '#ea580c' },
      { id: 'shift-3', name: 'Shift 3 (Malam/Subuh)', time: '21:00 - 06:00 WIB', icon: Moon, color: '#6366f1' },
    ];

    return shiftDefs.map((def) => {
      const matched = sessions.filter(
        (s) => s.shiftId === def.id || (s.shiftName && s.shiftName.toLowerCase().includes(def.id.replace('shift-', '')))
      );

      let rev = 0;
      let ord = 0;
      let vw = 0;
      let uVw = 0;
      let chk = 0;
      let prods = 0;
      let hrs = 0;

      matched.forEach((s) => {
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
        ...def,
        sessionsCount: matched.length,
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
  }, [sessions]);

  // Identify Best Shift by Revenue
  const bestShift = useMemo(() => {
    return [...shiftAggregates].sort((a, b) => b.revenue - a.revenue)[0];
  }, [shiftAggregates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
            <Clock className="w-5 h-5 drop-shadow-xs" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
              Analisis Komparasi Shift (Shift 1, Shift 2, & Shift 3)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Evaluasi kinerja live streaming Shopee berdasarkan jam tayang shift operasional.
            </p>
          </div>
        </div>
      </div>

      {/* CRITICAL SHIFT 3 RULE CALLOUT */}
      <div className="clay-card border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/60 p-5 flex items-start gap-3.5 shadow-xs">
        <div className="w-10 h-10 rounded-2xl clay-sphere-purple text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Moon className="w-5 h-5 drop-shadow-xs" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg">
              ATURAN BISNIS SISTEM
            </span>
            <h3 className="text-sm font-extrabold text-slate-800">
              Logika Perhitungan Khusus Shift 3 (21:00 - 06:00 WIB)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Shift 3 dimulai pukul 21:00 malam dan berakhir pukul 06:00 pagi keesokan harinya (melewati tengah malam).
            Sesuai regulasi sistem bisnis yang ditetapkan, <strong>Business Date</strong> dari Shift 3{' '}
            <em>tetap menggunakan tanggal dimulainya shift</em>, dan seluruh perolehan omset dihitung utuh
            pada tanggal tersebut tanpa dibagi menjadi dua hari kalender.
          </p>
        </div>
      </div>

      {/* 3 SHIFT COMPARISON CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {shiftAggregates.map((sh) => {
          const Icon = sh.icon;
          const isBest = bestShift && bestShift.id === sh.id && sh.revenue > 0;

          return (
            <div
              key={sh.id}
              className={`clay-card p-6 space-y-4 relative ${
                isBest ? 'border-orange-300 ring-2 ring-orange-200 bg-gradient-to-b from-orange-50/50 to-white' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: `${sh.color}15`, color: sh.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{sh.name}</h3>
                    <span className="text-[10px] text-slate-500 font-bold block">{sh.time}</span>
                  </div>
                </div>

                {isBest && (
                  <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-orange-600 text-white rounded-lg shadow-xs">
                    TERLARIS
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Total Omset Shift
                </span>
                <div className="text-xl font-black text-blue-600 mt-0.5">
                  {formatIDR(sh.revenue)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block">Total Orders</span>
                  <strong className="text-slate-800 font-black">{formatNumber(sh.orders)}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block">Total Viewers</span>
                  <strong className="text-slate-800 font-black">{formatNumber(sh.viewers)}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block">Conversion Rate</span>
                  <strong className="text-emerald-600 font-black">{sh.conversionRate}%</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block">Revenue / Jam</span>
                  <strong className="text-slate-800 font-black">{formatIDR(sh.revenuePerHour)}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1">
                <span>Total Sesi: {sh.sessionsCount}</span>
                <span>Total Jam: {sh.hours} Jam</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SHIFT PERFORMANCE COMPARISON BAR CHART */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Perbandingan Omset & Pesanan Antar Shift
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shiftAggregates}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
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
    </div>
  );
};
