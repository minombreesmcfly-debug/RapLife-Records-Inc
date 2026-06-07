import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Flame, Star, TrendingUp, Music, Play, ExternalLink, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';

import ElfsightTikTok from '../components/ElfsightTikTok';
import PhoneSlider from '../components/PhoneSlider';

const HomeView = () => {
  const { profile } = useAuth();
  const { play } = useMusic();
  const [pinnedArtists, setPinnedArtists] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  // Flyers para el slider de celular
  const flyerImages = [
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=400&auto=format&fit=crop', // Reemplaza por tus flyers
    'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=400&auto=format&fit=crop'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Pinned Artists
        const qPinned = query(collection(db, 'users'), where('role', '==', 'artist'), where('isPinned', '==', true), limit(6));
        const snapPinned = await getDocs(qPinned);
        setPinnedArtists(snapPinned.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Recent Tracks
        const qTracks = query(collection(db, 'tracks'), where('isRadioInterstitial', '==', false), orderBy('createdAt', 'desc'), limit(10));
        const snapTracks = await getDocs(qTracks);
        setRecentTracks(snapTracks.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching home data:", e);
      }
    };
    fetchData();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 md:p-10 space-y-16 max-w-7xl mx-auto"
    >
      {/* Pinned Artists */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-brand-yellow" />
            <h2 className="text-3xl font-black italic tracking-tighter uppercase underline decoration-brand-yellow/30 decoration-4 underline-offset-8">TOP ARTISTAS</h2>
          </div>
          <Link to="/artists" className="text-xs font-bold text-gray-500 hover:text-brand-yellow transition-colors tracking-widest">VER TODOS +</Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pinnedArtists.map((artist) => (
            <Link key={artist.id} to={`/profile/${artist.id}`} className="group">
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 border-2 border-transparent group-hover:border-brand-yellow transition-all shadow-lg group-hover:shadow-[0_0_20px_rgba(248,251,2,0.3)]">
                <img src={artist.photoURL || 'https://images.unsplash.com/photo-1601643143482-96cb344070fb?q=80&w=400&auto=format&fit=crop'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              </div>
              <h3 className="text-sm font-black italic uppercase text-center group-hover:text-brand-yellow truncate">{artist.displayName}</h3>
            </Link>
          ))}
          {pinnedArtists.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-600 italic font-bold uppercase tracking-widest text-sm bg-white/5 rounded-3xl border-2 border-dashed border-white/5">
               BUSCANDO TALENTO...
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* Main Feed */}
        <section className="lg:col-span-7 space-y-12">
          <div className="flex items-center gap-3 mb-6">
             <Music className="text-brand-yellow" size={24} />
             <h2 className="text-2xl font-black italic tracking-tighter uppercase">LANZAMIENTOS RECIENTES</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentTracks.map((track) => (
              <motion.div 
                key={track.id}
                whileHover={{ x: 5 }}
                className="group flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-brand-yellow/30 transition-all relative overflow-hidden"
              >
                <div className="w-16 h-16 bg-gray-900 rounded-xl flex-shrink-0 relative border border-white/10 overflow-hidden">
                   <img src={track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop'} className="w-full h-full object-cover" />
                   <button 
                     onClick={() => play(track)}
                     className="absolute inset-0 flex items-center justify-center bg-brand-yellow/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                     <Play className="text-black fill-black" size={24} />
                   </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black italic uppercase text-lg truncate group-hover:text-brand-yellow transition-colors tracking-tight">{track.title}</h4>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Artista: <span className="text-gray-300">{track.artistName}</span></p>
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <ExternalLink size={16} className="text-brand-yellow" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Sidebar / Social Feed */}
        <aside className="lg:col-span-5 space-y-10">
          <div className="bg-brand-purple/20 border-2 border-brand-yellow/10 rounded-[2.5rem] p-4 md:p-10 relative overflow-hidden boombox-texture">
            <div className="relative z-10">
              <div className="flex flex-col items-center gap-2 mb-8 text-center pt-4">
                <TrendingUp className="text-brand-yellow shrink-0" size={32} />
                <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white">SÍGUENOS EN TIKTOK</h2>
                <div className="h-1.5 w-24 bg-brand-yellow rounded-full" />
              </div>
              
              <div className="space-y-12">
                <div className="bg-black/40 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <ElfsightTikTok />
                </div>

                {/* Vertical Flyers Slider */}
                <div className="space-y-6">
                  <div className="text-center px-4">
                    <h3 className="font-black italic uppercase text-lg tracking-tighter">PRÓXIMOS EVENTOS</h3>
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Desliza para ver más</p>
                  </div>
                  <PhoneSlider images={flyerImages} />
                </div>
                
                <div className="pt-6 pb-4 text-center border-t border-white/5 space-y-6">
                   <div>
                     <p className="font-black italic uppercase text-xl mb-1 tracking-tighter text-brand-yellow">@raplife.records</p>
                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-4">Comunidad Oficial</p>
                     <a 
                       href="https://www.tiktok.com/@raplife.records" 
                       target="_blank" 
                       rel="noreferrer"
                       className="inline-block bg-white text-black px-12 py-4 rounded-2xl font-black italic uppercase text-sm hover:bg-brand-yellow transition-all shadow-xl active:scale-95 w-full md:w-auto"
                     >
                       VER EN TIKTOK
                     </a>
                   </div>

                   {/* Add Registration CTA if not logged in */}
                   {!profile && (
                     <div className="bg-brand-yellow/10 p-6 rounded-3xl border border-brand-yellow/20">
                        <h4 className="font-black italic uppercase text-lg mb-2">¿ERES ARTISTA?</h4>
                        <p className="text-xs text-gray-400 font-bold uppercase mb-4 tracking-tight">Sube tu música y forma parte de RapLife Radio.</p>
                        <Link 
                          to="/profile-setup"
                          className="block w-full bg-brand-yellow text-black py-3 rounded-xl font-black italic uppercase text-xs hover:bg-white transition-colors"
                        >
                          ÚNETE A LA FAMILIA
                        </Link>
                     </div>
                   )}
                </div>
              </div>
            </div>
            {/* Screw details */}
            <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50 shadow-inner" />
            <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50 shadow-inner" />
            <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50 shadow-inner" />
            <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50 shadow-inner" />
          </div>
        </aside>
      </div>
    </motion.div>
  );
};

export default HomeView;
