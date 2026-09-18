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
import { InputLiveReportModal } from './components/live-sessions/InputLiveReportModal';
import {
  subscribeLiveSessions,
  subscribeStreamers,
  subscribeSchedules,
  subscribeTargets,
  subscribeProducts,
  subscribeAuditLogs,
  seedInitialDemoData,
} from './services/firestoreService';
import {
  LiveSession,
  Streamer,
  Schedule,
  Target,
  Product,
  AuditLog,
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
  const [loading, setLoading] = useState(true);

  // Live report modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      // If no streamers exist yet, seed the initial database with Dona, Nina, Nata, Fawwas
      if (data.length === 0) {
        seedInitialDemoData().catch(console.error);
      }
    });
    const unsubSchedules = subscribeSchedules((data) => setSchedules(data));
    const unsubTargets = subscribeTargets((data) => setTargets(data));
    const unsubProducts = subscribeProducts((data) => setProducts(data));
    const unsubAudit = subscribeAuditLogs((data) => {
      setAuditLogs(data);
      setLoading(false);
    });

    unsubs = [
      unsubSessions,
      unsubStreamers,
      unsubSchedules,
      unsubTargets,
      unsubProducts,
      unsubAudit,
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

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
    streamerId: string,
    shiftId: string,
    date: string
  ) => {
    setEditingSession(null);
    setPrefillData({ streamerId, shiftId, date });
    setIsModalOpen(true);
  };

  // Pending report count from schedules
  const pendingReportCount = schedules.filter(
    (s) => s.status === 'Completed' && !s.hasReport
  ).length;

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
      />
    );
  };

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
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 bg-[#edf3fc]">
        <Header
          streamers={streamers}
          onOpenLiveModal={handleOpenNewReport}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'dashboard' && renderDashboard()}
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
