import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  Streamer,
  Shift,
  Schedule,
  LiveSession,
  Product,
  Target,
  NotificationItem,
  AuditLog,
  ProductItemSale,
} from '../types';
import { SHIFTS, calculateLiveMetrics } from '../utils/shiftLogic';

// Collection references
const STREAMERS_COL = 'streamers';
const SHIFTS_COL = 'shifts';
const SCHEDULES_COL = 'schedules';
const SESSIONS_COL = 'live_sessions';
const PRODUCTS_COL = 'products';
const TARGETS_COL = 'targets';
const NOTIFICATIONS_COL = 'notifications';
const AUDIT_LOGS_COL = 'audit_logs';
const USERS_COL = 'users';
const SYSTEM_SETTINGS_COL = 'system_settings';

// --- AUDIT LOGGING ---
export async function logAudit(
  user: string,
  userId: string,
  action: string,
  record: string,
  oldValue: string,
  newValue: string
) {
  try {
    const colRef = collection(db, AUDIT_LOGS_COL);
    await addDoc(colRef, {
      user: user || 'Sistem',
      userId: userId || 'system',
      action,
      record,
      oldValue: oldValue || '-',
      newValue: newValue || '-',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not write audit log to Firestore:', err);
  }
}

// --- STREAMERS CRUD ---
export function subscribeStreamers(callback: (streamers: Streamer[]) => void) {
  const colRef = collection(db, STREAMERS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const streamers: Streamer[] = [];
      snapshot.forEach((d) => {
        streamers.push({ id: d.id, ...d.data() } as Streamer);
      });
      callback(streamers);
    },
    (error) => {
      console.error('Error fetching streamers:', error);
    }
  );
}

export async function addStreamer(streamer: Omit<Streamer, 'id'>, currentUser: string, currentUserId: string) {
  const colRef = collection(db, STREAMERS_COL);
  const docRef = await addDoc(colRef, {
    ...streamer,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit(
    currentUser,
    currentUserId,
    'Tambah Streamer',
    `Streamer: ${streamer.name}`,
    '-',
    `Status: ${streamer.status}, Email: ${streamer.email}`
  );

  return docRef.id;
}

export async function updateStreamer(
  id: string,
  updates: Partial<Streamer>,
  currentUser: string,
  currentUserId: string,
  oldDesc = ''
) {
  const docRef = doc(db, STREAMERS_COL, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  await logAudit(
    currentUser,
    currentUserId,
    'Update Streamer',
    `Streamer ID: ${id}`,
    oldDesc,
    JSON.stringify(updates)
  );
}

export async function deleteStreamer(id: string, name: string, currentUser: string, currentUserId: string) {
  const docRef = doc(db, STREAMERS_COL, id);
  await deleteDoc(docRef);

  await logAudit(
    currentUser,
    currentUserId,
    'Hapus Streamer',
    `Streamer: ${name} (${id})`,
    name,
    'Dihapus'
  );
}

// --- PRODUCTS CRUD ---
export function subscribeProducts(callback: (products: Product[]) => void) {
  const colRef = collection(db, PRODUCTS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((d) => prods.push({ id: d.id, ...d.data() } as Product));
      callback(prods);
    },
    (err) => console.error('Error subscribe products:', err)
  );
}

export async function addProduct(product: Omit<Product, 'id'>, user: string, userId: string) {
  const colRef = collection(db, PRODUCTS_COL);
  const docRef = await addDoc(colRef, {
    ...product,
    createdAt: serverTimestamp(),
  });
  await logAudit(user, userId, 'Tambah Produk', product.name, '-', `SKU: ${product.sku}, Harga: ${product.price}`);
  return docRef.id;
}

export async function updateProduct(id: string, updates: Partial<Product>, user: string, userId: string) {
  const docRef = doc(db, PRODUCTS_COL, id);
  await updateDoc(docRef, updates);
  await logAudit(user, userId, 'Update Produk', `Produk ID: ${id}`, '-', JSON.stringify(updates));
}

export async function deleteProduct(id: string, name: string, user: string, userId: string) {
  const docRef = doc(db, PRODUCTS_COL, id);
  await deleteDoc(docRef);
  await logAudit(user, userId, 'Hapus Produk', `Produk: ${name} (${id})`, name, 'Dihapus');
}

// Clean payload to prevent Firestore 'Unsupported field value: undefined' errors
export function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Timestamp) &&
        !(val instanceof Date)
      ) {
        cleaned[key] = cleanFirestorePayload(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

// --- LIVE SESSIONS CRUD ---
export function subscribeLiveSessions(callback: (sessions: LiveSession[]) => void) {
  const colRef = collection(db, SESSIONS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: LiveSession[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as LiveSession);
      });
      // Sort client-side by date desc, then start time desc
      list.sort((a, b) => {
        const dateA = a.businessDate || '';
        const dateB = b.businessDate || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.startTime || '').localeCompare(a.startTime || '');
      });
      callback(list);
    },
    (err) => {
      console.error('Error in subscribeLiveSessions real-time listener:', err);
    }
  );
}

export async function getLiveSessions(): Promise<LiveSession[]> {
  try {
    const colRef = collection(db, SESSIONS_COL);
    const snapshot = await getDocs(colRef);
    const list: LiveSession[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as LiveSession);
    });
    list.sort((a, b) => {
      const dateA = a.businessDate || '';
      const dateB = b.businessDate || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.startTime || '').localeCompare(a.startTime || '');
    });
    return list;
  } catch (err) {
    console.error('Error in getLiveSessions:', err);
    return [];
  }
}

