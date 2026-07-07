import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Star, Award, Shield, User, MapPin } from 'lucide-react';

const ArtistsView = () => {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter those who are active artists or have filled bio
        setArtists(list.filter((item: any) => item.displayName));
      } catch (err) {
        console.error("Error fetching artists:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtists();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20 space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-boombox-gray pb-6">
        <h2 className="text-3xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
          ⚡ CREW OFICIAL DE RAPLIFE
        </h2>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
          Descubre a los MCs, productores y creativos que componen la escena underground de RapLife Records.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 bg-neutral-900 animate-pulse rounded-[2rem] border-4 border-boombox-gray" />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-12 text-center text-xs text-gray-500 uppercase font-bold">
          No hay artistas registrados todavía. ¡Regístrate e inicia sesión para unirte a la crew!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {artists.map((artist) => (
            <motion.div
              key={artist.id}
              whileHover={{ y: -5 }}
              className="bg-black/95 border-4 border-boombox-gray rounded-[2rem] p-6 relative flex flex-col justify-between min-h-[180px] shadow-lg group overflow-hidden"
            >
              {/* Background gradient hint */}
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-yellow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex gap-4 relative z-10 min-w-0">
                <div className="w-20 h-20 rounded-2xl bg-neutral-900 border-2 border-boombox-gray overflow-hidden flex-shrink-0 relative">
                  {artist.photoURL ? (
                    <img src={artist.photoURL} alt={artist.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-brand-yellow/10">
                      <User size={32} className="text-brand-yellow" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-black uppercase text-white truncate max-w-[130px]">{artist.displayName}</h3>
                    {artist.isAdmin && (
                      <span className="px-1.5 py-0.5 bg-brand-yellow text-black text-[7px] font-black uppercase rounded leading-none">STAFF</span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-gray-400 uppercase font-bold line-clamp-2 leading-relaxed">
                    {artist.bio || "Este artista prefiere rapear que escribir una biografía."}
                  </p>

                  <div className="flex items-center gap-1 mt-1">
                    <Star size={10} className="text-brand-yellow" />
                    <span className="text-[10px] font-mono text-brand-yellow font-bold uppercase">{artist.points || 0} CRED</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 border-t-2 border-boombox-gray/40 pt-4 relative z-10">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase">
                  <MapPin size={10} />
                  <span>CALLES DE RAPLIFE</span>
                </div>
                
                <Link
                  to={`/profile/${artist.id}`}
                  className="px-4 py-1.5 bg-boombox-gray hover:bg-brand-yellow hover:text-black text-[9px] font-black uppercase italic rounded-full transition-all"
                >
                  VER PERFIL
                </Link>
              </div>

              {/* Corner screws */}
              <div className="absolute top-2 left-2 w-1 h-1 rounded-full bg-boombox-gray/30" />
              <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-boombox-gray/30" />
              <div className="absolute bottom-2 left-2 w-1 h-1 rounded-full bg-boombox-gray/30" />
              <div className="absolute bottom-2 right-2 w-1 h-1 rounded-full bg-boombox-gray/30" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistsView;
