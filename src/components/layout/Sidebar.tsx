import React from 'react';
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
} from 'lucide-react';
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

  const handleClose = () => {
    if (setSidebarOpen) setSidebarOpen(false);
    if (onClose) onClose();
  };

  const handleNav = (tab: NavTabKey) => {
    if (tab === 'input-live' && onOpenLiveModal) {
      onOpenLiveModal();
      handleClose();
      return;
    }
    setActiveTab(tab);
    handleClose();
  };

  const navItems = [
    {
      group: 'UTAMA',
      items: [
        {
          key: 'dashboard' as NavTabKey,
          label: isAdmin ? 'Executive Dashboard' : 'Dashboard Streamer',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          key: 'input-live' as NavTabKey,
          label: 'Input Live Report',
          icon: PlusCircle,
          badge: pendingReportCount > 0 ? `${pendingReportCount} Tertunda` : null,
          badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        },
        {
          key: 'analytics' as NavTabKey,
          label: '10 Analytics Charts',
          icon: BarChart3,
          badge: null,
        },
      ],
    },
    {
      group: 'LAPORAN & ANALISIS',
      items: [
        {
          key: 'daily-report' as NavTabKey,
          label: 'Laporan Harian (Daily)',
          icon: Calendar,
          badge: null,
        },
        {
          key: 'weekly-report' as NavTabKey,
          label: 'Laporan Mingguan (Weekly)',
          icon: CalendarDays,
          badge: null,
        },
        {
          key: 'monthly-report' as NavTabKey,
          label: 'Laporan Bulanan (Monthly)',
          icon: CalendarRange,
          badge: null,
        },
        {
          key: 'yearly-report' as NavTabKey,
          label: 'Laporan Tahunan (Yearly)',
          icon: TrendingUp,
          badge: 'Fitur Utama',
          badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        },
        {
          key: 'streamer-performance' as NavTabKey,
          label: 'Streamer & Leaderboard',
          icon: Users,
          badge: null,
        },
        {
          key: 'shift-analytics' as NavTabKey,
          label: 'Analisis Shift (1, 2, 3)',
          icon: Clock,
          badge: null,
        },
      ],
    },
    {
      group: 'OPERASIONAL & TARGET',
      items: [
        {
          key: 'schedules' as NavTabKey,
          label: 'Jadwal Live (Schedules)',
          icon: CalendarCheck,
          badge: null,
        },
        {
          key: 'products' as NavTabKey,
          label: 'Katalog & Sales Produk',
          icon: Package,
          badge: null,
        },
        {
          key: 'targets' as NavTabKey,
          label: 'Target & Realisasi',
          icon: Target,
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
                label: 'Kelola Tim Streamer',
                icon: UserCheck,
                badge: null,
              },
              {
                key: 'audit-logs' as NavTabKey,
                label: 'Audit Trail / Log',
                icon: History,
                badge: null,
              },
            ],
          },
        ]
      : []),
  ];

  const getTabGradient = (key: NavTabKey) => {
    switch (key) {
      case 'dashboard':
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'input-live':
        return 'bg-gradient-to-r from-orange-500 to-amber-600 shadow-[0_4px_12px_rgba(249,115,22,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'analytics':
        return 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-[0_4px_12px_rgba(99,102,241,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'daily-report':
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-[0_4px_12px_rgba(16,185,129,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'weekly-report':
        return 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_4px_12px_rgba(14,165,233,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'monthly-report':
        return 'bg-gradient-to-r from-purple-600 to-violet-600 shadow-[0_4px_12px_rgba(147,51,234,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'yearly-report':
        return 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-[0_4px_12px_rgba(244,63,94,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'streamer-performance':
        return 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'shift-analytics':
        return 'bg-gradient-to-r from-teal-600 to-emerald-600 shadow-[0_4px_12px_rgba(20,184,166,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'schedules':
        return 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_4px_12px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'products':
        return 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_4px_12px_rgba(139,92,246,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      case 'targets':
        return 'bg-gradient-to-r from-rose-600 to-red-600 shadow-[0_4px_12px_rgba(225,29,72,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
      default:
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)]';
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isActuallyOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar container with 3D Binder Organizer styling */}
      <aside
        id="app-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-white/95 backdrop-blur-xl border-r border-blue-100/90 shadow-[4px_0_24px_rgba(30,58,138,0.04)] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isActuallyOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navItems.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {group.group}
              </div>
              <div className="space-y-1 mt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  const activeGrad = getTabGradient(item.key);

                  return (
                    <button
                      key={item.key}
                      type="button"
                      id={`sidebar-nav-${item.key}`}
                      onClick={() => handleNav(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-150 text-left relative ${
                        isActive
                          ? `${activeGrad} text-white scale-[1.02]`
                          : 'text-slate-600 hover:bg-blue-50/70 hover:text-blue-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-xs ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : item.badgeColor || 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card bottom of sidebar styled as 3D Clay Pill */}
        <div className="p-3 border-t border-blue-100/80 bg-slate-50/70">
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white border border-blue-100/80 shadow-[0_2px_8px_rgba(30,58,138,0.04)]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs flex items-center justify-center font-bold text-xs">
              {currentUser?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {currentUser?.displayName || 'User'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentUser?.role === 'ADMIN' ? 'bg-emerald-500' : 'bg-blue-500'
                  } animate-pulse`}
                />
                <p className="text-[10px] text-slate-500 font-semibold">
                  {currentUser?.role === 'ADMIN' ? 'Admin Shopee' : 'Live Streamer'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
