import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Play, Flame, Radio, Disc, ArrowRight, Star, Music, Award, Shield } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import SponsoredCarousel from '../components/SponsoredCarousel';

const LandingPage = () => {
  const { play, currentTrack, isPlaying, togglePlay } = useMusic();
  const { user } = useAuth();
  const [featuredTracks, setFeaturedTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(collection(db, 'tracks'), limit(6));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeaturedTracks(list);
      } catch (err) {
        console.error("Error fetching featured tracks:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20 space-y-12">
      {/* GUEST HERO BANNER & LOGO */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full rounded-[2.5rem] overflow-hidden border-4 border-boombox-gray bg-black/95 p-8 md:p-14 flex flex-col items-center justify-center text-center gap-6 min-h-[360px] md:min-h-[460px] shadow-2xl"
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-yellow/5 via-transparent to-black" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/80" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-3xl">
          <span className="px-4 py-1.5 bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow text-xs font-black uppercase tracking-widest rounded-full">
            👑 LA CORONA DEL RAP UNDERGROUND
          </span>
          
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-brand-yellow leading-none">
            RAPLIFE RECORDS INC.
          </h1>
          
          <p className="text-xs md:text-sm font-bold uppercase text-gray-400 tracking-wider max-w-2xl leading-relaxed">
            Graba tu demo, conéctate a la radio en vivo de RapLife, participa en competencias de rimas o diviértete con nuestro juego arcade callejero. Conéctate con fans y productores de toda la costa oeste.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <Link 
              to="/studio" 
              className="px-8 py-3.5 bg-brand-yellow text-black font-black uppercase italic rounded-full text-sm hover:scale-105 transition-all shadow-glow flex items-center gap-2"
            >
              <Radio size={16} /> ENTRENAR EN EL ESTUDIO
            </Link>
            <Link 
              to="/artists" 
              className="px-8 py-3.5 bg-transparent text-white border-2 border-boombox-gray font-black uppercase italic rounded-full text-sm hover:bg-white/5 transition-all flex items-center gap-2"
            >
              EXPLORAR ARTISTAS <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Retro corner screws */}
        <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-boombox-gray/55" />
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-boombox-gray/55" />
        <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-boombox-gray/55" />
        <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-boombox-gray/55" />
      </motion.div>

      {/* Sponsored Carousel */}
      <SponsoredCarousel />

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Game Promotion Card */}
        <div className="bg-gradient-to-br from-neutral-900 to-black border-4 border-boombox-gray rounded-[2.5rem] p-8 flex flex-col justify-between gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={120} className="text-brand-yellow" />
          </div>
          <div className="space-y-3 z-10">
            <div className="flex items-center gap-2 text-brand-yellow">
              <Award size={20} />
              <span className="text-xs font-black uppercase tracking-wider">MODO RETRO ARCADE</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black uppercase italic text-white leading-tight">
              RAPLIFE STREET PLATFORMER
            </h3>
            <p className="text-xs text-gray-400 font-bold uppercase leading-relaxed">
              Supera récords esquivando obstáculos callejeros y acumula Street-Cred canjeable por menciones oficiales en redes de RapLife, merch oficial y más. ¡Juega ahora!
            </p>
          </div>
          <Link 
            to="/game" 
            className="px-6 py-3 bg-brand-yellow text-black text-xs font-black uppercase italic rounded-full w-fit hover:scale-105 transition-transform flex items-center gap-2 z-10"
          >
            🔥 EMPEZAR A JUGAR
          </Link>
        </div>

        {/* Studio Promo */}
        <div className="bg-gradient-to-br from-neutral-900 to-black border-4 border-boombox-gray rounded-[2.5rem] p-8 flex flex-col justify-between gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Radio size={120} className="text-brand-green" />
          </div>
          <div className="space-y-3 z-10">
            <div className="flex items-center gap-2 text-brand-green">
              <Disc size={20} />
              <span className="text-xs font-black uppercase tracking-wider">CONSOLA DIGITAL</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black uppercase italic text-white leading-tight">
              ESTUDIO VOCAL PROFESIONAL
            </h3>
            <p className="text-xs text-gray-400 font-bold uppercase leading-relaxed">
              Carga tus bases de rap e integra efectos en vivo como AutoTune, Reverb y Delay, o añade un preset como nuestro nuevo Talkbox estilo West Coast para conseguir ese flow nasal clásico.
            </p>
          </div>
          <Link 
            to="/studio" 
            className="px-6 py-3 bg-brand-green text-white text-xs font-black uppercase italic rounded-full w-fit hover:scale-105 transition-transform flex items-center gap-2 z-10"
          >
            🎚️ ENTRAR AL ESTUDIO
          </Link>
        </div>
      </div>

      {/* Featured Releases */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="text-brand-yellow" size={24} />
            <h2 className="text-2xl font-black uppercase italic tracking-tight">LANZAMIENTOS RECIENTES</h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-neutral-900 animate-pulse rounded-2xl border border-white/5" />
            ))}
          </div>
        ) : featuredTracks.length === 0 ? (
          <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-8 text-center text-xs text-gray-500 uppercase font-black">
            No hay canciones subidas todavía por los artistas. ¡Sé el primero en subir un track en tu perfil!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredTracks.map((track) => (
              <div 
                key={track.id} 
                className="bg-neutral-900/60 hover:bg-neutral-900 border border-white/5 p-4 rounded-2xl flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-16 rounded-xl bg-black border border-white/10 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" alt="Cover" />
                    ) : (
                      <Disc className="text-brand-yellow/30" size={24} />
                    )}
                    <button 
                      onClick={() => play(track)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Play className="text-brand-yellow" size={20} />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase truncate text-white">{track.title}</p>
                    <Link to={`/profile/${track.artistId}`} className="text-[10px] font-black text-brand-yellow uppercase hover:underline truncate inline-block mt-0.5">
                      {track.artistName}
                    </Link>
                  </div>
                </div>

                <button 
                  onClick={() => play(track)}
                  className="p-3 bg-white/5 rounded-full hover:bg-brand-yellow hover:text-black transition-all flex-shrink-0"
                >
                  <Play size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
