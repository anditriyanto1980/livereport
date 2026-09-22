import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  Clock,
  Radio,
  AlertTriangle,
  FileText,
  Volume2,
  VolumeX,
  X,
  PlusCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { NotificationItem } from '../../types';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from '../../services/firestoreService';
import { playNotificationChime } from '../../utils/audioChime';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  onOpenReportForSchedule?: (streamerId?: string, shiftId?: string, date?: string) => void;
  onNavigateTab?: (tab: any) => void;
  currentUserRole?: string;
  currentUserId?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onOpenReportForSchedule,
  onNavigateTab,
  currentUserRole,
  currentUserId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'needs_report'>('all');
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shopee_notif_muted') === 'true';
    }
    return false;
  });

  // Floating toast for newly arrived real-time notification
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);
  const prevCountRef = useRef(notifications.length);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Toggle sound mute setting
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shopee_notif_muted', String(next));
    }
  };

  // Detect real-time new incoming notifications
  useEffect(() => {
    if (notifications.length > prevCountRef.current && prevCountRef.current > 0) {
      // Find the newest notification
      const newest = notifications[0];
      if (newest && !newest.read) {
        setLiveToast(newest);
        playNotificationChime(isMuted);

        // Auto dismiss toast after 6 seconds
        const t = setTimeout(() => {
          setLiveToast(null);
        }, 6000);
        return () => clearTimeout(t);
      }
    }
    prevCountRef.current = notifications.length;
  }, [notifications, isMuted]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const needsReportCount = notifications.filter(
    (n) => n.needsReport || n.type === 'reminder' || n.type === 'shift'
  ).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'needs_report') {
      return n.needsReport || n.type === 'reminder' || n.type === 'shift';
    }
    return true;
  });

  const handleActionClick = (n: NotificationItem) => {
    markNotificationAsRead(n.id);
    setIsOpen(false);
    setLiveToast(null);

    if (onOpenReportForSchedule) {
      onOpenReportForSchedule(n.streamerId, n.shiftId, n.date);
    } else if (onNavigateTab) {
      onNavigateTab('schedules');
    }
  };

  const formatTimestamp = (createdAt: any) => {
    if (!createdAt) return 'Baru saja';
    try {
      const millis = createdAt.toMillis ? createdAt.toMillis() : (createdAt.seconds ? createdAt.seconds * 1000 : null);
      if (!millis) return 'Baru saja';
      const diffMs = Date.now() - millis;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      return `${diffDays} hari lalu`;
    } catch {
      return 'Baru saja';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BELL TRIGGER BUTTON */}
      <button
        type="button"
        id="realtime-notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 rounded-2xl transition-all active:scale-95 cursor-pointer border border-transparent hover:border-blue-100"
        title="Pemberitahuan Real-Time Jadwal & Laporan"
        aria-label="Pemberitahuan"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-blue-600' : 'text-slate-500'}`} />

        {unreadCount > 0 && (
          <>
            <span className="absolute top-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-white text-[9px] font-black items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          </>
        )}
      </button>

      {/* FLOATING REAL-TIME TOAST BANNER (appears on live changes) */}
      {liveToast && (
        <div
          id="realtime-live-toast-alert"
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md border-2 border-orange-200/90 rounded-3xl p-4 shadow-[0_12px_40px_rgba(249,115,22,0.25)] animate-in fade-in slide-in-from-bottom-5 duration-300 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                  Notifikasi Real-Time Baru
                </span>
                <h4 className="text-xs font-black text-slate-900 leading-tight">
                  {liveToast.title}
                </h4>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            {liveToast.message}
          </p>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            {(liveToast.needsReport || liveToast.type === 'shift' || liveToast.type === 'reminder') && (
              <button
                type="button"
                onClick={() => handleActionClick(liveToast)}
                className="flex-1 py-1.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Isi Laporan Sekarang</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                markNotificationAsRead(liveToast.id);
                setLiveToast(null);
              }}
              className="py-1.5 px-3 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS DROPDOWN PANEL */}
      {isOpen && (
        <div
          id="realtime-notification-panel"
          className="absolute right-0 mt-3 w-84 sm:w-96 bg-white/95 backdrop-blur-xl border border-blue-100/90 rounded-3xl shadow-[0_16px_50px_-10px_rgba(30,58,138,0.2)] py-4 z-50 animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="px-5 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Pemberitahuan Real-Time
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'} • Jadwal & Laporan
              </p>
            </div>

            {/* Header Controls: Sound & Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? 'Aktifkan Suara Notifikasi' : 'Bisukan Suara Notifikasi'}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-blue-600" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsAsRead(notifications)}
                  title="Tandai Semua Sudah Dibaca"
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Hapus semua pemberitahuan?')) {
                      clearAllNotifications(notifications);
                    }
                  }}
                  title="Bersihkan Semua Notifikasi"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'unread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('needs_report')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'needs_report'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              ⚠️ Perlu Laporan ({needsReportCount})
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/80 px-2">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  Tidak Ada Notifikasi
                </h4>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Semua jadwal dan laporan live streaming Shopee Live tersinkronisasi secara real-time.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isNeedsReport = n.needsReport || n.type === 'reminder' || n.type === 'shift';

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 my-1.5 rounded-2xl transition-all flex flex-col gap-2 relative border ${
                      !n.read
                        ? 'bg-blue-50/50 border-blue-200/70 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-100'
                    }`}
                  >
                    {/* Top Row: Tag, Type Icon & Relative Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {n.priority === 'urgent' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-black uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Segera Isi
                          </span>
                        ) : n.type === 'shift' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-black uppercase flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-600" />
                            Jadwal Live
                          </span>
                        ) : n.type === 'report' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Laporan Selesai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
                            Pengingat
                          </span>
                        )}

                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTimestamp(n.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteNotification(n.id)}
                          title="Hapus pemberitahuan"
                          className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title and Message */}
                    <div>
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Schedule Context Pill if available */}
                    {(n.streamerName || n.shiftName || n.date) && (
                      <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-xl">
                        {n.streamerName && <span>🎙️ {n.streamerName}</span>}
                        {n.shiftName && <span>• {n.shiftName}</span>}
                        {n.date && <span>• 📅 {n.date}</span>}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-100/70">
                      {isNeedsReport ? (
                        <button
                          type="button"
                          onClick={() => handleActionClick(n)}
                          className="py-1.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[11px] font-black shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Isi Laporan Sekarang</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Informasi otomatis</span>
                      )}

                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationAsRead(n.id)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1"
                        >
                          Tandai Dibaca
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
