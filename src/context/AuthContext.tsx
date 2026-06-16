import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (u) {
        const docRef = doc(db, 'users', u.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("AuthContext real-time profile listener error:", err);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const isAdmin = 
    profile?.role === 'admin' || 
    user?.email?.toLowerCase() === 'minombreesmcfly@gmail.com' ||
    user?.email?.toLowerCase() === 'macfly@gmail.com';

  // Seed default artists in background if missing and user is admin
  useEffect(() => {
    if (!isAdmin) return;

    const seedDefaultArtists = async () => {
      try {
        const artistQ = query(collection(db, 'users'));
        const artistSnap = await getDocs(artistQ);
        const loadedArtists = artistSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const hasAitana = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('aitana'));
        const hasJay = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('jay'));
        const hasMcFly = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('mcfly'));

        if (!hasAitana) {
          try {
            const docId = 'artist_aitana_blue';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'Aitana Blue Dream',
              role: 'artist',
              category: 'G FUNK / EDM',
              bio: 'Fusión sublime que une las melodías grooves del G-Funk clásico de West Coast con la vibración electrónica y bailable del EDM moderno.',
              photoURL: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            console.log("[SEEDING] Aitana Blue Dream seeded successfully.");
          } catch (e) {
            console.warn("Seeding Aitana failed:", e);
          }
        }

        if (!hasJay) {
          try {
            const docId = 'artist_jay_santana';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'Jay Santana',
              role: 'artist',
              category: 'RAP / REGIONAL MEXICANO TRAP',
              bio: 'Fusión pionera que une la crudeza del rap de calle con los arreglos profundos y el alma del Regional Mexicano en ritmo Trap.',
              photoURL: '/src/assets/images/jay_santana_ghetto_1781111479453.png',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            console.log("[SEEDING] Jay Santana seeded successfully.");
          } catch (e) {
            console.warn("Seeding Jay Santana failed:", e);
          }
        }

        if (!hasMcFly) {
          try {
            const docId = 'artist_mcfly_emece';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'McFly EmeCe',
              role: 'artist',
              category: 'RAP TRAP CONSPIRACIONES',
              bio: 'Líricas punzantes y bases oscuras cargadas de verdades incómodas, enigmas y teorías de conspiración sobre el asfalto pesado.',
              photoURL: '/src/assets/images/mcfly_ninja_rapper_1781111492480.png',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            console.log("[SEEDING] McFly EmeCe seeded successfully.");
          } catch (e) {
            console.warn("Seeding McFly EmeCe failed:", e);
          }
        }
      } catch (err) {
        console.warn("Background default artists seeding failed:", err);
      }
    };

    seedDefaultArtists();
  }, [isAdmin]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
