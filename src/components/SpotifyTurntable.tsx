import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Sliders, Radio, Music, Volume2, Disc, 
  VolumeX, Sparkles, ChevronRight, ChevronLeft, Info, Mic, MicOff, 
  Settings, AlertCircle, Check, HelpCircle, Share2, 
  ArrowDownRight, Instagram, X, Square, Circle, Download
} from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';

interface Track {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  isRadioInterstitial?: boolean;
}

const MUSICAL_SCALES = [
  { id: 'c-major', name: 'DO Mayor (C Major) - Feliz / Pop' },
  { id: 'a-minor', name: 'LA Menor (A Minor) - Nostálgico / Rap' },
  { id: 'g-major', name: 'SOL Mayor (G Major) - Energía / Trap' },
  { id: 'e-minor', name: 'MI Menor (E Minor) - Oscuro / Underground' },
  { id: 'd-major', name: 'RE Mayor (D Major) - Épico' },
  { id: 'b-minor', name: 'SI Menor (B Minor) - Misterioso / Drill' },
  { id: 'f-major', name: 'FA Mayor (F Major) - Cálido' }
];

export interface VocalPreset {
  id: string;
  name: string;
  description: string;
  autoTuneActive: boolean;
  retuneSpeed: number;
  delayWet: number;
  reverbWet: number;
  distortionAmount: number;
  lowEQ: number;
  midEQ: number;
  highEQ: number;
}

export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: 'voz-central',
    name: 'Voz Central (Rap/Trap)',
    description: 'Voz principal potente, presencia alta, afinación precisa con reverb y delay sutiles para liderar la canción.',
    autoTuneActive: true,
    retuneSpeed: 40,
    delayWet: 10,
    reverbWet: 15,
    distortionAmount: 5,
    lowEQ: 3,
    midEQ: 2,
    highEQ: 3
  },
  {
    id: 'dobles-adlibs',
    name: 'Dobles & Ad-libs',
    description: 'Para doblajes y apoyos callejeros. delay expansivo, reverb espacial y agudos crujientes para que flote lateralmente.',
    autoTuneActive: true,
    retuneSpeed: 25,
    delayWet: 50,
    reverbWet: 40,
    distortionAmount: 10,
    lowEQ: -4,
    midEQ: 4,
    highEQ: 6
  },
  {
    id: 'g-funk-vocoder',
    name: 'G-Funk Vocoder (West Coast)',
    description: 'Sonido robótico retro de la costa oeste. Emulación de vocoder sintetizado con alta saturación y corrección de 0ms.',
    autoTuneActive: true,
    retuneSpeed: 0,
    delayWet: 20,
    reverbWet: 25,
    distortionAmount: 65,
    lowEQ: -6,
    midEQ: 7,
    highEQ: -2
  },
  {
    id: 'boom-bap-punch',
    name: 'Boom Bap Punch (Voz Pura)',
    description: 'Sonido crudo analógico "No Autotune". Boost masivo de medios y graves saturados tipo cinta para rimas underground.',
    autoTuneActive: false,
    retuneSpeed: 100,
    delayWet: 0,
    reverbWet: 10,
    distortionAmount: 12,
    lowEQ: 5,
    midEQ: 6,
    highEQ: 2
  },
  {
    id: 'trap-extremo',
    name: 'Trap Extremo (T-Pain Flow)',
    description: 'Afinación digital ultra agresiva de 0ms con retardos rítmicos y brillo cristalino para club.',
    autoTuneActive: true,
    retuneSpeed: 0,
    delayWet: 35,
    reverbWet: 35,
    distortionAmount: 15,
    lowEQ: -2,
    midEQ: -2,
    highEQ: 8
  },
  {
    id: 'lofi-radio',
    name: 'Lo-Fi Radio & Tape',
    description: 'Filtro de bocina telefónica estrecha con cortes agresivos de frecuencias, delay largo analógico y distorsión cálida.',
    autoTuneActive: true,
    retuneSpeed: 70,
    delayWet: 55,
    reverbWet: 20,
    distortionAmount: 35,
    lowEQ: -12,
    midEQ: 12,
    highEQ: -12
  }
];

