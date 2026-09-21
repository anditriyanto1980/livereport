import React, { useState, useEffect } from 'react';
import {
  Clock,
  PlusCircle,
  Shield,
  User,
  Radio,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Database,
  Trash2,
  Lock,
  LogOut,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Streamer } from '../../types';
import { seedInitialDemoData } from '../../services/firestoreService';

interface HeaderProps {
  streamers: Streamer[];
  onOpenLiveModal: () => void;
  onMenuToggle: () => void;
  onOpenResetModal?: () => void;
  onOpenAdminAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  streamers,
  onOpenLiveModal,
  onMenuToggle,
  onOpenResetModal,
  onOpenAdminAuthModal,
}) => {
  const { currentUser, switchStreamer, lockAdminSession, isAdmin } = useAuth();
  const [jakartaTime, setJakartaTime] = useState<string>('');
  const [seeding, setSeeding] = useState(false);

  // Real-time Jakarta Clock (WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      setJakartaTime(`${dateStr} • ${timeStr} WIB`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleReseed = async () => {
    if (confirm('Muat ulang data demo Shopee Live untuk Dona, Nina, Nata, Fawwas?')) {
      setSeeding(true);
      try {
        await seedInitialDemoData();
      } catch (err) {
        console.error('Seed error:', err);
      } finally {
        setSeeding(false);
      }
    }
  };

  return (
    <header className="bg-white/85 backdrop-blur-xl border-b border-blue-100/80 sticky top-0 z-30 px-4 lg:px-8 py-3.5 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.06)] transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile menu trigger & system status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-colors cursor-pointer"
            title="Buka Menu"
          >
            <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
          </button>

          {/* Mobile brand title */}
          <div className="lg:hidden flex items-center gap-1.5">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white font-black text-xs flex items-center justify-center shadow-xs border border-white/50">
              AT
            </span>
            <span className="font-black text-xs text-slate-800 tracking-tight">
              AT <span className="text-slate-400 font-normal">-</span> <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Live Reports</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-blue-50/80 border border-blue-100/90 rounded-2xl text-xs shadow-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-700 font-semibold">{jakartaTime || 'Memuat waktu...'}</span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-xs">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>AI+ Live Analytics</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-xs shadow-xs text-amber-900 font-bold" title="Database Firestore Aktif">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px]">Firestore Connected</span>
          </div>
        </div>

        {/* Action buttons & User Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* RESET KE 0 BUTTON (Hanya Ditampilkan untuk Akun ADMIN) */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenResetModal}
                title="Reset Database Menjadi 0 Data (Khusus Admin Berkata Sandi)"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border-2 border-rose-200 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-[11px]">Reset ke 0</span>
                <span className="hidden sm:inline-block text-[9px] uppercase px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-md font-black">
                  Admin
                </span>
              </button>

              {/* Optional Demo Re-load for admin testing */}
              <button
                type="button"
                onClick={handleReseed}
                disabled={seeding}
                title="Muat Ulang Demo Data Sampel"
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 text-slate-400 ${seeding ? 'animate-spin' : ''}`} />
                <span>{seeding ? 'Memuat...' : 'Muat Demo'}</span>
              </button>
            </div>
          )}

          {/* "+ Input Laporan Live" Primary Button */}
          <button
            type="button"
            id="header-input-live-btn"
            onClick={onOpenLiveModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Input Laporan Live</span>
            <span className="sm:hidden">Input Live</span>
          </button>

          {/* USER PROFILE & ACCESS GATE (Option 3: Hybrid Architecture) */}
          {isAdmin ? (
            /* ADMIN IS LOGGED IN: Show Active Admin Status + Lock Button */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50 to-blue-50 border-2 border-amber-200/90 rounded-2xl px-3 py-1.5 shadow-[0_2px_10px_rgba(245,158,11,0.12)]">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-blue-700 text-white flex items-center justify-center font-black text-xs shadow-xs border-2 border-white">
                    👑
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-amber-700 font-black uppercase tracking-wider">
                      Administrator
                    </span>
                    <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                  </div>
                  <span className="text-slate-900 font-black text-xs">
                    Full Access (Admin)
                  </span>
                </div>
              </div>

              {/* Lock / Exit Admin Mode Button */}
              <button
                type="button"
                onClick={lockAdminSession}
                title="Kunci Akses Admin dan Kembali ke Mode Host Streamer"
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border-2 border-rose-200 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Kunci Admin</span>
                <span className="sm:hidden">Kunci</span>
              </button>
            </div>
          ) : (
            /* REGULAR / HOST MODE: Dropdown only contains Streamers + Separate "Masuk Admin" button */
            <div className="flex items-center gap-2">
              {/* Host Streamer Selector (NO ADMIN OPTION HERE) */}
              <div className="flex items-center gap-2.5 bg-white border border-blue-100/90 rounded-2xl px-3 py-1.5 shadow-[0_2px_8px_rgba(30,58,138,0.06)]">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-xs border-2 border-white">
                    {currentUser?.displayName?.replace('Host: ', '').slice(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-wide">
                      Aktif Sebagai
                    </span>
                    <Shield className="w-2.5 h-2.5 text-blue-500" />
                  </div>
                  <select
                    value={currentUser?.streamerId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const st = streamers.find((x) => x.id === val);
                      if (st) {
                        switchStreamer(st.id, st.name);
                      }
                    }}
                    className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {streamers.map((s) => (
                      <option key={s.id} value={s.id} className="bg-white text-slate-900 font-medium">
                        🎙️ Host: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SEPARATE ADMIN ACCESS BUTTON (Protected Gate) */}
              {onOpenAdminAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAdminAuthModal}
                  title="Buka Hak Akses Administrator (Perlu Kata Sandi)"
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black rounded-2xl shadow-[0_4px_12px_rgba(217,119,6,0.25)] transition-all active:scale-95 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-100" />
                  <span className="hidden sm:inline">Akses Admin</span>
                  <span className="sm:hidden">Admin</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

