import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  Calendar,
  DollarSign,
  TrendingUp,
  User,
  Users,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { Target as TargetType, Streamer, LiveSession } from '../../types';
import { formatIDR, safeDivide, MONTH_NAMES_ID } from '../../utils/formatters';
import { getJakartaDate } from '../../utils/shiftLogic';
import { useAuth } from '../../context/AuthContext';
import { addTarget, updateTarget, deleteTarget } from '../../services/firestoreService';

interface TargetManagementViewProps {
  targets: TargetType[];
  streamers: Streamer[];
  sessions: LiveSession[];
}

export const TargetManagementView: React.FC<TargetManagementViewProps> = ({
  targets,
  streamers,
  sessions,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const todayStr = getJakartaDate();
  const [currY, currM] = todayStr.split('-').map(Number);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetType | null>(null);

  // Form states
  const [formPeriod, setFormPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [formType, setFormType] = useState<'individual' | 'team'>('team');
  const [formStreamerId, setFormStreamerId] = useState<string>('');
  const [formYear, setFormYear] = useState<number>(currY);
  const [formMonth, setFormMonth] = useState<number>(currM);
  const [formTargetValue, setFormTargetValue] = useState<number>(100000000);
  const [submitting, setSubmitting] = useState(false);

  // Calculate actual progress for each target
  const targetCards = useMemo(() => {
    return targets.map((t) => {
      let actual = 0;

      if (t.period === 'monthly') {
        const mPrefix = `${t.year}-${String(t.month || 1).padStart(2, '0')}`;
        const matched = sessions.filter((s) => {
          if (!s.businessDate.startsWith(mPrefix)) return false;
          if (t.type === 'individual' && t.streamerId) {
            return s.streamerId === t.streamerId;
          }
          return true;
        });
        actual = matched.reduce((sum, x) => sum + (x.revenue || 0), 0);
      } else if (t.period === 'yearly') {
        const matched = sessions.filter((s) => {
          if (!s.businessDate.startsWith(String(t.year))) return false;
          if (t.type === 'individual' && t.streamerId) {
            return s.streamerId === t.streamerId;
          }
          return true;
        });
        actual = matched.reduce((sum, x) => sum + (x.revenue || 0), 0);
      }

      const achievementPct = safeDivide(actual * 100, t.targetValue, 0);

      return {
        ...t,
        actualRevenue: actual,
        achievementPct: Number(achievementPct.toFixed(1)),
      };
    });
  }, [targets, sessions]);

  const handleOpenCreateModal = () => {
    setEditingTarget(null);
    setFormPeriod('monthly');
    setFormType('team');
    setFormStreamerId('');
    setFormYear(currY);
    setFormMonth(currM);
    setFormTargetValue(100000000);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: TargetType) => {
    setEditingTarget(t);
    setFormPeriod(t.period);
    setFormType(t.type);
    setFormStreamerId(t.streamerId || '');
    setFormYear(t.year);
    setFormMonth(t.month || currM);
    setFormTargetValue(t.targetValue);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = streamers.find((x) => x.id === formStreamerId);

    setSubmitting(true);
    try {
      if (editingTarget) {
        await updateTarget(
          editingTarget.id,
          {
            period: formPeriod,
            type: formType,
            streamerId: formType === 'individual' ? formStreamerId : undefined,
            streamerName: formType === 'individual' ? st?.name : undefined,
            year: Number(formYear),
            month: formPeriod === 'monthly' ? Number(formMonth) : undefined,
            targetValue: Number(formTargetValue),
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      } else {
        await addTarget(
          {
            period: formPeriod,
            type: formType,
            streamerId: formType === 'individual' ? formStreamerId : undefined,
            streamerName: formType === 'individual' ? st?.name : undefined,
            year: Number(formYear),
            month: formPeriod === 'monthly' ? Number(formMonth) : undefined,
            targetValue: Number(formTargetValue),
            actualValue: 0,
            currency: 'IDR',
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving target:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (confirm(`Yakin ingin menghapus target ${label}?`)) {
      await deleteTarget(id, label, currentUser?.displayName || 'User', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Target className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Target & Realisasi Omset
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Penetapan target omset bulanan dan tahunan untuk tim live streamer Shopee dan monitoring pencapaian real-time.
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              id="add-target-btn"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tetapkan Target Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* TARGETS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {targetCards.map((t) => (
          <div
            key={t.id}
            className="clay-card p-6 space-y-4 relative hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-lg border ${
                    t.type === 'team'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}
                >
                  {t.type === 'team' ? 'TEAM TARGET' : `INDIVIDUAL: ${t.streamerName}`}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {t.period === 'monthly'
                    ? `Bulan ${MONTH_NAMES_ID[(t.month || 1) - 1]} ${t.year}`
                    : `Tahun ${t.year}`}
                </span>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(t)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, `${t.period} ${t.year}`)}
                    className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Target Value vs Actual Value */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Target Ditetapkan
                </span>
                <div className="text-xl font-black text-slate-800">{formatIDR(t.targetValue)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Realisasi (Actual)
                </span>
                <div className="text-lg font-black text-emerald-600">
                  {formatIDR(t.actualRevenue)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Progres Pencapaian</span>
                <span className="font-extrabold text-blue-600">{t.achievementPct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    t.achievementPct >= 100
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, t.achievementPct))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                {editingTarget ? 'Edit Target Omset' : 'Tetapkan Target Omset Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Periode</label>
                  <select
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    <option value="monthly">Bulanan (Monthly)</option>
                    <option value="yearly">Tahunan (Yearly)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tipe Target</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    <option value="team">Target Tim Keseluruhan</option>
                    <option value="individual">Target Streamer Individu</option>
                  </select>
                </div>
              </div>

              {formType === 'individual' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Pilih Streamer</label>
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
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tahun</label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {formPeriod === 'monthly' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Bulan</label>
                    <select
                      value={formMonth}
                      onChange={(e) => setFormMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                    >
                      {MONTH_NAMES_ID.map((m, idx) => (
                        <option key={idx} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Nilai Omset (IDR)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-black focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs text-blue-600"
                />
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                  Preview: <strong className="text-slate-800">{formatIDR(formTargetValue)}</strong>
                </span>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
