import React, { useState } from 'react';
import {
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  X,
  RefreshCw,
  Info,
  CheckSquare,
  Square,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  resetDatabaseToZero,
  updateAdminPassword,
  ResetDatabaseOptions,
  DEFAULT_ADMIN_PASSWORD,
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isAdmin } = useAuth();

  // Reset options
  const [resetSessions, setResetSessions] = useState(true);
  const [resetSchedules, setResetSchedules] = useState(true);
  const [resetTargets, setResetTargets] = useState(true);
  const [resetStreamers, setResetStreamers] = useState(false);
  const [resetProducts, setResetProducts] = useState(false);

  // Password state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ message: string; stats?: Record<string, number> } | null>(null);

  // Change password accordion
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passChangeLoading, setPassChangeLoading] = useState(false);
  const [passChangeMsg, setPassChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('Akses Ditolak: Hanya akun Administrator yang berhak mereset data!');
      return;
    }

    if (!password) {
      setErrorMsg('Harap masukkan kata sandi Admin.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const options: ResetDatabaseOptions = {
      resetSessions,
      resetSchedules,
      resetTargets,
      resetStreamers,
      resetProducts,
    };

    const res = await resetDatabaseToZero(
      options,
      password,
      currentUser?.displayName || 'Admin',
      currentUser?.uid || 'admin'
    );

    setLoading(false);

    if (res.success) {
      setSuccessData({
        message: res.message,
        stats: res.deletedStats,
      });
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeMsg(null);

    if (newPassword !== confirmPassword) {
      setPassChangeMsg({ type: 'error', text: 'Konfirmasi kata sandi baru tidak cocok.' });
      return;
    }

    if (newPassword.length < 4) {
      setPassChangeMsg({ type: 'error', text: 'Kata sandi baru minimal 4 karakter.' });
      return;
    }

    setPassChangeLoading(true);
    const res = await updateAdminPassword(
      oldPassword,
      newPassword,
      currentUser?.displayName || 'Admin',
      currentUser?.uid || 'admin'
    );
    setPassChangeLoading(false);

    if (res.success) {
      setPassChangeMsg({ type: 'success', text: res.message });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPassChangeMsg(null);
      }, 2000);
    } else {
      setPassChangeMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="clay-card bg-white w-full max-w-xl p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(30,58,138,0.25)] border-2 border-red-100 relative my-8"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(225,29,72,0.35)] shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Reset Data Menjadi 0
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider border border-rose-200">
                Admin Only
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium leading-relaxed">
              Bersihkan seluruh data transaksi dan demo agar aplikasi Shopee Live dapat digunakan dari awal (nol) dengan data riil toko Anda.
            </p>
          </div>
        </div>

        {/* SUCCESS STATE */}
        {successData ? (
          <div className="space-y-5 py-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
              <div className="flex items-center gap-2.5 font-black text-emerald-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span className="text-base">Reset Database Berhasil Sempurna!</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                {successData.message}
              </p>

              {successData.stats && (
                <div className="bg-white/80 p-3 rounded-xl text-xs space-y-1 font-bold text-slate-700 border border-emerald-100">
                  <p className="text-[11px] text-slate-400 font-extrabold uppercase mb-1">Rincian Data yang Dihapus:</p>
                  {successData.stats.liveSessions !== undefined && (
                    <div className="flex justify-between">
                      <span>Riwayat Sesi Live:</span>
                      <span className="font-black text-rose-600">{successData.stats.liveSessions} sesi dibersihkan (Omset = Rp 0)</span>
                    </div>
                  )}
                  {successData.stats.schedules !== undefined && (
                    <div className="flex justify-between">
                      <span>Jadwal Live Host:</span>
                      <span className="font-black text-rose-600">{successData.stats.schedules} jadwal dibersihkan</span>
                    </div>
                  )}
                  {successData.stats.targets !== undefined && (
                    <div className="flex justify-between">
                      <span>Target Bulanan:</span>
                      <span className="font-black text-rose-600">{successData.stats.targets} target direset</span>
                    </div>
                  )}
                  {successData.stats.streamers !== undefined && (
                    <div className="flex justify-between">
                      <span>Host Streamer:</span>
                      <span className="font-black text-rose-600">{successData.stats.streamers} streamer demo dihapus</span>
                    </div>
                  )}
                  {successData.stats.products !== undefined && (
                    <div className="flex justify-between">
                      <span>Katalog Produk:</span>
                      <span className="font-black text-rose-600">{successData.stats.products} produk demo dihapus</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-[0_4px_14px_rgba(5,150,105,0.35)] cursor-pointer active:scale-98 transition-all"
            >
              Tutup & Mulai Gunakan Aplikasi Dari Nol
            </button>
          </div>
        ) : (
          /* FORM STATE */
          <form onSubmit={handleExecuteReset} className="space-y-4.5">
            {/* Warning Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-2.5 text-xs text-amber-900 font-medium leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Perhatian & Ketentuan Reset:</p>
                <p className="mt-0.5">
                  Tindakan ini akan mengosongkan seluruh riwayat siaran live, metrik KPI, dan transaksi. Database tidak akan memuat ulang data demo secara otomatis setelah proses ini.
                </p>
              </div>
            </div>

            {/* Selection Options */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Pilih Cakupan Pembersihan:
              </label>

              <div className="grid grid-cols-1 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
                {/* 1. Sesi Live & Metrik */}
                <div
                  onClick={() => setResetSessions(!resetSessions)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer hover:bg-slate-50 select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {resetSessions ? (
                      <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Reset Sesi Live & Metrik Penjualan (0 Data)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Omset, pesanan, penonton, dan konversi kembali ke 0.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    Wajib
                  </span>
                </div>

                {/* 2. Jadwal */}
                <div
                  onClick={() => setResetSchedules(!resetSchedules)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer hover:bg-slate-50 select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {resetSchedules ? (
                      <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Kosongkan Jadwal Live Demo
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Menghapus seluruh antrean jadwal siaran demo.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Target */}
                <div
                  onClick={() => setResetTargets(!resetTargets)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer hover:bg-slate-50 select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {resetTargets ? (
                      <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Reset Target Bulanan Tim & Host
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Menghapus target penjualan sampel Rp 200 Juta.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Streamers (Optional) */}
                <div
                  onClick={() => setResetStreamers(!resetStreamers)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer hover:bg-slate-50 select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {resetStreamers ? (
                      <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Hapus Juga Host Streamer Demo (Dona, Nina, Nata, Fawwas)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Centang ini jika Anda ingin mendaftarkan nama host asli toko Anda sendiri dari 0.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Opsional
                  </span>
                </div>

                {/* 5. Products (Optional) */}
                <div
                  onClick={() => setResetProducts(!resetProducts)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer hover:bg-slate-50 select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {resetProducts ? (
                      <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Hapus Juga Katalog Produk Demo
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Centang ini jika Anda ingin input produk & SKU toko sendiri dari awal.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Opsional
                  </span>
                </div>
              </div>
            </div>

            {/* ADMIN PASSWORD INPUT */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Kata Sandi Otorisasi Admin:</span>
                </label>
                <span className="text-[11px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  Default: <code className="text-blue-700 font-extrabold">{DEFAULT_ADMIN_PASSWORD}</code>
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi Admin..."
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 bg-white border-2 border-slate-200 focus:border-rose-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-slate-400 font-medium">
                  Hanya akun Admin dengan sandi valid yang berwenang mengeksekusi reset.
                </p>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{isChangingPassword ? 'Tutup Pengaturan Sandi' : 'Ubah Sandi Admin'}</span>
                </button>
              </div>
            </div>

            {/* CHANGE PASSWORD COLLAPSIBLE */}
            <AnimatePresence>
              {isChangingPassword && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ubah Kata Sandi Rahasia Admin:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="password"
                      placeholder="Sandi lama..."
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Sandi baru..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Konfirmasi sandi..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  {passChangeMsg && (
                    <div
                      className={`text-[11px] p-2 rounded-lg font-bold ${
                        passChangeMsg.type === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {passChangeMsg.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={passChangeLoading || !newPassword || !oldPassword}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      {passChangeLoading ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={loading || !password}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black rounded-xl shadow-[0_4px_14px_rgba(225,29,72,0.35),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{loading ? 'Sedang Mereset Data...' : 'Konfirmasi Reset ke 0'}</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
