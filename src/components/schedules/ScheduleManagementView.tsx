import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Plus,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  PlusCircle,
  Bell,
  Send,
  Radio,
  Sparkles,
  Check,
} from 'lucide-react';
import { Schedule, Streamer, LiveSession } from '../../types';
import { SHIFTS, getJakartaDate } from '../../utils/shiftLogic';
import { formatDateID } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  addSchedule,
  updateSchedule,
  deleteSchedule,
  sendScheduleReportReminder,
} from '../../services/firestoreService';

interface ScheduleManagementViewProps {
  schedules: Schedule[];
  streamers: Streamer[];
  onOpenLiveReportForSchedule: (streamerId: string, shiftId: string, date: string) => void;
}

export const ScheduleManagementView: React.FC<ScheduleManagementViewProps> = ({
  schedules,
  streamers,
  onOpenLiveReportForSchedule,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const todayStr = getJakartaDate();

  // Filters
  const [filterStreamer, setFilterStreamer] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [onlyNeedsReport, setOnlyNeedsReport] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Reminder states
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Form states for creating/editing schedule
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formStreamerId, setFormStreamerId] = useState<string>('');
  const [formShiftId, setFormShiftId] = useState<string>('shift-1');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'Scheduled' | 'Live' | 'Completed' | 'Missed' | 'Cancelled'>('Scheduled');
  const [submitting, setSubmitting] = useState(false);

  // Schedules that need live reports
  const schedulesNeedingReport = useMemo(() => {
    return schedules.filter((s) => !s.hasReport && s.status !== 'Cancelled');
  }, [schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (filterStreamer !== 'ALL' && s.streamerId !== filterStreamer) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (onlyNeedsReport && (s.hasReport || s.status === 'Cancelled')) return false;
      return true;
    });
  }, [schedules, filterStreamer, filterStatus, onlyNeedsReport]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setReminderToast({ msg, type });
    setTimeout(() => {
      setReminderToast(null);
    }, 4500);
  };

  const handleSendReminder = async (sc: Schedule) => {
    setSendingReminderId(sc.id);
    try {
      const res = await sendScheduleReportReminder(
        sc,
        currentUser?.displayName || 'Admin',
        currentUser?.uid || 'admin'
      );
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim pengingat', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleSendAllReminders = async () => {
    if (schedulesNeedingReport.length === 0) return;
    if (
      !confirm(
        `Kirim notifikasi pengingat real-time ke ${schedulesNeedingReport.length} jadwal yang belum diisi laporannya?`
      )
    ) {
      return;
    }

    setSendingReminderId('ALL');
    try {
      for (const sc of schedulesNeedingReport) {
        await sendScheduleReportReminder(
          sc,
          currentUser?.displayName || 'Admin',
          currentUser?.uid || 'admin'
        );
      }
      showToast(
        `Berhasil mengirim ${schedulesNeedingReport.length} notifikasi pengingat ke seluruh streamer!`,
        'success'
      );
    } catch (err: any) {
      showToast('Terjadi kesalahan saat mengirim pengingat masal.', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    setFormDate(todayStr);
    setFormStreamerId(streamers[0]?.id || '');
    setFormShiftId('shift-1');
    setFormNotes('');
    setFormStatus('Scheduled');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sc: Schedule) => {
    setEditingSchedule(sc);
    setFormDate(sc.date);
    setFormStreamerId(sc.streamerId);
    setFormShiftId(sc.shiftId);
    setFormNotes(sc.notes || '');
    setFormStatus(sc.status);
    setIsModalOpen(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStreamerId) return;

    const st = streamers.find((x) => x.id === formStreamerId);
    const sh = SHIFTS.find((x) => x.id === formShiftId);

    setSubmitting(true);
    try {
      if (editingSchedule) {
        await updateSchedule(
          editingSchedule.id,
          {
            streamerId: formStreamerId,
            streamerName: st?.name || 'Streamer',
            shiftId: formShiftId,
            shiftName: sh?.name || 'Shift 1',
            date: formDate,
            startTime: sh?.startTime || '06:00',
            endTime: sh?.endTime || '15:00',
            status: formStatus,
            notes: formNotes,
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      } else {
        await addSchedule(
          {
            streamerId: formStreamerId,
            streamerName: st?.name || 'Streamer',
            shiftId: formShiftId,
            shiftName: sh?.name || 'Shift 1',
            date: formDate,
            startTime: sh?.startTime || '06:00',
            endTime: sh?.endTime || '15:00',
            status: 'Scheduled',
            hasReport: false,
            notes: formNotes,
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving schedule:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string, label: string) => {
    if (confirm(`Yakin ingin menghapus jadwal ${label}?`)) {
      await deleteSchedule(id, label, currentUser?.displayName || 'User', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback for Real-Time Reminder */}
      {reminderToast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
            reminderToast.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-500 backdrop-blur-md'
              : 'bg-rose-900/90 text-white border-rose-500 backdrop-blur-md'
          }`}
        >
          {reminderToast.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{reminderToast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <CalendarCheck className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <span>Manajemen Jadwal Live Streamer</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black tracking-normal lowercase first-letter:uppercase">
                  <Radio className="w-3 h-3 text-blue-600 animate-pulse" />
                  Real-time Sync
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Penjadwalan shift live streaming Shopee dengan notifikasi real-time otomatis untuk admin dan streamer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && schedulesNeedingReport.length > 0 && (
              <button
                type="button"
                id="send-all-reminders-btn"
                onClick={handleSendAllReminders}
                disabled={sendingReminderId === 'ALL'}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                title="Kirim notifikasi pengingat ke seluruh streamer yang jadwalnya belum ada laporan"
              >
                <Bell className={`w-3.5 h-3.5 text-amber-700 ${sendingReminderId === 'ALL' ? 'animate-bounce' : ''}`} />
                <span>{sendingReminderId === 'ALL' ? 'Mengirim...' : `Ingatkan Semua (${schedulesNeedingReport.length})`}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                id="add-schedule-btn"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Jadwal Live</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Notification Status Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-amber-50/80 border border-blue-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <span>Notifikasi Otomatis Terintegrasi</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Setiap pembuatan jadwal live otomatis mengirim notifikasi ke Streamer & Admin. Jika sesi berakhir tanpa laporan, pengingat dapat dikirimkan secara instan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOnlyNeedsReport(!onlyNeedsReport)}
              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer border flex items-center gap-1.5 ${
                onlyNeedsReport
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <span>⚠️ Perlu Laporan</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${onlyNeedsReport ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {schedulesNeedingReport.length}
              </span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Streamer:</span>
            <select
              value={filterStreamer}
              onChange={(e) => setFilterStreamer(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Streamer</option>
              {streamers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Missed">Missed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* SCHEDULES LIST */}
      <div className="clay-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
          Daftar Jadwal ({filteredSchedules.length})
        </h3>

        {filteredSchedules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada jadwal yang sesuai filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchedules.map((sc) => (
              <div
                key={sc.id}
                className="clay-card p-5 space-y-3 relative hover:shadow-md transition-all border border-slate-200/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full clay-sphere-orange flex items-center justify-center text-white">
                      <User className="w-3 h-3" />
                    </div>
                    {sc.streamerName}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border ${
                      sc.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sc.status === 'Missed'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : sc.status === 'Cancelled'
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {sc.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="text-slate-800 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {formatDateID(sc.date)}
                  </div>
                  <div className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {sc.shiftName} ({sc.startTime} - {sc.endTime} WIB)
                  </div>
                </div>

                {sc.notes && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl italic border border-slate-200/60 font-medium">
                    "{sc.notes}"
                  </p>
                )}

                {/* Report status & action */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    {sc.hasReport ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-[11px] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Laporan Selesai
                      </span>
                    ) : (
                      <span className="text-amber-800 font-bold flex items-center gap-1.5 text-[11px] bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Perlu Input Laporan
                      </span>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Jadwal"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(sc.id, `${sc.streamerName} (${sc.date})`)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions when schedule has NO report yet */}
                  {!sc.hasReport && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenLiveReportForSchedule(sc.streamerId, sc.shiftId, sc.date)
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Isi Laporan</span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(sc)}
                          disabled={sendingReminderId === sc.id}
                          className="flex items-center gap-1 py-1.5 px-2.5 text-[11px] font-bold text-amber-800 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          title="Kirim notifikasi pengingat real-time ke streamer ini"
                        >
                          <Bell className={`w-3.5 h-3.5 text-amber-700 ${sendingReminderId === sc.id ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">Ingatkan</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT SCHEDULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                {editingSchedule ? 'Edit Jadwal Live' : 'Tambah Jadwal Live'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Streamer</label>
                <select
                  required
                  value={formStreamerId}
                  onChange={(e) => setFormStreamerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="">Pilih Streamer...</option>
                  {streamers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Shift</label>
                <select
                  value={formShiftId}
                  onChange={(e) => setFormShiftId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  {SHIFTS.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.startTime} - {sh.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {editingSchedule && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Status Jadwal</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Missed">Missed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Keterangan khusus jadwal..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white rounded-xl shadow-md transition-all active:scale-95"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