export async function addLiveSession(
  session: Omit<LiveSession, 'id'>,
  user: string,
  userId: string
): Promise<string> {
  const colRef = collection(db, SESSIONS_COL);
  const cleanedSession = cleanFirestorePayload(session);
  const docRef = await addDoc(colRef, {
    ...cleanedSession,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId || 'system',
  });

  // If session is linked to a schedule, mark schedule completed
  try {
    const schedQ = query(
      collection(db, SCHEDULES_COL),
      where('streamerId', '==', session.streamerId),
      where('date', '==', session.businessDate)
    );
    const schedSnap = await getDocs(schedQ);
    schedSnap.forEach(async (scDoc) => {
      await updateDoc(doc(db, SCHEDULES_COL, scDoc.id), {
        status: 'Completed',
        hasReport: true,
        reportId: docRef.id,
      });
    });
  } catch (err) {
    console.warn('Failed to auto-update linked schedule:', err);
  }

  // Create notification
  try {
    await addDoc(collection(db, NOTIFICATIONS_COL), {
      userId: 'ALL',
      title: 'Laporan Live Baru',
      message: `${session.streamerName} telah menginput live report untuk ${session.shiftName} (${session.businessDate}) dengan omset Rp ${session.revenue.toLocaleString('id-ID')}`,
      type: 'report',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to write notification:', err);
  }

  await logAudit(
    user,
    userId,
    'Input Live Report',
    `Live: ${session.streamerName} - ${session.shiftName} (${session.businessDate})`,
    '-',
    `Omset: Rp ${session.revenue.toLocaleString('id-ID')}, Orders: ${session.orders}`
  );

  return docRef.id;
}

export async function updateLiveSession(
  id: string,
  updates: Partial<LiveSession>,
  user: string,
  userId: string,
  oldSummary = ''
) {
  const docRef = doc(db, SESSIONS_COL, id);
  const cleanedUpdates = cleanFirestorePayload(updates);
  await updateDoc(docRef, {
    ...cleanedUpdates,
    updatedAt: serverTimestamp(),
  });

  await logAudit(
    user,
    userId,
    'Edit Live Report',
    `Live Report ID: ${id}`,
    oldSummary,
    JSON.stringify(updates)
  );
}

export async function deleteLiveSession(id: string, summary: string, user: string, userId: string) {
  const docRef = doc(db, SESSIONS_COL, id);
  await deleteDoc(docRef);

  await logAudit(user, userId, 'Hapus Live Report', `Live Session: ${id}`, summary, 'Dihapus');
}

// --- SCHEDULES CRUD ---
export function subscribeSchedules(callback: (schedules: Schedule[]) => void) {
  const colRef = collection(db, SCHEDULES_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Schedule[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Schedule));
      list.sort((a, b) => b.date.localeCompare(a.date));
      callback(list);
    },
    (err) => console.error('Error subscribe schedules:', err)
  );
}

export async function addSchedule(schedule: Omit<Schedule, 'id'>, user: string, userId: string) {
  const colRef = collection(db, SCHEDULES_COL);
  const docRef = await addDoc(colRef, {
    ...schedule,
    hasReport: schedule.hasReport ?? false,
    createdAt: serverTimestamp(),
  });

  // 1. Real-time Notification for the assigned Streamer
  try {
    await addDoc(collection(db, NOTIFICATIONS_COL), {
      userId: schedule.streamerId,
      title: `📢 Jadwal Live Baru: ${schedule.shiftName}`,
      message: `Anda ditugaskan live pada ${schedule.date} (${schedule.startTime} - ${schedule.endTime}). Jangan lupa untuk mengisi laporan setelah sesi berakhir!`,
      type: 'shift',
      scheduleId: docRef.id,
      streamerId: schedule.streamerId,
      streamerName: schedule.streamerName,
      shiftId: schedule.shiftId,
      shiftName: schedule.shiftName,
      date: schedule.date,
      needsReport: true,
      priority: 'high',
      read: false,
      createdAt: serverTimestamp(),
    });

    // 2. Real-time Notification for Admin (so admin stays informed about new live shifts needing reports)
    await addDoc(collection(db, NOTIFICATIONS_COL), {
      userId: 'ADMIN',
      title: `🗓️ Jadwal Live Baru: ${schedule.streamerName}`,
      message: `Jadwal live baru untuk ${schedule.streamerName} pada ${schedule.shiftName} (${schedule.date}, ${schedule.startTime} - ${schedule.endTime}). Menunggu pengisian laporan.`,
      type: 'shift',
      scheduleId: docRef.id,
      streamerId: schedule.streamerId,
      streamerName: schedule.streamerName,
      shiftId: schedule.shiftId,
      shiftName: schedule.shiftName,
      date: schedule.date,
      needsReport: true,
      priority: 'normal',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Notification error on addSchedule:', err);
  }

  await logAudit(user, userId, 'Buat Jadwal', `${schedule.streamerName} - ${schedule.date} (${schedule.shiftName})`, '-', 'Scheduled');
  return docRef.id;
}

export async function updateSchedule(id: string, updates: Partial<Schedule>, user: string, userId: string) {
  const docRef = doc(db, SCHEDULES_COL, id);
  await updateDoc(docRef, updates);
  await logAudit(user, userId, 'Update Jadwal', `Jadwal ID: ${id}`, '-', JSON.stringify(updates));
}

export async function deleteSchedule(
  id: string,
  labelOrStreamer: string,
  dateOrUser: string,
  userOrUserId?: string,
  userIdParam?: string
) {
  const docRef = doc(db, SCHEDULES_COL, id);
  await deleteDoc(docRef);
  const user = userIdParam ? userOrUserId || 'Admin' : dateOrUser || 'Admin';
  const uid = userIdParam || userOrUserId || 'uid';
  await logAudit(user, uid, 'Hapus Jadwal', `Jadwal: ${labelOrStreamer}`, 'Ada', 'Dihapus');
}

// --- TARGETS CRUD ---
export function subscribeTargets(callback: (targets: Target[]) => void) {
  const colRef = collection(db, TARGETS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Target[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Target));
      callback(list);
    },
    (err) => console.error('Error subscribe targets:', err)
  );
}

