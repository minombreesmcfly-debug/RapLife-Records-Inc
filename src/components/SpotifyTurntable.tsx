import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Sliders, Radio, Music, Volume2, Disc, Compass, Shuffle, Sparkles, ChevronRight, VolumeX } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useMusic } from '../context/MusicContext';

interface Track {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  isRadioInterstitial?: boolean;
}

export default function SpotifyTurntable() {
  const { isPlaying: isGlobalPlaying, togglePlay: toggleGlobalPlay } = useMusic();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(1.0); // 0.6 to 1.4
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlistId = '1fYkTNZmwjgP3RkkRPhnsG'; // Default RapLife Spotify playlist

  // 1. Fetch available tracks from Database to load into local turntable collection
  useEffect(() => {
    const fetchTracksForTurntable = async () => {
      try {
        const q = query(
          collection(db, 'tracks'), 
          where('isRadioInterstitial', '==', false),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        const loadedTracks: Track[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Track));
        setTracks(loadedTracks);
        
        // Load first track by default if available
        if (loadedTracks.length > 0) {
          setActiveTrack(loadedTracks[0]);
        }
      } catch (err) {
        console.error("[TURNTABLE] Error fetching track library:", err);
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTracksForTurntable();
  }, []);

  // 2. Initialize and manage local turntable Audio instance
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.loop = true;
    audioRef.current.volume = volume / 100;
    
    // When song ends, load a random next track if in auto-play
    audioRef.current.onended = () => {
      playNextRandomTrack();
    };

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // 100% reactive sync of speed/pitch properties
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = pitch;
    }
  }, [pitch, activeTrack]);

  // Synchronize play state
  useEffect(() => {
    if (!audioRef.current || !activeTrack) return;

    if (isPlaying) {
      // Pause global radio player if active to prevent overlapping tracks!
      if (isGlobalPlaying) {
        toggleGlobalPlay();
      }

      if (audioRef.current.src !== activeTrack.audioUrl) {
        audioRef.current.src = activeTrack.audioUrl;
      }
      
      audioRef.current.volume = isMuted ? 0 : volume / 100;
      audioRef.current.playbackRate = pitch;
      
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        promise.catch(e => {
          console.warn("[TURNTABLE] Playback blocked or aborted:", e);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, activeTrack]);

  // Synchronize volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const togglePlayback = () => {
    if (!activeTrack) return;
    setIsPlaying(prev => !prev);
  };

  const toggleMuteLocal = () => {
    setIsMuted(prev => !prev);
  };

  const loadTrackOnPlatter = (track: Track) => {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = track.audioUrl;
    }
    
    setActiveTrack(track);
    
    // Auto start selected track immediately if requested
    setTimeout(() => {
      setIsPlaying(true);
    }, 100);
  };

  const playNextRandomTrack = () => {
    if (tracks.length <= 1) return;
    let nextIndex = Math.floor(Math.random() * tracks.length);
    while (tracks[nextIndex].id === activeTrack?.id) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
    loadTrackOnPlatter(tracks[nextIndex]);
  };

  // Convert animation speed based on pitch
  const rotationDuration = 10 / (pitch * (isPlaying ? 1 : 0.0001));

  return (
    <div className="space-y-10">
      {/* EXPLANATORY HERO NOTICE CONTAINER */}
      <div className="bg-gradient-to-r from-brand-yellow/10 via-black/40 to-brand-green/10 border-2 border-brand-yellow/20 rounded-[2rem] p-6 text-center max-w-6xl mx-auto backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <div className="p-3 bg-brand-yellow/10 rounded-full border border-brand-yellow/30 animate-pulse text-brand-yellow">
            <Sparkles size={24} />
          </div>
          <div className="text-center md:text-left space-y-1">
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-white uppercase italic font-black">
              🎚️ ¡NUEVA MEZCLA INTERACTIVA EN VIVO!
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed max-w-3xl">
              Debido a las estrictas políticas de protección de derechos de autor y CORS de la API de Spotify, no es posible extraer los archivos de audio de Spotify para mezclarlos directamente en el tocadiscos o agregarlos a la cola aleatoria nativa. 
              <span className="text-brand-yellow font-bold"> ¡Pero no te detengas! </span> 
              Hemos convertido la bandeja de vinilo en un <strong className="text-brand-green">Direct-Drive Turntable 100% funcional</strong>. Carga cualquiera de tus canciones subidas directamente en la bandeja, ajusta su velocidad con el control de RPM y haz tu mezcla en vivo.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-950 border-4 border-boombox-gray rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden shadow-2xl boombox-texture max-w-6xl mx-auto">
        {/* Structural screws */}
        <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch relative z-10">
          
          {/* LEFT: THE INTERACTIVE TURNTABLE DECK */}
          <div className="lg:col-span-7 flex flex-col items-center justify-between">
            <div className="w-full bg-neutral-900 p-5 md:p-6 rounded-[2rem] border-4 border-neutral-850 shadow-inner flex flex-col items-center gap-4 relative">
              
              {/* Direct Drive Pitch / Status LEDs */}
              <div className="w-full flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-brand-green animate-pulse shadow-[0_0_8px_#39ff14]' : 'bg-red-650 shadow-[0_0_8px_#ff0000]'} transition-colors duration-300`} />
                  <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 font-bold">
                    {isPlaying ? 'PLATO GIRANDO' : 'PLATO DETENIDO'}
                  </span>
                </div>
                <div className="lcd-display px-2.5 py-1 rounded-lg text-[10px] font-mono border border-black shadow-inner font-black text-brand-yellow">
                  {(pitch * 33.3).toFixed(1)} RPM ({Math.round(pitch * 100)}%)
                </div>
              </div>

              {/* THE PLATTER & VINYL AREA */}
              <div className="relative flex items-center justify-center p-2">
                
                {/* Outer Platter Rim */}
                <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-[310px] md:h-[310px] rounded-full bg-neutral-950 border-8 border-neutral-850 shadow-[0_15px_35px_rgba(0,0,0,0.8),inset_0_0_20px_black] flex items-center justify-center relative">
                  
                  {/* Turntable slipmat background */}
                  <div className="absolute inset-1.5 rounded-full bg-[#111] border border-neutral-900 shadow-inner" />

                  {/* THE ROTATING VINYL RECORD */}
                  <motion.div 
                    className="w-[94%] h-[94%] rounded-full bg-[#080808] relative overflow-hidden flex items-center justify-center cursor-pointer shadow-lg"
                    style={{
                      background: "repeating-radial-gradient(circle, #080808, #0ee 0.8px, #121212 1.6px, #050505 2.4px)"
                    }}
                    animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                    transition={isPlaying ? { repeat: Infinity, duration: rotationDuration, ease: "linear" } : { duration: 0.5 }}
                  >
                    {/* Conic gloss reflection sheen */}
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
                      style={{
                        background: "conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.08) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 225deg, transparent 270deg)"
                      }}
                    />

                    {/* Grooves highlight overlays */}
                    <div className="absolute inset-6 rounded-full border-2 border-white/[0.01]" />
                    <div className="absolute inset-12 rounded-full border border-white/[0.02]" />
                    <div className="absolute inset-20 rounded-full border-2 border-white/[0.01]" />
                    <div className="absolute inset-28 rounded-full border border-white/[0.02]" />

                    {/* CENTER LABEL - THE CUSTOM RECORD MIDDLE */}
                    <div className="w-24 h-24 rounded-full bg-brand-yellow border-4 border-black flex flex-col items-center justify-center relative z-10 shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none overflow-hidden text-center p-1">
                      
                      {/* Album Art sticker background if track loaded */}
                      {activeTrack?.coverUrl && (
                        <div className="absolute inset-0 z-0 opacity-80">
                          <img src={activeTrack.coverUrl} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-neutral-900/35" />
                        </div>
                      )}

                      <div className="absolute inset-0.5 rounded-full border border-black/20 z-10" />

                      {/* Display active song title on sticker */}
                      <span className="text-[7.5px] font-black uppercase tracking-[0.05em] text-black bg-brand-yellow/85 px-1.5 py-0.5 rounded shadow-sm max-w-full truncate z-10">
                        {activeTrack ? activeTrack.title.substring(0, 15) : 'VACÍO'}
                      </span>
                      
                      <span className="text-[6px] font-black tracking-widest uppercase text-white drop-shadow-md mt-0.5 z-10">
                        {activeTrack ? activeTrack.artistName.substring(0, 14) : 'SELECCIONA'}
                      </span>

                      {/* Spindle Spindle Metal Center peg */}
                      <div className="w-4 h-4 bg-neutral-200 rounded-full border-2 border-neutral-400 flex items-center justify-center absolute z-20 shadow-inner">
                        <div className="w-1.5 h-1.5 bg-neutral-650 rounded-full" />
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Platter outer strobe dots simulation (dotted border-spacing look) */}
                  <div className="absolute inset-0.5 rounded-full border-4 border-dotted border-white/[0.03] pointer-events-none" />
                </div>

                {/* MECHANICAL TONEARM DECK PIECE */}
                <div className="absolute top-0 right-1 md:right-3 w-28 h-40 pointer-events-none z-20">
                  {/* Pivot base */}
                  <div className="absolute top-4 right-4 w-12 h-12 bg-neutral-850 rounded-full border-4 border-neutral-750 shadow-md flex items-center justify-center">
                    <div className="w-6 h-6 bg-neutral-700 rounded-full border border-neutral-600 shadow-inner" />
                  </div>
                  
                  {/* Pivot arm extension */}
                  <motion.div 
                    className="origin-[32px_24px] absolute top-4 right-4"
                    animate={{ rotate: isPlaying ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 60, damping: 15 }}
                  >
                    <svg width="40" height="150" viewBox="0 0 40 150" fill="none" className="drop-shadow-lg">
                      <path 
                        d="M 10 10 L 10 30 Q 10 60 18 80 L 18 115 L 6 135" 
                        stroke="#8a8a8a" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                      />
                      <path 
                        d="M 10 10 L 10 30 Q 10 60 18 80 L 18 115 L 6 135" 
                        stroke="#c0c0c0" 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                      />
                      <rect x="2" y="130" width="8" height="18" rx="1.5" fill="#111" />
                      <rect x="4" y="142" width="4" height="6" rx="0.5" fill="#f8fb02" />
                    </svg>
                  </motion.div>
                </div>
              </div>

              {/* TRACK INFO BANNER */}
              {activeTrack ? (
                <div className="w-full text-center px-4 py-1.5 bg-black/45 rounded-xl border border-white/5">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-brand-green/80">REPRODUCIENDO EN VINILO</div>
                  <h4 className="font-extrabold italic uppercase text-sm text-brand-yellow truncate">{activeTrack.title}</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">{activeTrack.artistName}</p>
                </div>
              ) : (
                <div className="w-full text-center px-4 py-2 bg-black/40 rounded-xl border border-white/5">
                  <p className="text-xs text-neutral-400 italic">CARGA UN VINILO ACÁ ABAJO</p>
                </div>
              )}

              {/* DECK CONTROLS SECTION */}
              <div className="w-full grid grid-cols-12 gap-4 border-t-2 border-neutral-850 pt-4 px-2">
                
                {/* Start/Stop Button */}
                <div className="col-span-3 flex flex-col justify-center items-center">
                  <button 
                    onClick={togglePlayback}
                    className={`w-11 h-11 md:w-13 md:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer ${isPlaying ? 'bg-brand-yellow text-black hover:bg-white shadow-glow' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'} border-4 border-neutral-950 active:scale-95`}
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play className="ml-0.5" size={18} fill="currentColor" />}
                  </button>
                  <span className="text-[8px] font-mono font-black uppercase tracking-wider text-neutral-500 mt-1">D.D. START</span>
                </div>

                <div className="col-span-3 flex flex-col justify-center items-center">
                  <button 
                    onClick={toggleMuteLocal}
                    className={`w-11 h-11 md:w-13 md:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer ${isMuted ? 'bg-red-500/20 text-red-500 border-red-500/40 hover:bg-red-500/30' : 'bg-neutral-800 text-brand-green hover:bg-neutral-750'} border-4 border-neutral-950 active:scale-95`}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <span className="text-[8px] font-mono font-black uppercase tracking-wider text-neutral-500 mt-1">{isMuted ? "SILENCIADO" : "VOL ACÁ"}</span>
                </div>

                {/* Pitch Fader Slider */}
                <div className="col-span-6 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-0.5 select-none">
                    <span className="text-[8px] font-mono font-black uppercase text-neutral-500 tracking-wider">SPEED AJUST</span>
                    <span className="text-[9px] font-mono text-brand-yellow font-black">{(pitch * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sliders size={11} className="text-neutral-500" />
                    <input 
                      type="range" 
                      min="0.6" 
                      max="1.4" 
                      step="0.05"
                      className="flex-grow accent-brand-yellow h-1 bg-black rounded-lg cursor-pointer"
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT: SPOTIFY EMBED WITH VINYL RETRO DESIGN FRAME */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="flex-grow h-[280px] md:h-full min-h-[300px]">
              <div className="w-full h-full bg-black rounded-[2rem] border-4 border-neutral-900 overflow-hidden shadow-2xl relative">
                <iframe
                  title="RapLife Spotify"
                  src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                  className="w-full h-full border-0 rounded-[1.8rem]"
                  allowFullScreen={false}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            </div>
            <a
              href={`https://open.spotify.com/playlist/${playlistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-[#1DB954] hover:bg-[#1ed760] hover:scale-[1.02] active:scale-95 text-black font-black uppercase text-[10px] tracking-wider py-3.5 px-4 rounded-xl shadow-glow transition-all text-center shrink-0"
            >
              <Music size={14} fill="black" />
              ABRIR PLAYLIST SP
            </a>
          </div>

        </div>

        {/* BOTTOM: VINYL RECORD RACK (La maleta de vinilos) */}
        <div className="mt-10 border-t border-neutral-800 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Disc className="text-brand-yellow animate-spin" size={18} style={{ animationDuration: '4s' }} />
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-white font-black">
                📂 COLECCIÓN DE VINILOS (RAPLIFE SELECTION)
              </h3>
            </div>
            
            <button 
              onClick={playNextRandomTrack}
              className="flex items-center justify-center gap-1.5 self-start bg-neutral-850 hover:bg-neutral-800 active:scale-95 text-[10px] font-black uppercase tracking-widest text-brand-green border border-brand-green/30 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            >
              <Shuffle size={11} />
              <span>MEZCLA ALEATORIA</span>
            </button>
          </div>

          {loadingTracks ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-t-brand-yellow border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <p className="font-mono text-[10px] text-gray-500 uppercase">REBUSCANDO CAJONES DE VINILO...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-8 text-center text-gray-500 font-mono text-[10px] uppercase border border-dashed border-neutral-800 rounded-2xl">
              TODAVÍA NO HAY VINILOS DISPONIBLES EN LA WEB
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tracks.map((t) => {
                const isActive = activeTrack?.id === t.id;
                return (
                  <div 
                    key={t.id} 
                    onClick={() => loadTrackOnPlatter(t)}
                    className={`relative p-3 bg-neutral-900 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                      isActive 
                        ? 'border-brand-yellow shadow-[0_0_12px_rgba(248,251,2,0.15)] bg-neutral-850' 
                        : 'border-white/5 hover:border-white/10 hover:bg-neutral-850'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 z-10 shadow-md">
                      <img 
                        src={t.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop'} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        alt=""
                      />
                      
                      {/* Virtual record visual popping out of sleeve on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-brand-yellow text-black text-[8px] font-black uppercase py-1 px-2.5 rounded-full scale-90 group-hover:scale-100 transition-transform">
                          {isActive ? 'PROCESANDO' : 'CARGAR'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <h5 className={`font-black italic uppercase text-xs truncate leading-tight ${isActive ? 'text-brand-yellow' : 'text-white'}`}>
                        {t.title}
                      </h5>
                      <p className="text-[9px] text-gray-500 uppercase font-bold truncate">
                        {t.artistName}
                      </p>
                    </div>

                    {/* Active loading dot indicator */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_6px_#39ff14]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
