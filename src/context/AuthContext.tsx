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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user profile from Firestore or establish default profile
  const syncUserProfile = async (user: FirebaseUser | null) => {
    if (!user) {
      // Default to Admin session for immediate executive preview if no user logged in
      const defaultAdmin: UserProfile = {
        uid: 'admin-super-uid',
        email: 'admin@shopee.live',
        displayName: 'Andi Triyanto (Admin)',
        role: 'ADMIN',
      };
      setCurrentUser(defaultAdmin);
      setLoading(false);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentUser({
          uid: user.uid,
          email: user.email || '',
          displayName: data.displayName || user.displayName || 'User',
          role: data.role || (user.email === 'admin@shopee.live' ? 'ADMIN' : 'STREAMER'),
          streamerId: data.streamerId,
          photoURL: user.photoURL || undefined,
        });
      } else {
        // Create initial profile in Firestore
        const isDefaultAdmin = user.email === 'admin@shopee.live' || user.email?.includes('admin') || user.email === 'anditriyanto80@gmail.com';
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || (isDefaultAdmin ? 'Admin Shopee Live' : 'Streamer Live'),
          role: isDefaultAdmin ? 'ADMIN' : 'STREAMER',
        };

        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setCurrentUser(newProfile);
      }
    } catch (err) {
      console.warn('Sync profile fallback:', err);
      // Fallback in case of permissions or network before full auth
      setCurrentUser({
        uid: user.uid,
        email: user.email || 'admin@shopee.live',
        displayName: user.displayName || 'Admin Shopee Live',
        role: 'ADMIN',
      });
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
      await syncUserProfile(cred.user);
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    // Switch to streamer view or guest for preview
    setCurrentUser(null);
  };

  // Demo Switcher: allows switching seamlessly between Admin and any Streamer (Dona, Nina, Nata, Fawwas)
  const switchDemoRole = async (role: UserRole, streamerId?: string, streamerName?: string) => {
    setLoading(true);
    try {
      if (role === 'ADMIN') {
        const adminProfile: UserProfile = {
          uid: 'admin-super-uid',
          email: 'admin@shopee.live',
          displayName: 'Admin Shopee Live',
          role: 'ADMIN',
        };
        setCurrentUser(adminProfile);
      } else {
        const stProfile: UserProfile = {
          uid: streamerId || 'streamer-dona',
          email: `${(streamerName || 'streamer').toLowerCase()}@shopee.live`,
          displayName: streamerName || 'Streamer',
          role: 'STREAMER',
          streamerId: streamerId || 'streamer-dona',
        };
        setCurrentUser(stProfile);
      }
    } finally {
      setLoading(false);
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