export async function addTarget(target: Omit<Target, 'id'>, user: string, userId: string) {
  const colRef = collection(db, TARGETS_COL);
  const docRef = await addDoc(colRef, target);
  await logAudit(user, userId, 'Buat Target', `${target.type} - ${target.period}`, '-', `Target: Rp ${target.targetValue.toLocaleString('id-ID')}`);
  return docRef.id;
}

export async function updateTarget(id: string, updates: Partial<Target>, user: string, userId: string) {
  const docRef = doc(db, TARGETS_COL, id);
  await updateDoc(docRef, updates);
  await logAudit(user, userId, 'Update Target', `Target ID: ${id}`, '-', JSON.stringify(updates));
}

export async function deleteTarget(id: string, label: string, user: string, userId: string) {
  const docRef = doc(db, TARGETS_COL, id);
  await deleteDoc(docRef);
  await logAudit(user, userId, 'Hapus Target', `Target: ${label} (${id})`, label, 'Dihapus');
}

// --- NOTIFICATIONS ---
export function subscribeNotifications(userId: string, role: string, callback: (notifications: NotificationItem[]) => void) {
  const colRef = collection(db, NOTIFICATIONS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: NotificationItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Omit<NotificationItem, 'id'>;
        // Admin gets all notifications + system, Streamer gets their own + ALL
        if (role === 'ADMIN' || data.userId === userId || data.userId === 'ALL' || (role === 'ADMIN' && data.userId === 'ADMIN')) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      callback(list);
    },
    (err) => {
      console.warn('Realtime notifications listener error:', err);
    }
  );
}

export async function markNotificationAsRead(id: string) {
  try {
    const docRef = doc(db, NOTIFICATIONS_COL, id);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.warn('Error markNotificationAsRead:', err);
  }
}

