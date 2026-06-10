import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import fallbackConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

// Dynamically use Environment Variables first (allowing the user to set their custom Firebase project on Vercel or locally)
const firebaseConfig = {
  apiKey: (metaEnv.VITE_FIREBASE_API_KEY as string) || fallbackConfig.apiKey,
  authDomain: (metaEnv.VITE_FIREBASE_AUTH_DOMAIN as string) || fallbackConfig.authDomain,
  projectId: (metaEnv.VITE_FIREBASE_PROJECT_ID as string) || fallbackConfig.projectId,
  storageBucket: (metaEnv.VITE_FIREBASE_STORAGE_BUCKET as string) || fallbackConfig.storageBucket,
  messagingSenderId: (metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || fallbackConfig.messagingSenderId,
  appId: (metaEnv.VITE_FIREBASE_APP_ID as string) || fallbackConfig.appId,
  measurementId: (metaEnv.VITE_FIREBASE_MEASUREMENT_ID as string) || fallbackConfig.measurementId || ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use custom db ID if defined, otherwise let Firestore use the default or project's database ID
const firestoreDbId = (metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || fallbackConfig.firestoreDatabaseId;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({})
  }, firestoreDbId || undefined);
} catch (e) {
  console.warn("Could not initialize firestore with persistent cache, falling back...", e);
  firestoreInstance = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Standard Popup Method - Synchronous return to avoid Safari popup blocking
export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

// Redirect Method
export const signInWithGoogleRedirect = () => {
  return signInWithRedirect(auth, googleProvider);
};

// Expose getRedirectResult to retrieve credentials after returning from redirect
export const getRedirectResultHelper = async () => {
  return await getRedirectResult(auth);
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
