import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, NavTabKey } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { StreamerDashboard } from './components/dashboard/StreamerDashboard';
import { DailyReportView } from './components/reports/DailyReportView';
import { WeeklyReportView } from './components/reports/WeeklyReportView';
import { MonthlyReportView } from './components/reports/MonthlyReportView';
import { YearlyReportView } from './components/reports/YearlyReportView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { StreamerPerformanceView } from './components/streamers/StreamerPerformanceView';
import { ShiftAnalyticsView } from './components/shifts/ShiftAnalyticsView';
import { ScheduleManagementView } from './components/schedules/ScheduleManagementView';
import { ProductCatalogView } from './components/products/ProductCatalogView';
import { TargetManagementView } from './components/targets/TargetManagementView';
import { StreamerManagementView } from './components/streamers/StreamerManagementView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { ShopeeImportView } from './components/reports/ShopeeImportView';
import { WawasanLivestreamView } from './components/reports/WawasanLivestreamView';
import { InputLiveReportModal } from './components/live-sessions/InputLiveReportModal';
import { ResetDataModal } from './components/admin/ResetDataModal';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import {
  subscribeLiveSessions,
  subscribeStreamers,
  subscribeSchedules,
  subscribeTargets,
  subscribeProducts,
  subscribeAuditLogs,
  subscribeNotifications,
  seedInitialDemoData,
  isCleanSlateActive,
  getLiveSessions,
} from './services/firestoreService';
import {
  LiveSession,
  Streamer,
  Schedule,
  Target,
  Product,
  AuditLog,
  NotificationItem,
} from './types';