export default function SpotifyTurntable() {
  const { isPlaying: isGlobalRadioPlaying, togglePlay: toggleGlobalRadio, fadeVolume } = useMusic();
  const { user, profile } = useAuth();

  // --- AUDIO STATES FOR INSTRUMENTAL PLATING ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeBeat, setActiveBeat] = useState<Track | null>(null);
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [beatBpm, setBeatBpm] = useState(1.0); // Pitch slider: 0.6x to 1.4x speed
  const [beatVolume, setBeatVolume] = useState(70);
  const [loadingTracks, setLoadingTracks] = useState(true);

  // --- PRESET STATE ---
  const [currentPresetId, setCurrentPresetId] = useState('voz-central');

  // --- REAL-TIME VOCAL STUDIO STATES ---
  const [micActive, setMicActive] = useState(false);
  const [autoTuneActive, setAutoTuneActive] = useState(true);
  const [retuneSpeed, setRetuneSpeed] = useState(40); // 0 (T-Pain) to 100 (Natural) - Default Voz Central
  const [selectedScale, setSelectedScale] = useState('a-minor');
  const [reverbWet, setReverbWet] = useState(15); // 0 to 100 - Default Voz Central
  const [delayWet, setDelayWet] = useState(10); // 0 to 100 - Default Voz Central
  const [distortionAmount, setDistortionAmount] = useState(5); // 0 to 100 (Saturation) - Default Voz Central
  
  // Equalizer
  const [lowEQ, setLowEQ] = useState(3); // -12 to +12 dB - Default Voz Central
  const [midEQ, setMidEQ] = useState(2); // -12 to +12 dB
  const [highEQ, setHighEQ] = useState(3); // -12 to +12 dB
  
  const [micGain, setMicGain] = useState(80); // 0 to 100
  const [monitorVolume, setMonitorVolume] = useState(85); // 0 to 100
  
  // Real-time meters & feedback indicators (for display loop)
  const [detectedNote, setDetectedNote] = useState('SILENCE');
  const [pitchCentsError, setPitchCentsError] = useState(0);
  const [vocalInputLevel, setVocalInputLevel] = useState(0);
  const [vocalOutputLevel, setVocalOutputLevel] = useState(0);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);

  // --- PRESET ACTIONS (FL Studio style preset window) ---
  const applyPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setCurrentPresetId('custom');
      return;
    }
    const preset = VOCAL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setCurrentPresetId(presetId);
    setAutoTuneActive(preset.autoTuneActive);
    setRetuneSpeed(preset.retuneSpeed);
    setDelayWet(preset.delayWet);
    setReverbWet(preset.reverbWet);
    setDistortionAmount(preset.distortionAmount);
    setLowEQ(preset.lowEQ);
    setMidEQ(preset.midEQ);
    setHighEQ(preset.highEQ);
  };

  const handleNextPreset = () => {
    const currentIndex = VOCAL_PRESETS.findIndex(p => p.id === currentPresetId);
    let nextIndex = 0;
    if (currentIndex !== -1) {
      nextIndex = (currentIndex + 1) % VOCAL_PRESETS.length;
    }
    applyPreset(VOCAL_PRESETS[nextIndex].id);
  };

  const handlePrevPreset = () => {
    const currentIndex = VOCAL_PRESETS.findIndex(p => p.id === currentPresetId);
    let prevIndex = VOCAL_PRESETS.length - 1;
    if (currentIndex !== -1) {
      prevIndex = (currentIndex - 1 + VOCAL_PRESETS.length) % VOCAL_PRESETS.length;
    }
    applyPreset(VOCAL_PRESETS[prevIndex].id);
  };

  // --- INTERACTIVE ANNOTATED EXPLANATION OVERLAY STATE ---
  const [overlayDismissed, setOverlayDismissed] = useState(() => {
    return localStorage.getItem('raplife_vocal_tutorial_viewed') === 'true';
  });

  // --- PLAYLIST APPLICATION POPUP STATE ---
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [appArtistName, setAppArtistName] = useState('');
  const [appSpotifyLink, setAppSpotifyLink] = useState('');
  const [appSocialLink, setAppSocialLink] = useState('');
  const [appPitchMessage, setAppPitchMessage] = useState('');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);

  // --- VOCAL PRESETS DETAILED MODAL STATE ---
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  // --- REAL-TIME RECORDING ENGINE STATES ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [monitorActive, setMonitorActive] = useState(true); // Escucharse en vivo (Monitorización)
  const [isBouncing, setIsBouncing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const playbackSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Audio refs for Web Audio API graph
  const instrumentalAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const eqLowNodeRef = useRef<BiquadFilterNode | null>(null);
  const eqMidNodeRef = useRef<BiquadFilterNode | null>(null);
  const eqHighNodeRef = useRef<BiquadFilterNode | null>(null);
  const distortionNodeRef = useRef<WaveShaperNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainNodeRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbGainNodeRef = useRef<GainNode | null>(null);
  const mainVocalMixGainNodeRef = useRef<GainNode | null>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const playlistId = '1fYkTNZmwjgP3RkkRPhnsG'; // RapLife Spotify playlist

  // --- AUTO-FILL PLAYLIST SUBMISSIONS ON USER STATUS CHANGE ---
  useEffect(() => {
    if (profile) {
      setAppArtistName(profile.displayName || '');
      setAppSpotifyLink(profile.spotifyUrl || '');
      setAppSocialLink(profile.instagramUrl || '');
    } else if (user) {
      setAppArtistName(user.displayName || '');
    }
  }, [profile, user]);

  // --- 1. FETCH DATABASE SONGS AS INSTRUMENTALS / BEATS ---
  useEffect(() => {
    const fetchInstrumentals = async () => {
      try {
        let loadedTracks: Track[] = [];
        try {
          const q = query(
            collection(db, 'tracks'),
            where('isRadioInterstitial', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          const snap = await getDocs(q);
          loadedTracks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Track));
        } catch (queryErr) {
          console.warn("[TURNTABLE] Beats query failed (index missing), falling back to client-side sort:", queryErr);
          const qFallback = query(collection(db, 'tracks'), limit(100));
          const snapFallback = await getDocs(qFallback);
          loadedTracks = snapFallback.docs.map(d => ({ id: d.id, ...d.data() } as Track))
            .filter(t => t.isRadioInterstitial !== true);
          loadedTracks.sort((a, b) => {
            const timeA = (a as any).createdAt?.seconds || 0;
            const timeB = (b as any).createdAt?.seconds || 0;
            return timeB - timeA;
          });
          loadedTracks = loadedTracks.slice(0, 10);
        }
        setTracks(loadedTracks);
        
        if (loadedTracks.length > 0) {
          setActiveBeat(loadedTracks[0]);
        }
      } catch (err) {
        console.error("[STUDIO CONSOLE] Error fetching beats:", err);
      } finally {
        setLoadingTracks(false);
      }
    };
    fetchInstrumentals();
  }, []);

  // --- 2. INITIALIZE COMPACT INSTRUMENTAL AUDIO PLAYER ---
  useEffect(() => {
    instrumentalAudioRef.current = new Audio();
    instrumentalAudioRef.current.loop = true;
    instrumentalAudioRef.current.volume = beatVolume / 100;
    
    return () => {
      if (instrumentalAudioRef.current) {
        instrumentalAudioRef.current.pause();
        instrumentalAudioRef.current.src = '';
      }
    };
  }, []);

  // Update beat rate (playback speed)
  useEffect(() => {
    if (instrumentalAudioRef.current) {
      instrumentalAudioRef.current.playbackRate = beatBpm;
    }
  }, [beatBpm, activeBeatCustomTrigger()]);

  // Sync volume of the instrumental
  useEffect(() => {
    if (instrumentalAudioRef.current) {
      instrumentalAudioRef.current.volume = beatVolume / 100;
    }
  }, [beatVolume]);

  function activeBeatCustomTrigger() {
    return activeBeat ? activeBeat.id : '';
  }

  // Manage beat playback state
  useEffect(() => {
    if (!instrumentalAudioRef.current || !activeBeat) return;

    if (beatPlaying) {
      // Pause global radio when playing instrumental or recording vocal!
      if (isGlobalRadioPlaying) {
        fadeVolume(0, 1500);
      }

      if (instrumentalAudioRef.current.src !== activeBeat.audioUrl) {
        instrumentalAudioRef.current.src = activeBeat.audioUrl;
      }
      
      instrumentalAudioRef.current.playbackRate = beatBpm;
      instrumentalAudioRef.current.play()
        .catch(e => {
          console.warn("[STUDIO CONSOLE] Beat playback failed:", e);
          setBeatPlaying(false);
        });
    } else {
      instrumentalAudioRef.current.pause();
    }
  }, [beatPlaying, activeBeat]);

  const loadBeatIntoDeck = (track: Track) => {
    setBeatPlaying(false);
    if (instrumentalAudioRef.current) {
      instrumentalAudioRef.current.pause();
      instrumentalAudioRef.current.src = track.audioUrl;
    }
    setActiveBeat(track);
    setTimeout(() => {
      setBeatPlaying(true);
    }, 150);
  };

  // --- 3. WEB AUDIO VOICE SYNTHESIS DIRECT-SIGNAL PROCESSING (DSP) GRAPH ---
  const startVocalProcessing = async () => {
    try {
      setMicErrorMsg(null);

      // Gradually fade out live radio if playing
      if (isGlobalRadioPlaying) {
        await fadeVolume(0, 1500);
      }
      
      // Initialize AudioContext if not active
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });

      localStreamRef.current = stream;

      // 1. Microphone Source
      micSourceNodeRef.current = ctx.createMediaStreamSource(stream);

      // 2. Analysers for input/output metering
      analyserInputRef.current = ctx.createAnalyser();
      analyserInputRef.current.fftSize = 256;
      analyserOutputRef.current = ctx.createAnalyser();
      analyserOutputRef.current.fftSize = 256;

      // 3. Microphone Input Gain Node
      micGainNodeRef.current = ctx.createGain();
      micGainNodeRef.current.gain.value = micGain / 100;

      // 4. Equalizer Node Filters
      eqLowNodeRef.current = ctx.createBiquadFilter();
      eqLowNodeRef.current.type = 'lowshelf';
      eqLowNodeRef.current.frequency.value = 200; // Bass warmth
      eqLowNodeRef.current.gain.value = lowEQ;

      eqMidNodeRef.current = ctx.createBiquadFilter();
      eqMidNodeRef.current.type = 'peaking';
      eqMidNodeRef.current.frequency.value = 1500; // Presence / Clarity
      eqMidNodeRef.current.Q.value = 1.0;
      eqMidNodeRef.current.gain.value = midEQ;

      eqHighNodeRef.current = ctx.createBiquadFilter();
      eqHighNodeRef.current.type = 'highshelf';
      eqHighNodeRef.current.frequency.value = 6000; // Air / Sibilance
      eqHighNodeRef.current.gain.value = highEQ;

      // 5. Distortion / Saturation Wave Shaper
      distortionNodeRef.current = ctx.createWaveShaper();
      distortionNodeRef.current.curve = generateDistortionCurve(distortionAmount);
      distortionNodeRef.current.oversample = '4x';

      // 6. Delay Node Setup
      delayNodeRef.current = ctx.createDelay(1.5);
      delayNodeRef.current.delayTime.value = 0.35; // default 350ms echo
      delayGainNodeRef.current = ctx.createGain();
      delayGainNodeRef.current.gain.value = delayWet / 100;

      // Feed delay back into itself
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.3; // medium feedback loop
      delayNodeRef.current.connect(delayFeedback);
      delayFeedback.connect(delayNodeRef.current);

      // 7. Convolution Reverb Node
      reverbNodeRef.current = ctx.createConvolver();
      reverbNodeRef.current.buffer = getImpulseResponseBuffer(ctx, 1.8, 2.5);
      reverbGainNodeRef.current = ctx.createGain();
      reverbGainNodeRef.current.gain.value = reverbWet / 100;

      // 8. Main vocal track mixer
      mainVocalMixGainNodeRef.current = ctx.createGain();
      mainVocalMixGainNodeRef.current.gain.value = monitorVolume / 100;

      // --- ASSEMBLE GRAPH CONNECTIONS ---
      // Source -> Input Analyser -> Input Gain -> EQ Low -> EQ Mid -> EQ High -> Distortion input
      micSourceNodeRef.current.connect(analyserInputRef.current);
      analyserInputRef.current.connect(micGainNodeRef.current);
      
      micGainNodeRef.current.connect(eqLowNodeRef.current);
      eqLowNodeRef.current.connect(eqMidNodeRef.current);
      eqMidNodeRef.current.connect(eqHighNodeRef.current);
      
      // Parallel routing for effects
      eqHighNodeRef.current.connect(distortionNodeRef.current);
      
      // Route dry signal to main submix
      distortionNodeRef.current.connect(mainVocalMixGainNodeRef.current);

      // Route through Delay
      distortionNodeRef.current.connect(delayNodeRef.current);
      delayNodeRef.current.connect(delayGainNodeRef.current);
      delayGainNodeRef.current.connect(mainVocalMixGainNodeRef.current);

      // Route through Reverb
      distortionNodeRef.current.connect(reverbNodeRef.current);
      reverbNodeRef.current.connect(reverbGainNodeRef.current);
      reverbGainNodeRef.current.connect(mainVocalMixGainNodeRef.current);

      // Connect main submix to outputs and output analyser
      mainVocalMixGainNodeRef.current.connect(analyserOutputRef.current);
      analyserOutputRef.current.connect(ctx.destination);

      setMicActive(true);
      startVUVisualizationLoop();

    } catch (e: any) {
      console.warn("[VOCAL CONSOLE] Mic capture failed:", e);
      setMicErrorMsg("Permiso de micrófono bloqueado. Para activarlo: 1) Activa el micrófono para este sitio desde el candado de la barra de direcciones, o 2) Abre la app en una PESTAÑA NUEVA usando el botón en la esquina de la vista previa para eludir las restricciones de seguridad de iframes.");
      setMicActive(false);
    }
  };

  const stopVocalProcessing = () => {
    setMicActive(false);
    
    // Stop recording if active
    if (isRecording) {
      handleStopRecording();
    }
    
    // Stop playback of recording if active
    if (isPlayingRecording) {
      handleStopPlayback();
    }
    
    // Stop tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Disconnect Node Graph cleanly to avoid leaks
    try {
      micSourceNodeRef.current?.disconnect();
      micGainNodeRef.current?.disconnect();
      eqLowNodeRef.current?.disconnect();
      eqMidNodeRef.current?.disconnect();
      eqHighNodeRef.current?.disconnect();
      distortionNodeRef.current?.disconnect();
      delayNodeRef.current?.disconnect();
      delayGainNodeRef.current?.disconnect();
      reverbNodeRef.current?.disconnect();
      reverbGainNodeRef.current?.disconnect();
      mainVocalMixGainNodeRef.current?.disconnect();
    } catch (e) {
      // Ignored
    }
  };

  // --- REAL-TIME DRY VOCAL RECORDING & FX TUNING ACTIONS ---
  const handleStartRecording = async () => {
    try {
      setRecordedBlob(null);
      setRecordedBuffer(null);
      setIsPlayingRecording(false);
      playbackSourceNodeRef.current?.stop();

      // Ensure vocal processing is active
      if (!micActive) {
        await startVocalProcessing();
      }

      const stream = localStreamRef.current;
      if (!stream) {
        throw new Error("No microphone stream available.");
      }

      // Record DRY (raw) microphone audio so users can adjust/change slider effects post-recording!
      const options = { mimeType: 'audio/webm' };
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, options);
      } catch (err) {
        rec = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = rec;
      recordedChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      rec.onstop = async () => {
        const docBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setRecordedBlob(docBlob);

        if (audioContextRef.current) {
          const arrBuf = await docBlob.arrayBuffer();
          audioContextRef.current.decodeAudioData(arrBuf, (decodedBuf) => {
            setRecordedBuffer(decodedBuf);
          }, (decErr) => {
            console.error("Decoding error for recorded chunk:", decErr);
          });
        }
      };

      rec.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Failed to start voice recorder:", err);
      setMicErrorMsg("Error al iniciar el grabador de RapLife Studio: " + err.message);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleStartPlayback = () => {
    if (!recordedBuffer || !audioContextRef.current) return;

    handleStopPlayback();

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = recordedBuffer;

    // Connect right to the front-entry point of the active vocal effects path
    if (analyserInputRef.current) {
      sourceNode.connect(analyserInputRef.current);
    } else if (micGainNodeRef.current) {
      sourceNode.connect(micGainNodeRef.current);
    } else {
      sourceNode.connect(ctx.destination);
    }

    sourceNode.onended = () => {
      setIsPlayingRecording(false);
    };

    sourceNode.start(0);
    playbackSourceNodeRef.current = sourceNode;
    setIsPlayingRecording(true);
  };

  const handleStopPlayback = () => {
    if (playbackSourceNodeRef.current) {
      try {
        playbackSourceNodeRef.current.stop();
      } catch (err) {
        // Safe ended
      }
      playbackSourceNodeRef.current = null;
    }
    setIsPlayingRecording(false);
  };

  const [uploadingToRadio, setUploadingToRadio] = useState(false);

  const handleUploadToRadio = async () => {
    if (!recordedBuffer) return;
    
    // Choose a custom name
    const defaultVoiceName = `Locucion Vocal ${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}`;
    const customName = prompt(
      "Introduce un título/nombre para tu nota de voz en la radio (por ej: Locución de McFly, Mensaje Secreto):", 
      defaultVoiceName
    );
    if (customName === null) return; // User cancelled
    
    const sanitizedName = (customName.trim() || defaultVoiceName).replace(/[^a-zA-Z0-9\s-_]/g, '');
    const fileName = `${sanitizedName}.wav`;

    setUploadingToRadio(true);
    try {
      const duration = recordedBuffer.duration;
      const sampleRate = recordedBuffer.sampleRate;

      // Render the vocal *with* all processing sliders applied inside OfflineAudioContext!
      const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      const vocalSourceNode = offlineCtx.createBufferSource();
      vocalSourceNode.buffer = recordedBuffer;

      const inputGainNode = offlineCtx.createGain();
      inputGainNode.gain.value = micGain / 100;

      const lowEQFilter = offlineCtx.createBiquadFilter();
      lowEQFilter.type = 'lowshelf';
      lowEQFilter.frequency.value = 200;
      lowEQFilter.gain.value = lowEQ;

      const midEQFilter = offlineCtx.createBiquadFilter();
      midEQFilter.type = 'peaking';
      midEQFilter.frequency.value = 1500;
      midEQFilter.Q.value = 1.0;
      midEQFilter.gain.value = midEQ;

      const highEQFilter = offlineCtx.createBiquadFilter();
      highEQFilter.type = 'highshelf';
      highEQFilter.frequency.value = 6000;
      highEQFilter.gain.value = highEQ;

      const distNode = offlineCtx.createWaveShaper();
      distNode.curve = generateDistortionCurve(distortionAmount);
      distNode.oversample = '4x';

      // Delay Node setup
      const dNode = offlineCtx.createDelay(1.5);
      dNode.delayTime.value = 0.35;
      const dGainNode = offlineCtx.createGain();
      dGainNode.gain.value = delayWet / 100;

      const dFeedback = offlineCtx.createGain();
      dFeedback.gain.value = 0.3;
      dNode.connect(dFeedback);
      dFeedback.connect(dNode);

      // Reverb Node setup
      const rNode = offlineCtx.createConvolver();
      rNode.buffer = getImpulseResponseBuffer(offlineCtx as any, 1.8, 2.5);
      const rGainNode = offlineCtx.createGain();
      rGainNode.gain.value = reverbWet / 100;

      const outputSubmixNode = offlineCtx.createGain();
      outputSubmixNode.gain.value = 1.0; // max headroom output

      // Connect DSP graph
      vocalSourceNode.connect(inputGainNode);
      inputGainNode.connect(lowEQFilter);
      lowEQFilter.connect(midEQFilter);
      midEQFilter.connect(highEQFilter);
      highEQFilter.connect(distNode);

      // Dry sound to submix
      distNode.connect(outputSubmixNode);

      // Delay path
      distNode.connect(dNode);
      dNode.connect(dGainNode);
      dGainNode.connect(outputSubmixNode);

      // Reverb path
      distNode.connect(rNode);
      rNode.connect(rGainNode);
      rGainNode.connect(outputSubmixNode);

      // Direct to offline output rendering target
      outputSubmixNode.connect(offlineCtx.destination);

      vocalSourceNode.start(0);
      const renderedBuffer = await offlineCtx.startRendering();

      // Encode output AudioBuffer into CD-fidelity WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer);

      // Now map to a FormData and send to '/api/upload-radio-local'
      const formData = new FormData();
      formData.append('track', wavBlob, fileName);

      const res = await fetch('/api/upload-radio-local', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert(`🎙️ ¡Nota de voz "${sanitizedName}" inyectada con éxito en RapLife Radio! Ahora aparecerá en la playlist de la radio.`);
      } else {
        const errorData = await res.json();
        alert(`Error al inyectar nota de voz: ${errorData.error || 'error desconocido'}`);
      }
    } catch (err: any) {
      console.error("Master & radio upload error:", err);
      alert("Error al masterizar y guardar la nota de voz en la radio: " + err.message);
    } finally {
      setUploadingToRadio(false);
    }
  };

  const handleDownloadWithEffects = async () => {
    if (!recordedBuffer) return;
    setIsBouncing(true);

    try {
      const duration = recordedBuffer.duration;
      const sampleRate = recordedBuffer.sampleRate;

      // Render the vocal *with* all processing sliders applied inside OfflineAudioContext!
      const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      const vocalSourceNode = offlineCtx.createBufferSource();
      vocalSourceNode.buffer = recordedBuffer;

      const inputGainNode = offlineCtx.createGain();
      inputGainNode.gain.value = micGain / 100;

      const lowEQFilter = offlineCtx.createBiquadFilter();
      lowEQFilter.type = 'lowshelf';
      lowEQFilter.frequency.value = 200;
      lowEQFilter.gain.value = lowEQ;

      const midEQFilter = offlineCtx.createBiquadFilter();
      midEQFilter.type = 'peaking';
      midEQFilter.frequency.value = 1500;
      midEQFilter.Q.value = 1.0;
      midEQFilter.gain.value = midEQ;

      const highEQFilter = offlineCtx.createBiquadFilter();
      highEQFilter.type = 'highshelf';
      highEQFilter.frequency.value = 6000;
      highEQFilter.gain.value = highEQ;

      const distNode = offlineCtx.createWaveShaper();
      distNode.curve = generateDistortionCurve(distortionAmount);
      distNode.oversample = '4x';

      // Delay Node setup
      const dNode = offlineCtx.createDelay(1.5);
      dNode.delayTime.value = 0.35;
      const dGainNode = offlineCtx.createGain();
      dGainNode.gain.value = delayWet / 100;

      const dFeedback = offlineCtx.createGain();
      dFeedback.gain.value = 0.3;
      dNode.connect(dFeedback);
      dFeedback.connect(dNode);

      // Reverb Node setup
      const rNode = offlineCtx.createConvolver();
      rNode.buffer = getImpulseResponseBuffer(offlineCtx as any, 1.8, 2.5);
      const rGainNode = offlineCtx.createGain();
      rGainNode.gain.value = reverbWet / 100;

      const outputSubmixNode = offlineCtx.createGain();
      outputSubmixNode.gain.value = 1.0; // max headroom output

      // Connect DSP graph
      vocalSourceNode.connect(inputGainNode);
      inputGainNode.connect(lowEQFilter);
      lowEQFilter.connect(midEQFilter);
      midEQFilter.connect(highEQFilter);
      highEQFilter.connect(distNode);

      // Dry sound to submix
      distNode.connect(outputSubmixNode);

      // Delay path
      distNode.connect(dNode);
      dNode.connect(dGainNode);
      dGainNode.connect(outputSubmixNode);

      // Reverb path
      distNode.connect(rNode);
      rNode.connect(rGainNode);
      rGainNode.connect(outputSubmixNode);

      // Direct to offline output rendering target
      outputSubmixNode.connect(offlineCtx.destination);

      vocalSourceNode.start(0);
      const renderedBuffer = await offlineCtx.startRendering();

      // Encode output AudioBuffer into CD-fidelity WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer);
      const downloadUrl = URL.createObjectURL(wavBlob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `raplife_studio_${currentPresetId}_vocal.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

    } catch (err) {
      console.error("Master offline bounce error:", err);
      alert("Error al masterizar y exportar la grabación.");
    } finally {
      setIsBouncing(false);
    }
  };

  // --- DIRECT SYNC OF LIVE SLIDERS INTO RUNNING DSP GRAPH ---
  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = micGain / 100;
    }
  }, [micGain]);

  useEffect(() => {
    if (mainVocalMixGainNodeRef.current) {
      mainVocalMixGainNodeRef.current.gain.value = monitorActive ? (monitorVolume / 100) : 0;
    }
  }, [monitorVolume, monitorActive]);

  useEffect(() => {
    if (eqLowNodeRef.current) {
      eqLowNodeRef.current.gain.value = lowEQ;
    }
  }, [lowEQ]);

  useEffect(() => {
    if (eqMidNodeRef.current) {
      eqMidNodeRef.current.gain.value = midEQ;
    }
  }, [midEQ]);

  useEffect(() => {
    if (eqHighNodeRef.current) {
      eqHighNodeRef.current.gain.value = highEQ;
    }
  }, [highEQ]);

  useEffect(() => {
    if (distortionNodeRef.current) {
      distortionNodeRef.current.curve = generateDistortionCurve(distortionAmount);
    }
  }, [distortionAmount]);

  useEffect(() => {
    if (delayGainNodeRef.current) {
      delayGainNodeRef.current.gain.value = delayWet / 100;
    }
  }, [delayWet]);

  useEffect(() => {
    if (reverbGainNodeRef.current) {
      reverbGainNodeRef.current.gain.value = reverbWet / 100;
    }
  }, [reverbWet]);


  // --- 4. GRAPHICS VISUALIZATION LOOP (VU AND TUNER ERROR CORRECTION) ---
  const startVUVisualizationLoop = () => {
    if (!micActive && !analyserInputRef.current) return;

    const inputData = new Uint8Array(analyserInputRef.current?.frequencyBinCount || 128);
    const outputData = new Uint8Array(analyserOutputRef.current?.frequencyBinCount || 128);

    const updateLevels = () => {
      if (!analyserInputRef.current || !analyserOutputRef.current) return;

      analyserInputRef.current.getByteFrequencyData(inputData);
      analyserOutputRef.current.getByteFrequencyData(outputData);

      // Compute simple root mean square voltage levels
      let inSum = 0;
      let outSum = 0;
      for (let i = 0; i < inputData.length; i++) {
        inSum += inputData[i];
        outSum += outputData[i];
      }

      const inputVolPercent = inSum / inputData.length;
      const outputVolPercent = outSum / outputData.length;

      setVocalInputLevel(Math.min(100, Math.round((inputVolPercent / 128) * 100)));
      setVocalOutputLevel(Math.min(100, Math.round((outputVolPercent / 128) * 100)));

      // Simulate Note intervals during active voice mapping
      if (inputVolPercent > 35) {
        // High level voice input, display dynamic autotune keys!
        const scaleNotes = getScaleNotes(selectedScale);
        const randomNote = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        const octave = 3 + Math.floor(Math.random() * 2);
        setDetectedNote(`${randomNote}${octave}`);
        
        // Retune corrections cents error is inversely proportional to retune speed
        const offset = Math.round((Math.random() * 60 - 30) * (retuneSpeed / 100));
        setPitchCentsError(offset);
      } else {
        setDetectedNote('SILENCE');
        setPitchCentsError(0);
      }

      if (localStreamRef.current) {
        requestAnimationFrame(updateLevels);
      }
    };

    requestAnimationFrame(updateLevels);
  };

  // --- HELPERS FOR DSP REVERB BUFFER GENERATION & SATURATION ---
  function generateDistortionCurve(amount: number) {
    const k = amount + 5;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function getImpulseResponseBuffer(ctx: AudioContext, duration: number, decay: number) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const leftChan = buffer.getChannelData(0);
    const rightChan = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decayEnvelope = Math.pow(1 - i / length, decay);
      const randValueLeft = (Math.random() * 2 - 1) * decayEnvelope;
      const randValueRight = (Math.random() * 2 - 1) * decayEnvelope;
      leftChan[i] = randValueLeft;
      rightChan[i] = randValueRight;
    }
    return buffer;
  }

  function getScaleNotes(scaleId: string): string[] {
    switch (scaleId) {
      case 'c-major': return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      case 'a-minor': return ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      case 'g-major': return ['G', 'A', 'B', 'C', 'D', 'E', 'F#'];
      case 'e-minor': return ['E', 'F#', 'G', 'A', 'B', 'C', 'D'];
      case 'd-major': return ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'];
      case 'b-minor': return ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'];
      case 'f-major': return ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'];
      default: return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }
  }

  // --- DISMISS CAROUSEL TUTORIAL OVERLAY & MUTING/PAUSING RADIO ---
  const handleDismissOverlay = async () => {
    setOverlayDismissed(true);
    localStorage.setItem('raplife_vocal_tutorial_viewed', 'true');
    
    // Automatically mute or pause the global radio gradually!
    if (isGlobalRadioPlaying) {
      await fadeVolume(0, 1500); // 1.5 seconds smooth transition
    }
    
    // Auto initiate audio processor
    startVocalProcessing();
  };

  // --- 5. SPOTIFY PLAYLIST SUBMISSION HANDLER ---
  const handlePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appArtistName.trim() || !appSpotifyLink.trim()) {
      alert("Por favor rellena el nombre artístico y el enlace de Spotify.");
      return;
    }

    setAppSubmitting(true);
    try {
      await addDoc(collection(db, 'playlist_applications'), {
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || 'anonymous@gmail.com',
        artistName: appArtistName,
        spotifyLink: appSpotifyLink,
        socialNetworkLink: appSocialLink,
        pitchMessage: appPitchMessage,
        submittedAt: new Date().toISOString(),
        status: 'pending'
      });

      setAppSuccess(true);
      setTimeout(() => {
        setAppSuccess(false);
        setPlaylistModalOpen(false);
        setAppPitchMessage('');
      }, 3500);

    } catch (err: any) {
      console.error("[PLAYLIST APP] FireStore submit failure:", err);
      alert("No se pudo transmitir la solicitud. " + err.message);
    } finally {
      setAppSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      
      {/* EXPLANATORY HERO TITLE HEADER */}
      <div className="bg-gradient-to-r from-brand-yellow/10 via-black/40 to-brand-green/10 border-2 border-brand-yellow/20 rounded-[2rem] p-6 text-center max-w-6xl mx-auto backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <div className="p-3 bg-brand-yellow/10 rounded-full border border-brand-yellow/30 animate-pulse text-brand-yellow">
            <Sparkles size={24} />
          </div>
          <div className="text-center md:text-left space-y-1">
            <h3 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tight">
              🎙️ ESTUDIO PORTÁTIL RAPLIFE & SPOTIFY CONSOLE
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed max-w-3xl">
              ¡Hemos fusionado la radio con el ghetto! <strong className="text-brand-yellow">Aparca las mesas de mezcla tradicionales </strong> y sintoniza nuestro procesador de vocales inteligente. Carga tus bases e instrumentales de abajo, enciende tu micrófono en tiempo real, sintoniza tu <span className="text-brand-green font-bold font-mono">RAP LIFE TUNES</span> y escupe tus mejores rimas directo en los parlantes.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-950 border-4 border-boombox-gray rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden shadow-2xl boombox-texture max-w-6xl mx-auto">
        {/* Structural metal screws */}
        <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />
        <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-neutral-800 border-2 border-black" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch relative z-10">
          
          {/* LEFT: THE INTERACTIVE AUTOTUNE VOCAL STUDIO CONSOLE */}
          <div className="lg:col-span-7 flex flex-col items-center justify-between relative min-h-[500px]">
            
            {/* COMPACT BLURRED INTERACTION CONTAINER */}
            <div className={`w-full bg-neutral-900/90 p-5 md:p-6 rounded-[2rem] border-4 border-neutral-850 shadow-inner flex flex-col items-center gap-4 relative transition-all duration-700 ${
              !overlayDismissed ? 'blur-md pointer-events-none filter select-none' : ''
            }`}>
              
              {/* LCD CONSOLE HEADER & LED STATUS */}
              <div className="w-full flex justify-between items-center px-1 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${micActive ? 'bg-brand-green animate-pulse shadow-[0_0_8px_#39ff14]' : 'bg-red-655 shadow-[0_0_8px_rgba(239,68,68,0.4)]'} transition-colors duration-300`} />
                  <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 font-black">
                    {micActive ? 'CONSOLA GRABANDO / CAPTURANDO' : 'RAPLIFE STUDIO'}
                  </span>
                </div>
                <div className="lcd-display px-2.5 py-1 rounded-lg text-[10px] font-mono border border-black shadow-inner font-black text-brand-yellow">
                  CORRECTOR: {autoTuneActive ? 'RAP LIFE TUNE' : 'PASS'} / {MUSICAL_SCALES.find(s=>s.id===selectedScale)?.name.substring(0, 8)}
                </div>
              </div>

              {/* FL STUDIO PLUG-IN PRESET INTERFACE */}
              <div className="w-full bg-black/60 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5 text-left w-full sm:w-auto">
                  <div className="p-2 bg-brand-yellow/10 rounded-lg border border-brand-yellow/25 text-brand-yellow shrink-0">
                    <Sliders size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-mono tracking-widest font-black text-neutral-500 block uppercase">CONSOLA PRESETS (FL SYSTEM PRO)</span>
                    <span className="text-xs font-sans font-black text-white uppercase italic tracking-tight">
                      {currentPresetId === 'custom' ? '⚡ MEZCLA PERSONALIZADA' : `🎚️ ${VOCAL_PRESETS.find(p => p.id === currentPresetId)?.name}`}
                    </span>
                  </div>
                </div>

                {/* Navigation and list dropdown selector */}
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <button 
                    onClick={handlePrevPreset}
                    className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-brand-yellow hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
                    title="Anterior Preset"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button 
                    onClick={() => setShowPresetsModal(true)}
                    className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-lg py-1.5 px-3 text-[10px] font-mono font-black text-brand-yellow hover:text-white outline-none cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all shadow-md uppercase tracking-wider grow sm:grow-0 justify-center min-w-[150px]"
                  >
                    <Sliders size={11} className="text-brand-yellow" />
                    <span>VER PRESETS 🎚️</span>
                  </button>

                  <button 
                    onClick={handleNextPreset}
                    className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-brand-yellow hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
                    title="Siguiente Preset"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              
              {/* PRESET DESCRIPTION DECAL */}
              {currentPresetId !== 'custom' && (
                <div className="w-full px-2 text-left -mt-1">
                  <p className="text-[9px] text-gray-400 leading-snug font-bold font-mono">
                    💡 <span className="text-brand-yellow uppercase">EFECTO:</span> {VOCAL_PRESETS.find(p => p.id === currentPresetId)?.description}
                  </p>
                </div>
              )}

              {/* VOCAL CONTROL DASHBOARD PANELS */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* INTERACTIVE CONTROLLER PANEL A (RAP LIFE TUNE) */}
                <div className="bg-black/40 p-4 border border-white/5 rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <Settings className="text-brand-yellow" size={12} />
                    <span className="text-[10px] font-mono font-black uppercase text-gray-300">RAP LIFE TUNES</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Scale Selector */}
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest block font-mono">ESCALA MUSICAL TRAP/RAP</label>
                      <select 
                        className="w-full bg-neutral-900 border border-neutral-800 p-2 rounded-lg text-xs font-mono text-brand-yellow font-black focus:border-brand-yellow outline-none"
                        value={selectedScale}
                        onChange={(e) => setSelectedScale(e.target.value)}
                      >
                        {MUSICAL_SCALES.map((scale) => (
                          <option key={scale.id} value={scale.id} className="bg-neutral-900">{scale.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Retune Speed fader */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest font-mono">VELOCIDAD AFINADOR</span>
                        <span className="text-[9px] font-mono text-brand-yellow font-black">{retuneSpeed}ms</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8.5px] font-black text-brand-green select-none pointer-events-none font-mono">ROBOT</span>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="5"
                          className="flex-grow accent-brand-yellow h-1 bg-black rounded-lg cursor-pointer"
                          value={retuneSpeed}
                          onChange={(e) => {
                            setRetuneSpeed(parseInt(e.target.value));
                            setCurrentPresetId('custom');
                          }}
                        />
                        <span className="text-[8.5px] font-black text-white select-none pointer-events-none font-mono">SUAVE</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={() => {
                        setAutoTuneActive(!autoTuneActive);
                        setCurrentPresetId('custom');
                      }}
                      className={`w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                        autoTuneActive 
                          ? 'bg-brand-yellow hover:bg-white text-black font-black' 
                          : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-400'
                      }`}
                    >
                      {autoTuneActive ? '🟢 RAP LIFE TUNE ENCENDIDO' : '🔴 RAP LIFE TUNE APAGADO'}
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE CONTROLLER PANEL B (ANALOG EFFECTS) */}
                <div className="bg-black/40 p-4 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <Sliders className="text-brand-green" size={12} />
                    <span className="text-[10px] font-mono font-black uppercase text-gray-300">EFECTOS ANALÓGICOS (FX)</span>
                  </div>

                  {/* Delay fader */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-black tracking-tighter">
                      <span className="text-neutral-500 uppercase">ECO / DELAY (REPETIDOR)</span>
                      <span className="text-brand-green">{delayWet}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      className="w-full accent-brand-green h-1 bg-black rounded-lg cursor-pointer"
                      value={delayWet}
                      onChange={(e) => {
                        setDelayWet(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                  </div>

                  {/* Reverb fader */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-black tracking-tighter">
                      <span className="text-neutral-500 uppercase font-mono">REVERB (CÁMARA DE ARENA)</span>
                      <span className="text-brand-green">{reverbWet}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      className="w-full accent-brand-green h-1 bg-black rounded-lg cursor-pointer"
                      value={reverbWet}
                      onChange={(e) => {
                        setReverbWet(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                  </div>

                  {/* Distortion fader */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-black tracking-tighter">
                      <span className="text-neutral-500 uppercase">DISTORSIÓN CALLEJERA</span>
                      <span className="text-brand-green">{distortionAmount}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      className="w-full accent-brand-green h-1 bg-black rounded-lg cursor-pointer"
                      value={distortionAmount}
                      onChange={(e) => {
                        setDistortionAmount(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                  </div>
                </div>

              </div>

              {/* THREE BAND EQ SECTION */}
              <div className="w-full bg-black/45 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-widest text-center">ECUALIZADOR ACÚSTICO DE TRIPLE BANDA</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center space-y-1.5">
                    <span className="text-[8px] font-mono text-gray-500 font-bold">GRAVES (LOW)</span>
                    <input 
                      type="range" 
                      min="-12" 
                      max="12" 
                      step="1"
                      className="accent-brand-yellow h-24 -rotate-180 cursor-pointer"
                      style={{ writingMode: 'vertical-lr' } as any}
                      value={lowEQ}
                      onChange={(e) => {
                        setLowEQ(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                    <span className="text-[9px] font-mono text-brand-yellow font-black">{lowEQ > 0 ? `+${lowEQ}` : lowEQ}dB</span>
                  </div>

                  <div className="flex flex-col items-center space-y-1.5">
                    <span className="text-[8px] font-mono text-gray-500 font-bold">MEDIOS (MID)</span>
                    <input 
                      type="range" 
                      min="-12" 
                      max="12" 
                      step="1"
                      className="accent-brand-yellow h-24 -rotate-180 cursor-pointer"
                      style={{ writingMode: 'vertical-lr' } as any}
                      value={midEQ}
                      onChange={(e) => {
                        setMidEQ(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                    <span className="text-[9px] font-mono text-brand-yellow font-black">{midEQ > 0 ? `+${midEQ}` : midEQ}dB</span>
                  </div>

                  <div className="flex flex-col items-center space-y-1.5">
                    <span className="text-[8px] font-mono text-gray-500 font-bold">AGUDOS (HIGH)</span>
                    <input 
                      type="range" 
                      min="-12" 
                      max="12" 
                      step="1"
                      className="accent-brand-yellow h-24 -rotate-180 cursor-pointer"
                      style={{ writingMode: 'vertical-lr' } as any}
                      value={highEQ}
                      onChange={(e) => {
                        setHighEQ(parseInt(e.target.value));
                        setCurrentPresetId('custom');
                      }}
                    />
                    <span className="text-[9px] font-mono text-brand-yellow font-black">{highEQ > 0 ? `+${highEQ}` : highEQ}dB</span>
                  </div>
                </div>
              </div>

              {/* SIGNAL VISUAL DISPLAY ROOM */}
              <div className="w-full bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex items-center justify-between gap-4">
                
                {/* Note LCD monitor */}
                <div className="flex flex-col space-y-1 select-none">
                  <span className="text-[7.5px] font-mono text-neutral-500 uppercase tracking-widest font-black">NOTA DETECTADA EN MIC</span>
                  <div className="lcd-display text-lg font-mono font-black text-center w-28 py-2 border-2 border-black rounded-lg uppercase shadow-lg select-none">
                    {detectedNote}
                  </div>
                </div>

                {/* Pitch Error needle simulation */}
                <div className="flex-1 flex flex-col justify-center space-y-1">
                  <div className="flex justify-between items-center text-[7.5px] font-mono text-neutral-500 font-black">
                    <span>CORRECCIÓN -50c</span>
                    <span>TUNE ACTIVO</span>
                    <span>CORRECCIÓN +50c</span>
                  </div>
                  <div className="relative h-6 bg-black rounded-lg overflow-hidden border border-neutral-900 flex items-center">
                    {/* Centered zero line */}
                    <div className="absolute left-1/2 -translate-x-1/2 h-full w-0.5 bg-neutral-700 pointer-events-none" />
                    
                    {/* Moving Needle */}
                    {detectedNote !== 'SILENCE' && (
                      <motion.div 
                        className="absolute h-full w-1 bg-brand-green shadow-[0_0_8px_#39ff14] origin-bottom"
                        style={{ left: `calc(50% + ${pitchCentsError}% - 2px)` }}
                        animate={{ scaleY: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 0.3 }}
                      />
                    )}
                    
                    {/* Grid indices */}
                    <div className="absolute inset-0 flex justify-between px-4 pointer-events-none text-[8px] font-mono text-neutral-800 select-none">
                      <span>||</span>
                      <span>||</span>
                      <span>||</span>
                      <span>||</span>
                      <span>||</span>
                    </div>
                  </div>
                </div>

                {/* VU METERS INSIDE DISPLAY */}
                <div className="flex flex-col space-y-1.5 w-16 shrink-0">
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center text-[6px] font-mono font-black text-gray-500">
                      <span>IN VU</span>
                      <span>{vocalInputLevel}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black rounded shadow-inner overflow-hidden flex">
                      <div 
                        className="h-full bg-brand-yellow transition-all duration-75"
                        style={{ width: `${vocalInputLevel}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center text-[6px] font-mono font-black text-gray-500">
                      <span>OUT VU</span>
                      <span>{vocalOutputLevel}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black rounded shadow-inner overflow-hidden flex">
                      <div 
                        className="h-full bg-brand-green transition-all duration-75"
                        style={{ width: `${vocalOutputLevel}%` }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* BEAT STREAM SUBPLAYER (Rap Over This Beat) */}
              {activeBeat ? (
                <div className="w-full flex items-center justify-between gap-4 p-3 bg-neutral-950 rounded-2xl border-2 border-neutral-850">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-neutral-800 rounded-lg overflow-hidden shrink-0 border border-white/5 relative group">
                      <img src={activeBeat.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=100&auto=format&fit=crop'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-brand-yellow/10" />
                    </div>
                    <div className="min-w-0 text-left">
                      <span className="text-[7.5px] font-mono font-black text-brand-green uppercase tracking-wider block">BASE INSTRUMENTAL ACTIVA</span>
                      <h4 className="font-extrabold italic uppercase text-xs text-white truncate leading-snug">{activeBeat.title}</h4>
                      <p className="text-[9px] text-gray-500 uppercase font-black tracking-tight">{activeBeat.artistName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Speed slider BPM */}
                    <div className="hidden sm:flex flex-col items-end min-w-[100px] pr-2 border-r border-white/5">
                      <div className="flex justify-between w-full text-[7.5px] font-mono text-neutral-500 font-bold uppercase">
                        <span>BPM AJUST</span>
                        <span className="text-brand-yellow">x{beatBpm.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.7" 
                        max="1.3" 
                        step="0.05"
                        className="w-full accent-brand-yellow h-0.5 bg-neutral-900 rounded"
                        value={beatBpm}
                        onChange={(e) => setBeatBpm(parseFloat(e.target.value))}
                      />
                    </div>

                    {/* Volume instrumental */}
                    <div className="hidden sm:flex flex-col items-end min-w-[70px] pr-2 border-r border-white/5">
                      <div className="flex justify-between w-full text-[7.5px] font-mono text-neutral-500 font-bold uppercase">
                        <span>VOL BEAT</span>
                        <span className="text-brand-green">{beatVolume}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        className="w-full accent-brand-green h-0.5 bg-neutral-900 rounded"
                        value={beatVolume}
                        onChange={(e) => setBeatVolume(parseInt(e.target.value))}
                      />
                    </div>

                    <button 
                      onClick={() => setBeatPlaying(!beatPlaying)}
                      className={`h-10 px-4 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 ${
                        beatPlaying 
                          ? 'bg-red-650 text-white hover:bg-red-600' 
                          : 'bg-brand-green text-black hover:bg-white shadow-[0_0_12px_rgba(57,255,20,0.15)]'
                      }`}
                    >
                      {beatPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                      <span>{beatPlaying ? 'PARAR BEAT' : 'HACER SONAR BEAT'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full py-2 bg-black/40 text-center rounded-xl font-mono text-[9px] text-gray-400">
                  CARGA UN BEAT INSTRUMENTAL DE LA COLECCIÓN DE ABAJO
                </div>
              )}

              {/* DYNAMIC RECORD CONTROLS FOR LOCAL FEEDBACK & RECORDING DECK */}
              <div className="w-full border-t border-neutral-850 pt-4 space-y-4 px-1 text-left">
                {/* TOP DECK ROW: VOICE VOLUME & REAL-TIME MONITOR SWITCH */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-neutral-400">VOLUMEN DE TU VOZ (MIC)</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Mic size={12} className="text-brand-yellow" />
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        className="accent-brand-yellow h-1 bg-black rounded cursor-pointer w-28 sm:w-36"
                        value={micGain}
                        onChange={(e) => setMicGain(parseInt(e.target.value))}
                      />
                      <span className="text-[10px] font-mono text-neutral-500 font-bold">{micGain}%</span>
                    </div>
                  </div>

                  {/* MONITOR TOGGLE (HEAR IT LIVE) */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setMonitorActive(!monitorActive)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-mono font-black uppercase tracking-widest cursor-pointer border active:scale-95 transition-all ${
                        monitorActive 
                          ? 'bg-brand-green/15 text-brand-green border-brand-green/30 hover:bg-brand-green/25' 
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-750'
                      }`}
                      title="Activa o desactiva escucharte a ti mismo en tus bocinas o auriculares"
                    >
                      {monitorActive ? '🟢 ESCUCHARME EN VIVO' : '🔴 ESCUCHARME DESACTIVADO'}
                    </button>
                    
                    {/* Live microphone trigger */}
                    <button 
                      onClick={() => {
                        if (micActive) {
                          stopVocalProcessing();
                        } else {
                          startVocalProcessing();
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-lg font-mono text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95 border ${
                        micActive 
                          ? 'bg-neutral-800 text-red-500 border-red-500/20 hover:bg-neutral-750' 
                          : 'bg-neutral-900 text-brand-yellow border-neutral-800 hover:bg-black/60 font-black'
                      }`}
                    >
                      {micActive ? <MicOff size={10} className="inline mr-1" /> : <Mic size={10} className="inline mr-1" />}
                      <span>{micActive ? 'APAGAR MIC' : 'PROBAR MIC'}</span>
                    </button>
                  </div>
                </div>

                {/* BOTTOM DECK ROW: RECORDING ENGINE AND TAKE CONTROLLERS */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* RECORD BUTTON */}
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={`px-5 py-3 rounded-xl font-mono text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 w-full md:w-auto ${
                        isRecording 
                          ? 'bg-red-600 text-white animate-pulse shadow-[0_0_12px_rgba(220,38,38,0.5)] border border-red-700' 
                          : 'bg-brand-yellow text-black hover:bg-white shadow-glow'
                      }`}
                    >
                      <Circle size={10} fill={isRecording ? "currentColor" : "none"} className={isRecording ? 'animate-ping' : ''} />
                      <span>{isRecording ? `DETENER GRABACIÓN (${recordingSeconds}s)` : 'GRABAR MI VOZ 🎙️'}</span>
                    </button>
                  </div>

                  {/* CAPTURED TAKE PLAYBACK & EXPORT DIRECT TO WAV BUTTONS */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto justify-end">
                    {recordedBuffer ? (
                      <>
                        {/* Playback dry buffer through dynamic faders */}
                        <button
                          onClick={isPlayingRecording ? handleStopPlayback : handleStartPlayback}
                          className={`px-4 py-2.5 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                            isPlayingRecording 
                              ? 'bg-brand-green text-black hover:bg-white' 
                              : 'bg-neutral-900 text-white border border-neutral-800 hover:bg-neutral-800'
                          }`}
                        >
                          {isPlayingRecording ? <Square size={9} fill="currentColor" /> : <Play size={9} fill="currentColor" />}
                          <span>{isPlayingRecording ? 'PARAR REPRODUCCIÓN' : 'ESCUCHAR GRABACIÓN 🎧'}</span>
                        </button>

                        {/* Offline Render mix and download WAV */}
                        <button
                          onClick={handleDownloadWithEffects}
                          disabled={isBouncing}
                          className="px-4 py-2.5 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-yellow to-brand-green text-black disabled:opacity-50"
                        >
                          <Download size={10} />
                          <span>{isBouncing ? 'MASTERIZANDO VOZ...' : 'DESCARGAR AUDIO CON EFECTOS ✨'}</span>
                        </button>

                        {/* Direct save to RapLife Radio Playlist */}
                        <button
                          onClick={handleUploadToRadio}
                          disabled={uploadingToRadio || isBouncing}
                          className="px-4 py-2.5 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 bg-black border border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 disabled:opacity-50"
                          title="Inyecta esta locución masterizada directamente como un archivo local en la playlist de la radio"
                        >
                          <Radio size={10} />
                          <span>{uploadingToRadio ? 'SUBIENDO...' : 'INYECTAR EN RAPLIFE RADIO 📻'}</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[9.5px] font-mono text-neutral-500 uppercase font-black tracking-wider text-center w-full">
                        {isRecording ? 'Capturando tu voz pura (limpia/sin latencia)...' : 'Presiona GRABAR para capturar una toma de voz'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {micErrorMsg && (
                <div className="w-full bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center text-[10px] font-bold text-red-500 flex items-center justify-center gap-2 uppercase tracking-wide">
                  <AlertCircle size={13} />
                  <span>{micErrorMsg}</span>
                </div>
              )}

            </div>

            {/* HANDWRITTEN ANNOTATED GUIDE OVERLAY (Displayed when overlayDismissed is false) */}
            <AnimatePresence>
              {!overlayDismissed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/85 rounded-[2rem] p-6 z-50 flex flex-col items-center justify-center text-center select-none overflow-hidden backdrop-blur-md"
                >
                  <div className="absolute inset-0 bg-brand-yellow/[0.02] pointer-events-none" />

                  {/* Absolute Explanatory Handwritten Tags pointing in direction of original components */}
                  <div className="w-full max-w-xl relative h-full flex flex-col justify-between py-2 text-brand-yellow font-handwritten">
                    
                    {/* Annotation Top Right pointing to LCD */}
                    <div className="absolute top-[8%] right-[2%] text-right max-w-[190px] bg-neutral-900/90 p-2.5 rounded-xl border border-brand-yellow/30 shadow-2xl">
                      <p className="text-sm md:text-base leading-tight font-bold">
                        🎼 EL TONO CORRECTO
                      </p>
                      <p className="text-xs md:text-sm text-gray-300 leading-snug mt-0.5">
                        Elige la escala de tu base instrumental para que cada verso rime en perfecta armonía.
                      </p>
                      <div className="text-brand-yellow text-xs mt-1 font-sans font-black flex items-center justify-end">
                        <span>Apunta aquí</span> <ArrowDownRight size={10} className="inline ml-1" />
                      </div>
                    </div>

                    {/* Annotation Mid Left pointing to AutoTune speed */}
                    <div className="absolute top-[35%] left-[1%] text-left max-w-[195px] bg-neutral-900/90 p-2.5 rounded-xl border border-brand-yellow/30 shadow-2xl">
                      <p className="text-sm md:text-base leading-tight font-bold">
                        🤖 EFECTO T-PAIN PRO
                      </p>
                      <p className="text-xs md:text-sm text-gray-300 leading-snug mt-0.5">
                        Lleva la velocidad a 0ms para un flow robótico extremo o 80ms para un retoque sutil callejero.
                      </p>
                    </div>

                    {/* Annotation Mid Right pointing to FX controllers */}
                    <div className="absolute top-[38%] right-[1%] text-right max-w-[180px] bg-neutral-900/90 p-2.5 rounded-xl border border-brand-yellow/30 shadow-2xl">
                      <p className="text-sm md:text-base leading-tight font-bold">
                        🎚️ MIX ANALÓGICO
                      </p>
                      <p className="text-xs md:text-sm text-gray-300 leading-snug mt-0.5">
                        Satura tu voz con distorsiones, añade eco metálico y reverbs espaciales para grabaciones gordas.
                      </p>
                    </div>

                    {/* Main Centered Box with large GO buttons */}
                    <div className="m-auto text-center space-y-6 pt-16 z-20">
                      <div className="space-y-1 bg-black/60 p-5 rounded-2xl border-2 border-brand-yellow/40 shadow-glow">
                        <span className="px-3.5 py-1 bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow text-[9.5px] font-sans font-black uppercase tracking-widest rounded-full inline-block mb-1.5">
                          CONSOLA ESTUDIO VOCAL RAPLIFE
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black italic uppercase text-white font-sans tracking-tight">
                          ¿PREPARADO PARA RAPEAR?
                        </h2>
                        <p className="text-xs text-gray-400 font-sans font-bold uppercase tracking-widest mt-1.5 leading-relaxed">
                          La consola capturará tu micrófono para procesarlo en vivo. Al arrancar, <strong className="text-brand-yellow">el reproductor de radio global se pausará automáticamente</strong> para evitar molestias o interferencias de sonido.
                        </p>
                      </div>

                      <button
                        onClick={handleDismissOverlay}
                        className="px-14 py-5 bg-brand-yellow hover:bg-white text-black font-black font-sans italic text-lg uppercase tracking-tight rounded-2xl hover:scale-105 active:scale-95 shadow-glow transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                      >
                        <Sparkles size={18} /> GO / EMPEZAR AHORA
                      </button>
                    </div>

                    {/* Annotation Bottom Left pointing to micro toggle */}
                    <div className="absolute bottom-[2%] left-[2%] text-left max-w-[190px] bg-neutral-900/90 p-2.5 rounded-xl border border-brand-yellow/30 shadow-2xl">
                      <p className="text-sm md:text-base leading-tight font-bold">
                        🎙️ ACTIVA SU MICRO
                      </p>
                      <p className="text-xs md:text-sm text-gray-300 leading-snug mt-0.5">
                        Presiona para dar el permiso de micrófono e iniciar el sintetizador live de tu voz.
                      </p>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* RIGHT: SPOTIFY PLAYLIST WITH FLOATING CLAY CONTAINER & SUBMIT FORM */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5 relative">
            
            {/* Spotify Playlist Frame container */}
            <div className="flex-grow h-[310px] md:h-full min-h-[310px]">
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

            {/* COMBINED SPOTIFY & SUBMISSIONS TRIGGERS */}
            <div className="grid grid-cols-1 gap-2 shrink-0">
              <a
                href={`https://open.spotify.com/playlist/${playlistId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 bg-[#1DB954] hover:bg-[#1ed760] hover:scale-[1.01] active:scale-95 text-black font-black uppercase text-[10px] tracking-wider py-3.5 px-4 rounded-xl shadow-md transition-all text-center"
              >
                <Music size={13} fill="black" />
                ABRIR PLAYLIST SP
              </a>

              {/* BRAND-NEW PLAYLIST APPLICATION BUTTON UNDER PLAYLIST */}
              <button
                onClick={() => setPlaylistModalOpen(true)}
                className="flex items-center justify-center gap-2.5 bg-[#111] hover:bg-neutral-900 text-brand-yellow hover:text-white border-2 border-brand-yellow/20 hover:border-brand-yellow active:scale-95 font-black uppercase text-[10px] tracking-wider py-3.5 px-4 rounded-xl transition-all cursor-pointer text-center"
              >
                <Share2 size={13} />
                POSTULAR MI CANCIÓN A PLAYLIST SP
              </button>
            </div>

          </div>

        </div>

        {/* BOTTOM: INSTRUMENTAL COLLECTION FOR SESSIONS (VIRTUAL TRACKS RECORD CABINET) */}
        <div className="mt-10 border-t border-neutral-800 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-left">
              <Disc className="text-brand-yellow animate-spin" size={18} style={{ animationDuration: '4s' }} />
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-white font-black">
                💿 COLECCIÓN DE INSTRUMENTALES & RITMOS DE APOYO (RAPLIFE COMPILACIÓN)
              </h3>
            </div>
          </div>

          {loadingTracks ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-t-brand-yellow border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <p className="font-mono text-[10px] text-gray-500 uppercase">REBUSCANDO CAJONES DE VINILO...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-8 text-center text-gray-500 font-mono text-[10px] uppercase border border-dashed border-neutral-800 rounded-2xl">
              TODAVÍA NO HAY INSTRUMENTALES DISPONIBLES EN EL ESTUDIO
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tracks.map((t) => {
                const isActive = activeBeat?.id === t.id;
                return (
                  <div 
                    key={t.id} 
                    onClick={() => loadBeatIntoDeck(t)}
                    className={`relative p-3 bg-neutral-900 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                      isActive 
                        ? 'border-brand-yellow shadow-[0_0_12px_rgba(248,251,2,0.15)] bg-neutral-850 scale-[0.98]' 
                        : 'border-white/5 hover:border-white/10 hover:bg-neutral-850'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 z-10 shadow-md">
                      <img 
                        src={t.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop'} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        alt=""
                      />
                      
                      {/* Visual overlay popping out of sleeve */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-brand-yellow text-black text-[8px] font-black uppercase py-1 px-2.5 rounded-full scale-90 group-hover:scale-100 transition-transform">
                          {isActive ? 'PROCESANDO' : 'CARGAR RITMO'}
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

      {/* MODAL / POP-UP PORTAL: APPLY FOR PLAYLIST */}
      <AnimatePresence>
        {playlistModalOpen && (
          <div className="fixed inset-0 bg-black/85 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border-4 border-boombox-gray rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl relative p-6 md:p-8 boombox-texture select-none"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-5 text-left">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-brand-yellow text-black rounded-lg">
                    <Music size={16} />
                  </span>
                  <h3 className="font-black italic uppercase text-lg text-white">SUBMIT A PLAYLIST SP</h3>
                </div>
                <button 
                  onClick={() => setPlaylistModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {appSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center space-y-4"
                >
                  <div className="p-4 bg-brand-green/15 text-brand-green rounded-full border border-brand-green/25 w-fit mx-auto animate-bounce">
                    <Check size={40} />
                  </div>
                  <h4 className="text-xl font-black italic uppercase text-brand-yellow tracking-tight">¡SOLICITUD ENVIADA!</h4>
                  <p className="text-[#a5a5a5] text-xs font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                    Tus credenciales y links se han enviado al comité ejecutivo de RapLife Records. Evaluaremos tu audio y te notificaremos si eres integrado.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handlePlaylistSubmit} className="space-y-4 text-left">
                  
                  {/* Info notice */}
                  <div className="bg-brand-yellow/10 border border-brand-yellow/20 p-3.5 rounded-lg text-xs leading-relaxed text-[#c4c4c4] font-semibold uppercase tracking-tight flex items-start gap-2.5">
                    <Info size={14} className="text-brand-yellow mt-0.5 shrink-0" />
                    <p>
                      Somete tu material de Spotify directo al equipo curador. Si estás logueado y guardas Spotify link en <strong className="text-brand-yellow">"Mi Perfil"</strong>, se auto-llenará de inmediato.
                    </p>
                  </div>

                  {/* Artist public name */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black tracking-widest text-[#6c6c6c] uppercase">NOMBRE DEL ARTISTA / AKA *</label>
                    <input 
                      type="text"
                      className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl uppercase font-mono text-xs text-white focus:border-brand-yellow outline-none font-bold"
                      placeholder="Ej. Mac Flyer MC"
                      value={appArtistName}
                      onChange={e => setAppArtistName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Spotify URL */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black tracking-widest text-[#6c6c6c] uppercase">LINK DE LA CANCIÓN / ARTISTA EN SPOTIFY *</label>
                    <input 
                      type="url"
                      className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl font-mono text-xs text-white focus:border-brand-yellow outline-none"
                      placeholder="https://open.spotify.com/track/..."
                      value={appSpotifyLink}
                      onChange={e => setAppSpotifyLink(e.target.value)}
                      required
                    />
                  </div>

                  {/* Other networks URL */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black tracking-widest text-[#6c6c6c] uppercase">OTRO ENLACE / INSTAGRAM (OPCIONAL)</label>
                    <input 
                      type="url"
                      className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl font-mono text-xs text-white focus:border-brand-yellow outline-none"
                      placeholder="https://instagram.com/tuusuario"
                      value={appSocialLink}
                      onChange={e => setAppSocialLink(e.target.value)}
                    />
                  </div>

                  {/* Pitch msg */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black tracking-widest text-[#6c6c6c] uppercase">PROPUESTA / ¿POR QUÉ DEBERÍAS ESTAR? (OPCIONAL)</label>
                    <textarea 
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-sans text-xs text-neutral-300 focus:border-brand-yellow outline-none h-20 resize-none font-medium text-left"
                      placeholder="Cuéntanos un poco sobre tu tema o lanzamiento..."
                      value={appPitchMessage}
                      onChange={e => setAppPitchMessage(e.target.value)}
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setPlaylistModalOpen(false)}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-xs rounded-xl"
                    >
                      CANCELAR
                    </button>
                    <button 
                      type="submit"
                      disabled={appSubmitting}
                      className="flex-1 py-4 bg-brand-yellow text-black hover:bg-white font-black uppercase text-xs rounded-xl shadow-glow disabled:opacity-50"
                    >
                      {appSubmitting ? 'TRANSMITIENDO...' : 'SOMETER SOLICITUD ✨'}
                    </button>
                  </div>

                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VOCAL PRESETS DETAILED POPUP MODAL */}
      <AnimatePresence>
        {showPresetsModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border-4 border-neutral-800 p-6 rounded-3xl max-w-2xl w-full shadow-2xl relative text-left font-sans my-8"
            >
              <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />

              {/* Header */}
              <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-5">
                <div className="p-2 bg-brand-yellow/10 text-brand-yellow leading-none flex items-center justify-center rounded-lg pr-2.5">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-yellow glow-yellow leading-none">
                    PRESETS DE VOZ RAPLIFE STUDIO
                  </h3>
                  <p className="text-[9px] text-gray-400 font-mono font-black uppercase tracking-widest mt-1">
                    Afinación militar y modelado de espacio analógico en un clic
                  </p>
                </div>
                <button 
                  onClick={() => setShowPresetsModal(false)}
                  className="ml-auto text-gray-400 hover:text-white p-1 hover:bg-black/20 rounded-md transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
                {VOCAL_PRESETS.map((preset) => (
                  <div 
                    key={preset.id}
                    onClick={() => {
                      applyPreset(preset.id);
                      setShowPresetsModal(false);
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden ${
                      currentPresetId === preset.id 
                        ? 'bg-brand-yellow/10 border-brand-yellow shadow-glow' 
                        : 'bg-black/40 border-white/5 hover:border-brand-yellow/50 hover:bg-black/60'
                    }`}
                  >
                    {/* Background neon accent */}
                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl -mr-6 -mt-6 transition-opacity opacity-20 ${
                      currentPresetId === preset.id ? 'bg-brand-yellow' : 'bg-brand-green'
                    }`} />

                    <div className="space-y-1 bg-transparent relative z-10 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black uppercase italic text-white group-hover:text-brand-yellow transition-colors truncate">
                          {preset.name}
                        </h4>
                        {currentPresetId === preset.id && (
                          <span className="bg-brand-yellow text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold leading-relaxed line-clamp-2">
                        {preset.description}
                      </p>
                    </div>

                    {/* Parameters specs readout */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/5 font-mono text-[8px] text-neutral-500 font-black tracking-tighter uppercase relative z-10">
                      <div>
                        TUNE: <span className={preset.autoTuneActive ? "text-brand-green" : "text-neutral-600"}>{preset.autoTuneActive ? 'ACTIVE' : 'OFF'}</span>
                      </div>
                      <div>
                        REVERB: <span className="text-white">{preset.reverbWet}%</span>
                      </div>
                      <div>
                        DELAY: <span className="text-white">{preset.delayWet}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-5 text-center leading-normal">
                💡 Consejo: Después de elegir un preset, puedes retocar libremente cualquier ajuste de distorsión, eco o ecualizador en la consola principal para perfeccionar tu sonido.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- WAV AUDIO BUFFER ENCODING UTILITIES ---
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = 16-bit PCM integer
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, bufferLength, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
