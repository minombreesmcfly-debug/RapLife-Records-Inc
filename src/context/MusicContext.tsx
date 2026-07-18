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
  const skipTimeoutRef = useRef<any>(null);
  const [songsPlayedCount, setSongsPlayedCount] = useState(0);
  const trackFailureCountsRef = useRef<Map<string, number>>(new Map());

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

  const setupAudioListeners = (audio: HTMLAudioElement) => {
    audio.onended = () => {
      handleTrackEnd();
    };

    audio.onerror = (e) => {
      const err = audio.error;
      const failedSrc = audio.src || '';
      
      // If there is no error object, or if it is an aborted load (code 1), do NOT trigger auto-skip.
      if (!err || err.code === 1) {
        return;
      }
      
      console.error("[RADIO] Audio element error occurred:", err.code, err.message, "for source:", failedSrc);
      
      // Implement a circuit breaker / failure retry logic
      const normFailed = failedSrc.toLowerCase().trim();
      const failCount = (trackFailureCountsRef.current.get(normFailed) || 0) + 1;
      trackFailureCountsRef.current.set(normFailed, failCount);

      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
      
      // If it failed more than twice, auto-skip. Otherwise, retry playing once after a tiny delay.
      if (failCount >= 2) {
        console.warn(`[RADIO] Source ${failedSrc} failed ${failCount} times. Auto-skipping to avoid loop.`);
        skipTimeoutRef.current = setTimeout(() => {
          nextTrack();
        }, 2000);
      } else {
        console.log(`[RADIO] Source ${failedSrc} failed once. Retrying play in 1.5s...`);
        skipTimeoutRef.current = setTimeout(() => {
          audio.load();
          audio.play().catch(pe => console.warn("[RADIO] Retry play failed:", pe.message));
        }, 1500);
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.ondurationchange = () => {
      setDuration(audio.duration || 0);
    };

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };
  };

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    setupAudioListeners(audio);

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
          
          // Premium de-duplication by both normalized URL and normalized Title
          const normalizeUrl = (u: string) => {
            if (!u) return '';
            let decoded = decodeURIComponent(u).toLowerCase().trim();
            if (decoded.startsWith('/')) {
              decoded = decoded.slice(1);
            }
            return decoded;
          };

          const seenNormalizedUrls = new Set<string>();
          const seenNormalizedTitles = new Set<string>();
          const deDuplicatedLocals: Track[] = [];

          const addTrackUnique = (t: Track) => {
            const normUrl = normalizeUrl(t.audioUrl || '');
            const normTitle = (t.title || '').toLowerCase().trim();
            
            if (normUrl && seenNormalizedUrls.has(normUrl)) {
              return;
            }
            if (normTitle && seenNormalizedTitles.has(normTitle)) {
              if (normTitle !== '') {
                return;
              }
            }

            if (normUrl) seenNormalizedUrls.add(normUrl);
            if (normTitle) seenNormalizedTitles.add(normTitle);
            deDuplicatedLocals.push(t);
          };

          locals.forEach(addTrackUnique);
          dbTracks.forEach(addTrackUnique);

          locals = deDuplicatedLocals;
        } catch (dbErr) {
          console.warn("[RADIO] Approved/legacy db tracks fetch error:", dbErr);
        }

        // 3. Fallback to premium default tracks if both disk and db collections are empty
        if (!locals || locals.length === 0) {
          locals = [
            {
              id: 'default_track_raplife_records',
              title: 'Ghetto Anthem',
              artistId: 'mcfly',
              artistName: 'McFly',
              audioUrl: '/assets/radio/RapLife Records (1).mp3',
              coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop',
              isRadioInterstitial: false,
              fullName: 'RapLife Records (1).mp3'
            },
            {
              id: 'default_track_soundhelix_1',
              title: 'SoundHelix Orbit Beat',
              artistId: 'raplife_records',
              artistName: 'RAPLIFE RADIO',
              audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              coverUrl: '/assets/player_idle.png',
              isRadioInterstitial: false,
              fullName: 'SoundHelix-Song-1.mp3'
            }
          ];
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
          try {
            // Fallback to database track
            const q = query(collection(db, 'tracks'), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const data = snap.docs[0].data();
              initial = { id: snap.docs[0].id, ...data } as Track;
            }
          } catch (offlineErr) {
            console.warn("[RADIO] Could not fetch fallback database track offline:", offlineErr);
          }
        }

        if (!initial) {
          initial = {
            id: 'fallback_raplife_radio_promo',
            title: 'Sintonizando Emisión RapLife',
            artistId: 'raplife_records',
            artistName: 'RAPLIFE RADIO',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            coverUrl: '/assets/player_idle.png',
            isRadioInterstitial: false,
            fullName: 'Sintonizando Emisión RapLife'
          } as Track;
        }

        if (initial) {
          if (skipTimeoutRef.current) {
            clearTimeout(skipTimeoutRef.current);
            skipTimeoutRef.current = null;
          }
          setCurrentTrack(initial);
          setPlaylist(prev => {
            if (prev.length === 0) {
              return [initial!];
            }
            return prev;
          });
          setCurrentTime(0);
          setDuration(0);
          if (audioRef.current) {
            audioRef.current.src = initial.audioUrl;
            audioRef.current.autoplay = true;
            setIsPlaying(true);

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log("[RADIO] Inline unmuted autoplay succeeded.");
                })
                .catch(err => {
                  console.warn("[RADIO] Direct unmuted autoplay failed. Registering interaction gesture fallbacks.", err.message);
                  
                  // Setup interactive gesture handlers because of strict browser user-interaction autoplay rules
                  const handleUserGestureToPlay = () => {
                    if (audioRef.current) {
                      audioRef.current.play()
                        .then(() => {
                          console.log("[RADIO] Gestured unmuted autoplay resumed successfully.");
                          removeGestures();
                        })
                        .catch(gestureErr => {
                          console.warn("[RADIO] Gesture playback attempt failed:", gestureErr.message);
                        });
                    } else {
                      removeGestures();
                    }
                  };

                  const removeGestures = () => {
                    window.removeEventListener('click', handleUserGestureToPlay);
                    window.removeEventListener('touchstart', handleUserGestureToPlay);
                    window.removeEventListener('keydown', handleUserGestureToPlay);
                  };

                  window.addEventListener('click', handleUserGestureToPlay);
                  window.addEventListener('touchstart', handleUserGestureToPlay);
                  window.addEventListener('keydown', handleUserGestureToPlay);
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
        currentIndex = playlistVal.findIndex(t => {
          const tDecoded = decodeURIComponent(t.audioUrl || '').toLowerCase();
          const curDecoded = decodeURIComponent(currentTrackVal.audioUrl || '').toLowerCase();
          return t.fullName === currentTrackVal.fullName || 
                 t.audioUrl === currentTrackVal.audioUrl ||
                 tDecoded === curDecoded ||
                 (currentTrackVal.audioUrl && (
                   currentTrackVal.audioUrl.endsWith('/' + t.fullName) || 
                   currentTrackVal.audioUrl.endsWith('/' + encodeURIComponent(t.fullName || '')) ||
                   curDecoded.endsWith('/' + (t.fullName || '').toLowerCase())
                 ));
        });
      }
      
      let nextIndex = currentIndex !== -1 ? (currentIndex + 1) % playlistVal.length : 0;
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
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = null;
    }

    // User is manually playing this track, clear any recorded failures for it
    const normUrl = (track.audioUrl || '').toLowerCase().trim();
    trackFailureCountsRef.current.delete(normUrl);
    if (normUrl.startsWith('/')) {
      trackFailureCountsRef.current.delete(normUrl.slice(1));
    } else {
      trackFailureCountsRef.current.delete('/' + normUrl);
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.ondurationchange = null;
      audioRef.current.onloadedmetadata = null;
    }

    const audio = new Audio();
    audioRef.current = audio;
    audio.muted = isMuted;

    // Restore volume to 100% on fresh play action if it was faded to 0 (to stay self-healing and audible)
    if (volume === 0) {
      audio.volume = 1.0;
      setVolumeState(1.0);
    } else {
      audio.volume = volume;
    }

    setupAudioListeners(audio);

    audio.src = track.audioUrl;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);

    const promise = audio.play();
    if (promise !== undefined) {
      playPromiseRef.current = promise;
      promise.catch(e => {
        if (e.name !== 'AbortError') {
          console.warn("Play error:", e);
        }
      });
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
          const decodedSrc = decodeURIComponent(currentSrc);
          const decodedTrackUrl = decodeURIComponent(currentTrack.audioUrl);
          
          if (!currentSrc || currentSrc === '' || (!decodedSrc.endsWith(decodedTrackUrl) && !currentSrc.endsWith(currentTrack.audioUrl))) {
            audioRef.current.src = currentTrack.audioUrl;
          }
        }

        // Restore volume to 100% on play action if it was faded to 0
        if (audioRef.current.volume === 0 || volume === 0) {
          audioRef.current.volume = 1.0;
          setVolumeState(1.0);
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