function MainApp() {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTabKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore real-time data states
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Live report modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [prefillData, setPrefillData] = useState<{
    streamerId?: string;
    shiftId?: string;
    date?: string;
  }>({});

  // Real-time subscriptions
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubSessions = subscribeLiveSessions((data) => setSessions(data));
    const unsubStreamers = subscribeStreamers((data) => {
      setStreamers(data);
      // If no streamers exist yet, seed initial data ONLY if clean slate has not been set by Admin
      if (data.length === 0) {
        const isCleanLocal = typeof window !== 'undefined' && localStorage.getItem('shopee_system_clean_slate') === 'true';
        if (!isCleanLocal) {
          isCleanSlateActive().then((cleanActive) => {
            if (!cleanActive) {
              seedInitialDemoData().catch(console.error);
            }
          });
        }
      }
    });
    const unsubSchedules = subscribeSchedules((data) => setSchedules(data));
    const unsubTargets = subscribeTargets((data) => setTargets(data));
    const unsubProducts = subscribeProducts((data) => setProducts(data));
    const unsubAudit = subscribeAuditLogs((data) => {
      setAuditLogs(data);
      setLoading(false);
    });
    const unsubNotifications = subscribeNotifications(
      currentUser?.streamerId || currentUser?.uid || '',
      currentUser?.role || 'ADMIN',
      (data) => setNotifications(data)
    );

    unsubs = [
      unsubSessions,
      unsubStreamers,
      unsubSchedules,
      unsubTargets,
      unsubProducts,
      unsubAudit,
      unsubNotifications,
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [currentUser?.streamerId, currentUser?.uid, currentUser?.role]);

  const handleManualRefreshSessions = async () => {
    try {
      const fresh = await getLiveSessions();
      if (fresh && fresh.length > 0) {
        setSessions(fresh);
      }
    } catch (err) {
      console.warn('Manual refresh sessions error:', err);
    }
  };

  // Handlers for modal
  const handleOpenNewReport = () => {
    setEditingSession(null);
    setPrefillData({
      streamerId: !isAdmin && currentUser?.streamerId ? currentUser.streamerId : undefined,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditReport = (session: LiveSession) => {
    setEditingSession(session);
    setPrefillData({});
    setIsModalOpen(true);
  };

  const handleOpenReportFromSchedule = (
    streamerId?: string,
    shiftId?: string,
    date?: string
  ) => {
    setEditingSession(null);
    setPrefillData({
      streamerId: streamerId || undefined,
      shiftId: shiftId || undefined,
      date: date || undefined,
    });
    setIsModalOpen(true);
  };

  // Pending report count from schedules needing reports
  const pendingReportCount = schedules.filter((s) => {
    if (s.hasReport || s.status === 'Cancelled') return false;
    if (!isAdmin && currentUser?.streamerId && s.streamerId !== currentUser.streamerId) return false;
    return true;
  }).length;

  // Determine which dashboard to show for 'dashboard' tab:
  // If user is Streamer, render StreamerDashboard; if Admin, render AdminDashboard
  const renderDashboard = () => {
    if (!isAdmin && currentUser?.streamerId) {
      return (
        <StreamerDashboard
          sessions={sessions}
          schedules={schedules}
          targets={targets}
          onOpenNewLiveModal={handleOpenNewReport}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      );
    }
    return (
      <AdminDashboard
        sessions={sessions}
        streamers={streamers}
        schedules={schedules}
        onOpenNewLiveModal={handleOpenNewReport}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenResetModal={() => setIsResetModalOpen(true)}
      />
    );
  };

  const ADMIN_RESTRICTED_TABS: NavTabKey[] = [
    'daily-report',
    'weekly-report',
    'monthly-report',
    'yearly-report',
    'analytics',
    'shift-analytics',
    'targets',
    'streamers-mgmt',
    'audit-logs',
  ];

  const isAccessDenied = !isAdmin && ADMIN_RESTRICTED_TABS.includes(activeTab);

  return (
    <div className="min-h-screen bg-[#edf3fc] text-slate-800 flex relative selection:bg-blue-500 selection:text-white">
      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        pendingReportCount={pendingReportCount}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenLiveModal={handleOpenNewReport}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onOpenAdminAuthModal={() => setIsAdminAuthModalOpen(true)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 bg-[#edf3fc]">
        <Header
          streamers={streamers}
          notifications={notifications}
          onOpenLiveModal={handleOpenNewReport}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenResetModal={() => setIsResetModalOpen(true)}
          onOpenAdminAuthModal={() => setIsAdminAuthModalOpen(true)}
          onOpenReportForSchedule={handleOpenReportFromSchedule}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* ACCESS CONTROL GATE FOR NON-ADMIN USERS */}
          {isAccessDenied ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-amber-200 shadow-xl max-w-2xl mx-auto text-center space-y-6 my-12 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 flex items-center justify-center text-amber-600 shadow-inner">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-black uppercase tracking-wider">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Area Khusus Administrator
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Akses Terbatas: Memerlukan Autentikasi Admin
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Laporan finansial, rekapan omset, analisis mendalam, dan konfigurasi tim hanya dapat diakses dengan kata sandi Administrator Shopee Live.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdminAuthModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-2xl font-black text-sm shadow-[0_4px_16px_rgba(217,119,6,0.35)] transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Masukkan Kata Sandi Admin
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Dashboard Streamer
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'wawasan-livestream' && (
                <WawasanLivestreamView
                  streamers={streamers}
                  sessions={sessions}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onRefreshSessions={handleManualRefreshSessions}
                />
              )}
              {activeTab === 'import-livestream' && (
                <ShopeeImportView
                  streamers={streamers}
                  sessions={sessions}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onSuccessSave={() => {
                    setActiveTab('wawasan-livestream');
                  }}
                />
              )}
              {activeTab === 'daily-report' && (
                <DailyReportView
                  sessions={sessions}
                  streamers={streamers}
                  onOpenEditModal={handleOpenEditReport}
                />
              )}
              {activeTab === 'weekly-report' && <WeeklyReportView sessions={sessions} />}
              {activeTab === 'monthly-report' && (
                <MonthlyReportView sessions={sessions} targets={targets} />
              )}
              {activeTab === 'yearly-report' && (
                <YearlyReportView sessions={sessions} targets={targets} />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsView sessions={sessions} streamers={streamers} />
              )}
              {activeTab === 'streamer-performance' && (
                <StreamerPerformanceView sessions={sessions} streamers={streamers} />
              )}
              {activeTab === 'shift-analytics' && <ShiftAnalyticsView sessions={sessions} />}
              {activeTab === 'schedules' && (
                <ScheduleManagementView
                  schedules={schedules}
                  streamers={streamers}
                  onOpenLiveReportForSchedule={handleOpenReportFromSchedule}
                />
              )}
              {activeTab === 'products' && (
                <ProductCatalogView products={products} sessions={sessions} />
              )}
              {activeTab === 'targets' && (
                <TargetManagementView
                  targets={targets}
                  streamers={streamers}
                  sessions={sessions}
                />
              )}
              {activeTab === 'streamers-mgmt' && (
                <StreamerManagementView streamers={streamers} />
              )}
              {activeTab === 'audit-logs' && <AuditLogsView logs={auditLogs} />}
            </>
          )}
        </main>
      </div>

      {/* INPUT / EDIT LIVE REPORT MODAL */}
      <InputLiveReportModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSession(null);
        }}
        streamers={streamers}
        products={products}
        editingSession={editingSession}
        prefillStreamerId={prefillData.streamerId}
        prefillShiftId={prefillData.shiftId}
        prefillDate={prefillData.date}
      />

      {/* RESET DATABASE TO ZERO MODAL (ADMIN ONLY) */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />

      {/* ADMIN AUTHENTICATION GATE MODAL (OPTION 3 HYBRID) */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={() => {
          setIsAdminAuthModalOpen(false);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
