import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight, Music, Heart, Disc, ExternalLink } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SponsoredArtist {
  id: string;
  displayName: string;
  role: string;
  category: string;
  bio: string;
  photoURL: string;
  spotifyUrl?: string;
  instagramUrl?: string;
  isPinned?: boolean;
}

const STATIC_SPONSORS: SponsoredArtist[] = [
  {
    id: 'sponsor_mac_flyer',
    displayName: 'McFly EmeCe',
    role: 'artist',
    category: 'RAP TRAP CONSPIRACIONES',
    bio: 'Líricas punzantes y bases oscuras cargadas de verdades incómodas, enigmas y teorías de conspiración sobre el asfalto pesado.',
    photoURL: '/src/assets/images/mcfly_ninja_rapper_1781111492480.png', // Ninja rapero hiperrealista
    spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
    instagramUrl: 'https://instagram.com/'
  },
  {
    id: 'sponsor_jason_santana',
    displayName: 'Jay Santana',
    role: 'artist',
    category: 'RAP / REGIONAL MEXICANO TRAP',
    bio: 'Fusión pionera que une la crudeza del rap de calle con los arreglos profundos y el alma del Regional Mexicano en ritmo Trap.',
    photoURL: '/src/assets/images/jay_santana_ghetto_1781111479453.png', // Ciudad gueto noche
    spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
    instagramUrl: 'https://instagram.com/'
  },
  {
    id: 'sponsor_aitan_blue',
    displayName: 'Aitana Blue Dream',
    role: 'artist',
    category: 'G FUNK / EDM',
    bio: 'Fusión sublime que une las melodías grooves del G-Funk clásico de West Coast con la vibración electrónica y bailable del EDM moderno.',
    photoURL: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop', // Concierto luces neon
    spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
    instagramUrl: 'https://instagram.com/'
  }
];