export async function markAllNotificationsAsRead(notifications: NotificationItem[]) {
  try {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.slice(0, 450).forEach((n) => {
      const docRef = doc(db, NOTIFICATIONS_COL, n.id);
      batch.update(docRef, { read: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Error markAllNotificationsAsRead:', err);
  }
}

export async function deleteNotification(id: string) {
  try {
    const docRef = doc(db, NOTIFICATIONS_COL, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Error deleteNotification:', err);
  }
}

export async function clearAllNotifications(notifications: NotificationItem[]) {
  try {
    if (notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.slice(0, 450).forEach((n) => {
      const docRef = doc(db, NOTIFICATIONS_COL, n.id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Error clearAllNotifications:', err);
  }
}

/**
 * Send an urgent real-time reminder to streamer & admin for a schedule that needs a live report
 */
export async function sendScheduleReportReminder(
  schedule: Schedule,
  senderUser: string,
  senderUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const batch = writeBatch(db);

    // 1. Notif to Streamer
    const streamerNotifRef = doc(collection(db, NOTIFICATIONS_COL));
    batch.set(streamerNotifRef, {
      userId: schedule.streamerId,
      title: `⏰ Pengingat: Segera Isi Laporan Live!`,
      message: `Jadwal live ${schedule.shiftName} (${schedule.date}, ${schedule.startTime} - ${schedule.endTime}) belum diisi laporannya. Harap segera input live report.`,
      type: 'reminder',
      scheduleId: schedule.id,
      streamerId: schedule.streamerId,
      streamerName: schedule.streamerName,
      shiftId: schedule.shiftId,
      shiftName: schedule.shiftName,
      date: schedule.date,
      needsReport: true,
      priority: 'urgent',
      read: false,
      createdAt: serverTimestamp(),
    });

    // 2. Notif copy to Admin
    const adminNotifRef = doc(collection(db, NOTIFICATIONS_COL));
    batch.set(adminNotifRef, {
      userId: 'ADMIN',
      title: `⚠️ Pengingat Terkirim: ${schedule.streamerName}`,
      message: `Pengingat pengisian laporan untuk ${schedule.streamerName} pada ${schedule.shiftName} (${schedule.date}) telah dikirim secara real-time.`,
      type: 'reminder',
      scheduleId: schedule.id,
      streamerId: schedule.streamerId,
      streamerName: schedule.streamerName,
      shiftId: schedule.shiftId,
      shiftName: schedule.shiftName,
      date: schedule.date,
      needsReport: true,
      priority: 'normal',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    await logAudit(
      senderUser,
      senderUserId,
      'Kirim Pengingat Laporan',
      `Jadwal: ${schedule.streamerName} - ${schedule.date} (${schedule.shiftName})`,
      'Belum Laporan',
      'Pengingat Terkirim'
    );

    return {
      success: true,
      message: `Notifikasi pengingat real-time berhasil dikirim ke streamer ${schedule.streamerName}!`,
    };
  } catch (err: any) {
    console.error('Error sending schedule report reminder:', err);
    return {
      success: false,
      message: err.message || 'Gagal mengirim pengingat.',
    };
  }
}

// --- AUDIT LOGS ---
export function subscribeAuditLogs(callback: (logs: AuditLog[]) => void) {
  const colRef = collection(db, AUDIT_LOGS_COL);
  let fallbackUnsub: (() => void) | null = null;
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as AuditLog));
      callback(list);
    },
    () => {
      fallbackUnsub = onSnapshot(colRef, (snapshot) => {
        const list: AuditLog[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as AuditLog));
        list.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        callback(list);
      });
    }
  );

  return () => {
    unsub();
    if (fallbackUnsub) fallbackUnsub();
  };
}

// --- SEED INITIAL / DEMO DATA ---
export async function seedInitialDatabase(force = false): Promise<{ success: boolean; message: string }> {
  try {
    // Check if streamers already seeded
    const streamersSnap = await getDocs(collection(db, STREAMERS_COL));
    if (!streamersSnap.empty && !force) {
      return { success: true, message: 'Database sudah memiliki data.' };
    }

    const batch = writeBatch(db);

    // 1. Initial Streamers: Dona, Nina, Nata, Fawwas
    const initialStreamers = [
      {
        id: 'streamer-dona',
        name: 'Dona',
        email: 'dona@shopee.live',
        phone: '0812-3456-7891',
        status: 'active' as const,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        joinDate: '2025-11-01',
        notes: 'Top host untuk fashion & beauty, gaya bicara interaktif & ceria.',
      },
      {
        id: 'streamer-nina',
        name: 'Nina',
        email: 'nina@shopee.live',
        phone: '0812-3456-7892',
        status: 'active' as const,
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        joinDate: '2025-12-15',
        notes: 'Spesialis skincare review mendalam, conversion rate tinggi.',
      },
      {
        id: 'streamer-nata',
        name: 'Nata',
        email: 'nata@shopee.live',
        phone: '0812-3456-7893',
        status: 'active' as const,
        avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
        joinDate: '2026-01-10',
        notes: 'Energetik untuk flash sale & game engagement, jago live malam (Shift 3).',
      },
      {
        id: 'streamer-fawwas',
        name: 'Fawwas',
        email: 'fawwas@shopee.live',
        phone: '0812-3456-7894',
        status: 'active' as const,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        joinDate: '2026-02-01',
        notes: 'Host pria karismatik, cocok untuk kategori unisex, electronics & casual apparel.',
      },
    ];

    for (const s of initialStreamers) {
      const docRef = doc(db, STREAMERS_COL, s.id);
      batch.set(docRef, {
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Initial Products
    const initialProducts: Product[] = [
      {
        id: 'prod-1',
        name: 'Gamis Silk Premium Zahiya',
        sku: 'GMS-SLK-01',
        category: 'Fashion Muslim',
        price: 185000,
        status: 'active',
      },
      {
        id: 'prod-2',
        name: 'Serum Brightening Glow 30ml',
        sku: 'SKN-SRM-02',
        category: 'Skincare',
        price: 129000,
        status: 'active',
      },
      {
        id: 'prod-3',
        name: 'Lip Tint Velvet Matte Finish',
        sku: 'LIP-VMT-03',
        category: 'Cosmetics',
        price: 68000,
        status: 'active',
      },
      {
        id: 'prod-4',
        name: 'Pashmina Ceruty Baby Doll Shawl',
        sku: 'HJB-CRT-04',
        category: 'Hijab & Aksesoris',
        price: 45000,
        status: 'active',
      },
      {
        id: 'prod-5',
        name: 'Sunscreen Aqua Gel SPF 50 PA++++',
        sku: 'SKN-SUN-05',
        category: 'Skincare',
        price: 95000,
        status: 'active',
      },
      {
        id: 'prod-6',
        name: 'Tunic Rayon Premium Oversized',
        sku: 'FSH-TNC-06',
        category: 'Fashion Wanita',
        price: 110000,
        status: 'active',
      },
    ];

    for (const p of initialProducts) {
      const docRef = doc(db, PRODUCTS_COL, p.id);
      batch.set(docRef, {
        ...p,
        createdAt: serverTimestamp(),
      });
    }

    // 3. Realistic Demo Live Sessions for September 2026 & historic months
    // Showing Shift 1, Shift 2, and Shift 3 (CRITICAL: Shift 3 21:00-06:00 businessDate is start date!)
    const demoSessions = [
      {
        id: 'demo-session-18-s1',
        streamerId: 'streamer-dona',
        streamerName: 'Dona',
        businessDate: '2026-09-18',
        shiftId: 'shift-1',
        shiftName: 'Shift 1 (Pagi)',
        startTime: '06:00',
        endTime: '15:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 14500,
        uniqueViewers: 11200,
        peakViewers: 1850,
        averageViewers: 940,
        newFollowers: 320,
        totalFollowers: 45200,
        likes: 85400,
        comments: 6200,
        shares: 480,
        productClicks: 4300,
        productImpressions: 24500,
        checkout: 640,
        orders: 512,
        productsSold: 780,
        revenue: 28650000,
        cancelledOrders: 18,
        refundOrders: 4,
        refundAmount: 520000,
        voucherUsed: 310,
        affiliateOrders: 45,
        affiliateRevenue: 2800000,
        adsSpend: 350000,
        notes: 'Sesi pagi sangat ramai saat flash sale jam 10:00! Gamis Silk habis terjual.',
        isDemo: true,
        productDetails: [
          { productId: 'prod-1', productName: 'Gamis Silk Premium Zahiya', quantity: 95, revenue: 17575000 },
          { productId: 'prod-4', productName: 'Pashmina Ceruty Baby Doll Shawl', quantity: 180, revenue: 8100000 },
          { productId: 'prod-3', productName: 'Lip Tint Velvet Matte Finish', quantity: 44, revenue: 2975000 },
        ],
      },
      {
        id: 'demo-session-18-s2',
        streamerId: 'streamer-nina',
        streamerName: 'Nina',
        businessDate: '2026-09-18',
        shiftId: 'shift-2',
        shiftName: 'Shift 2 (Siang - Sore)',
        startTime: '12:00',
        endTime: '21:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 18200,
        uniqueViewers: 13900,
        peakViewers: 2400,
        averageViewers: 1150,
        newFollowers: 410,
        totalFollowers: 45610,
        likes: 112000,
        comments: 8900,
        shares: 620,
        productClicks: 5600,
        productImpressions: 31200,
        checkout: 790,
        orders: 680,
        productsSold: 940,
        revenue: 34500000,
        cancelledOrders: 14,
        refundOrders: 2,
        refundAmount: 258000,
        voucherUsed: 420,
        affiliateOrders: 60,
        affiliateRevenue: 3400000,
        adsSpend: 400000,
        notes: 'Review demo serum dan sunscreen mendapat antusiasme luar biasa dari penonton.',
        isDemo: true,
        productDetails: [
          { productId: 'prod-2', productName: 'Serum Brightening Glow 30ml', quantity: 140, revenue: 18060000 },
          { productId: 'prod-5', productName: 'Sunscreen Aqua Gel SPF 50 PA++++', quantity: 120, revenue: 11400000 },
          { productId: 'prod-3', productName: 'Lip Tint Velvet Matte Finish', quantity: 74, revenue: 5040000 },
        ],
      },
      // Shift 3 Overnight Test: 21:00 - 06:00, businessDate is 18 September 2026
      {
        id: 'demo-session-18-s3-overnight',
        streamerId: 'streamer-nata',
        streamerName: 'Nata',
        businessDate: '2026-09-18',
        shiftId: 'shift-3',
        shiftName: 'Shift 3 (Malam - Dini Hari)',
        startTime: '21:00',
        endTime: '06:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 22400,
        uniqueViewers: 17800,
        peakViewers: 3200,
        averageViewers: 1420,
        newFollowers: 550,
        totalFollowers: 46160,
        likes: 145000,
        comments: 11400,
        shares: 830,
        productClicks: 7100,
        productImpressions: 42000,
        checkout: 920,
        orders: 810,
        productsSold: 1150,
        revenue: 41800000,
        cancelledOrders: 22,
        refundOrders: 3,
        refundAmount: 387000,
        voucherUsed: 530,
        affiliateOrders: 75,
        affiliateRevenue: 4100000,
        adsSpend: 500000,
        notes: 'Sesi Shift 3 melewati tengah malam (21:00 - 06:00 WIB). Midnight mega sale meledak!',
        isDemo: true,
        productDetails: [
          { productId: 'prod-1', productName: 'Gamis Silk Premium Zahiya', quantity: 120, revenue: 22200000 },
          { productId: 'prod-2', productName: 'Serum Brightening Glow 30ml', quantity: 85, revenue: 10965000 },
          { productId: 'prod-6', productName: 'Tunic Rayon Premium Oversized', quantity: 78, revenue: 8635000 },
        ],
      },
      // Fawwas session on 17 Sep
      {
        id: 'demo-session-17-s2',
        streamerId: 'streamer-fawwas',
        streamerName: 'Fawwas',
        businessDate: '2026-09-17',
        shiftId: 'shift-2',
        shiftName: 'Shift 2 (Siang - Sore)',
        startTime: '12:00',
        endTime: '21:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 13800,
        uniqueViewers: 10400,
        peakViewers: 1720,
        averageViewers: 860,
        newFollowers: 290,
        totalFollowers: 44800,
        likes: 72000,
        comments: 5400,
        shares: 390,
        productClicks: 3900,
        productImpressions: 21000,
        checkout: 580,
        orders: 490,
        productsSold: 670,
        revenue: 25400000,
        cancelledOrders: 11,
        refundOrders: 1,
        refundAmount: 110000,
        voucherUsed: 290,
        affiliateOrders: 38,
        affiliateRevenue: 2200000,
        adsSpend: 300000,
        notes: 'Interaksi penonton sangat aktif saat giveaway voucher diskon.',
        isDemo: true,
        productDetails: [
          { productId: 'prod-6', productName: 'Tunic Rayon Premium Oversized', quantity: 110, revenue: 12100000 },
          { productId: 'prod-2', productName: 'Serum Brightening Glow 30ml', quantity: 70, revenue: 9030000 },
          { productId: 'prod-3', productName: 'Lip Tint Velvet Matte Finish', quantity: 62, revenue: 4270000 },
        ],
      },
      // Dona session on 16 Sep
      {
        id: 'demo-session-16-s1',
        streamerId: 'streamer-dona',
        streamerName: 'Dona',
        businessDate: '2026-09-16',
        shiftId: 'shift-1',
        shiftName: 'Shift 1 (Pagi)',
        startTime: '06:00',
        endTime: '15:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 12900,
        uniqueViewers: 9800,
        peakViewers: 1640,
        averageViewers: 810,
        newFollowers: 270,
        totalFollowers: 44500,
        likes: 68000,
        comments: 4900,
        shares: 340,
        productClicks: 3600,
        productImpressions: 19500,
        checkout: 520,
        orders: 430,
        productsSold: 590,
        revenue: 22100000,
        cancelledOrders: 9,
        refundOrders: 2,
        refundAmount: 220000,
        voucherUsed: 260,
        affiliateOrders: 32,
        affiliateRevenue: 1900000,
        adsSpend: 250000,
        notes: 'Sesi live berjalan lancar tanpa kendala teknis koneksi.',
        isDemo: true,
      },
      // Nina session on 15 Sep
      {
        id: 'demo-session-15-s2',
        streamerId: 'streamer-nina',
        streamerName: 'Nina',
        businessDate: '2026-09-15',
        shiftId: 'shift-2',
        shiftName: 'Shift 2 (Siang - Sore)',
        startTime: '12:00',
        endTime: '21:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 16500,
        uniqueViewers: 12800,
        peakViewers: 2150,
        averageViewers: 1040,
        newFollowers: 380,
        totalFollowers: 44200,
        likes: 98000,
        comments: 7600,
        shares: 510,
        productClicks: 4900,
        productImpressions: 27500,
        checkout: 710,
        orders: 610,
        productsSold: 840,
        revenue: 31200000,
        cancelledOrders: 12,
        refundOrders: 2,
        refundAmount: 258000,
        voucherUsed: 390,
        affiliateOrders: 52,
        affiliateRevenue: 2900000,
        adsSpend: 350000,
        notes: 'Promo bundle skincare laku keras.',
        isDemo: true,
      },
      // Historical monthly sessions for robust 2026 Yearly report
      {
        id: 'demo-session-august',
        streamerId: 'streamer-dona',
        streamerName: 'Dona',
        businessDate: '2026-08-20',
        shiftId: 'shift-1',
        shiftName: 'Shift 1 (Pagi)',
        startTime: '06:00',
        endTime: '15:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 15200,
        uniqueViewers: 11900,
        peakViewers: 1980,
        averageViewers: 970,
        newFollowers: 340,
        totalFollowers: 43800,
        likes: 89000,
        comments: 6500,
        shares: 450,
        productClicks: 4500,
        productImpressions: 25000,
        checkout: 670,
        orders: 560,
        productsSold: 810,
        revenue: 29800000,
        cancelledOrders: 10,
        refundOrders: 2,
        refundAmount: 200000,
        notes: 'Promo Kemerdekaan Agustus',
        isDemo: true,
      },
      {
        id: 'demo-session-july',
        streamerId: 'streamer-nata',
        streamerName: 'Nata',
        businessDate: '2026-07-15',
        shiftId: 'shift-3',
        shiftName: 'Shift 3 (Malam - Dini Hari)',
        startTime: '21:00',
        endTime: '06:00',
        durationMinutes: 540,
        durationHours: 9,
        viewers: 19800,
        uniqueViewers: 15400,
        peakViewers: 2800,
        averageViewers: 1250,
        newFollowers: 480,
        totalFollowers: 42000,
        likes: 128000,
        comments: 9800,
        shares: 710,
        productClicks: 6200,
        productImpressions: 36000,
        checkout: 840,
        orders: 730,
        productsSold: 1020,
        revenue: 37500000,
        cancelledOrders: 15,
        refundOrders: 3,
        refundAmount: 380000,
        notes: 'Mid-year 7.7 Campaign',
        isDemo: true,
      },
    ];

    for (const raw of demoSessions) {
      const metrics = calculateLiveMetrics({
        revenue: raw.revenue,
        orders: raw.orders,
        viewers: raw.viewers,
        uniqueViewers: raw.uniqueViewers,
        durationHours: raw.durationHours,
      });

      const fullSession: LiveSession = {
        ...raw,
        ...metrics,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'seed-admin',
      };

      const docRef = doc(db, SESSIONS_COL, raw.id);
      batch.set(docRef, fullSession);
    }

    // 4. Initial Schedules
    const initialSchedules: Schedule[] = [
      {
        id: 'sched-1',
        date: '2026-09-18',
        streamerId: 'streamer-dona',
        streamerName: 'Dona',
        shiftId: 'shift-1',
        shiftName: 'Shift 1 (Pagi)',
        startTime: '06:00',
        endTime: '15:00',
        status: 'Completed',
        hasReport: true,
        reportId: 'demo-session-18-s1',
      },
      {
        id: 'sched-2',
        date: '2026-09-18',
        streamerId: 'streamer-nina',
        streamerName: 'Nina',
        shiftId: 'shift-2',
        shiftName: 'Shift 2 (Siang - Sore)',
        startTime: '12:00',
        endTime: '21:00',
        status: 'Completed',
        hasReport: true,
        reportId: 'demo-session-18-s2',
      },
      {
        id: 'sched-3',
        date: '2026-09-18',
        streamerId: 'streamer-nata',
        streamerName: 'Nata',
        shiftId: 'shift-3',
        shiftName: 'Shift 3 (Malam - Dini Hari)',
        startTime: '21:00',
        endTime: '06:00',
        status: 'Completed',
        hasReport: true,
        reportId: 'demo-session-18-s3-overnight',
      },
      {
        id: 'sched-4',
        date: '2026-09-19',
        streamerId: 'streamer-fawwas',
        streamerName: 'Fawwas',
        shiftId: 'shift-1',
        shiftName: 'Shift 1 (Pagi)',
        startTime: '06:00',
        endTime: '15:00',
        status: 'Scheduled',
        hasReport: false,
      },
      // A finished shift without report to demonstrate the "Live report belum diinput" alert!
      {
        id: 'sched-pending-demo',
        date: '2026-09-17',
        streamerId: 'streamer-fawwas',
        streamerName: 'Fawwas',
        shiftId: 'shift-3',
        shiftName: 'Shift 3 (Malam - Dini Hari)',
        startTime: '21:00',
        endTime: '06:00',
        status: 'Missed',
        hasReport: false,
      },
    ];

    for (const sc of initialSchedules) {
      const docRef = doc(db, SCHEDULES_COL, sc.id);
      batch.set(docRef, { ...sc, createdAt: serverTimestamp() });
    }

    // 5. Monthly Targets for September 2026
    const initialTargets: Target[] = [
      {
        id: 'target-team-sep-2026',
        type: 'team',
        period: 'monthly',
        metric: 'revenue',
        targetValue: 200000000, // Rp 200 Juta
        year: 2026,
        month: 9,
      },
      {
        id: 'target-dona-sep-2026',
        type: 'individual',
        period: 'monthly',
        metric: 'revenue',
        streamerId: 'streamer-dona',
        streamerName: 'Dona',
        targetValue: 50000000, // Rp 50 Juta
        year: 2026,
        month: 9,
      },
      {
        id: 'target-nina-sep-2026',
        type: 'individual',
        period: 'monthly',
        metric: 'revenue',
        streamerId: 'streamer-nina',
        streamerName: 'Nina',
        targetValue: 50000000,
        year: 2026,
        month: 9,
      },
      {
        id: 'target-nata-sep-2026',
        type: 'individual',
        period: 'monthly',
        metric: 'revenue',
        streamerId: 'streamer-nata',
        streamerName: 'Nata',
        targetValue: 50000000,
        year: 2026,
        month: 9,
      },
      {
        id: 'target-fawwas-sep-2026',
        type: 'individual',
        period: 'monthly',
        metric: 'revenue',
        streamerId: 'streamer-fawwas',
        streamerName: 'Fawwas',
        targetValue: 50000000,
        year: 2026,
        month: 9,
      },
    ];

    for (const t of initialTargets) {
      const docRef = doc(db, TARGETS_COL, t.id);
      batch.set(docRef, t);
    }

    // 6. Notifications
    const initialNotifs = [
      {
        id: 'notif-1',
        userId: 'ALL',
        title: 'Sistem Monitoring Siap Digunakan',
        message: 'Selamat datang di Livestream Performance Management System Shopee Live. Semua data terekam realtime.',
        type: 'system',
        read: false,
        createdAt: serverTimestamp(),
      },
      {
        id: 'notif-2',
        userId: 'streamer-fawwas',
        title: 'Pengingat: Live Report Belum Diinput',
        message: 'Shift 3 pada 17 September 2026 belum memiliki laporan live. Mohon segera input live report.',
        type: 'reminder',
        read: false,
        createdAt: serverTimestamp(),
      },
    ];

    for (const n of initialNotifs) {
      const docRef = doc(db, NOTIFICATIONS_COL, n.id);
      batch.set(docRef, n);
    }

    // Commit batch
    await batch.commit();

    return {
      success: true,
      message: 'Seed database awal berhasil dibuat dengan streamer Dona, Nina, Nata, Fawwas, produk, dan sample sessions September 2026.',
    };
  } catch (error: any) {
    console.error('Error seeding initial database:', error);
    return { success: false, message: error.message || 'Gagal membuat seed database.' };
  }
}

export const seedInitialDemoData = () => seedInitialDatabase(true);

// --- ADMIN SECURITY & RESET DATABASE TO ZERO ---

export const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Fetch current admin master password (stored in Firestore system_settings/security, default: admin123)
 */
export async function getAdminPassword(): Promise<string> {
  try {
    const docRef = doc(db, SYSTEM_SETTINGS_COL, 'security');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.adminPassword) {
      return snap.data().adminPassword;
    }
  } catch (err) {
    console.warn('Could not read admin password from Firestore, using default:', err);
  }
  return DEFAULT_ADMIN_PASSWORD;
}

/**
 * Verify if the entered password matches the admin master password
 */
export async function verifyAdminPassword(passwordInput: string): Promise<boolean> {
  const actual = await getAdminPassword();
  return passwordInput.trim() === actual;
}

/**
 * Update admin master password
 */
export async function updateAdminPassword(
  currentPasswordInput: string,
  newPassword: string,
  currentUser: string,
  currentUserId: string
): Promise<{ success: boolean; message: string }> {
  const currentActual = await getAdminPassword();
  if (currentPasswordInput !== currentActual) {
    return { success: false, message: 'Kata sandi lama salah! Perubahan kata sandi ditolak.' };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, message: 'Kata sandi baru minimal 4 karakter.' };
  }

  try {
    const docRef = doc(db, SYSTEM_SETTINGS_COL, 'security');
    await setDoc(
      docRef,
      {
        adminPassword: newPassword.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser,
        updatedById: currentUserId,
      },
      { merge: true }
    );

    await logAudit(
      currentUser,
      currentUserId,
      'UBAH KATA SANDI ADMIN',
      'Keamanan Sistem',
      'Password Lama',
      'Password Berhasil Diperbarui'
    );

    return { success: true, message: 'Kata sandi admin berhasil diperbarui!' };
  } catch (err: any) {
    console.error('Error updating admin password:', err);
    return { success: false, message: err.message || 'Gagal memperbarui kata sandi admin.' };
  }
}

/**
 * Check if the database is in a clean slate mode (user intentionally reset to 0)
 */
export async function isCleanSlateActive(): Promise<boolean> {
  if (typeof window !== 'undefined' && localStorage.getItem('shopee_system_clean_slate') === 'true') {
    return true;
  }
  try {
    const docRef = doc(db, SYSTEM_SETTINGS_COL, 'init');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.isCleanSlate === true) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('shopee_system_clean_slate', 'true');
      }
      return true;
    }
  } catch (err) {
    console.warn('Error checking clean slate state:', err);
  }
  return false;
}

/**
 * Helper to delete all documents from a specified collection in batches
 */
async function deleteAllDocsInCollection(colName: string): Promise<number> {
  const colRef = collection(db, colName);
  const snap = await getDocs(colRef);
  if (snap.empty) return 0;

  const docs = snap.docs;
  let deletedCount = 0;
  // Batch delete in chunks of 350 docs (Firestore limit is 500)
  for (let i = 0; i < docs.length; i += 350) {
    const chunk = docs.slice(i, i + 350);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedCount += chunk.length;
  }
  return deletedCount;
}

export interface ResetDatabaseOptions {
  resetSessions: boolean;
  resetSchedules: boolean;
  resetTargets: boolean;
  resetStreamers: boolean;
  resetProducts: boolean;
}

/**
 * Reset database to 0 so the application can start completely from scratch.
 * Requires Admin password validation.
 */
export async function resetDatabaseToZero(
  options: ResetDatabaseOptions,
  passwordInput: string,
  currentUser: string,
  currentUserId: string
): Promise<{ success: boolean; message: string; deletedStats?: Record<string, number> }> {
  // 1. Password verification
  const actualPassword = await getAdminPassword();
  if (passwordInput !== actualPassword) {
    return {
      success: false,
      message: 'Kata sandi Admin salah! Tindakan reset dibatalkan demi keamanan data.',
    };
  }

  try {
    const stats: Record<string, number> = {};

    // 2. Delete Live Sessions if chosen (sets revenue, orders, viewers, KPIs to 0)
    if (options.resetSessions) {
      stats.liveSessions = await deleteAllDocsInCollection(SESSIONS_COL);
    }

    // 3. Delete Schedules if chosen
    if (options.resetSchedules) {
      stats.schedules = await deleteAllDocsInCollection(SCHEDULES_COL);
    }

    // 4. Delete Targets if chosen
    if (options.resetTargets) {
      stats.targets = await deleteAllDocsInCollection(TARGETS_COL);
    }

    // 5. Delete Streamers if chosen (clean host list)
    if (options.resetStreamers) {
      stats.streamers = await deleteAllDocsInCollection(STREAMERS_COL);
    }

    // 6. Delete Products if chosen (clean product catalog)
    if (options.resetProducts) {
      stats.products = await deleteAllDocsInCollection(PRODUCTS_COL);
    }

    // 7. Mark database as Clean Slate in Firestore and localStorage
    const initRef = doc(db, SYSTEM_SETTINGS_COL, 'init');
    await setDoc(
      initRef,
      {
        isCleanSlate: true,
        resetAt: serverTimestamp(),
        resetBy: currentUser,
        resetById: currentUserId,
        lastResetStats: stats,
      },
      { merge: true }
    );

    if (typeof window !== 'undefined') {
      localStorage.setItem('shopee_system_clean_slate', 'true');
    }

    // 8. Log the reset action to immutable Audit Logs
    await logAudit(
      currentUser,
      currentUserId,
      'RESET DATABASE KE 0',
      'Pembersihan Data Demo',
      'Data Demo Shopee Live Aktif',
      `Berhasil direset ke 0. Rincian: ${JSON.stringify(stats)}`
    );

    return {
      success: true,
      message: 'Database berhasil direset menjadi 0! Seluruh data demo telah dibersihkan dan aplikasi siap digunakan dari awal.',
      deletedStats: stats,
    };
  } catch (error: any) {
    console.error('Error resetting database to zero:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan sistem saat mereset database.',
    };
  }
}


