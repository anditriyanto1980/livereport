import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Eye,
  ShoppingCart,
  ShoppingBag,
  Package,
  Percent,
  Calculator,
  Clock,
  CalendarCheck,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  History,
  Info,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LiveSession, Schedule, Target } from '../../types';
import { getJakartaDate } from '../../utils/shiftLogic';
import { WawasanLivestreamCard } from './WawasanLivestreamCard';
import {
  formatIDR,
  formatNumber,
  formatPercent,
  formatDateID,
  safeDivide,
} from '../../utils/formatters';

interface StreamerDashboardProps {
  sessions: LiveSession[];
  schedules: Schedule[];
  targets: Target[];
  onOpenNewLiveModal: (sessionToEdit?: LiveSession) => void;
  onNavigateTab: (tab: any) => void;
}

export const StreamerDashboard: React.FC<StreamerDashboardProps> = ({
  sessions,
  schedules,
  targets,
  onOpenNewLiveModal,
  onNavigateTab,
}) => {
  const { currentUser } = useAuth();
  const todayStr = getJakartaDate();
  const currentMonth = Number(todayStr.split('-')[1]);
  const currentYear = Number(todayStr.split('-')[0]);

  // Streamer Name
  const streamerName = currentUser?.displayName || 'Streamer';
  const streamerId = currentUser?.streamerId;

  // Streamer's personal sessions (Strict privacy filter!)
  const mySessions = useMemo(() => {
    return sessions.filter((s) => {
      if (streamerId) return s.streamerId === streamerId;
      return s.streamerName?.toLowerCase() === streamerName.toLowerCase();
    });
  }, [sessions, streamerId, streamerName]);

  // Today's personal sessions
  const todaySessions = useMemo(() => {
    return mySessions.filter((s) => s.businessDate === todayStr);
  }, [mySessions, todayStr]);

  // Today's Performance Metrics
  const todayPerformance = useMemo(() => {
    let rev = 0;
    let vw = 0;
    let uVw = 0;
    let chk = 0;
    let ord = 0;
    let prods = 0;
    let hrs = 0;

    todaySessions.forEach((s) => {
      rev += s.revenue || 0;
      vw += s.viewers || 0;
      uVw += s.uniqueViewers || 0;
      chk += s.checkout || 0;
      ord += s.orders || 0;
      prods += s.productsSold || 0;
      hrs += s.durationHours || 0;
    });

    const trafficBase = uVw > 0 ? uVw : vw;
    const cr = safeDivide(ord * 100, trafficBase, 0);
    const aov = safeDivide(rev, ord, 0);
    const revPerHour = safeDivide(rev, hrs, 0);

    return {
      revenue: rev,
      viewers: vw,
      checkout: chk,
      orders: ord,
      productsSold: prods,
      conversion: Number(cr.toFixed(2)),
      aov: Math.round(aov),
      revenuePerHour: Math.round(revPerHour),
      hours: hrs,
    };
  }, [todaySessions]);

  // Monthly Target for this Streamer
  const monthlyTarget = useMemo(() => {
    // Check individual target first
    const ind = targets.find(
      (t) =>
        t.period === 'monthly' &&
        t.year === currentYear &&
        (t.month === currentMonth || !t.month) &&
        (t.streamerId === streamerId || t.streamerName?.toLowerCase() === streamerName.toLowerCase())
    );
    if (ind) return ind;

    // Fallback team target
    return targets.find((t) => t.period === 'monthly' && t.type === 'team' && t.year === currentYear);
  }, [targets, currentYear, currentMonth, streamerId, streamerName]);

  // Streamer's actual month-to-date revenue
  const actualMonthRevenue = useMemo(() => {
    return mySessions
      .filter((s) => {
        const [yr, mo] = s.businessDate.split('-').map(Number);
        return yr === currentYear && mo === currentMonth;
      })
      .reduce((sum, s) => sum + (s.revenue || 0), 0);
  }, [mySessions, currentYear, currentMonth]);

  const targetValue = monthlyTarget?.targetValue || 50000000;
  const achievementPct = safeDivide(actualMonthRevenue * 100, targetValue, 0);

  // My Schedules & Pending Report Reminder
  const mySchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (streamerId) return s.streamerId === streamerId;
      return s.streamerName?.toLowerCase() === streamerName.toLowerCase();
    });
  }, [schedules, streamerId, streamerName]);

  const myPendingSchedules = useMemo(() => {
    return mySchedules.filter((s) => !s.hasReport && (s.status === 'Missed' || s.status === 'Completed'));
  }, [mySchedules]);

  return (
    <div className="space-y-6">
      {/* 3D NOTEBOOK BINDER STREAMER HERO CARD */}
      <div className="relative clay-card-blue p-6 sm:p-8 text-white space-y-6 overflow-hidden">
        {/* Layered paper / binder corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[4rem] pointer-events-none -mr-4 -mt-4 blur-xs" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header: Streamer Greeting & Quick Action */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-[11px] font-black tracking-wider text-cyan-200 shadow-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                <span>HOST STREAMER</span>
              </span>
              <span className="text-xs text-blue-100 font-medium">
                {formatDateID(todayStr)} &bull; Jakarta Time
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 drop-shadow-xs">
              Halo, {streamerName}!
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 font-medium mt-1">
              Pantau performa live streaming harian dan progres target bulananmu.
            </p>
          </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            id="streamer-wawasan-btn"
            onClick={() => onNavigateTab('wawasan-livestream')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-orange-950 bg-orange-100 hover:bg-orange-200 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-orange-700" />
            <span>Wawasan Livestream</span>
          </button>

          <button
            type="button"
            id="streamer-upload-screenshot-btn"
            onClick={() => onNavigateTab('import-livestream')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-xl shadow-[0_6px_20px_rgba(249,115,22,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Screenshot AI</span>
          </button>

          <button
            type="button"
            id="streamer-quick-input-btn"
            onClick={() => onOpenNewLiveModal()}
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Input Manual</span>
          </button>
        </div>
      </div>

        {/* Streamer Profile & Today's Highlight Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
          {/* Host Card */}
          <div className="md:col-span-2 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-inner">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-white/20 flex items-center justify-center text-2xl font-black text-white">
                  {streamerName.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-cyan-400 text-blue-950 p-1 rounded-full border-2 border-white shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {streamerName}
                </h3>
                <span className="px-2 py-0.5 bg-white/20 text-cyan-200 text-[10px] font-extrabold rounded-md uppercase">
                  Verified Host
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-blue-100/80">
                <span>ID: {streamerId ? `#${streamerId.slice(0, 8)}` : '#HOST-ID'}</span>
                <span>Role: Live Streamer</span>
                <span>Total Live: {mySessions.length} Sesi</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-semibold text-emerald-300">
                  {todaySessions.length > 0 ? `${todaySessions.length} Sesi Terlapor Hari Ini` : 'Siap untuk Sesi Live Berikutnya'}
                </span>
              </div>
            </div>
          </div>

          {/* Achievement Gauge */}
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Target Bulan Ini
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {achievementPct.toFixed(0)}%
                </span>
                <span className="text-xs font-bold text-cyan-200">Tercapai</span>
              </div>
              <div className="text-[11px] font-semibold text-blue-100 mt-1">
                {formatIDR(actualMonthRevenue)}
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
                  strokeDasharray={`${Math.min(100, achievementPct)}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-white">
                {achievementPct >= 100 ? '100%' : `${achievementPct.toFixed(0)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* 4 3D Mini Stat Pills for Today */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-pink flex items-center justify-center text-white shrink-0">
              <DollarSign className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Omset Hari Ini</div>
              <div className="text-sm font-black text-white truncate">
                {formatIDR(todayPerformance.revenue)}
              </div>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-cyan flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Orders Hari Ini</div>
              <div className="text-sm font-black text-white truncate">
                {formatNumber(todayPerformance.orders)} <span className="text-[10px] font-semibold">order</span>
              </div>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-emerald flex items-center justify-center text-white shrink-0">
              <Eye className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Viewers Hari Ini</div>
              <div className="text-sm font-black text-white truncate">
                {formatNumber(todayPerformance.viewers)}
              </div>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full clay-sphere-purple flex items-center justify-center text-white shrink-0">
              <Percent className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-100 truncate">Conversion Rate</div>
              <div className="text-sm font-black text-white truncate">
                {formatPercent(todayPerformance.conversion)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PENDING REPORT ALERT */}
      {myPendingSchedules.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Pemberitahuan: Live Report Belum Diinput!
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Ada {myPendingSchedules.length} sesi shift yang telah selesai tetapi belum dimasukkan
                laporannya. Mohon segera input data dari Shopee Live.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="streamer-input-pending-btn"
            onClick={() => onOpenNewLiveModal()}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs transition-all whitespace-nowrap active:scale-95"
          >
            Input Laporan Sesi
          </button>
        </div>
      )}

      {/* TODAY'S PERFORMANCE: REPLACED WITH WAWASAN LIVESTREAM (16 KPIS DARI SHOPEE) */}
      <WawasanLivestreamCard
        sessions={mySessions}
        todayDateStr={todayStr}
        streamerName={streamerName}
        isAdmin={false}
        onNavigateTab={onNavigateTab}
        onOpenManualModal={onOpenNewLiveModal}
      />

      {/* MONTHLY TARGET WIDGET (PROGRESS BAR) IN CLAY CARD */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
                Target Bulanan ({formatDateID(todayStr).split(' ')[1]} {currentYear})
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md">
                INDIVIDUAL TARGET
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Realisasi omset live Anda dibandingkan target yang ditetapkan manajemen.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-blue-600">
              {achievementPct.toFixed(1)}%
            </span>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Tercapai</p>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                achievementPct >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, achievementPct))}%` }}
            />
          </div>

          <div className="grid grid-cols-3 text-xs pt-1">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Target Bulanan</span>
              <strong className="text-slate-800 font-bold">{formatIDR(targetValue)}</strong>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Realisasi (Actual)</span>
              <strong className="text-emerald-600 font-bold">{formatIDR(actualMonthRevenue)}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Sisa Target</span>
              <strong className="text-slate-700 font-bold">
                {formatIDR(Math.max(0, targetValue - actualMonthRevenue))}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* MY SCHEDULE & MY RECENT LIVE SESSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Schedules in Clay Card */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              Jadwal Shift Saya
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('schedules')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              Lihat Kalender
            </button>
          </div>

          {mySchedules.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Belum ada jadwal yang ditugaskan untuk Anda.
            </div>
          ) : (
            <div className="space-y-2">
              {mySchedules.slice(0, 4).map((sc) => (
                <div
                  key={sc.id}
                  className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{formatDateID(sc.date)}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {sc.shiftName} ({sc.startTime} - {sc.endTime} WIB)
                    </div>
                  </div>
                  <div>
                    {sc.hasReport ? (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Laporan Selesai
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                        Belum Ada Laporan
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Live History in Clay Card */}
        <div className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Histori Sesi Live Saya ({mySessions.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Data pribadi Anda</span>
          </div>

          {mySessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Belum ada data laporan live. Klik <strong>Input Live Report</strong> untuk memulai.
            </div>
          ) : (
            <div className="space-y-2">
              {mySessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {s.businessDate} &bull; {s.shiftName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {s.orders} Orders &bull; {s.viewers} Viewers &bull; CR: {s.conversionRate}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-blue-600">{formatIDR(s.revenue)}</div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {formatIDR(s.revenuePerHour)}/jam
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
