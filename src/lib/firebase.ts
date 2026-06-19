import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, doc, getDocFromServer } from 'firebase/firestore';
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

// Calculate the project ID being used
const projectId = (metaEnv.VITE_FIREBASE_PROJECT_ID as string) || fallbackConfig.projectId;

// Calculate Firestore database ID safely
let firestoreDbId = (metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string);

if (!firestoreDbId) {
  // If we are running in the AI Studio Sandbox (matching the fallback config project ID), we use the custom database
  if (projectId === fallbackConfig.projectId) {
    firestoreDbId = fallbackConfig.firestoreDatabaseId;
  } else {
    // If running in a custom user Firebase project (e.g. raplife), default to the (default) database
    firestoreDbId = "";
  }
}

// Security: if databaseId resembles a URL or path, it will crash Firestore. Clear it.
if (firestoreDbId && (firestoreDbId.includes('://') || firestoreDbId.includes('.') || firestoreDbId.includes('/'))) {
  console.warn(`[FIREBASE] Sanitized invalid databaseId URL/path: "${firestoreDbId}". Falling back to default.`);
  firestoreDbId = "";
}

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  }),
  experimentalForceLongPolling: true,
}, firestoreDbId || undefined);
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('offline'))) {
      console.warn("[FIREBASE] Connection test: Firestore client is offline.");
    }
  }
}
testConnection();
export const googleProvider = new GoogleAuthProvider();

// Standard Popup Method
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google (Popup)", error);
    throw error;
  }
};

// Redirect Method - Immune to Pop-up Blockers and Third-Party Cookie Restrictions
export const signInWithGoogleRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google (Redirect)", error);
    throw error;
  }
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
