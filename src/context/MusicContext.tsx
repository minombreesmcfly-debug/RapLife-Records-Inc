import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, where, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Track {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  isRadioInterstitial?: boolean;
  fullName?: string;
}

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  play: (track: Track) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  radioMode: boolean;
  setRadioMode: (mode: boolean) => void;
  isMuted: boolean;
  toggleMute: () => void;
  volume: number;
  setVolume: (vol: number) => void;
  fadeVolume: (target: number, durationMs: number) => Promise<void>;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
  playlist: Track[];
  setPlaylist: (list: Track[]) => void;
  playRadioPlaylist: (list: Track[], startIndex?: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [radioMode, setRadioMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [songsPlayedCount, setSongsPlayedCount] = useState(0);

  // Refs for tracking state inside stale event handler closures
  const statesRef = useRef({
    currentTrack,
    radioMode,
    playlist,
  });

  useEffect(() => {
    statesRef.current = {
      currentTrack,
      radioMode,
      playlist,
    };
  }, [currentTrack, radioMode, playlist]);

  // Time tracking states
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume & Fade states
  const [volume, setVolumeState] = useState(1.0);
  const fadeIntervalRef = useRef<any>(null);

  const setVolume = (vol: number) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const fadeVolume = (target: number, durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }

      if (!audioRef.current) {
        resolve();
        return;
      }

      const startVolume = audioRef.current.volume;
      const targetVolume = Math.max(0, Math.min(1, target));
      const steps = 15;
      const stepTime = durationMs / steps;
      let currentStep = 0;

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        const fraction = currentStep / steps;
        const nextVolume = startVolume + (targetVolume - startVolume) * fraction;
        
        if (audioRef.current) {
          const nextClamped = Math.max(0, Math.min(1, nextVolume));
          audioRef.current.volume = nextClamped;
          setVolumeState(nextClamped);
        }

        if (currentStep >= steps) {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          if (audioRef.current) {
            audioRef.current.volume = targetVolume;
            setVolumeState(targetVolume);
            
            // If target is 0, pause the playback entirely to allow local instruments
            if (targetVolume === 0 && isPlaying) {
              if (playPromiseRef.current) {
                playPromiseRef.current
                  .then(() => {
                    if (audioRef.current) audioRef.current.pause();
                  })
                  .catch(() => {
                    if (audioRef.current) audioRef.current.pause();
                  });
              } else {
                audioRef.current.pause();
              }
              setIsPlaying(false);
            }
          }
          resolve();
        }
      }, stepTime);
    });
  };

  // Synchronize audio muted state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Synchronize audio volume state
  useEffect(() => {
    if (audioRef.current && !fadeIntervalRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Seek helper
  const seek = (time: number) => {
    if (audioRef.current) {
      const targetTime = Math.max(0, Math.min(duration || 1, time));
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      handleTrackEnd();
    };
    audioRef.current.onerror = (e) => {
      const err = audioRef.current?.error;
      console.error("[RADIO] Audio element error occurred:", err?.code, err?.message);
      // Self-healing radio: auto-skip to the next track in queue after a short delay so play doesn't stall
      setTimeout(() => {
        console.log("[RADIO] Auto-skipping to the next track due to playback error...");
        nextTrack();
      }, 2500);
    };
    audioRef.current.ontimeupdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };
    audioRef.current.ondurationchange = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration || 0);
      }
    };
    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration || 0);
      }
    };

    // Auto-load an initial track and autoplay
    const loadInitialTrack = async () => {
      try {
        let initial: Track | null = null;
        let locals: Track[] = [];

        // 1. Fetch local radio files
        try {
          const localRes = await fetch('/api/radio-local-songs');
          if (localRes.ok) {
            locals = await localRes.json();
          }
        } catch (e) {
          console.warn("[RADIO] Local radio files fetch error:", e);
        }

        // 2. Fetch approved or legacy database tracks and map them to Track items
        try {
          const tracksQ = query(collection(db, 'tracks'));
          const tracksSnap = await getDocs(tracksQ);
          const dbTracks = tracksSnap.docs
            .map(docSnap => {
              const data = docSnap.data();
              const status = data.status || (data.approved ? 'approved' : 'pending');
              return {
                id: docSnap.id,
                artistId: data.artistId || '',
                artistName: data.artistName || 'Artista',
                title: data.title || 'Track sin título',
                audioUrl: data.audioUrl,
                coverUrl: data.coverUrl || '/assets/player_idle.png',
                isRadioInterstitial: false,
                fullName: data.title || docSnap.id,
                status
              } as Track & { status: string };
            });
          locals = [...locals, ...dbTracks];
        } catch (dbErr) {
          console.warn("[RADIO] Approved/legacy db tracks fetch error:", dbErr);
        }

        if (locals && locals.length > 0) {
          // Check if there is configured play order
          let order: string[] = [];
          try {
            const docSnap = await getDoc(doc(db, 'config', 'radioOrder'));
            if (docSnap.exists()) {
              order = docSnap.data().fileOrder || [];
              try {
                localStorage.setItem('raplife_radio_order', JSON.stringify(order));
              } catch (_) {}
            } else {
              const cached = localStorage.getItem('raplife_radio_order');
              if (cached) order = JSON.parse(cached);
            }
          } catch (e) {
            console.warn("[RADIO] Firestore offline during initial load. Using localStorage:", e);
            try {
              const cached = localStorage.getItem('raplife_radio_order');
              if (cached) order = JSON.parse(cached);
            } catch (_) {}
          }

          // Sync with local playlist (sorted)
          let sortedLocals = [...locals];
          if (order && order.length > 0) {
            sortedLocals.sort((a, b) => {
              const idxA = order.indexOf(a.fullName || a.id || '');
              const idxB = order.indexOf(b.fullName || b.id || '');
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            });
          }
          setPlaylist(sortedLocals);

          if (order.length > 0) {
            const firstInOrder = sortedLocals.find((t: any) => (t.fullName === order[0] || t.id === order[0]));
            if (firstInOrder) {
              initial = firstInOrder;
            }
          }

          if (!initial) {
            initial = sortedLocals[0];
          }
        }

        if (!initial) {
          // Fallback to database track
          const q = query(collection(db, 'tracks'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            initial = { id: snap.docs[0].id, ...data } as Track;
          }
        }

        if (initial) {
          setCurrentTrack(initial);
          setCurrentTime(0);
          setDuration(0);
          if (audioRef.current) {
            audioRef.current.src = initial.audioUrl;
            audioRef.current.autoplay = true;
            
            // Try autoplay right away
            const promise = audioRef.current.play();
            if (promise !== undefined) {
              playPromiseRef.current = promise;
              promise.then(() => {
                setIsPlaying(true);
              }).catch(err => {
                console.warn("[RADIO] Autoplay blocked, wait for user interaction helper:", err);
                
                // Play as soon as user interacts anywhere to bypass Google/Apple autoplay block
                const startPlayOnFirstInteraction = () => {
                  if (audioRef.current) {
                    audioRef.current.play()
                      .then(() => {
                        setIsPlaying(true);
                        cleanup();
                      })
                      .catch(e => console.warn("[RADIO] Still blocked on interaction:", e));
                  }
                };
                
                const cleanup = () => {
                  window.removeEventListener('click', startPlayOnFirstInteraction);
                  window.removeEventListener('touchstart', startPlayOnFirstInteraction);
                  window.removeEventListener('keydown', startPlayOnFirstInteraction);
                  window.removeEventListener('scroll', startPlayOnFirstInteraction);
                };
                
                window.addEventListener('click', startPlayOnFirstInteraction);
                window.addEventListener('touchstart', startPlayOnFirstInteraction);
                window.addEventListener('keydown', startPlayOnFirstInteraction);
                window.addEventListener('scroll', startPlayOnFirstInteraction);
              });
            }
          }
        }
      } catch (err) {
        console.error("[RADIO] Failed to load initial track on startup:", err);
      }
    };
    loadInitialTrack();

    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handleTrackEnd = () => {
    if (statesRef.current.radioMode) {
      nextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  const nextTrack = () => {
    const currentTrackVal = statesRef.current.currentTrack;
    const playlistVal = statesRef.current.playlist;
    
    // If we have an active playlist loaded, play sequentially!
    if (playlistVal && playlistVal.length > 0) {
      let currentIndex = -1;
      
      if (currentTrackVal) {
        currentIndex = playlistVal.findIndex(t => 
          t.fullName === currentTrackVal.fullName || 
          t.audioUrl === currentTrackVal.audioUrl ||
          (currentTrackVal.audioUrl && (currentTrackVal.audioUrl.endsWith('/' + t.fullName) || currentTrackVal.audioUrl.endsWith('/' + encodeURIComponent(t.fullName || ''))))
        );
      }
      
      const nextIndex = currentIndex !== -1 ? (currentIndex + 1) % playlistVal.length : 0;
      const nextTrackObj = playlistVal[nextIndex];
      console.log(`[RADIO] Playlist transition: moving to index ${nextIndex + 1}/${playlistVal.length} (${nextTrackObj.title || nextTrackObj.fullName})`);
      play(nextTrackObj);
      return;
    }

    // Default fallback if playlist is empty (should not happen since we initialize it on mount)
    console.warn("[RADIO] Playlist is empty in nextTrack");
  };

  const playRadioPlaylist = (list: Track[], startIndex: number = 0) => {
    if (!list || list.length === 0) return;
    setPlaylist(list);
    setRadioMode(true);
    const startTrack = list[startIndex];
    play(startTrack);
  };

  const play = (track: Track) => {
    if (audioRef.current) {
      audioRef.current.src = track.audioUrl;
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        playPromiseRef.current = promise;
        promise.catch(e => {
          if (e.name !== 'AbortError') {
            console.warn("Play error:", e);
          }
        });
      }
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (audioRef.current) audioRef.current.pause();
            })
            .catch(() => {
              if (audioRef.current) audioRef.current.pause();
            });
        } else {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        if (currentTrack) {
          const currentSrc = audioRef.current.src || '';
          if (!currentSrc || currentSrc === '' || !currentSrc.endsWith(currentTrack.audioUrl)) {
            audioRef.current.src = currentTrack.audioUrl;
          }
        }
        const promise = audioRef.current.play();
        if (promise !== undefined) {
          playPromiseRef.current = promise;
          promise.catch(e => {
            if (e.name !== 'AbortError') {
              console.warn("Play error:", e);
            }
          });
        }
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  return (
    <MusicContext.Provider value={{ 
      currentTrack, 
      isPlaying, 
      play, 
      togglePlay, 
      nextTrack, 
      radioMode, 
      setRadioMode, 
      isMuted, 
      toggleMute, 
      volume, 
      setVolume, 
      fadeVolume,
      currentTime,
      duration,
      seek,
      playlist,
      setPlaylist,
      playRadioPlaylist
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
