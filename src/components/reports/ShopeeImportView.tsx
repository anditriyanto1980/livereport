import React, { useState, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Eye,
  RefreshCw,
  Edit3,
  Save,
  Trash2,
  Calendar,
  Clock,
  User,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Zap,
  ZoomIn,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Streamer, LiveSession, ShopeeRawExtractedData } from '../../types';
import { getJakartaDate } from '../../utils/shiftLogic';
import {
  validateShopeeKpis,
  formatDurationSeconds,
  findDuplicateSession,
  SAMPLE_SHOPEE_SCREENSHOT_DATA,
  ValidationResult,
} from '../../utils/shopeeOcrParser';
import { formatIDR, formatNumber, formatPercent } from '../../utils/formatters';
import { addLiveSession, logAudit } from '../../services/firestoreService';

interface ShopeeImportViewProps {
  streamers: Streamer[];
  sessions: LiveSession[];
  onSuccessSave?: (sessionId: string) => void;
  onNavigateTab?: (tab: any) => void;
}

type ScanStep = 'idle' | 'reading' | 'processing' | 'validating' | 'preview';

export const ShopeeImportView: React.FC<ShopeeImportViewProps> = ({
  streamers,
  sessions,
  onSuccessSave,
  onNavigateTab,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Controls
  const [platform, setPlatform] = useState<string>('Shopee');
  const [selectedStreamerId, setSelectedStreamerId] = useState<string>(() => {
    if (!isAdmin && currentUser?.streamerId) return currentUser.streamerId;
    return streamers[0]?.id || '';
  });
  const [sessionDate, setSessionDate] = useState<string>(getJakartaDate());
  const [sessionTime, setSessionTime] = useState<string>('08:00');
  const [orderStatus, setOrderStatus] = useState<string>('Pesanan Siap Dikirim');

  // Drag & drop & file preview state
  const [isDragging, setIsDragging] = useState(false);
  const [scanStep, setScanStep] = useState<ScanStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Uploaded image metadata & preview
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [uploadedFileType, setUploadedFileType] = useState<string>('image/jpeg');
  const [isDemoData, setIsDemoData] = useState<boolean>(false);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);

  // Extracted Data & Editing State
  const [extractedData, setExtractedData] = useState<ShopeeRawExtractedData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ShopeeRawExtractedData>>({});

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    existingSession: LiveSession | null;
  } | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Active streamer info
  const activeStreamer = useMemo(() => {
    return (
      streamers.find((s) => s.id === selectedStreamerId) || {
        id: selectedStreamerId,
        name: currentUser?.displayName || 'Streamer',
      }
    );
  }, [streamers, selectedStreamerId, currentUser]);

  // Validation results of current preview data
  const currentDataToValidate = useMemo(() => {
    if (!extractedData) return null;
    return {
      ...extractedData,
      ...editedData,
    };
  }, [extractedData, editedData]);

  const validation: ValidationResult | null = useMemo(() => {
    if (!currentDataToValidate) return null;
    return validateShopeeKpis(currentDataToValidate);
  }, [currentDataToValidate]);

  // Handle file selection (Drag or Click)
  const processImageFile = async (file: File) => {
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Format file tidak didukung. Harap upload gambar JPG, JPEG, atau PNG.');
      return;
    }

    setErrorMessage(null);
    setSaveSuccessMsg(null);
    setDuplicateWarning(null);
    setIsDemoData(false);

    setUploadedFileName(file.name);
    setUploadedFileSize((file.size / 1024).toFixed(1) + ' KB');
    setUploadedFileType(file.type);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result as string;
      setUploadedImageSrc(base64String);

      try {
        setScanStep('reading');
        await new Promise((r) => setTimeout(r, 400));

        setScanStep('processing');
        // Call backend API /api/extract-shopee-screenshot with automatic retry on cold-start (404/502/503)
        let res: Response | null = null;
        let lastError = '';

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            res = await fetch('/api/extract-shopee-screenshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: base64String,
                mimeType: file.type,
              }),
            });

            if (res.ok) break;

            // If server cold start / temporary high demand, wait and retry once
            if ((res.status === 404 || res.status === 502 || res.status === 503) && attempt === 1) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }

            const errJson = await res.json().catch(() => ({}));
            lastError = errJson.error || `Server merespon error (${res.status})`;
          } catch (netErr: any) {
            lastError = netErr.message || 'Koneksi ke server terputus';
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1200));
            }
          }
        }

        if (!res || !res.ok) {
          throw new Error(lastError || 'Gagal memproses gambar. Silakan klik tombol Coba Scan Ulang AI.');
        }

        const json = await res.json().catch(() => ({}));

        if (!json.success || !json.data) {
          throw new Error(json.error || `Gagal mengekstrak data dari screenshot.`);
        }

        const parsedResult: ShopeeRawExtractedData = {
          ...json.data,
          isDemo: false,
        };
        const usedAi = json.modelUsed || 'AI Vision';
        setModelUsed(usedAi);

        setScanStep('validating');
        await new Promise((r) => setTimeout(r, 300));

        // Update states with REAL extracted data from the user's uploaded image
        setExtractedData(parsedResult);
        setEditedData(parsedResult);
        if (parsedResult.order_status) setOrderStatus(parsedResult.order_status);
        if (parsedResult.extracted_date) setSessionDate(parsedResult.extracted_date);
        if (parsedResult.extracted_time) setSessionTime(parsedResult.extracted_time);

        // Check for duplicate in existing sessions
        const dup = findDuplicateSession(
          {
            host_id: selectedStreamerId,
            session_date: parsedResult.extracted_date || sessionDate,
            sales: parsedResult.sales || 0,
            orders: parsedResult.orders || 0,
            views: parsedResult.views || 0,
            products_sold: parsedResult.products_sold || 0,
          },
          sessions
        );

        if (dup) {
          setDuplicateWarning({
            isDuplicate: true,
            existingSession: dup,
          });
        }

        setScanStep('preview');
      } catch (err: any) {
        console.error('Extraction error:', err);
        setErrorMessage(
          err.message || 'AI Vision gagal membaca angka dari gambar ini. Anda dapat mencoba scan ulang atau mengisi data manual dengan screenshot tetap tampil di samping.'
        );
        setScanStep('idle');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  // Retry scan on the already uploaded image
  const handleRetryScan = async () => {
    if (!uploadedImageSrc) return;
    setErrorMessage(null);
    setScanStep('processing');

    try {
      let res: Response | null = null;
      let lastError = '';

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          res = await fetch('/api/extract-shopee-screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: uploadedImageSrc,
              mimeType: uploadedFileType || 'image/jpeg',
            }),
          });

          if (res.ok) break;

          if ((res.status === 404 || res.status === 502 || res.status === 503) && attempt === 1) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          const errJson = await res.json().catch(() => ({}));
          lastError = errJson.error || `Server merespon error (${res.status})`;
        } catch (netErr: any) {
          lastError = netErr.message || 'Koneksi ke server terputus';
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }

      if (!res || !res.ok) {
        throw new Error(lastError || 'Gagal membaca gambar saat dicoba ulang.');
      }

      const json = await res.json().catch(() => ({}));

      if (!json.success || !json.data) {
        throw new Error(json.error || `Gagal membaca gambar saat dicoba ulang.`);
      }

      const parsedResult: ShopeeRawExtractedData = {
        ...json.data,
        isDemo: false,
      };
      setModelUsed(json.modelUsed || 'AI Vision');

      setExtractedData(parsedResult);
      setEditedData(parsedResult);
      if (parsedResult.order_status) setOrderStatus(parsedResult.order_status);
      if (parsedResult.extracted_date) setSessionDate(parsedResult.extracted_date);
      if (parsedResult.extracted_time) setSessionTime(parsedResult.extracted_time);

      setScanStep('preview');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses gambar saat dicoba ulang.');
      setScanStep('idle');
    }
  };

  // Open manual input with the uploaded screenshot displayed side-by-side
  const handleOpenManualFromScreenshot = () => {
    setErrorMessage(null);
    const blankData: ShopeeRawExtractedData = {
      platform: 'shopee',
      order_status: orderStatus || 'Pesanan Siap Dikirim',
      sales: 0,
      active_viewers: 0,
      comments: 0,
      add_to_cart: 0,
      views: 0,
      average_watch_duration: 0,
      comment_rate: 0,
      sales_per_1000_views: 0,
      orders: 0,
      sales_per_order: 0,
      viewers: 0,
      peak_viewers: 0,
      click_rate: 0,
      orders_per_click: 0,
      buyers: 0,
      products_sold: 0,
      confidence: {
        sales: 1,
        active_viewers: 1,
        comments: 1,
        add_to_cart: 1,
        views: 1,
        average_watch_duration: 1,
        comment_rate: 1,
        sales_per_1000_views: 1,
        orders: 1,
        sales_per_order: 1,
        viewers: 1,
        peak_viewers: 1,
        click_rate: 1,
        orders_per_click: 1,
        buyers: 1,
        products_sold: 1,
      },
      isDemo: false,
    };
    setExtractedData(blankData);
    setEditedData(blankData);
    setIsEditing(true);
    setScanStep('preview');
  };

  // Test with demo screenshot data directly
  const handleUseDemoSample = () => {
    setErrorMessage(null);
    setSaveSuccessMsg(null);
    setDuplicateWarning(null);
    setIsDemoData(true);
    setUploadedImageSrc(null);
    setUploadedFileName('Sampel_Shopee_Demo.jpg');
    setUploadedFileSize('184 KB');
    setModelUsed('Demo Screenshot');

    setScanStep('reading');
    setTimeout(() => {
      setScanStep('processing');
      setTimeout(() => {
        setScanStep('validating');
        setTimeout(() => {
          setExtractedData({
            ...SAMPLE_SHOPEE_SCREENSHOT_DATA,
            isDemo: true,
          });
          setEditedData(SAMPLE_SHOPEE_SCREENSHOT_DATA);
          setOrderStatus(SAMPLE_SHOPEE_SCREENSHOT_DATA.order_status || 'Pesanan Siap Dikirim');
          if (SAMPLE_SHOPEE_SCREENSHOT_DATA.extracted_date) {
            setSessionDate(SAMPLE_SHOPEE_SCREENSHOT_DATA.extracted_date);
          }
          if (SAMPLE_SHOPEE_SCREENSHOT_DATA.extracted_time) {
            setSessionTime(SAMPLE_SHOPEE_SCREENSHOT_DATA.extracted_time);
          }

          // Duplicate check
          const dup = findDuplicateSession(
            {
              host_id: selectedStreamerId,
              session_date: SAMPLE_SHOPEE_SCREENSHOT_DATA.extracted_date || sessionDate,
              sales: SAMPLE_SHOPEE_SCREENSHOT_DATA.sales || 0,
              orders: SAMPLE_SHOPEE_SCREENSHOT_DATA.orders || 0,
              views: SAMPLE_SHOPEE_SCREENSHOT_DATA.views || 0,
              products_sold: SAMPLE_SHOPEE_SCREENSHOT_DATA.products_sold || 0,
            },
            sessions
          );

          if (dup) {
            setDuplicateWarning({
              isDuplicate: true,
              existingSession: dup,
            });
          }

          setScanStep('preview');
        }, 400);
      }, 500);
    }, 400);
  };

  // Update a single field in manual edit mode
  const handleFieldChange = (field: keyof ShopeeRawExtractedData, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Save to Firestore
  const handleSaveToDatabase = async (ignoreDuplicate = false) => {
    if (!currentDataToValidate) return;

    if (duplicateWarning?.isDuplicate && !ignoreDuplicate) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const finalSales = Number(currentDataToValidate.sales) || 0;
      const finalOrders = Number(currentDataToValidate.orders) || 0;
      const finalViewers = Number(currentDataToValidate.viewers) || 0;
      const finalViews = Number(currentDataToValidate.views) || 0;
      const finalProductsSold = Number(currentDataToValidate.products_sold) || 0;
      const finalActiveViewers = Number(currentDataToValidate.active_viewers) || 0;
      const finalPeakViewers = Number(currentDataToValidate.peak_viewers) || 0;
      const finalAddToCart = Number(currentDataToValidate.add_to_cart) || 0;
      const finalComments = Number(currentDataToValidate.comments) || 0;
      const finalAvgDuration = Number(currentDataToValidate.average_watch_duration) || 20;
      const finalCommentRate = Number(currentDataToValidate.comment_rate) || 0;
      const finalSalesPer1000 = Number(currentDataToValidate.sales_per_1000_views) || 0;
      const finalSalesPerOrder = Number(currentDataToValidate.sales_per_order) || (finalOrders > 0 ? Math.round(finalSales / finalOrders) : 0);
      const finalClickRate = Number(currentDataToValidate.click_rate) || 0;
      const finalOrdersPerClick = Number(currentDataToValidate.orders_per_click) || 0;
      const finalBuyers = Number(currentDataToValidate.buyers) || finalOrders;

      // Approximate hours (duration) for hourly rate
      const durationHours = Math.max(1, Math.round((finalAvgDuration * finalViewers) / 3600) || 3);
      const conversionRate = finalViewers > 0 ? Number(((finalOrders / finalViewers) * 100).toFixed(2)) : 0;
      const revenuePerHour = Math.round(finalSales / durationHours);

      // Determine shift based on sessionTime
      let shiftId = 'shift-1';
      let shiftName = 'Shift 1 (06:00 - 15:00)';
      const hourNum = parseInt(sessionTime.split(':')[0], 10) || 8;
      if (hourNum >= 12 && hourNum < 21) {
        shiftId = 'shift-2';
        shiftName = 'Shift 2 (12:00 - 21:00)';
      } else if (hourNum >= 21 || hourNum < 6) {
        shiftId = 'shift-3';
        shiftName = 'Shift 3 (21:00 - 06:00)';
      }

      // LiveSession payload matching database schema with 100% compatibility
      const newSessionPayload: Omit<LiveSession, 'id'> = {
        streamerId: selectedStreamerId,
        streamerName: activeStreamer.name,
        businessDate: sessionDate,
        shiftId,
        shiftName,
        startTime: sessionTime,
        endTime: `${String((hourNum + 4) % 24).padStart(2, '0')}:00`,
        durationMinutes: durationHours * 60,
        durationHours,

        // Traffic
        viewers: finalViewers,
        uniqueViewers: finalViewers,
        peakViewers: finalPeakViewers,
        averageViewers: finalActiveViewers,
        newFollowers: 0,
        totalFollowers: 0,

        // Engagement
        likes: 0,
        comments: finalComments,
        shares: 0,
        productClicks: Math.round((finalViews * finalClickRate) / 100) || 0,
        productImpressions: finalViews,

        // Commerce
        checkout: finalAddToCart,
        orders: finalOrders,
        productsSold: finalProductsSold,
        revenue: finalSales,
        cancelledOrders: 0,
        refundOrders: 0,
        refundAmount: 0,

        // Calculated
        conversionRate,
        revenuePerHour,
        ordersPerHour: Math.round(finalOrders / durationHours),
        viewersPerHour: Math.round(finalViewers / durationHours),
        revenuePerViewer: finalViewers > 0 ? Math.round(finalSales / finalViewers) : 0,
        averageOrderValue: finalSalesPerOrder,

        // Shopee Specific Mapped Fields (Section 3 & 4)
        platform: 'Shopee',
        orderStatus: orderStatus || 'Pesanan Siap Dikirim',
        source: 'shopee_screenshot_ocr',
        sales: finalSales,
        activeViewers: finalActiveViewers,
        averageWatchDuration: finalAvgDuration,
        commentRate: finalCommentRate,
        salesPer1000Views: finalSalesPer1000,
        salesPerOrder: finalSalesPerOrder,
        clickRate: finalClickRate,
        ordersPerClick: finalOrdersPerClick,
        buyers: finalBuyers,

        notes: `Imported via AI OCR Shopee Screenshot. Status: ${orderStatus}. Fields validated.`,
      };

      const newId = await addLiveSession(
        newSessionPayload,
        currentUser?.displayName || 'User',
        currentUser?.uid || selectedStreamerId
      );

      // Section 21: Audit Log
      await logAudit(
        currentUser?.displayName || 'Host',
        currentUser?.uid || selectedStreamerId,
        'Import Livestream OCR Shopee',
        `Live: ${activeStreamer.name} - ${sessionDate} (Rp ${finalSales.toLocaleString('id-ID')})`,
        '-',
        `Platform: Shopee | Fields: 16/16 | Status: Saved | Validation: ${validation?.isValid ? 'Passed' : 'Passed with Warnings'}`
      );

      setSaveSuccessMsg(
        `Berhasil menyimpan data Shopee Livestream untuk ${activeStreamer.name} (Tanggal: ${sessionDate}). Omset: ${formatIDR(finalSales)}.`
      );
      setDuplicateWarning(null);

      if (onSuccessSave) {
        onSuccessSave(newId);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan data ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for confidence badge
  const renderConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined || confidence === null) return null;
    const pct = Math.round(confidence * 100);
    let color = 'text-emerald-700 bg-emerald-100 border-emerald-300';
    if (confidence < 0.8) color = 'text-amber-700 bg-amber-100 border-amber-300';
    if (confidence < 0.5) color = 'text-red-700 bg-red-100 border-red-300';

    return (
      <span className={`inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${color}`}>
        {pct}%
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-800 text-xs font-black uppercase tracking-wider mb-2">
            <Zap className="w-3.5 h-3.5" />
            AI Vision OCR Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Import Data Livestream Shopee
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload screenshot Wawasan Livestream Shopee untuk mendeteksi 16 KPI performa secara instan dan bebas penyimpanan file gambar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('wawasan-livestream')}
              className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Buka Wawasan Livestream
            </button>
          )}
        </div>
      </div>

      {/* ERROR ALERT */}
      {errorMessage && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-red-900 space-y-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-extrabold text-red-950">Gagal Memproses Screenshot</div>
              <div className="text-red-700 text-xs mt-0.5">{errorMessage}</div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {uploadedImageSrc && (
            <div className="pt-2 border-t border-red-200/80 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRetryScan}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Scan Ulang AI
              </button>
              <button
                type="button"
                onClick={handleOpenManualFromScreenshot}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                Input Manual dengan Screenshot di Samping
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Upload Gambar Lain
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS ALERT */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-emerald-900 flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="font-extrabold text-emerald-950">Data Berhasil Disimpan ke Database!</div>
              <div className="text-emerald-800 text-xs mt-0.5">{saveSuccessMsg}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExtractedData(null);
                setScanStep('idle');
                setSaveSuccessMsg(null);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
            >
              Upload Lagi
            </button>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold cursor-pointer"
              >
                Lihat Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      {/* DUPLICATE WARNING MODAL / CARD */}
      {duplicateWarning?.isDuplicate && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-amber-900 space-y-3 shadow-md animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-amber-950">
                Peringatan: Data Livestream Kemungkinan Sudah Pernah Diinput!
              </h3>
              <p className="text-xs text-amber-800">
                Sistem mendeteksi bahwa data sesi untuk <strong>{activeStreamer.name}</strong> pada tanggal <strong>{sessionDate}</strong> dengan omset <strong>{formatIDR(extractedData?.sales || 0)}</strong> dan <strong>{extractedData?.orders} pesanan</strong> sudah ada di database.
              </p>
            </div>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-500 block">Host:</span>
              <strong className="text-slate-900">{activeStreamer.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Tanggal:</span>
              <strong className="text-slate-900">{sessionDate}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Omset Tercatat:</span>
              <strong className="text-slate-900">{formatIDR(duplicateWarning.existingSession?.revenue || 0)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total Pesanan:</span>
              <strong className="text-slate-900">{duplicateWarning.existingSession?.orders || 0} order</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setDuplicateWarning(null);
                setExtractedData(null);
                setScanStep('idle');
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={() => handleSaveToDatabase(true)}
              disabled={isSaving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Tetap Simpan (Sebagai Sesi Baru)'}
            </button>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('daily-report')}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Lihat Data Sebelumnya
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN UPLOAD & SETTINGS CARD */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Platform Picker */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Platform
            </label>
            <div className="relative">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Shopee">Shopee Live (Wawasan Livestream)</option>
                <option value="TikTok" disabled>
                  TikTok Shop (Coming Soon)
                </option>
                <option value="Tokopedia" disabled>
                  Tokopedia Live (Coming Soon)
                </option>
              </select>
            </div>
          </div>

          {/* Host Picker (Locked for Host, Choosable for Admin) */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Host Streamer
            </label>
            {isAdmin ? (
              <select
                value={selectedStreamerId}
                onChange={(e) => setSelectedStreamerId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {streamers.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.status})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-4 py-2.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-sm font-bold text-blue-900 flex items-center justify-between">
                <span>{activeStreamer.name}</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-200/80 text-blue-800 rounded-md">
                  Login Otomatis
                </span>
              </div>
            )}
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Tanggal & Jam Sesi
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-2/3 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <input
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="w-1/3 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* DRAG AND DROP ZONE */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processImageFile(e.dataTransfer.files[0]);
            }
          }}
          className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-orange-500 bg-orange-50/60 scale-[0.99]'
              : 'border-slate-300 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/30'
          }`}
          onClick={() => {
            if (scanStep === 'idle' || scanStep === 'preview') {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processImageFile(e.target.files[0]);
              }
            }}
          />

          {scanStep === 'idle' || scanStep === 'preview' ? (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)]">
                <UploadCloud className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Upload Screenshot Wawasan Livestream
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tarik dan lepas file di sini, atau <span className="text-orange-600 font-bold underline">pilih dari perangkat</span>
                </p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Mendukung JPG, JPEG, PNG (Resolusi bebas, screenshot crop / full)
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  PILIH GAMBAR
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseDemoSample();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Gunakan Screenshot Contoh (Demo Scan)
                </button>
              </div>

              <div className="text-[11px] text-slate-400 italic">
                🔒 Gambar hanya diproses di memory dan langsung dihapus setelah ekstraksi. Tidak disimpan ke database / storage.
              </div>
            </div>
          ) : (
            /* SCANNING ANIMATION */
            <div className="py-8 space-y-4 max-w-sm mx-auto">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-orange-600 font-black text-xs">
                  AI
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">
                  {scanStep === 'reading' && 'Membaca data screenshot...'}
                  {scanStep === 'processing' && 'Memproses seluruh 16 KPI dengan AI Vision...'}
                  {scanStep === 'validating' && 'Memvalidasi konsistensi data & normalisasi...'}
                </h4>
                <p className="text-xs text-slate-500">
                  Mengekstrak penjualan, viewers, order, durasi, dan rasio konversi...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PREVIEW & EDIT SECTION (APPEARS ONCE DATA IS READ) */}
      {extractedData && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1 text-xs font-black uppercase text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Data Berhasil Dibaca
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Preview & Verifikasi Hasil Ekstraksi
              </h2>
              <p className="text-xs text-slate-500">
                Host: <strong className="text-slate-800">{activeStreamer.name}</strong> &bull; Platform: <strong className="text-slate-800">Shopee</strong> &bull; Tanggal: <strong className="text-slate-800">{sessionDate}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  isEditing
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditing ? 'Selesai Edit' : 'Edit Manual'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveToDatabase(false)}
                disabled={isSaving}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Menyimpan...' : 'SIMPAN DATA KE DATABASE'}
              </button>
            </div>
          </div>

          {/* VALIDATION WARNINGS BANNER */}
          {validation && (!validation.isValid || validation.warnings.length > 0) && (
            <div className={`p-4 rounded-2xl border ${validation.isValid ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>{validation.isValid ? 'Catatan Pemeriksaan Data (Peringatan)' : 'Data Perlu Diperiksa Sebelum Disimpan'}</span>
              </div>
              <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                {validation.errors.map((err, i) => (
                  <li key={`err-${i}`} className="font-semibold text-red-700">{err}</li>
                ))}
                {validation.warnings.map((warn, i) => (
                  <li key={`warn-${i}`} className="text-amber-800">{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ORIGIN BANNER (REAL SCREENSHOT VS DEMO SAMPLE) */}
          {isDemoData ? (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="font-black text-amber-950">Mode Uji Coba: Menggunakan Sampel Screenshot Demo</div>
                  <div className="text-amber-800 text-[11px] mt-0.5">
                    Angka yang tampil di bawah adalah data simulasi Shopee (Rp 626.084), bukan dari file yang Anda upload.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
              >
                Upload Screenshot Asli Anda
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-black text-emerald-950">
                    Hasil Pembacaan Asli dari File Screenshot Anda
                  </div>
                  <div className="text-emerald-800 text-[11px] mt-0.5">
                    File: <strong>{uploadedFileName || 'Screenshot Anda'}</strong> ({uploadedFileSize}) &bull; Engine AI:{' '}
                    <strong>{modelUsed || 'AI Vision'}</strong>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploadedImageSrc && (
                  <button
                    type="button"
                    onClick={() => setShowZoomModal(true)}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    Lihat Foto Asli
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                >
                  Ganti File
                </button>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE VERIFICATION CONTAINER */}
          <div className={`grid grid-cols-1 ${uploadedImageSrc ? 'lg:grid-cols-12 gap-6' : ''} items-start`}>
            {uploadedImageSrc && (
              <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-3xl p-4 space-y-3 lg:sticky lg:top-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-orange-600" />
                    Screenshot Asli Anda
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowZoomModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    Perbesar
                  </button>
                </div>

                <div
                  onClick={() => setShowZoomModal(true)}
                  className="relative rounded-2xl overflow-hidden border border-slate-200 group cursor-pointer bg-slate-900/5 max-h-[380px] flex items-center justify-center"
                >
                  <img
                    src={uploadedImageSrc}
                    alt="Shopee Screenshot Upload"
                    referrerPolicy="no-referrer"
                    className="w-full object-contain max-h-[380px] group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                    <ZoomIn className="w-4 h-4" /> Klik untuk Zoom
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between">
                    <span>Nama File:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[140px]">{uploadedFileName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ukuran:</span>
                    <span className="font-semibold text-slate-800">{uploadedFileSize}</span>
                  </div>
                  {modelUsed && (
                    <div className="flex justify-between">
                      <span>Model AI:</span>
                      <span className="font-bold text-emerald-700">{modelUsed}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetryScan}
                    className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-orange-600" />
                    Scan Ulang
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  >
                    Ganti Foto
                  </button>
                </div>
              </div>
            )}

            <div className={`${uploadedImageSrc ? 'lg:col-span-8' : 'w-full'} space-y-4`}>
              {/* STATUS FILTER ROW */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-600">Status Pesanan:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                ) : (
                  <span className="font-black text-slate-800 px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    {orderStatus}
                  </span>
                )}
              </div>

              {/* 16 KPI METRICS GRID WITH EXACT MAPPING */}
              <div className={`grid grid-cols-2 ${uploadedImageSrc ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-4'} gap-3`}>
            {/* 1. Penjualan (Rp) */}
            <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 space-y-1 relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-orange-900">1. Penjualan (Rp)</span>
                {renderConfidenceBadge(extractedData.confidence?.sales)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.sales ?? ''}
                  onChange={(e) => handleFieldChange('sales', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-orange-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-orange-950">
                  {formatIDR(currentDataToValidate?.sales || 0)}
                </div>
              )}
              <div className="text-[10px] text-orange-800 font-medium">sales: integer numeric</div>
            </div>

            {/* 2. Penonton Aktif */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">2. Penonton Aktif</span>
                {renderConfidenceBadge(extractedData.confidence?.active_viewers)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.active_viewers ?? ''}
                  onChange={(e) => handleFieldChange('active_viewers', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.active_viewers || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">active_viewers</div>
            </div>

            {/* 3. Komentar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">3. Komentar</span>
                {renderConfidenceBadge(extractedData.confidence?.comments)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.comments ?? ''}
                  onChange={(e) => handleFieldChange('comments', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.comments || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">comments</div>
            </div>

            {/* 4. Tambah ke Keranjang */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">4. Tambah ke Keranjang</span>
                {renderConfidenceBadge(extractedData.confidence?.add_to_cart)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.add_to_cart ?? ''}
                  onChange={(e) => handleFieldChange('add_to_cart', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.add_to_cart || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">add_to_cart / checkout</div>
            </div>

            {/* 5. Dilihat */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">5. Dilihat</span>
                {renderConfidenceBadge(extractedData.confidence?.views)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.views ?? ''}
                  onChange={(e) => handleFieldChange('views', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.views || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">views (impresi produk)</div>
            </div>

            {/* 6. Durasi Rata-Rata Menonton */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">6. Durasi Rata-Rata</span>
                {renderConfidenceBadge(extractedData.confidence?.average_watch_duration)}
              </div>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editedData.average_watch_duration ?? ''}
                    onChange={(e) => handleFieldChange('average_watch_duration', Number(e.target.value))}
                    className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                  <span className="text-xs text-slate-500 font-bold">detik</span>
                </div>
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatDurationSeconds(currentDataToValidate?.average_watch_duration)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">average_watch_duration ({currentDataToValidate?.average_watch_duration || 0}s)</div>
            </div>

            {/* 7. Persentase Komentar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">7. % Komentar</span>
                {renderConfidenceBadge(extractedData.confidence?.comment_rate)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  step="0.1"
                  value={editedData.comment_rate ?? ''}
                  onChange={(e) => handleFieldChange('comment_rate', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatPercent(currentDataToValidate?.comment_rate || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">comment_rate</div>
            </div>

            {/* 8. Penjualan per mil (Rp) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">8. Penjualan/mil</span>
                {renderConfidenceBadge(extractedData.confidence?.sales_per_1000_views)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.sales_per_1000_views ?? ''}
                  onChange={(e) => handleFieldChange('sales_per_1000_views', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatIDR(currentDataToValidate?.sales_per_1000_views || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">sales_per_1000_views</div>
            </div>

            {/* 9. Pesanan */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">9. Pesanan</span>
                {renderConfidenceBadge(extractedData.confidence?.orders)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.orders ?? ''}
                  onChange={(e) => handleFieldChange('orders', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.orders || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">orders (pesanan masuk)</div>
            </div>

            {/* 10. Nilai Penjualan per Pesanan */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">10. Penjualan/Order</span>
                {renderConfidenceBadge(extractedData.confidence?.sales_per_order)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.sales_per_order ?? ''}
                  onChange={(e) => handleFieldChange('sales_per_order', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatIDR(currentDataToValidate?.sales_per_order || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">sales_per_order (AOV)</div>
            </div>

            {/* 11. Penonton */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">11. Penonton</span>
                {renderConfidenceBadge(extractedData.confidence?.viewers)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.viewers ?? ''}
                  onChange={(e) => handleFieldChange('viewers', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.viewers || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">viewers (total penonton)</div>
            </div>

            {/* 12. Penonton Tertinggi */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">12. Penonton Tertinggi</span>
                {renderConfidenceBadge(extractedData.confidence?.peak_viewers)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.peak_viewers ?? ''}
                  onChange={(e) => handleFieldChange('peak_viewers', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.peak_viewers || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">peak_viewers</div>
            </div>

            {/* 13. Persentase Klik */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">13. % Klik</span>
                {renderConfidenceBadge(extractedData.confidence?.click_rate)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  step="0.1"
                  value={editedData.click_rate ?? ''}
                  onChange={(e) => handleFieldChange('click_rate', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatPercent(currentDataToValidate?.click_rate || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">click_rate (CTR)</div>
            </div>

            {/* 14. Pesanan per Klik */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">14. Pesanan/Klik</span>
                {renderConfidenceBadge(extractedData.confidence?.orders_per_click)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  step="0.1"
                  value={editedData.orders_per_click ?? ''}
                  onChange={(e) => handleFieldChange('orders_per_click', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatPercent(currentDataToValidate?.orders_per_click || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">orders_per_click</div>
            </div>

            {/* 15. Pembeli */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">15. Pembeli</span>
                {renderConfidenceBadge(extractedData.confidence?.buyers)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.buyers ?? ''}
                  onChange={(e) => handleFieldChange('buyers', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.buyers || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">buyers (pembeli unik)</div>
            </div>

            {/* 16. Produk Terjual */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">16. Produk Terjual</span>
                {renderConfidenceBadge(extractedData.confidence?.products_sold)}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedData.products_sold ?? ''}
                  onChange={(e) => handleFieldChange('products_sold', Number(e.target.value))}
                  className="w-full px-2 py-1 text-base font-black bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              ) : (
                <div className="text-lg font-black text-slate-900">
                  {formatNumber(currentDataToValidate?.products_sold || 0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">products_sold (pcs)</div>
            </div>
          </div>
        </div>
      </div>

          {/* BOTTOM ACTIONS */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              *Setelah mengklik Simpan, seluruh metrik langsung terhubung ke dashboard Host & Laporan Finansial.
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setExtractedData(null);
                  setScanStep('idle');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                Reset / Batal
              </button>

              <button
                type="button"
                onClick={() => handleSaveToDatabase(false)}
                disabled={isSaving}
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Menyimpan ke Database...' : 'SIMPAN DATA KE DATABASE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE SCREENSHOT ZOOM MODAL */}
      {showZoomModal && uploadedImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowZoomModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
              <span>Screenshot Asli: {uploadedFileName || 'Wawasan Livestream Shopee'}</span>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center max-h-[calc(90vh-45px)]">
              <img
                src={uploadedImageSrc}
                alt="Zoomed Screenshot"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
