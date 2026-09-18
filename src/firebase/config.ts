import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Firebase configuration using provisioned project
const firebaseConfig = {
  projectId: firebaseConfigJson.projectId || 'nifty-freehold-ht8c4',
  appId: firebaseConfigJson.appId || '1:873587536514:web:b05ee7c7a2301d08acba9b',
  apiKey: firebaseConfigJson.apiKey || 'AIzaSyCloprEnu0jCL3uJ1zoJQpCZhqSQ3KUZsA',
  authDomain: firebaseConfigJson.authDomain || 'nifty-freehold-ht8c4.firebaseapp.com',
  storageBucket: firebaseConfigJson.storageBucket || 'nifty-freehold-ht8c4.firebasestorage.app',
  messagingSenderId: firebaseConfigJson.messagingSenderId || '873587536514',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Provisioned named database ID
const databaseId = firebaseConfigJson.firestoreDatabaseId || 'ai-studio-247cfb38-0970-43ec-861e-748c9e5a5bf8';
export const db = getFirestore(app, databaseId);

export default app;
