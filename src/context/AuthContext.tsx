import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { verifyAdminPassword } from '../services/firestoreService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isStreamer: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logoutUser: () => Promise<void>;
  switchDemoRole: (role: UserRole, streamerId?: string, streamerName?: string) => Promise<void>;
  verifyAndLoginAdmin: (password: string) => Promise<{ success: boolean; message: string }>;
  lockAdminSession: () => void;
  switchStreamer: (streamerId: string, streamerName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to get default streamer profile
  const getDefaultStreamerProfile = (): UserProfile => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('at_current_streamer_id') || 'streamer-dona' : 'streamer-dona';
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('at_current_streamer_name') || 'Dona' : 'Dona';
    return {
      uid: savedId,
      email: `${savedName.toLowerCase()}@shopee.live`,
      displayName: `Host: ${savedName}`,
      role: 'STREAMER',
      streamerId: savedId,
    };
  };

  // Helper to get admin profile
  const getAdminProfile = (email?: string, name?: string): UserProfile => ({
    uid: 'admin-super-uid',
    email: email || 'admin@shopee.live',
    displayName: name || 'Andi Triyanto (Admin)',
    role: 'ADMIN',
  });

  // Sync user profile from Firestore or establish default profile (Default: Host Streamer)
  const syncUserProfile = async (user: FirebaseUser | null) => {
    // Check if an active verified admin session already exists in sessionStorage
    const hasAdminSession = typeof window !== 'undefined' && sessionStorage.getItem('at_admin_session_token') === 'verified';

    if (hasAdminSession) {
      setCurrentUser(getAdminProfile());
      setLoading(false);
      return;
    }

    if (!user) {
      // Default to Host Streamer (Option 3: Default Host Mode, no full access without password)
      setCurrentUser(getDefaultStreamerProfile());
      setLoading(false);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      // Check if logged-in user is officially recognized as Admin email
      const isOfficialAdminEmail =
        user.email === 'anditriyanto80@gmail.com' ||
        user.email === 'admin@shopee.live';

      if (userSnap.exists()) {
        const data = userSnap.data();
        const isAdminRole = (data.role === 'ADMIN' || isOfficialAdminEmail) && hasAdminSession;
        if (isAdminRole) {
          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            displayName: data.displayName || user.displayName || 'Andi Triyanto (Admin)',
            role: 'ADMIN',
            photoURL: user.photoURL || undefined,
          });
        } else {
          setCurrentUser(getDefaultStreamerProfile());
        }
      } else {
        // New user or guest: Default to Host mode unless admin session is actively verified
        if (isOfficialAdminEmail && hasAdminSession) {
          const newAdmin = getAdminProfile(user.email || undefined, user.displayName || undefined);
          await setDoc(userDocRef, {
            ...newAdmin,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setCurrentUser(newAdmin);
        } else {
          setCurrentUser(getDefaultStreamerProfile());
        }
      }
    } catch (err) {
      console.warn('Sync profile fallback to default streamer:', err);
      setCurrentUser(getDefaultStreamerProfile());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!isMounted) return;
      setFirebaseUser(u);
      if (u) {
        await syncUserProfile(u);
      } else {
        try {
          const anon = await signInAnonymously(auth);
          if (isMounted) {
            setFirebaseUser(anon.user);
            await syncUserProfile(anon.user);
          }
        } catch {
          if (isMounted) {
            await syncUserProfile(null);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(cred.user);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (
        cred.user.email === 'anditriyanto80@gmail.com' ||
        cred.user.email === 'admin@shopee.live'
      ) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('at_admin_session_token', 'verified');
        }
      }
      await syncUserProfile(cred.user);
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('at_admin_session_token');
    }
    await signOut(auth);
    setFirebaseUser(null);
    setCurrentUser(getDefaultStreamerProfile());
  };

  /**
   * Secure Admin verification gate using Admin master password
   */
  const verifyAndLoginAdmin = async (password: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const isCorrect = await verifyAdminPassword(password);
      if (!isCorrect) {
        return {
          success: false,
          message: 'Kata sandi Administrator salah! Akses ditolak.',
        };
      }

      const adminProfile = getAdminProfile();
      setCurrentUser(adminProfile);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('at_admin_session_token', 'verified');
      }

      return {
        success: true,
        message: 'Akses Admin Berhasil Diberikan! Selamat datang.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Terjadi kendala saat memverifikasi kata sandi admin.',
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lock admin session and securely return to Host Streamer mode
   */
  const lockAdminSession = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('at_admin_session_token');
    }
    setCurrentUser(getDefaultStreamerProfile());
  };

  /**
   * Switch between host streamers (safe, non-admin)
   */
  const switchStreamer = (streamerId: string, streamerName: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('at_current_streamer_id', streamerId);
      localStorage.setItem('at_current_streamer_name', streamerName);
    }

    // When switching streamer, ensure admin session token is removed so it stays in host mode
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('at_admin_session_token');
    }

    const hostProfile: UserProfile = {
      uid: streamerId,
      email: `${streamerName.toLowerCase()}@shopee.live`,
      displayName: `Host: ${streamerName}`,
      role: 'STREAMER',
      streamerId,
    };
    setCurrentUser(hostProfile);
  };

  // Demo Switcher: kept for backward compatibility, but routes to switchStreamer if streamer
  const switchDemoRole = async (role: UserRole, streamerId?: string, streamerName?: string) => {
    if (role === 'STREAMER' && streamerId && streamerName) {
      switchStreamer(streamerId, streamerName);
      return;
    }
    if (role === 'ADMIN') {
      // If manually invoking ADMIN without password, lock it if no token
      const hasToken = typeof window !== 'undefined' && sessionStorage.getItem('at_admin_session_token') === 'verified';
      if (hasToken) {
        setCurrentUser(getAdminProfile());
      } else {
        setCurrentUser(getDefaultStreamerProfile());
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isAdmin: currentUser?.role === 'ADMIN',
        isStreamer: currentUser?.role === 'STREAMER',
        loginWithEmail,
        loginWithGoogle,
        logoutUser,
        switchDemoRole,
        verifyAndLoginAdmin,
        lockAdminSession,
        switchStreamer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
