import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Music, Instagram, Share2, Heart, Play, ExternalLink, Disc, Mic2, ArrowLeft } from 'lucide-react';
import { useMusic } from '../context/MusicContext';

const ArtistProfileView = () => {
  const { uid } = useParams();
  const { play } = useMusic();
  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtist = async () => {
      if (!uid) return;
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setArtist(docSnap.data());
      }

      const q = query(collection(db, 'tracks'), where('artistId', '==', uid), orderBy('createdAt', 'desc'));
      const trackSnap = await getDocs(q);
      setTracks(trackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchArtist();
  }, [uid]);

  if (loading) return <div className="p-20 text-center animate-pulse italic font-black uppercase text-xl">CARGANDO PERFIL...</div>;
  if (!artist) return <div className="p-20 text-center">Artista no encontrado.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-10 max-w-6xl mx-auto space-y-10"
    >
      <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-yellow font-bold uppercase text-xs tracking-widest transition-colors mb-4">
        <ArrowLeft size={16} /> REGRESAR
      </Link>

      <header className="relative flex flex-col md:flex-row gap-10 items-end">
        {/* Profile Image with Boombox Frame */}
        <div className="relative w-full md:w-80 aspect-square group">
           <div className="absolute inset-0 bg-brand-yellow rounded-3xl rotate-3 scale-105 opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
           <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border-4 border-boombox-gray shadow-2xl">
              <img src={artist.photoURL || 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?q=80&w=400&auto=format&fit=crop'} className="w-full h-full object-cover grayscale-0 md:grayscale group-hover:grayscale-0 transition-all duration-700" alt={artist.displayName} />
           </div>
           <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-brand-yellow rounded-2xl flex items-center justify-center text-black shadow-lg transform rotate-6 z-20">
              <Disc className="animate-spin-slow" size={32} />
           </div>
        </div>

        <div className="flex-1 space-y-4">
           {artist.isPinned && (
             <span className="bg-brand-yellow text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-glow">DESTACADO RAPLIFE</span>
           )}
           <div>
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter glow-yellow leading-[0.8] mb-4">{artist.displayName}</h1>
              <div className="flex gap-4">
                 {artist.spotifyUrl && (
                   <a href={artist.spotifyUrl} target="_blank" className="p-3 bg-[#1DB954]/20 border border-[#1DB954]/50 rounded-xl text-[#1DB954] hover:bg-[#1DB954] hover:text-white transition-all">
                      <Music size={20} />
                   </a>
                 )}
                 {artist.appleMusicUrl && (
                   <a href={artist.appleMusicUrl} target="_blank" className="p-3 bg-[#FA243C]/20 border border-[#FA243C]/50 rounded-xl text-[#FA243C] hover:bg-[#FA243C] hover:text-white transition-all">
                      <ExternalLink size={20} />
                   </a>
                 )}
                 {artist.instagramUrl && (
                   <a href={artist.instagramUrl} target="_blank" className="p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white hover:text-black transition-all">
                      <Instagram size={20} />
                   </a>
                 )}
              </div>
           </div>
           <p className="text-gray-400 font-medium leading-relaxed max-w-xl italic">
              {artist.bio || "Este artista aún no ha escrito su biografía oficial. Sigue su música en RAPLIFE RECORDS."}
           </p>
        </div>
      </header>

      {/* Visualizer & Tracks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-10">
         <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
               <Mic2 className="text-brand-yellow" size={24} />
               <h2 className="text-2xl font-black italic uppercase tracking-tighter">DISCOGRAFÍA</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
               {tracks.map((track, i) => (
                 <motion.div 
                   key={track.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="group flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-brand-yellow/30 transition-all cursor-pointer relative overflow-hidden"
                   onClick={() => play(track)}
                 >
                    <div className="text-xs font-mono opacity-30 group-hover:opacity-100 transition-opacity w-4">{(i + 1).toString().padStart(2, '0')}</div>
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                       <img src={track.coverUrl || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="font-bold italic uppercase tracking-tight truncate group-hover:text-brand-yellow transition-colors">{track.title}</h3>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{artist.displayName}</p>
                    </div>
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Heart size={18} className="text-gray-500 hover:text-brand-yellow transition-colors" />
                       <Share2 size={18} className="text-gray-500 hover:text-brand-yellow transition-colors" />
                       <Play size={20} className="text-brand-yellow fill-brand-yellow" />
                    </div>
                 </motion.div>
               ))}
               {tracks.length === 0 && (
                 <div className="py-20 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/5 opacity-30 italic font-black uppercase text-xs tracking-widest">
                    EL ESTUDIO ESTÁ VACÍO... POR AHORA.
                 </div>
               )}
            </div>
         </div>

         {/* Visualizer Placeholder / Interactive sidebar */}
         <aside className="space-y-8">
            <div className="bg-black border-4 border-boombox-gray rounded-[2.5rem] p-8 h-80 flex flex-col items-center justify-center relative overflow-hidden boombox-texture">
               <div className="flex items-center gap-1 h-32 w-full justify-center">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                    <motion.div 
                      key={i} 
                      className="w-2 bg-brand-yellow shadow-glow"
                      animate={{ height: [10, 80, 40, 100, 20, 90, 10] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                      style={{ opacity: 0.2 + (i * 0.05) }}
                    />
                  ))}
               </div>
               <p className="text-[10px] font-mono uppercase tracking-[0.3em] mt-6 text-brand-yellow">REAL-TIME VISUALIZER</p>
               
               {/* Screws */}
               <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-brand-yellow">RANKING DE LA CALLE</h3>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-gray-500">Popularidad</span>
                  <span className="font-mono text-brand-yellow">TOP 10</span>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-gray-500">Oyentes Mensuales</span>
                  <span className="font-mono text-brand-yellow">12.5K</span>
               </div>
            </div>
         </aside>
      </div>
    </motion.div>
  );
};

export default ArtistProfileView;
