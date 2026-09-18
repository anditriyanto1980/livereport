import React, { useState } from 'react';
import {
  Radio,
  Bell,
  PlusCircle,
  Shield,
  User,
  LogOut,
  ChevronDown,
  Database,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Streamer, NotificationItem } from '../../types';
import { seedInitialDatabase } from '../../services/firestoreService';

interface NavbarProps {
  streamers: Streamer[];
  notifications: NotificationItem[];
  unreadCount: number;
  onOpenNewLiveModal: () => void;
  onOpenNotifications: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  streamers,
  notifications,
  unreadCount,
  onOpenNewLiveModal,
  onOpenNotifications,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const { currentUser, switchDemoRole, logoutUser, isAdmin } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const handleSeedData = async () => {
    setIsSeeding(true);
    const res = await seedInitialDatabase(true);
    setSeedMsg(res.message);
    setTimeout(() => setSeedMsg(null), 4000);
    setIsSeeding(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile Toggle & Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="mobile-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Radio className="w-5 h-5 animate-pulse drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                  LIVESTREAM PERFORMANCE
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded-lg">
                  SHOPEE LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block truncate max-w-xs md:max-w-md">
                Sistem Monitoring & Analytics Tim Live Streamer
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Seed Data Button */}
          <button
            type="button"
            id="seed-data-btn"
            onClick={handleSeedData}
            disabled={isSeeding}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95"
            title="Muat ulang atau inisialisasi sample data 4 streamer & live session September 2026"
          >
            <Database className="w-3.5 h-3.5 text-orange-500" />
            <span>{isSeeding ? 'Memuat Data...' : 'Reset / Seed Demo'}</span>
          </button>

          {/* Quick Input Live Report Button */}
          <button
            type="button"
            id="navbar-input-report-btn"
            onClick={onOpenNewLiveModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-xl shadow-[0_4px_14px_rgba(249,115,22,0.3)] active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden xs:inline">Input Live Report</span>
            <span className="xs:hidden">Input</span>
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            id="navbar-notifications-btn"
            onClick={onOpenNotifications}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="Pemberitahuan"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Role & Persona Switcher */}
          <div className="relative">
            <button
              type="button"
              id="role-switch-dropdown-btn"
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-orange-500">
                {currentUser?.role === 'ADMIN' ? <Shield className="w-4 h-4 text-emerald-600" /> : <User className="w-4 h-4 text-orange-500" />}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[110px]">
                  {currentUser?.displayName || 'Admin'}
                </div>
                <div className="text-[10px] font-bold text-slate-500">
                  {currentUser?.role === 'ADMIN' ? 'SUPER ADMIN' : 'STREAMER'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {roleDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-slate-700"
                onClick={() => setRoleDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Ganti Role / Persona Uji
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Login saat ini: <strong className="text-slate-900">{currentUser?.displayName}</strong>
                  </p>
                </div>

                <div className="py-1">
                  {/* Admin Choice */}
                  <button
                    type="button"
                    onClick={() => switchDemoRole('ADMIN')}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      currentUser?.role === 'ADMIN' ? 'bg-emerald-50 text-emerald-700 font-bold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-bold">Admin Shopee Live</div>
                        <div className="text-[10px] text-slate-400 font-normal">Akses penuh seluruh data</div>
                      </div>
                    </div>
                    {currentUser?.role === 'ADMIN' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <div className="my-1 border-t border-slate-100" />
                  <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase">
                    PILIH STREAMER (Dona, Nina, Nata, Fawwas):
                  </div>

                  {streamers.length > 0 ? (
                    streamers.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => switchDemoRole('STREAMER', st.id, st.name)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          currentUser?.streamerId === st.id ? 'bg-blue-50 text-blue-700 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {st.name.charAt(0)}
                          </div>
                          <span>{st.name}</span>
                        </div>
                        {currentUser?.streamerId === st.id && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-slate-400 italic">
                      Streamer belum dimuat. Klik Reset/Seed Demo.
                    </div>
                  )}
                </div>

                <div className="mt-1 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => logoutUser()}
                    className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {seedMsg && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 text-center font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{seedMsg}</span>
        </div>
      )}
    </header>
  );
};
