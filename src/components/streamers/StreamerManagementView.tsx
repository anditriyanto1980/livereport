import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Phone,
  Shield,
  Percent,
  DollarSign,
} from 'lucide-react';
import { Streamer } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { addStreamer, updateStreamer, deleteStreamer } from '../../services/firestoreService';

interface StreamerManagementViewProps {
  streamers: Streamer[];
}

export const StreamerManagementView: React.FC<StreamerManagementViewProps> = ({ streamers }) => {
  const { currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStreamer, setEditingStreamer] = useState<Streamer | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSalary, setFormSalary] = useState<number>(3500000);
  const [formCommission, setFormCommission] = useState<number>(1.5);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setEditingStreamer(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormSalary(3500000);
    setFormCommission(1.5);
    setFormStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Streamer) => {
    setEditingStreamer(s);
    setFormName(s.name);
    setFormEmail(s.email || '');
    setFormPhone(s.phone || '');
    setFormSalary(s.baseSalary || 3500000);
    setFormCommission(s.commissionRate || 1.5);
    setFormStatus(s.status);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (s: Streamer) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    await updateStreamer(
      s.id,
      { status: newStatus },
      currentUser?.displayName || 'Admin',
      currentUser?.uid || 'uid'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    setSubmitting(true);
    try {
      if (editingStreamer) {
        await updateStreamer(
          editingStreamer.id,
          {
            name: formName,
            email: formEmail,
            phone: formPhone,
            baseSalary: Number(formSalary),
            commissionRate: Number(formCommission),
            status: formStatus,
          },
          currentUser?.displayName || 'Admin',
          currentUser?.uid || 'uid'
        );
      } else {
        await addStreamer(
          {
            name: formName,
            email: formEmail,
            phone: formPhone,
            baseSalary: Number(formSalary),
            commissionRate: Number(formCommission),
            status: formStatus,
            joinedDate: new Date().toISOString().slice(0, 10),
          },
          currentUser?.displayName || 'Admin',
          currentUser?.uid || 'uid'
        );
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving streamer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus streamer "${name}" dari database?`)) {
      await deleteStreamer(id, name, currentUser?.displayName || 'Admin', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <UserCheck className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Kelola Tim Live Streamer (Database Streamer)
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Tambah, edit, aktifkan, atau non-aktifkan streamer secara fleksibel melalui Firestore tanpa hard-code.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="add-streamer-btn"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Streamer Baru</span>
          </button>
        </div>
      </div>

      {/* STREAMERS TABLE */}
      <div className="clay-card p-6 space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3.5">Nama Streamer</th>
                <th className="py-3 px-3.5">Kontak</th>
                <th className="py-3 px-3.5">Status Akun</th>
                <th className="py-3 px-3.5 text-right">Gaji Pokok</th>
                <th className="py-3 px-3.5 text-right">Komisi (%)</th>
                <th className="py-3 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {streamers.map((st) => (
                <tr key={st.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-bold text-slate-800 text-sm">{st.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {st.id}</div>
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="text-slate-600 font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {st.email || '-'}
                    </div>
                    {st.phone && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {st.phone}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(st)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shadow-xs ${
                        st.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Klik untuk mengubah status aktif/nonaktif"
                    >
                      {st.status === 'active' ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Aktif (Klik ubah)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Non-aktif (Klik aktifkan)</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-slate-800">
                    {formatIDR(st.baseSalary || 0)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-black text-blue-600">
                    {st.commissionRate || 0}%
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(st)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Streamer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(st.id, st.name)}
                        className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                {editingStreamer ? 'Edit Data Streamer' : 'Tambah Streamer Baru'}
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
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Streamer</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Dona / Nina / Nata / Fawwas"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="streamer@brand.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gaji Pokok Bulanan (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    value={formSalary}
                    onChange={(e) => setFormSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Persentase Komisi (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formCommission}
                    onChange={(e) => setFormCommission(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Status Keaktifan</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="active">Aktif (Dapat Dijadwalkan)</option>
                  <option value="inactive">Non-aktif (Cuti / Istirahat)</option>
                </select>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Streamer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
