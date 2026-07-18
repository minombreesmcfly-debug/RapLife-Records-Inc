import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

let firebaseConfig: any = {};
try {
  const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  }
} catch (error) {
  console.error('[SCRIPT] Error reading firebase-applet-config.json:', error);
}

const serverProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: serverProjectId,
  });
}

const db = getFirestore(undefined, firebaseConfig.firestoreDatabaseId || undefined);

async function listTracks() {
  console.log("Fetching tracks from database ID:", firebaseConfig.firestoreDatabaseId);
  const snap = await db.collection('tracks').get();
  console.log(`Found ${snap.size} tracks.`);
  for (const doc of snap.docs) {
    console.log(`ID: ${doc.id} | Title: ${doc.get('title')} | audioUrl: ${doc.get('audioUrl')} | isRadioInterstitial: ${doc.get('isRadioInterstitial')}`);
  }
}

listTracks().catch(console.error);
