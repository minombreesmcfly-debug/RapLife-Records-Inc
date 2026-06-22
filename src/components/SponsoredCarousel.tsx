import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight, Music, Heart, Disc, ExternalLink } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, signInWithGoogle } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

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

const PLACEHOLDER_SPONSOR: SponsoredArtist = {
  id: 'placeholder_join',
  displayName: 'Rap Life Records',
  role: 'artist',
  category: 'ÚNETE A LA REVOLUCIÓN',
  bio: 'Únete a Rap Life Records. Regístrate o inicia sesión en la parte superior para acumular puntos, participar en el chat colectivo y registrar tu propio álbum o canción.',
  photoURL: '/assets/Logo.png',
  instagramUrl: '#'
};

const USER_PLACEHOLDER_SPONSOR: SponsoredArtist = {
  id: 'placeholder_join',
  displayName: 'Rap Life Records',
  role: 'artist',
  category: '★ MIEMBRO VIP / SOCIO ★',
  bio: '¡Te damos la bienvenida a la discográfica! Ya formas parte de Rap Life Records. Participa en el chat colectivo, acumula puntos de calle o sube tu propia canción o álbum en la sección superior.',
  photoURL: '/assets/Logo.png',
  instagramUrl: '#'
};

const DEFAULT_FALLBACK_ARTISTS: SponsoredArtist[] = [];

