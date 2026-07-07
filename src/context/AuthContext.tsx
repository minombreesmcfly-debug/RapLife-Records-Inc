import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
}

// Import auth helpers from firebase lib
import { signInWithGoogle, logoutUser } from '../lib/firebase';

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false,
  loginWithGoogle: async () => { throw new Error("AuthProvider not ready"); },
  logout: async () => {}
});

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
            const data = docSnap.data();
            setProfile(data);
            
            // Seed 150k points once to the admin if not already seeded
            if (u.email?.toLowerCase() === 'minombreesmcfly@gmail.com' && !data.adminPointsSeeded) {
              setDoc(docRef, { points: 150000, adminPointsSeeded: true }, { merge: true })
                .catch(err => console.error("Error seeding admin points:", err));
            }
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

  const loginWithGoogle = async () => {
    return await signInWithGoogle();
  };

  const logout = async () => {
    await logoutUser();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
