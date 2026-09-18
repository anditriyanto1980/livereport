import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  Save,
  Clock,
  Sparkles,
  Info,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  ShoppingBag,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Streamer, Product, LiveSession, ProductItemSale } from '../../types';
import { SHIFTS, calculateDuration, calculateLiveMetrics, getJakartaDate } from '../../utils/shiftLogic';
import { formatIDR, formatNumber, formatPercent, safeDivide } from '../../utils/formatters';
import { addLiveSession, updateLiveSession } from '../../services/firestoreService';

interface InputLiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamers: Streamer[];
  products: Product[];
  initialData?: LiveSession | null;
  editingSession?: LiveSession | null;
  prefillStreamerId?: string;
  prefillShiftId?: string;
  prefillDate?: string;
  onSuccess?: () => void;
}

export const InputLiveReportModal: React.FC<InputLiveReportModalProps> = ({
  isOpen,
  onClose,
  streamers,
  products,
  initialData,
  editingSession,
  prefillStreamerId,
  prefillShiftId,
  prefillDate,
  onSuccess,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeData = initialData || editingSession;

  // Form states
  const [businessDate, setBusinessDate] = useState<string>(getJakartaDate());
  const [streamerId, setStreamerId] = useState<string>('');
  const [shiftId, setShiftId] = useState<string>('shift-1');
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('15:00');

  // Traffic
  const [viewers, setViewers] = useState<number>(0);
  const [uniqueViewers, setUniqueViewers] = useState<number>(0);
  const [peakViewers, setPeakViewers] = useState<number>(0);
  const [averageViewers, setAverageViewers] = useState<number>(0);
  const [newFollowers, setNewFollowers] = useState<number>(0);
  const [totalFollowers, setTotalFollowers] = useState<number>(0);

  // Engagement
  const [likes, setLikes] = useState<number>(0);
  const [comments, setComments] = useState<number>(0);
  const [shares, setShares] = useState<number>(0);
  const [productClicks, setProductClicks] = useState<number>(0);
  const [productImpressions, setProductImpressions] = useState<number>(0);

  // Commerce
  const [checkout, setCheckout] = useState<number>(0);
  const [orders, setOrders] = useState<number>(0);
  const [productsSold, setProductsSold] = useState<number>(0);
  const [revenue, setRevenue] = useState<number>(0);
  const [cancelledOrders, setCancelledOrders] = useState<number>(0);
  const [refundOrders, setRefundOrders] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Optional
  const [voucherUsed, setVoucherUsed] = useState<number>(0);
  const [affiliateOrders, setAffiliateOrders] = useState<number>(0);
  const [affiliateRevenue, setAffiliateRevenue] = useState<number>(0);
  const [adsSpend, setAdsSpend] = useState<number>(0);

  // Products detail
  const [productDetails, setProductDetails] = useState<ProductItemSale[]>([]);

  // Notes
  const [notes, setNotes] = useState<string>('');

  // Auto-calculated duration
  const { durationMinutes, durationHours } = calculateDuration(startTime, endTime);

  // Auto-calculated metrics live preview
  const liveMetrics = calculateLiveMetrics({
    revenue,
    orders,
    viewers,
    uniqueViewers,
    durationHours,
  });

  // Shift selection effect
  const handleShiftChange = (selectedShiftId: string) => {
    setShiftId(selectedShiftId);
    const chosen = SHIFTS.find((s) => s.id === selectedShiftId);
    if (chosen) {
      setStartTime(chosen.startTime);
      setEndTime(chosen.endTime);
    }
  };

  // Populate data when editing or when opening modal
  useEffect(() => {
    if (activeData) {
      setBusinessDate(activeData.businessDate);
      setStreamerId(activeData.streamerId);
      setShiftId(activeData.shiftId);
      setStartTime(activeData.startTime);
      setEndTime(activeData.endTime);
      setViewers(activeData.viewers || 0);
      setUniqueViewers(activeData.uniqueViewers || 0);
      setPeakViewers(activeData.peakViewers || 0);
      setAverageViewers(activeData.averageViewers || 0);
      setNewFollowers(activeData.newFollowers || 0);
      setTotalFollowers(activeData.totalFollowers || 0);
      setLikes(activeData.likes || 0);
      setComments(activeData.comments || 0);
      setShares(activeData.shares || 0);
      setProductClicks(activeData.productClicks || 0);
      setProductImpressions(activeData.productImpressions || 0);
      setCheckout(activeData.checkout || 0);
      setOrders(activeData.orders || 0);
      setProductsSold(activeData.productsSold || 0);
      setRevenue(activeData.revenue || 0);
      setCancelledOrders(activeData.cancelledOrders || 0);
      setRefundOrders(activeData.refundOrders || 0);
      setRefundAmount(activeData.refundAmount || 0);
      setVoucherUsed(activeData.voucherUsed || 0);
      setAffiliateOrders(activeData.affiliateOrders || 0);
      setAffiliateRevenue(activeData.affiliateRevenue || 0);
      setAdsSpend(activeData.adsSpend || 0);
      setProductDetails(activeData.productDetails || []);
      setNotes(activeData.notes || '');
    } else {
      // Default new report
      setBusinessDate(prefillDate || getJakartaDate());
      if (prefillStreamerId) {
        setStreamerId(prefillStreamerId);
      } else if (currentUser?.streamerId) {
        setStreamerId(currentUser.streamerId);
      } else if (streamers.length > 0) {
        setStreamerId(streamers[0].id);
      }
      handleShiftChange(prefillShiftId || 'shift-1');
      setViewers(0);
      setUniqueViewers(0);
      setPeakViewers(0);
      setAverageViewers(0);
      setNewFollowers(0);
      setTotalFollowers(0);
      setLikes(0);
      setComments(0);
      setShares(0);
      setProductClicks(0);
      setProductImpressions(0);
      setCheckout(0);
      setOrders(0);
      setProductsSold(0);
      setRevenue(0);
      setCancelledOrders(0);
      setRefundOrders(0);
      setRefundAmount(0);
      setVoucherUsed(0);
      setAffiliateOrders(0);
      setAffiliateRevenue(0);
      setAdsSpend(0);
      setProductDetails([]);
      setNotes('');
    }
  }, [activeData, isOpen, currentUser, streamers, prefillDate, prefillStreamerId, prefillShiftId]);

  // Product detail item helper
  const handleAddProductItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setProductDetails((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        productName: firstProd.name,
        sku: firstProd.sku,
        price: firstProd.price,
        quantity: 1,
        revenue: firstProd.price,
      },
    ]);
  };

  const handleUpdateProductItem = (index: number, field: string, value: any) => {
    setProductDetails((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'productId') {
        const p = products.find((x) => x.id === value);
        if (p) {
          item.productId = p.id;
          item.productName = p.name;
          item.sku = p.sku;
          item.price = p.price;
          item.revenue = p.price * (item.quantity || 1);
        }
      } else if (field === 'quantity') {
        const q = Math.max(1, Number(value) || 1);
        item.quantity = q;
        item.revenue = (item.price || 0) * q;
      } else if (field === 'revenue') {
        item.revenue = Math.max(0, Number(value) || 0);
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveProductItem = (index: number) => {
    setProductDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetStreamer = streamers.find((s) => s.id === streamerId);
    const targetShift = SHIFTS.find((s) => s.id === shiftId);

    if (!streamerId || !targetStreamer) {
      setErrorMsg('Pilih Streamer yang melakukan live!');
      return;
    }
    if (!businessDate) {
      setErrorMsg('Tentukan Tanggal Bisnis (Business Date)!');
      return;
    }

    setSubmitting(true);

    try {
      const sessionPayload: Omit<LiveSession, 'id'> = {
        streamerId,
        streamerName: targetStreamer.name,
        businessDate,
        shiftId,
        shiftName: targetShift?.name || 'Shift 1',
        startTime,
        endTime,
        durationMinutes,
        durationHours,

        // Traffic
        viewers: Number(viewers) || 0,
        uniqueViewers: Number(uniqueViewers) || 0,
        peakViewers: Number(peakViewers) || 0,
        averageViewers: Number(averageViewers) || 0,
        newFollowers: Number(newFollowers) || 0,
        totalFollowers: Number(totalFollowers) || 0,

        // Engagement
        likes: Number(likes) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0,
        productClicks: Number(productClicks) || 0,
        productImpressions: Number(productImpressions) || 0,

        // Commerce
        checkout: Number(checkout) || 0,
        orders: Number(orders) || 0,
        productsSold: Number(productsSold) || 0,
        revenue: Number(revenue) || 0,
        cancelledOrders: Number(cancelledOrders) || 0,
        refundOrders: Number(refundOrders) || 0,
        refundAmount: Number(refundAmount) || 0,

        // Optional
        voucherUsed: Number(voucherUsed) || 0,
        affiliateOrders: Number(affiliateOrders) || 0,
        affiliateRevenue: Number(affiliateRevenue) || 0,
        adsSpend: Number(adsSpend) || 0,

        // Products
        productDetails,

        // Calculated metrics
        ...liveMetrics,

        notes,
        isDemo: false,
      };

      if (activeData?.id) {
        await updateLiveSession(
          activeData.id,
          sessionPayload,
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid',
          `Omset lama: Rp ${activeData.revenue.toLocaleString('id-ID')}`
        );
      } else {
        await addLiveSession(
          sessionPayload,
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving live report:', err);
      setErrorMsg(err.message || 'Gagal menyimpan laporan live.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeShiftObj = SHIFTS.find((s) => s.id === shiftId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white border-2 border-slate-200/90 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 rounded-md">
                  SHOPEE LIVE REPORT
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-800">
                  {initialData ? 'Edit Laporan Live Session' : 'Input Live Report Shopee'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Masukkan data analitik live streaming langsung dari Seller Centre Shopee Live.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-live-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-50/40">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CRITICAL SHIFT 3 RULE NOTICE */}
          {activeShiftObj?.isOvernight && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="text-amber-900 font-bold">
                  Aturan Penting Shift 3 (21:00 - 06:00 WIB):
                </strong>
                <p className="text-amber-800 mt-0.5 leading-relaxed font-medium">
                  Shift 3 melewati tengah malam. Sesuai aturan bisnis, <em>businessDate</em> tetap
                  menggunakan tanggal dimulainya sesi shift. Pendapatan dihitung utuh pada tanggal
                  tersebut dan <strong>tidak dibagi menjadi dua tanggal</strong>.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 1: INFORMASI LIVE */}
          <div className="clay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg clay-sphere-orange text-white flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 drop-shadow-xs" />
              </div>
              1. INFORMASI LIVE & SHIFT
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              {/* Business Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Business Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  id="input-business-date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Streamer */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Streamer <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  id="input-streamer-select"
                  value={streamerId}
                  disabled={!isAdmin && Boolean(currentUser?.streamerId)}
                  onChange={(e) => setStreamerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs disabled:opacity-60"
                >
                  <option value="">Pilih Streamer...</option>
                  {streamers.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.status === 'active' ? 'Aktif' : 'Non-aktif'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Shift <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  id="input-shift-select"
                  value={shiftId}
                  onChange={(e) => handleShiftChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  {SHIFTS.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.startTime} - {sh.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time & Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Durasi Live (Otomatis)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-1/2 px-2 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-xs"
                  />
                  <span className="text-slate-400 text-xs font-bold">-</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-1/2 px-2 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-xs"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  Total: <strong className="text-slate-800 font-bold">{durationHours} Jam</strong> ({durationMinutes} Menit)
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: TRAFFIC */}
          <div className="clay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg clay-sphere-cyan text-white flex items-center justify-center">
                <Users className="w-3.5 h-3.5 drop-shadow-xs" />
              </div>
              2. DATA TRAFFIC (PENONTON)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Total Viewer</label>
                <input
                  type="number"
                  min="0"
                  id="input-viewers"
                  value={viewers || ''}
                  onChange={(e) => setViewers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Unique Viewer</label>
                <input
                  type="number"
                  min="0"
                  id="input-unique-viewers"
                  value={uniqueViewers || ''}
                  onChange={(e) => setUniqueViewers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Peak Concurrent</label>
                <input
                  type="number"
                  min="0"
                  id="input-peak-viewers"
                  value={peakViewers || ''}
                  onChange={(e) => setPeakViewers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Avg Concurrent</label>
                <input
                  type="number"
                  min="0"
                  id="input-avg-viewers"
                  value={averageViewers || ''}
                  onChange={(e) => setAverageViewers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">New Followers</label>
                <input
                  type="number"
                  min="0"
                  id="input-new-followers"
                  value={newFollowers || ''}
                  onChange={(e) => setNewFollowers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Total Followers</label>
                <input
                  type="number"
                  min="0"
                  id="input-total-followers"
                  value={totalFollowers || ''}
                  onChange={(e) => setTotalFollowers(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: ENGAGEMENT */}
          <div className="clay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg clay-sphere-pink text-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 drop-shadow-xs" />
              </div>
              3. ENGAGEMENT (INTERAKSI)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Likes</label>
                <input
                  type="number"
                  min="0"
                  id="input-likes"
                  value={likes || ''}
                  onChange={(e) => setLikes(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Comments</label>
                <input
                  type="number"
                  min="0"
                  id="input-comments"
                  value={comments || ''}
                  onChange={(e) => setComments(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Shares</label>
                <input
                  type="number"
                  min="0"
                  id="input-shares"
                  value={shares || ''}
                  onChange={(e) => setShares(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Product Clicks</label>
                <input
                  type="number"
                  min="0"
                  id="input-product-clicks"
                  value={productClicks || ''}
                  onChange={(e) => setProductClicks(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Product Impressions</label>
                <input
                  type="number"
                  min="0"
                  id="input-product-impressions"
                  value={productImpressions || ''}
                  onChange={(e) => setProductImpressions(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: COMMERCE & REVENUE */}
          <div className="clay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg clay-sphere-emerald text-white flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5 drop-shadow-xs" />
              </div>
              4. COMMERCE (PENJUALAN & REVENUE)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              {/* Gross Revenue */}
              <div className="col-span-2">
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  Gross Revenue / GMV (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-emerald-600">Rp</span>
                  <input
                    type="number"
                    min="0"
                    required
                    id="input-gross-revenue"
                    value={revenue || ''}
                    onChange={(e) => setRevenue(Number(e.target.value))}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2.5 text-sm font-black bg-white border-2 border-emerald-300 rounded-xl text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-semibold mt-1.5">
                  Preview:{' '}
                  <strong className="text-emerald-700 font-black">{formatIDR(revenue)}</strong>
                </p>
              </div>

              {/* Orders */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Orders <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  id="input-orders"
                  value={orders || ''}
                  onChange={(e) => setOrders(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Checkout */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Checkout</label>
                <input
                  type="number"
                  min="0"
                  id="input-checkout"
                  value={checkout || ''}
                  onChange={(e) => setCheckout(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Products Sold */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Products Sold (Qty)</label>
                <input
                  type="number"
                  min="0"
                  id="input-products-sold"
                  value={productsSold || ''}
                  onChange={(e) => setProductsSold(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Cancelled Orders */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cancelled Orders</label>
                <input
                  type="number"
                  min="0"
                  id="input-cancelled-orders"
                  value={cancelledOrders || ''}
                  onChange={(e) => setCancelledOrders(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Refund Orders */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Refund Orders</label>
                <input
                  type="number"
                  min="0"
                  id="input-refund-orders"
                  value={refundOrders || ''}
                  onChange={(e) => setRefundOrders(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Refund Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Refund Amount (Rp)</label>
                <input
                  type="number"
                  min="0"
                  id="input-refund-amount"
                  value={refundAmount || ''}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* CALCULATED METRICS SUMMARY BOX (AUTO-CALCULATED) */}
          <div className="clay-card p-5 space-y-3 bg-blue-50/40 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg clay-sphere-orange text-white flex items-center justify-center">
                  <Calculator className="w-3.5 h-3.5 drop-shadow-xs" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Calculated Metrics (Dihitung Otomatis Oleh Sistem)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold italic">
                *Streamer tidak perlu menghitung manual
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Avg Order Value (AOV)</p>
                <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                  {formatIDR(liveMetrics.averageOrderValue)}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Revenue / Orders</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Conversion Rate</p>
                <p className="text-xs sm:text-sm font-black text-emerald-600 mt-1">
                  {formatPercent(liveMetrics.conversionRate)}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Orders / Viewer × 100</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Revenue Per Hour</p>
                <p className="text-xs sm:text-sm font-black text-blue-600 mt-1">
                  {formatIDR(liveMetrics.revenuePerHour)}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Revenue / {durationHours} Jam</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Orders Per Hour</p>
                <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                  {liveMetrics.ordersPerHour} / jam
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Orders / {durationHours} Jam</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Viewer Per Hour</p>
                <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                  {formatNumber(liveMetrics.viewersPerHour)} / jam
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Viewers / {durationHours} Jam</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Revenue Per Viewer</p>
                <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                  {formatIDR(liveMetrics.revenuePerViewer)}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Revenue / Viewer</p>
              </div>
            </div>
          </div>

          {/* SECTION 5: DETAIL PRODUK TERJUAL */}
          <div className="clay-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg clay-sphere-purple text-white flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5 drop-shadow-xs" />
                </div>
                5. DETAIL PRODUK TERJUAL (PRODUCT PERFORMANCE)
              </h3>
              <button
                type="button"
                id="add-product-detail-row-btn"
                onClick={handleAddProductItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Produk
              </button>
            </div>

            {productDetails.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                Belum ada rincian produk yang ditambahkan. Klik <strong className="text-blue-600 font-bold">+ Tambah Produk</strong> untuk
                mencatat SKU produk terlaris di sesi live ini.
              </div>
            ) : (
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                {productDetails.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs"
                  >
                    <div className="col-span-5">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Pilih Produk</label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleUpdateProductItem(idx, 'productId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold shadow-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatIDR(p.price)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Qty Terjual</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateProductItem(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold shadow-xs"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Total Omset Produk</label>
                      <input
                        type="number"
                        min="0"
                        value={item.revenue}
                        onChange={(e) => handleUpdateProductItem(idx, 'revenue', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-emerald-600 font-extrabold shadow-xs"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveProductItem(idx)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: OPTIONAL & ADS */}
          <div className="clay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg clay-sphere-orange text-white flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5 drop-shadow-xs" />
              </div>
              6. DATA TAMBAHAN / OPTIONAL (VOUCHER, AFFILIATE & ADS)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Used (Qty)</label>
                <input
                  type="number"
                  min="0"
                  id="input-voucher-used"
                  value={voucherUsed || ''}
                  onChange={(e) => setVoucherUsed(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Affiliate Orders</label>
                <input
                  type="number"
                  min="0"
                  id="input-affiliate-orders"
                  value={affiliateOrders || ''}
                  onChange={(e) => setAffiliateOrders(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Affiliate Revenue (Rp)</label>
                <input
                  type="number"
                  min="0"
                  id="input-affiliate-revenue"
                  value={affiliateRevenue || ''}
                  onChange={(e) => setAffiliateRevenue(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ads Spend (Rp)</label>
                <input
                  type="number"
                  min="0"
                  id="input-ads-spend"
                  value={adsSpend || ''}
                  onChange={(e) => setAdsSpend(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div className="clay-card p-5 space-y-2">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Catatan Sesi Live (Notes / Evaluasi Sesi)
            </label>
            <textarea
              rows={2}
              id="input-live-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Flash sale jam 10 sangat ramai, stok gamis ukuran L habis, koneksi lancar."
              className="w-full px-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>

          {/* Modal Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              id="submit-live-report-btn"
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Menyimpan Laporan...' : 'Simpan Live Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
