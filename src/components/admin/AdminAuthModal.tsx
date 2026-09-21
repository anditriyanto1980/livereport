import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../services/firestoreService';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { verifyAndLoginAdmin, loginWithGoogle } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Harap masukkan kata sandi Administrator.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await verifyAndLoginAdmin(password.trim());
    setLoading(false);

    if (result.success) {
      setSuccessMsg(result.message);
      // Log security access audit
      await logAudit(
        'Andi Triyanto (Admin)',
        'admin-super-uid',
        'ADMIN LOGIN - VERIFIKASI SANDI',
        'Gerbang Keamanan Admin',
        'Mode Host Streamer',
        'Akses Administrator Diberikan'
      );

      setTimeout(() => {
        setSuccessMsg(null);
        setPassword('');
        if (onSuccess) onSuccess();
        onClose();
      }, 900);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      setSuccessMsg('Login Google Admin berhasil diverifikasi!');
      setTimeout(() => {
        setSuccessMsg(null);
        if (onSuccess) onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login dengan Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl border-2 border-blue-100 shadow-[0_20px_50px_rgba(30,58,138,0.25)] max-w-md w-full overflow-hidden relative"
        >
          {/* Header Ambient Accent */}
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-7 space-y-5">
            {/* Icon & Title */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex items-center justify-center shrink-0 border-2 border-white">
                <Lock className="w-6 h-6 text-amber-300 drop-shadow-xs" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Opsi 3: Protected Gate
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight mt-1">
                  Gerbang Akses Administrator
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                  Laporan keuangan, omset live, dan pengaturan sistem terkunci demi keamanan data tim.
                </p>
              </div>
            </div>

            {/* Error / Success Notifications */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5 font-bold"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Kata Sandi Administrator
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan sandi admin..."
                    disabled={loading || !!successMsg}
                    autoFocus
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                  <span>💡 Sandi bawaan sistem:</span>
                  <code className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 rounded text-blue-700 font-bold">
                    admin123
                  </code>
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="flex-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <span>Memverifikasi...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-amber-300" />
                      <span>Buka Hak Akses Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Separator */}
            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
                Atau Autentikasi Google
              </span>
            </div>

            {/* Google OAuth Login Option */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-2xl text-xs font-bold text-slate-700 shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{googleLoading ? 'Menghubungkan...' : 'Masuk dengan Akun Google Admin'}</span>
            </button>

            {/* Note regarding isolation */}
            <div className="flex items-center gap-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Saat berada dalam <strong>Mode Host</strong>, user biasa hanya bisa melihat dan mencatat sesi live mereka sendiri.
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
