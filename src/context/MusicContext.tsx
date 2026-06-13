import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Track {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  isRadioInterstitial?: boolean;
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

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      handleTrackEnd();
    };
    audioRef.current.onerror = (e) => {
      const err = audioRef.current?.error;
      console.warn("[RADIO] Audio element error occurred:", err?.code, err?.message);
    };

    // Auto-load an initial track and autoplay
    const loadInitialTrack = async () => {
      try {
        let initial: Track | null = null;
        
        // Try to load any local radio track first
        const localRes = await fetch('/api/radio-local-songs');
        if (localRes.ok) {
          const locals = await localRes.json();
          if (locals && locals.length > 0) {
            initial = locals[0];
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
    if (radioMode) {
      nextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  const nextTrack = async () => {
    // Logic: Pick a random song. Every 2-3 songs, pick an interstitial if available.
    let next: Track | null = null;
    
    const shouldPlayInterstitial = songsPlayedCount > 0 && songsPlayedCount % 2 === 0;

    // Fetch local files in real-time
    let currentLocalTracks: Track[] = [];
    try {
      const res = await fetch('/api/radio-local-songs');
      if (res.ok) {
        currentLocalTracks = await res.json();
      }
    } catch (e) {
      console.error("[RADIO] Error fetching local tracks in nextTrack:", e);
    }

    if (shouldPlayInterstitial) {
      const dbInterstitials: Track[] = [];
      try {
        const q = query(collection(db, 'tracks'), where('isRadioInterstitial', '==', true), limit(10));
        const snap = await getDocs(q);
        snap.forEach(d => {
          dbInterstitials.push({ id: d.id, ...d.data() } as Track);
        });
      } catch (err) {
        console.error("Error fetching db interstitials:", err);
      }

      const activeInterstitials = [...dbInterstitials, ...currentLocalTracks];
      if (activeInterstitials.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeInterstitials.length);
        next = activeInterstitials[randomIndex];
        setSongsPlayedCount(0); // Reset after interstitial
      }
    }

    if (!next) {
      const dbTracks: Track[] = [];
      try {
        const q = query(collection(db, 'tracks'), where('isRadioInterstitial', '==', false), limit(25));
        const snap = await getDocs(q);
        snap.forEach(d => {
          dbTracks.push({ id: d.id, ...d.data() } as Track);
        });
      } catch (err) {
        console.error("Error fetching db tracks:", err);
      }

      const activeTracks = [...dbTracks, ...currentLocalTracks];
      if (activeTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeTracks.length);
        next = activeTracks[randomIndex];
        setSongsPlayedCount(prev => prev + 1);
      }
    }

    if (next) {
      play(next);
    }
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
    <MusicContext.Provider value={{ currentTrack, isPlaying, play, togglePlay, nextTrack, radioMode, setRadioMode, isMuted, toggleMute, volume, setVolume, fadeVolume }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