export default function SponsoredCarousel() {
  const [artists, setArtists] = useState<SponsoredArtist[]>(STATIC_SPONSORS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  // Load pinned or exclusive artists from db to supplement!
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'artist'),
          limit(30)
        );
        const snap = await getDocs(q);
        const dbArtists: SponsoredArtist[] = [];
        
        if (!snap.empty) {
          snap.docs.forEach(doc => {
            const data = doc.data();
            const isPinned = data.isPinned === true;
            const isExclusive = data.isExclusive !== false; // defaults to true or custom value
            
            // Include all fetched artists in the slideshow and format them correctly
            dbArtists.push({
              id: doc.id,
              displayName: data.displayName || 'Artista Sin Nombre',
              role: data.role || 'artist',
              category: data.category || (isExclusive ? 'EXCLUSIVO RAPLIFE' : 'DESTACADO RAPLIFE'),
              bio: data.bio || 'Exclusivo artista independiente asociado al sello discográfico.',
              photoURL: data.photoURL || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
              spotifyUrl: data.spotifyUrl || '',
              instagramUrl: data.instagramUrl || '',
              isPinned: honorsField(isPinned),
              isExclusive: isExclusive,
              createdAt: data.createdAt
            } as any);
          });

          // Helper to cast boolean
          function honorsField(val: any) {
            return typeof val === 'boolean' ? val : !!val;
          }

          // Sort db artists: 1. Pinned first, 2. Exclusive next, 3. Newer (by createdAt) first
          dbArtists.sort((a: any, b: any) => {
            if (a.isPinned !== b.isPinned) {
              return a.isPinned ? -1 : 1;
            }
            if (a.isExclusive !== b.isExclusive) {
              return a.isExclusive ? -1 : 1;
            }
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          
          console.log("[CAROUSEL] Successfully loaded database artists:", dbArtists.map(a => a.displayName));
        }

        // Combine static sponsors with db artists, preventing duplication, BUT put database-sourced ones FIRST so they instantly appear at the start of the slide!
        const combined: SponsoredArtist[] = [...dbArtists];
        STATIC_SPONSORS.forEach(staticSponsor => {
          if (!combined.some(a => a.displayName.toLowerCase() === staticSponsor.displayName.toLowerCase())) {
            combined.push(staticSponsor);
          }
        });

        if (combined.length > 0) {
          setArtists(combined);
        }
      } catch (e) {
        console.warn("[CAROUSEL] Database fetch error, falling back perfectly to static:", e);
      }
    };
    fetchArtists();
  }, []);

  // Autoplay intervals
  useEffect(() => {
    if (!autoplay) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % artists.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [artists.length, autoplay]);

  const handlePrev = () => {
    setAutoplay(false);
    setCurrentIndex(prev => (prev - 1 + artists.length) % artists.length);
  };

  const handleNext = () => {
    setAutoplay(false);
    setCurrentIndex(prev => (prev + 1) % artists.length);
  };

  const activeArtist = artists[currentIndex] || STATIC_SPONSORS[0];

  return (
    <div 
      className="w-full relative bg-black/45 border-y-4 border-boombox-gray py-6 overflow-hidden boombox-texture select-none"
      onMouseEnter={() => setAutoplay(false)}
      onMouseLeave={() => setAutoplay(true)}
      id="sponsored-artists-reel"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-12 relative">
        <div className="flex items-center justify-between gap-1 mb-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-yellow opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-yellow"></span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white font-black flex items-center gap-2">
              🔊 SPONSOR OFICIAL RAPLIFE <span className="text-gray-500 font-normal">| ARTISTAS EN PORTADA</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-full border border-white/5 shrink-0">
            <button 
              onClick={handlePrev}
              className="p-1 text-gray-400 hover:text-brand-yellow active:scale-95 transition-all text-sm rounded-full"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[9px] font-mono text-gray-500 px-1 font-bold">
              {currentIndex + 1} / {artists.length}
            </span>
            <button 
              onClick={handleNext}
              className="p-1 text-gray-400 hover:text-brand-yellow active:scale-95 transition-all text-sm rounded-full"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="relative min-h-[190px] md:min-h-[170px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeArtist.id}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
            >
              {/* IMAGE ELEMENT */}
              <div className="md:col-span-3 flex justify-center">
                <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-neutral-900 shadow-2xl shrink-0 group">
                  <img 
                    referrerPolicy="no-referrer"
                    src={activeArtist.photoURL} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    alt={activeArtist.displayName} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                    <span className="bg-brand-yellow text-black text-[6.5px] font-black uppercase px-2 py-0.5 rounded-full">RAP ARTIST</span>
                  </div>
                  {/* Speaker-grill border circle */}
                  <div className="absolute inset-0 rounded-full border-2 border-black/40 pointer-events-none" />
                </div>
              </div>

              {/* CARD DETAILS */}
              <div className="md:col-span-6 text-center md:text-left space-y-2">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white">
                    {activeArtist.displayName}
                  </h3>
                  <span className="bg-brand-yellow/15 text-brand-yellow text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-brand-yellow/30 tracking-widest font-mono">
                    {activeArtist.category}
                  </span>
                </div>
                
                <p className="text-[11px] text-gray-300 font-bold uppercase tracking-tight leading-relaxed line-clamp-3">
                  "{activeArtist.bio}"
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-brand-green/90 text-[9px] font-mono font-black uppercase">
                    <Disc className="animate-spin" size={12} style={{ animationDuration: '3s' }} />
                    <span>ARTISTA DE LA CASA</span>
                  </div>
                </div>
              </div>

              {/* ACTION LINKS */}
              <div className="md:col-span-3 flex flex-row md:flex-col gap-2 justify-center md:justify-end md:items-end w-full">
                {activeArtist.spotifyUrl && (
                  <a
                    href={activeArtist.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black uppercase text-[8.5px] tracking-wider px-3.5 py-2.5 rounded-lg transition-all scale-95 hover:scale-100 shadow-glow"
                  >
                    <Music size={11} fill="black" />
                    <span>ESCUCHAR SPOTIFY</span>
                  </a>
                )}
                {activeArtist.instagramUrl && (
                  <a
                    href={activeArtist.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-850 hover:border-white/10 text-white font-black uppercase text-[8.5px] tracking-wider px-3.5 py-2.5 rounded-lg border border-white/5 transition-all scale-95 hover:scale-100"
                  >
                    <ExternalLink size={11} />
                    <span>VER REDES</span>
                  </a>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
