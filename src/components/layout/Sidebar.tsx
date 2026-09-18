import React, { useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  Users,
  Clock,
  CalendarCheck,
  Package,
  Target,
  UserCheck,
  History,
  AlertCircle,
  Database,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

export type NavTabKey =
  | 'dashboard'
  | 'input-live'
  | 'analytics'
  | 'daily-report'
  | 'weekly-report'
  | 'monthly-report'
  | 'yearly-report'
  | 'streamer-performance'
  | 'shift-analytics'
  | 'schedules'
  | 'products'
  | 'targets'
  | 'streamers-mgmt'
  | 'audit-logs';

interface SidebarProps {
  activeTab: NavTabKey;
  setActiveTab: (tab: NavTabKey) => void;
  pendingReportCount?: number;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenLiveModal?: () => void;
}

interface NavItemConfig {
  key: NavTabKey;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  lensClass: string;
  glowColor: string;
  badge?: string | null;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingReportCount = 0,
  sidebarOpen,
  setSidebarOpen,
  isOpen,
  onClose,
  onOpenLiveModal,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const isActuallyOpen = sidebarOpen ?? isOpen ?? false;
  const [clickedTab, setClickedTab] = useState<string | null>(null);

  const handleClose = () => {
    if (setSidebarOpen) setSidebarOpen(false);
    if (onClose) onClose();
  };

  const handleNav = (tab: NavTabKey) => {
    setClickedTab(tab);
    setTimeout(() => setClickedTab(null), 700);

    if (tab === 'input-live' && onOpenLiveModal) {
      onOpenLiveModal();
      handleClose();
      return;
    }
    setActiveTab(tab);
    handleClose();
  };

  const navItems: { group: string; items: NavItemConfig[] }[] = [
    {
      group: 'UTAMA',
      items: [
        {
          key: 'dashboard',
          label: isAdmin ? 'Executive Dashboard' : 'Dashboard Streamer',
          subtitle: 'Overview performa & KPI',
          icon: LayoutDashboard,
          lensClass: 'lens-cyan',
          glowColor: 'rgba(2, 132, 199, 0.4)',
          badge: null,
        },
        {
          key: 'input-live',
          label: 'Input Live Report',
          subtitle: 'Seller Centre Shopee',
          icon: PlusCircle,
          lensClass: 'lens-orange',
          glowColor: 'rgba(234, 88, 12, 0.4)',
          badge: pendingReportCount > 0 ? `${pendingReportCount} Pending` : null,
          badgeColor: 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold',
        },
        {
          key: 'analytics',
          label: '10 Analytics Charts',
          subtitle: 'Grafik tren komparatif',
          icon: BarChart3,
          lensClass: 'lens-indigo',
          glowColor: 'rgba(79, 70, 229, 0.4)',
          badge: null,
        },
      ],
    },
    {
      group: 'LAPORAN & ANALISIS',
      items: [
        {
          key: 'daily-report',
          label: 'Laporan Harian',
          subtitle: 'Rekap omset harian',
          icon: Calendar,
          lensClass: 'lens-lime',
          glowColor: 'rgba(132, 204, 22, 0.4)',
          badge: null,
        },
        {
          key: 'weekly-report',
          label: 'Laporan Mingguan',
          subtitle: 'Analisis per minggu',
          icon: CalendarDays,
          lensClass: 'lens-teal',
          glowColor: 'rgba(13, 148, 136, 0.4)',
          badge: null,
        },
        {
          key: 'monthly-report',
          label: 'Laporan Bulanan',
          subtitle: 'Rekap performa bulan',
          icon: CalendarRange,
          lensClass: 'lens-purple',
          glowColor: 'rgba(147, 51, 234, 0.4)',
          badge: null,
        },
        {
          key: 'yearly-report',
          label: 'Laporan Tahunan',
          subtitle: 'Tren 12 bulan & YoY',
          icon: TrendingUp,
          lensClass: 'lens-rose',
          glowColor: 'rgba(225, 29, 72, 0.4)',
          badge: 'Fitur Utama',
          badgeColor: 'bg-rose-100 text-rose-700 border border-rose-300 font-extrabold',
        },
        {
          key: 'streamer-performance',
          label: 'Host Leaderboard',
          subtitle: 'Peringkat live streamer',
          icon: Users,
          lensClass: 'lens-yellow',
          glowColor: 'rgba(234, 179, 8, 0.4)',
          badge: null,
        },
        {
          key: 'shift-analytics',
          label: 'Analisis Shift 1, 2, 3',
          subtitle: 'Efektivitas jam siaran',
          icon: Clock,
          lensClass: 'lens-emerald',
          glowColor: 'rgba(5, 150, 105, 0.4)',
          badge: null,
        },
      ],
    },
    {
      group: 'OPERASIONAL & TARGET',
      items: [
        {
          key: 'schedules',
          label: 'Jadwal Live Host',
          subtitle: 'Rotasi shift & kalender',
          icon: CalendarCheck,
          lensClass: 'lens-orange',
          glowColor: 'rgba(234, 88, 12, 0.4)',
          badge: null,
        },
        {
          key: 'products',
          label: 'Katalog & Sales SKU',
          subtitle: 'Produk terlaris sesi',
          icon: Package,
          lensClass: 'lens-purple',
          glowColor: 'rgba(124, 58, 237, 0.4)',
          badge: null,
        },
        {
          key: 'targets',
          label: 'Target & Realisasi',
          subtitle: 'Tracking omset & gap',
          icon: Target,
          lensClass: 'lens-rose',
          glowColor: 'rgba(225, 29, 72, 0.4)',
          badge: null,
        },
      ],
    },
    // Admin specific modules
    ...(isAdmin
      ? [
          {
            group: 'ADMINISTRASI',
            items: [
              {
                key: 'streamers-mgmt' as NavTabKey,
                label: 'Kelola Tim Host',
                subtitle: 'Manajemen akun streamer',
                icon: UserCheck,
                lensClass: 'lens-cyan',
                glowColor: 'rgba(2, 132, 199, 0.4)',
                badge: null,
              },
              {
                key: 'audit-logs' as NavTabKey,
                label: 'Audit Trail Logs',
                subtitle: 'Riwayat data Firestore',
                icon: History,
                lensClass: 'lens-slate',
                glowColor: 'rgba(71, 85, 105, 0.4)',
                badge: null,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isActuallyOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar container with 3D Neumorphic Infographic Menu styling */}
      <aside
        id="app-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e8eef8] border-r-2 border-slate-200/90 shadow-[6px_0_28px_rgba(30,58,138,0.06)] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isActuallyOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
          {navItems.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <div className="px-3 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {group.group}
                </span>
                <span className="h-[1px] flex-1 ml-2 bg-slate-200/80 rounded-full" />
              </div>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  const isJustClicked = clickedTab === item.key;

                  return (
                    <motion.button
                      key={item.key}
                      type="button"
                      id={`sidebar-nav-${item.key}`}
                      onClick={() => handleNav(item.key)}
                      whileHover={{ scale: 1.025, x: 3 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                      className={`w-full group h-14 sm:h-[58px] flex items-center p-1.5 pr-3.5 rounded-full text-left relative overflow-hidden transition-all duration-200 cursor-pointer select-none ${
                        isActive
                          ? 'infographic-pill-active ring-2 ring-blue-400/60 shadow-[0_10px_22px_-3px_rgba(37,99,235,0.22)]'
                          : 'infographic-pill'
                      }`}
                    >
                      {/* Active Indicator Sliding Highlight */}
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebarIndicator"
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent rounded-full pointer-events-none"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}

                      {/* Click Ripple Shockwave on the whole button */}
                      <AnimatePresence>
                        {isJustClicked && (
                          <motion.span
                            initial={{ scale: 0.3, opacity: 0.9 }}
                            animate={{ scale: 2.4, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.55, ease: 'easeOut' }}
                            className="absolute left-6 w-12 h-12 rounded-full pointer-events-none bg-blue-400/25 blur-xs"
                          />
                        )}
                      </AnimatePresence>

                      {/* LEFT SIDE: 3D Raised Circular Button / Orb (Matching Reference Image) */}
                      <div className="relative shrink-0 mr-2.5">
                        {/* Outer 3D Saucer / Bezel Ring */}
                        <div className="w-11 h-11 sm:w-12 sm:h-12 infographic-disc p-1 relative">
                          {/* Pulsing glow ring when active */}
                          {isActive && (
                            <motion.div
                              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.15, 0.6] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 rounded-full border-2 border-blue-400/70 pointer-events-none"
                            />
                          )}

                          {/* Inner Recessed Vibrant Colored Lens */}
                          <div
                            className={`w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-full ${item.lensClass} flex items-center justify-center relative overflow-hidden text-white transition-transform duration-200 group-hover:scale-105`}
                          >
                            {/* Glossy Reflection Highlight */}
                            <div className="absolute top-0.5 left-1 right-1 h-3 rounded-full bg-white/40 blur-[0.5px] pointer-events-none" />

                            {/* Center 3D Icon with Bounce Animation */}
                            <motion.div
                              animate={
                                isJustClicked
                                  ? { rotate: [0, -18, 18, 0], scale: [1, 1.3, 1] }
                                  : isActive
                                  ? { scale: [1, 1.08, 1] }
                                  : { scale: 1 }
                              }
                              transition={{ duration: 0.45 }}
                            >
                              <Icon className="w-4.5 h-4.5 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.6)]" />
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SIDE: Text Details (Infographics Style) */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs sm:text-[12.5px] font-black tracking-tight truncate transition-colors duration-150 ${
                              isActive
                                ? 'text-blue-900 font-extrabold'
                                : 'text-slate-700 group-hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] sm:text-[10.5px] font-semibold truncate transition-colors duration-150 ${
                            isActive ? 'text-blue-600 font-bold' : 'text-slate-400 group-hover:text-slate-500'
                          }`}
                        >
                          {item.subtitle}
                        </span>
                      </div>

                      {/* Optional Badge / Active Jewel Dot */}
                      <div className="shrink-0 flex items-center ml-1">
                        {item.badge ? (
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap ${
                              item.badgeColor || 'bg-blue-100 text-blue-700 font-bold'
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : isActive ? (
                          <motion.span
                            layoutId="activeJewel"
                            className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(37,99,235,0.7)]"
                            animate={{ scale: [1, 1.25, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                          />
                        ) : null}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card bottom of sidebar styled as 3D Clay Pill */}
        <div className="p-3 border-t-2 border-slate-200/80 bg-white/70 backdrop-blur-md space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs flex items-center justify-center font-black text-xs">
              {currentUser?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-800 truncate">
                {currentUser?.displayName || 'User'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentUser?.role === 'ADMIN' ? 'bg-emerald-500' : 'bg-blue-500'
                  } animate-pulse`}
                />
                <p className="text-[10px] text-slate-500 font-bold">
                  {currentUser?.role === 'ADMIN' ? 'Admin Shopee' : 'Live Streamer'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 font-bold">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-amber-600" />
              <span>Firestore DB</span>
            </div>
            <span className="flex items-center gap-1 text-emerald-700 font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Sync
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