export default function SponsoredCarousel() {
  const { profile } = useAuth();
  const [artists, setArtists] = useState<SponsoredArtist[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load all artists with role 'artist' or custom-made profiles from db
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          limit(100)
        );
        const snap = await getDocs(q);
        const dbArtists: SponsoredArtist[] = [];
        
        if (!snap.empty) {
          snap.docs.forEach(doc => {
            const data = doc.data();
            const isExclusive = data.isExclusive !== false; // defaults to true
            
            // Failsafe isArtist check to catch any custom profiles created by the user with or without role='artist'
            const dispName = (data.displayName || '').trim();
            const isDefaultProfile = !dispName || dispName === 'RapLife Member' || dispName === 'Artista Sin Nombre';
            
            const isArtist = data.role === 'artist' || 
                             data.isPinned === true || 
                             data.isExclusive === true ||
                             (!isDefaultProfile && (
                               data.hasAvatar === true || 
                               (data.avatarUrl && data.avatarUrl !== '') || 
                               (data.photoURL && data.photoURL !== '') ||
                               (data.avatarSelfieUrl && data.avatarSelfieUrl !== '')
                             ));

            if (isArtist) {
              dbArtists.push({
                id: doc.id,
                displayName: data.displayName || 'Artista Sin Nombre',
                role: 'artist',
                category: data.category || (isExclusive ? 'EXCLUSIVO RAPLIFE' : 'DESTACADO RAPLIFE'),
                bio: data.bio || 'Exclusivo artista independiente asociado al sello discográfico.',
                photoURL: data.photoURL || data.avatarUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                spotifyUrl: data.spotifyUrl || '',
                instagramUrl: data.instagramUrl || '',
                isExclusive: isExclusive,
                createdAt: data.createdAt
              } as any);
            }
          });

          // Sort db artists: Newer (by createdAt) first
          dbArtists.sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          
          console.log("[CAROUSEL] Successfully loaded database artists:", dbArtists.map(a => a.displayName));
        }

        // If they are not logged in, show ONLY the primary sign-up card.
        // Once logged in, we show the member status card AND then any custom database artists they added.
        let finalArtists: SponsoredArtist[] = [];
        if (!profile) {
          finalArtists = [PLACEHOLDER_SPONSOR];
        } else {
          finalArtists = [USER_PLACEHOLDER_SPONSOR, ...dbArtists];
        }
        setArtists(finalArtists);
      } catch (e) {
        console.warn("[CAROUSEL] Database fetch error:", e);
        const finalArtists = profile ? [USER_PLACEHOLDER_SPONSOR] : [PLACEHOLDER_SPONSOR];
        setArtists(finalArtists);
      } finally {
        setLoading(false);
      }
    };
    fetchArtists();
  }, [profile]);

  // Autoplay intervals
  useEffect(() => {
    if (artists.length <= 1) return;
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

  if (loading) {
    return (
      <>
        {/* Mobile Loading Skeleton */}
        <div className="block md:hidden w-full relative bg-neutral-950/90 py-1.5 px-3 flex items-center justify-between gap-1.5 min-h-[48px]">
          <div className="flex items-center gap-1.5 animate-pulse flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
            <div className="space-y-1 flex-1 min-w-0">
              <div className="w-20 h-2.5 bg-neutral-800 rounded" />
              <div className="w-32 h-2 bg-neutral-800 rounded truncate" />
            </div>
          </div>
          <div className="w-8 h-4 bg-neutral-800 rounded animate-pulse shrink-0" />
        </div>

        {/* Desktop Loading Skeleton */}
        <div className="hidden md:block w-full relative bg-black/45 border-y-4 border-boombox-gray py-6 overflow-hidden boombox-texture min-h-[218px]">
          <div className="max-w-7xl mx-auto px-4 md:px-12 w-full flex items-center justify-between gap-4 animate-pulse pt-2">
            <div className="flex items-center gap-6 flex-grow">
              <div className="w-28 h-28 rounded-full bg-neutral-800 border-4 border-neutral-900 shrink-0" />
              <div className="space-y-3 flex-grow">
                <div className="flex gap-2 items-center">
                  <div className="w-40 h-6 bg-neutral-800 rounded" />
                  <div className="w-24 h-4 bg-neutral-800 rounded" />
                </div>
                <div className="w-full h-3 bg-neutral-800 rounded" />
                <div className="w-2/3 h-3 bg-neutral-800 rounded" />
              </div>
            </div>
            <div className="w-32 h-10 bg-neutral-800 rounded shrink-0 self-center" />
          </div>
        </div>
      </>
    );
  }

  if (artists.length === 0) return null;

  const rawActiveArtist = artists[currentIndex];
  const isMcFly = rawActiveArtist.id === 'artist_mcfly_emece' || rawActiveArtist.id === 'sponsor_mac_flyer' || rawActiveArtist.displayName.toLowerCase().includes('mcfly');

  const activeArtist = (isMcFly && profile) ? {
    ...rawActiveArtist,
    displayName: profile.displayName || rawActiveArtist.displayName,
    photoURL: profile.photoURL || profile.avatarUrl || rawActiveArtist.photoURL,
    bio: profile.bio || rawActiveArtist.bio,
    spotifyUrl: profile.spotifyUrl || rawActiveArtist.spotifyUrl,
    instagramUrl: profile.instagramUrl || rawActiveArtist.instagramUrl,
  } : rawActiveArtist;

  return (
    <>
      {/* MOBILE COMPACT RIBBON VIEW */}
      <div 
        className="block md:hidden w-full relative py-1.5 px-3 flex items-center justify-between gap-1.5 overflow-hidden select-none"
        style={activeArtist.id === 'placeholder_join' ? {
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url('/assets/Banner.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {
          backgroundColor: 'rgb(10 10 10 / 0.9)',
        }}
        onTouchStart={() => setAutoplay(false)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-nowrap flex-1">
          {/* Avatar (small circle) */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-yellow/30 shrink-0 bg-black/40">
            <img 
              referrerPolicy="no-referrer"
              src={activeArtist.photoURL} 
              className={`w-full h-full ${activeArtist.id === 'placeholder_join' ? 'object-contain p-1' : 'object-cover'}`}
              alt={activeArtist.displayName} 
            />
          </div>
          {/* Text Info */}
          <div className="min-w-0 flex flex-col justify-center leading-none">
            <div className="flex items-center gap-1 flex-nowrap">
              <span className="text-[11px] font-black italic uppercase tracking-tighter text-white truncate max-w-[110px]">
                {activeArtist.displayName}
              </span>
              <span className="bg-brand-yellow/10 text-brand-yellow text-[5.5px] font-black uppercase px-1 py-0.5 rounded tracking-widest font-mono shrink-0 scale-90 origin-left">
                {activeArtist.category}
              </span>
            </div>
            <p className="text-[7.5px] text-gray-400 uppercase font-black tracking-tight mt-0.5 truncate max-w-[180px]">
              "{activeArtist.bio}"
            </p>
          </div>
        </div>

        {/* Actions & Pagination Navigation */}
        <div className="flex items-center gap-1 shrink-0">
          {activeArtist.id === 'placeholder_join' ? (
            profile ? (
              <span className="px-2 py-1 bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow font-black uppercase text-[6.5px] rounded tracking-wider flex items-center gap-0.5 whitespace-nowrap">
                ★ VIP MEMBER ★
              </span>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err) {
                    console.error("Popup login error, trying redirect fallback:", err);
                    try {
                      const { signInWithGoogleRedirect } = await import('../lib/firebase');
                      await signInWithGoogleRedirect();
                    } catch (redirectErr) {
                      console.error("Redirect fallback failed:", redirectErr);
                    }
                  }
                }}
                className="px-2 py-1 bg-brand-yellow hover:bg-yellow-400 text-black font-black uppercase text-[6.5px] rounded tracking-wider flex items-center gap-0.5 whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
              >
                <Sparkles size={7} />
                <span>UNIRTE</span>
              </button>
            )
          ) : (
            <>
              {activeArtist.spotifyUrl && (
                <a
                  href={activeArtist.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1DB954] hover:bg-[#1ed760] active:scale-90 transition-all shadow-md shrink-0"
                  title="Spotify"
                >
                  <Music size={10} fill="black" className="text-black" />
                </a>
              )}
            </>
          )}
          
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-full border border-white/5 shrink-0 ml-0.5">
            <button 
              onClick={handlePrev}
              className="p-0.5 text-gray-400 hover:text-brand-yellow active:scale-95 rounded-full"
            >
              <ChevronLeft size={10} />
            </button>
            <span className="text-[8px] font-mono text-gray-500 font-bold px-0.5">
              {currentIndex + 1}/{artists.length}
            </span>
            <button 
              onClick={handleNext}
              className="p-0.5 text-gray-400 hover:text-brand-yellow active:scale-95 rounded-full"
            >
              <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP FULL BOOMBOX VIEW */}
      <div 
        className="hidden md:block w-full relative border-y-4 border-boombox-gray py-6 overflow-hidden boombox-texture select-none"
        style={activeArtist.id === 'placeholder_join' ? {
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.45), rgba(0,0,0,0.85)), url('/assets/Banner.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {
          backgroundColor: 'rgb(0 0 0 / 0.45)',
        }}
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
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-neutral-900 shadow-2xl shrink-0 group bg-neutral-950/80">
                    <img 
                      referrerPolicy="no-referrer"
                      src={activeArtist.photoURL} 
                      className={`w-full h-full ${activeArtist.id === 'placeholder_join' ? 'object-contain p-3 md:p-4' : 'object-cover'} group-hover:scale-110 transition-transform duration-500`}
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
                  {activeArtist.id === 'placeholder_join' ? (
                    profile ? (
                      <Link
                        to="/studio"
                        className="flex items-center justify-center gap-1.5 bg-brand-yellow hover:bg-yellow-400 text-black font-black uppercase text-[9px] tracking-wider px-4 py-2.5 rounded-lg transition-all scale-95 hover:scale-100 cursor-pointer shadow-[0_4px_12px_rgba(247,250,5,0.25)]"
                      >
                        <Sparkles size={11} />
                        <span>IR A ESTUDIO DE AVATAR</span>
                      </Link>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await signInWithGoogle();
                          } catch (err) {
                            console.error("Popup login error, trying redirect fallback:", err);
                            try {
                              const { signInWithGoogleRedirect } = await import('../lib/firebase');
                              await signInWithGoogleRedirect();
                            } catch (redirectErr) {
                              console.error("Redirect fallback failed:", redirectErr);
                            }
                          }
                        }}
                        className="flex items-center gap-1.5 bg-brand-yellow hover:bg-yellow-400 text-black font-black uppercase text-[9px] tracking-wider px-4 py-2.5 rounded-lg transition-all scale-95 hover:scale-100 cursor-pointer shadow-[0_4px_12px_rgba(247,250,5,0.25)]"
                      >
                        <Sparkles size={11} />
                        <span>UNIRSE AHORA (GOOGLE)</span>
                      </button>
                    )
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
