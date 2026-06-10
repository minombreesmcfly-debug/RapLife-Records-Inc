import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { 
  Upload, Sparkles, RefreshCw, Undo, ArrowLeft, Check, 
  AlertTriangle, Download, Trash2, Image as ImageIcon, 
  Shirt, Eye, Save, User, Info, HelpCircle, ChevronRight, CheckCircle2,
  Mic, MicOff, Play, Square, Circle, Sliders, Music, Volume2, VolumeX, Disc, HelpCircle as Help
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Dual-Delay line pitch shifter helper class
class DelayLinePitchShifter {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private size: number;
  private phase: number = 0;

  constructor(size: number = 16384) {
    this.size = size;
    this.buffer = new Float32Array(size);
  }

  process(input: Float32Array, output: Float32Array, pitchRatio: number) {
    if (Math.abs(pitchRatio - 1.0) < 0.005) {
      output.set(input);
      return;
    }

    const n = input.length;
    for (let i = 0; i < n; i++) {
      const x = input[i];
      this.buffer[this.writeIndex] = x;

      this.phase += (1.0 - pitchRatio) / 4096;
      if (this.phase >= 1.0) this.phase -= 1.0;
      if (this.phase < 0.0) this.phase += 1.0;

      const phase1 = this.phase;
      const phase2 = (this.phase + 0.5) % 1.0;

      const maxDelay = 1200;
      const delay1 = phase1 * maxDelay;
      const delay2 = phase2 * maxDelay;

      const tap1 = this.readTap(this.writeIndex - delay1);
      const tap2 = this.readTap(this.writeIndex - delay2);

      const gain1 = Math.sin(phase1 * Math.PI);
      const gain2 = Math.sin(phase2 * Math.PI);

      output[i] = (tap1 * gain1 + tap2 * gain2);

      this.writeIndex = (this.writeIndex + 1) % this.size;
    }
  }

  private readTap(index: number): number {
    while (index < 0) index += this.size;
    const indexInt = Math.floor(index) % this.size;
    const frac = index - Math.floor(index);
    const nextIndex = (indexInt + 1) % this.size;
    return this.buffer[indexInt] * (1.0 - frac) + this.buffer[nextIndex] * frac;
  }
}

// Static pitch/note utilities
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const frequencyToMidi = (f: number): number => {
  return Math.round(69 + 12 * Math.log2(f / 440));
};

const midiToFrequency = (midi: number): number => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const getNoteName = (midi: number): string => {
  return NOTE_NAMES[midi % 12];
};

const snapToScale = (midi: number, scaleIntervals: number[]): number => {
  const octave = Math.floor(midi / 12);
  const noteInOctave = midi % 12;

  let closestVal = scaleIntervals[0];
  let minDiff = Math.abs(noteInOctave - scaleIntervals[0]);
  
  for (const val of scaleIntervals) {
    const diff = Math.abs(noteInOctave - val);
    if (diff < minDiff) {
      minDiff = diff;
      closestVal = val;
    }
    const diffAbove = Math.abs(noteInOctave - (val + 12));
    if (diffAbove < minDiff) {
      minDiff = diffAbove;
      closestVal = val; 
    }
    const diffBelow = Math.abs(noteInOctave - (val - 12));
    if (diffBelow < minDiff) {
      minDiff = diffBelow;
      closestVal = val;
    }
  }

  return octave * 12 + closestVal;
};

const makeDistortionCurve = (amount: number): Float32Array => {
  const k = typeof amount === 'number' ? amount : 30;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = Math.tanh(x * (k / 15 + 1));
  }
  return curve;
};

const createReverbImpulseResponse = (context: AudioContext, duration: number, decay: number): AudioBuffer => {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const percent = i / length;
    const decayFactor = Math.exp(-percent * decay);
    left[i] = (Math.random() * 2 - 1) * decayFactor;
    right[i] = (Math.random() * 2 - 1) * decayFactor;
  }
  return impulse;
};

const SCALES = [
  { id: 'chromatic', name: 'Chromatic / Libre', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'c-major', name: 'C Major (Diatónica)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'c-minor', name: 'C Minor (Natural)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'c-pentatonic-m', name: 'C Pentatónica Mayor', intervals: [0, 2, 4, 7, 9] },
  { id: 'c-pentatonic-min', name: 'C Pentatónica Menor', intervals: [0, 3, 5, 7, 10] },
  { id: 'c-blues', name: 'C Blues Rap', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'a-minor', name: 'A Minor Classic', intervals: [9, 11, 0, 2, 4, 5, 7] },
];

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.012) {
    return -1; 
  }

  const minOffset = Math.floor(sampleRate / 1000); 
  const maxOffset = Math.floor(sampleRate / 50);   

  const correlations = new Float32Array(maxOffset);
  for (let offset = minOffset; offset < maxOffset; offset++) {
    let correlation = 0;
    for (let i = 0; i < maxOffset; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
    correlations[offset] = correlation;
  }

  let peak = -1;
  let peakValue = -1;
  for (let offset = minOffset; offset < maxOffset; offset++) {
    if (correlations[offset] > peakValue) {
      peakValue = correlations[offset];
      peak = offset;
    }
  }

  if (peak > 0) {
    return sampleRate / peak;
  }
  return -1;
}

interface PredefinedOutfit {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  filename: string;
  fallbackUrl: string;
}

const PREDEFINED_OUTFITS: PredefinedOutfit[] = [
  // HOMBRE / MALE
  {
    id: 'outfit_m1',
    name: 'RapLife Classic Hoodie',
    gender: 'male',
    description: 'Chaqueta acolchada negra clásica con el logo bordado de RapLife Records en el pecho, sudadera con capucha amarilla debajo, vaqueros estilo hip-hop anchos negros y tenis retro amarillos.',
    filename: 'outfit_m1.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_m2',
    name: 'RapLife Ghetto Champion',
    gender: 'male',
    description: 'Sudadera oversize retro gris con estampado frontal "RapLife Records", cadena de eslabones plateada gruesa de rapero, pantalones cargo beige sueltos y tenis deportivos blancos de suela alta.',
    filename: 'outfit_m2.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_m3',
    name: 'RapLife Golden Blackout',
    gender: 'male',
    description: 'Camiseta negra holgada urbana de algodón con la tipografía oficial RapLife Records bordada en hilos de oro, pantalones técnicos estilo utilitario negros con múltiples bolsillos y gorra snapback ajustada.',
    filename: 'outfit_m3.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_m4',
    name: 'RapLife Windbreaker Vandal',
    gender: 'male',
    description: 'Cortavientos deportivo impermeable de bloques de color negro, gris y morado con branding vintage de RapLife Records en la espalda, pantalones de chándal a juego y gorro de lana urbana negro.',
    filename: 'outfit_m4.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=300&auto=format&fit=crop'
  },
  // MUJER / FEMALE
  {
    id: 'outfit_f1',
    name: 'RapLife Queen Crop',
    gender: 'female',
    description: 'Sudadera recortada (crop hoodie) color beige con letras doradas premium de RapLife Records en la capucha, top corto interior blanco, shorts ciclistas de tiro alto en negro y zapatillas gorpcore.',
    filename: 'outfit_f1.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_f2',
    name: 'RapLife Satin Varsity',
    gender: 'female',
    description: 'Chaqueta universitaria varsity de satén negro brillante con mangas blancas y el escudo oficial redondo de RapLife bordado en la espalda, top ceñido blanco, vaqueros holgados desgastados de corte skater.',
    filename: 'outfit_f2.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_f3',
    name: 'RapLife Ghetto Jumpsuit',
    gender: 'female',
    description: 'Mono deportivo entero ajustado de chándal estilo callejero de color verde militar, con decoraciones con cierres y letras RapLife amarillas impresas en el costado izquierdo del pecho, gorra de béisbol negra.',
    filename: 'outfit_f3.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'outfit_f4',
    name: 'RapLife Velvet Velvet',
    gender: 'female',
    description: 'Camiseta de manga corta morada aterciopelada oversized con estampa icónica RapLife Boombox en el frente, joggers de chándal sueltos de felpa morados y tenis retro blancos.',
    filename: 'outfit_f4.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=300&auto=format&fit=crop'
  }
];

const StudioView = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [accepted, setAccepted] = useState<boolean>(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<'male' | 'female'>('male');
  const [selectedOutfit, setSelectedOutfit] = useState<PredefinedOutfit | null>(null);
  const [isOutfitModified, setIsOutfitModified] = useState(false);

  // IA process states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // --- VOCAL STUDIO NEW STATES & TUNINGS ---
  const [activeTab, setActiveTab] = useState<'vocal' | 'avatar'>('vocal');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [monitoring, setMonitoring] = useState<boolean>(false);
  const [bufferSize, setBufferSize] = useState<number>(4096);
  const [scaleId, setScaleId] = useState<string>('c-major');
  const [retuneSpeed, setRetuneSpeed] = useState<number>(75);
  const [bypassPitch, setBypassPitch] = useState<boolean>(false);
  const [lowCut, setLowCut] = useState<boolean>(true);
  const [eqLow, setEqLow] = useState<number>(2);     // +2dB low punch
  const [eqMid, setEqMid] = useState<number>(1);     // +1dB vocals
  const [eqHigh, setEqHigh] = useState<number>(3);   // +3dB air crispness
  const [compressorThreshold, setCompressorThreshold] = useState<number>(-24);
  const [compressorRatio, setCompressorRatio] = useState<number>(4);
  const [saturationAmount, setSaturationAmount] = useState<number>(30); // valve drive
  const [delayFeedback, setDelayFeedback] = useState<number>(0.35);
  const [delayTime, setDelayTime] = useState<number>(0.32);
  const [delayWet, setDelayWet] = useState<number>(0.15);
  const [reverbWet, setReverbWet] = useState<number>(0.18);
  const [inputLevel, setInputLevel] = useState<number>(1.0);
  const [monitorVol, setMonitorVol] = useState<number>(0.75);

  // Live pitch display and levels (decoupled from direct fast renders)
  const [detectedNote, setDetectedNote] = useState<string>('SILENCE');
  const [detectedPitch, setDetectedPitch] = useState<number>(0);
  const [vuInputLevel, setVuInputLevel] = useState<number>(0);
  const [vuOutputLevel, setVuOutputLevel] = useState<number>(0);

  // Recording Takes States
  const [recording, setRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedTakes, setRecordedTakes] = useState<{id: string, url: string, blob: Blob, duration: number, timestamp: string, name: string}[]>([]);

  // Refs for Web Audio persistence
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const hpFilterRef = useRef<BiquadFilterNode | null>(null);
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const waveShaperRef = useRef<WaveShaperNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const submixGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const inputGainRef = useRef<GainNode | null>(null);

  // Mutable refs for high speed audio process calculations
  const latestNoteRef = useRef<string>('SILENCE');
  const latestPitchRef = useRef<number>(0);
  const latestInputVuRef = useRef<number>(0);
  const latestOutputVuRef = useRef<number>(0);
  const pitchShifterRef = useRef<DelayLinePitchShifter | null>(null);

  useEffect(() => {
    if (profile) {
      setAccepted(profile.acceptedEcosystem || false);
      setSelfie(profile.avatarSelfieUrl || null);
      setAvatarUrl(profile.avatarUrl || null);
    }
  }, [profile]);

  // Convert image url to base64 helper
  const getBase64FromUrl = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn("Could not load image reference as base64, proceeding with description prompt only", err);
      return null;
    }
  };

  const handleDeclineEcosystem = () => {
    if (window.confirm('¿Seguro de rechazar el ecosistema? Si omites, volverás a la Radio, pero puedes configurarlo cuando quieras.')) {
      navigate('/');
    }
  };

  const handleAcceptEcosystem = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingStep('Activando tu perfil en el ecosistema digital de RapLife...');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        acceptedEcosystem: true,
        updatedAt: serverTimestamp()
      });
      setAccepted(true);
    } catch (err: any) {
      console.error(err);
      alert('Error activando ecosistema: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Process selfie file upload in workarea
  const handleSelfieSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelfie(event.target?.result as string);
        setAvatarUrl(null); // Clear previous generated avatar when new selfie is set
        setSelectedOutfit(null);
        setErrorText(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI Outfit Try-On
  const handleApplyTryon = async () => {
    if (!selfie) {
      alert('Primero debes subir tu selfie o foto real.');
      return;
    }
    if (!selectedOutfit) {
      alert('Selecciona un outfit pre-diseñado para aplicártelo.');
      return;
    }

    setLoading(true);
    setLoadingStep('Llamando al motor inteligente de cambio de vestuario de Gemini (Try-on)...');
    setErrorText(null);

    try {
      // 1. Intentamos cargar la imagen real del outfit si está subida, para mandarla como referencia multimodal
      const localOutfitPath = `/assets/outfits/${selectedOutfit.filename}`;
      let clothesBase64 = await getBase64FromUrl(localOutfitPath);
      let clothesMime = 'image/png';

      // 2. Armar la petición para el endpoint
      const payload = {
        image: selfie,
        mimeType: 'image/jpeg',
        people: [
          {
            id: 'actor',
            label: 'Mi Foto',
            description: 'La persona en primer o medio plano a la que se le debe cambiar la ropa de forma idéntica.',
            originalOutfit: 'Ropa original',
            newOutfit: selectedOutfit.description,
            ...(clothesBase64 ? { clothesImage: clothesBase64, clothesImageMime: clothesMime } : {})
          }
        ]
      };

      const response = await fetch('/api/studio/render-outfits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(profile?.geminiApiKey ? { 'x-gemini-api-key': profile.geminiApiKey } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo generar tu nueva ropa. Revisa los detalles.');
      }

      const responseData = await response.json();
      if (responseData.image) {
        setAvatarUrl(responseData.image);
        setIsOutfitModified(true);
      } else {
        throw new Error('El servidor de Inteligencia Artificial no devolvió el archivo final.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Error de conexión con el motor IA.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Save official digital avatar config to profile
  const handleSaveOfficialAvatar = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingStep('Guardando la configuración oficial de tu Avatar RapLife en la nube...');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        avatarUrl: avatarUrl || selfie, // Si no aplicó IA todavía, guarda su selfie base
        avatarSelfieUrl: selfie,
        acceptedEcosystem: true,
        hasAvatar: true,
        updatedAt: serverTimestamp()
      });
      setIsOutfitModified(false);
      alert('¡Excelente! Tu Avatar RapLife se ha guardado de manera oficial. Ahora formas parte de nuestra red de artistas digitales.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando avatar: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Clean / reset photo workspace
  const handleResetWorkspace = () => {
    if (window.confirm('¿Quieres cambiar tu foto base y limpiar tu lienzo de diseño?')) {
      setSelfie(null);
      setAvatarUrl(null);
      setSelectedOutfit(null);
      setErrorText(null);
      setIsOutfitModified(false);
    }
  };

  // Download Avatar File safely
  const downloadAvatar = () => {
    const activeImage = avatarUrl || selfie;
    if (!activeImage) return;
    const link = document.createElement('a');
    link.href = activeImage;
    link.download = `avatar-raplife-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[70vh] text-center">
        <DiscIconAnimate />
        <h1 className="text-2xl font-black italic uppercase tracking-tighter mt-4 text-red-500">DEBES CONECTAR TU CUENTA</h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Inicia sesión en la barra superior para acceder a tu avatar.</p>
      </div>
    );
  }

  // ONBOARDING / DECLINED ACCEPTANCE VIEW
  if (!accepted) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-20 py-10 md:py-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-dark p-8 md:p-12 rounded-[2.5rem] border-4 border-boombox-gray text-center relative overflow-hidden boombox-texture shadow-2xl"
        >
          {/* Decorative design screws */}
          <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50" />
          <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50" />
          <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50" />
          <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border border-black/50" />

          <div className="max-w-2xl mx-auto space-y-8 relative z-10">
            <div className="space-y-4">
              <div className="p-4 bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow rounded-full w-fit mx-auto animate-pulse">
                <Sparkles size={40} className="glow-yellow" />
              </div>
              <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none glow-yellow">AVATAR DIGITAL RAPLIFE</h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">EL FUTURO DE LA CALLE EN LA WEB3</p>
            </div>

            <div className="h-1 bg-gradient-to-r from-transparent via-brand-yellow/40 to-transparent w-full rounded-full" />

            <div className="text-left bg-black/40 p-6 md:p-8 rounded-3xl border border-white/5 space-y-4">
              <h3 className="font-black italic uppercase text-lg text-brand-yellow">ÚNETE AL ECOSISTEMA DE ARTISTAS DIGITALES</h3>
              <p className="text-xs text-gray-300 font-bold uppercase tracking-wide leading-relaxed">
                Al activar tu Avatar RapLife, entras en nuestro ecosistema interactivo de identidad urbana. Podrás:
              </p>
              <ul className="space-y-3 pl-2">
                <li className="flex items-start gap-3 text-xs font-bold text-gray-400 uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full mt-1.5 shrink-0" />
                  <span>Subir tu selfie real y cambiar de vestuario con las colecciones oficiales RapLife.</span>
                </li>
                <li className="flex items-start gap-3 text-xs font-bold text-gray-400 uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full mt-1.5 shrink-0" />
                  <span>Participar en rankings de popularidad y presentarte en eventos online del ghetto.</span>
                </li>
                <li className="flex items-start gap-3 text-xs font-bold text-gray-400 uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full mt-1.5 shrink-0" />
                  <span>Tener tu ficha digital y carnet oficial con el estilo visual que tú elijas.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <button
                onClick={handleDeclineEcosystem}
                className="px-8 py-4 bg-white/5 text-white/50 font-bold uppercase italic rounded-xl hover:bg-white/10 text-xs tracking-wider"
              >
                OMITIR / HACERLO MÁS TARDE
              </button>
              <button
                onClick={handleAcceptEcosystem}
                disabled={loading}
                className="px-10 py-5 bg-brand-yellow text-black font-black italic text-sm uppercase tracking-tighter rounded-xl hover:scale-105 active:scale-95 shadow-glow transition-all disabled:opacity-50"
              >
                {loading ? 'SINTONIZANDO...' : 'SÍ, CREAR AVATAR REGISTRAR'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // MAIN RUNTIME WORKSPACE VIEW
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      
      {/* BRANDING HEADER */}
      <header className="flex flex-col md:flex-row items-center gap-6 bg-white/5 p-6 md:p-8 rounded-[2.5rem] border border-white/10 boombox-texture">
        <div className="p-4 bg-brand-yellow text-black rounded-2xl rotate-2 shadow-glow">
          <User size={30} />
        </div>
        <div className="text-center md:text-left flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter">IDENTIDAD & PORTADOR RAPLIFE</h1>
            <span className="bg-brand-yellow/20 text-brand-yellow text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-brand-yellow/30">VERSIÓN DIGITAL ACTIVA</span>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">
            Cargado en tu selfie o foto real, la Inteligencia Artificial de Gemini reemplazará tu ropa con las últimas colecciones con el branding RapLife. Conservando intacta tu pose, iluminación y ángulo original.
          </p>
        </div>
      </header>

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LIENZO DE RETOQUE & VISUALIZER (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-brand-dark p-6 rounded-[2rem] border-4 border-boombox-gray flex flex-col relative overflow-hidden group">
            
            <div className="flex items-center justify-between mb-4 z-10 border-b border-white/5 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-brand-yellow flex items-center gap-1.5">
                <ImageIcon size={14} /> LIENZO REAL (MÁSTER DIGITAL)
              </span>
              {selfie && (
                <button
                  onClick={handleResetWorkspace}
                  className="text-[9px] font-black text-red-500 hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} /> CAMBIAR FOTO BASE
                </button>
              )}
            </div>

            {/* DYNAMIC RETOUCH CANVAS */}
            {!selfie ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-4 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[350px] transition-all bg-white/[0.01] hover:bg-white/[0.03] border-white/10 hover:border-brand-yellow/40 group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleSelfieSelect} 
                />
                
                <div className="p-4 bg-white/5 rounded-full text-brand-yellow mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                
                <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">SUBE TU FOTO O SELFI REAL</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1 max-w-sm">
                  Haz clic o arrastra una selfie para usar de modelo. Funciona mejor con tomas de frente en iluminación estándar.
                </p>
                <p className="text-[9px] text-[#444] font-black uppercase tracking-widest mt-6">JPG / PNG / WEBP / HEIC</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border-2 border-black aspect-video max-h-[480px] bg-black/70 flex items-center justify-center shadow-inner">
                  {/* DISPLAY ORIGINAL OR THE GENERATED AVATAR PICTURE */}
                  <img 
                    src={avatarUrl || selfie} 
                    alt="Lienzo de avatar RapLife" 
                    className="max-h-[450px] max-w-full object-contain"
                  />

                  {/* LOADING GRAPHICS */}
                  {loading && (
                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-8 z-50 backdrop-blur-sm">
                      <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand-yellow animate-spin" />
                        <User className="text-brand-yellow animate-pulse" size={32} />
                      </div>
                      <h4 className="text-brand-yellow font-black italic uppercase tracking-tighter text-sm mb-2">{loadingStep ? 'MOTORES IA ACTIVO' : 'SINTONIZANDO VESTIMENTA'}</h4>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider max-w-md animate-pulse">{loadingStep || 'Modificando solo los hilos y fibras de tu ropa...'}</p>
                    </div>
                  )}

                  {/* STATUS PILL OVERLAY */}
                  <div className="absolute top-4 left-4">
                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                      avatarUrl 
                        ? 'bg-brand-green/20 text-brand-green border-brand-green/40' 
                        : 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/35'
                    }`}>
                      {avatarUrl ? 'VISTIENDO RAPLIFE OUTFIT IA' : 'FOTO SEFI LIMPIA'}
                    </span>
                  </div>
                </div>

                {/* LIENZO DE RETOQUE FOOTER BUTTONS */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    {avatarUrl && (
                      <button 
                        onClick={() => setAvatarUrl(null)}
                        className="px-4 py-2.5 bg-[#1a1a1a] border border-white/15 text-white/70 hover:text-white font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 transition-all"
                        title="Ver foto base original"
                      >
                        <Undo size={14} /> VER FOTO ORIGINAL
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={downloadAvatar}
                      className="px-4 py-2.5 bg-[#222] border border-white/10 text-white font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 hover:bg-[#333] transition-all"
                    >
                      <Download size={14} /> DESCARGAR PNG
                    </button>
                    <button 
                      onClick={handleSaveOfficialAvatar}
                      disabled={loading}
                      className="px-5 py-3 bg-brand-yellow text-black font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-glow"
                    >
                      <Save size={14} /> GUARDAR COMO AVATAR OFICIAL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* INSTRUCTIONS GUIDE TO ADD NEW MANNEQUINS/OUTFITS */}
          <div className="bg-[#111] p-6 rounded-[2rem] border border-white/10 space-y-4">
            <h4 className="font-italic text-sm font-black italic uppercase tracking-tight text-brand-yellow flex items-center gap-2">
              <Info size={16} /> ADMINISTRACIÓN: CÓMO SUBIR MÁS OPCIONES DE OUTFIT
            </h4>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider space-y-3 leading-relaxed">
              <p>
                Puedes cargar prendas personalizadas de maniquíes tanto para hombre como para mujer. Sube las imágenes dentro de tu servidor de RapLife a la ruta:
              </p>
              <div className="bg-black/50 p-3.5 rounded-xl border border-white/5 font-mono text-[10.5px] text-brand-green lowercase select-all text-center">
                /public/assets/outfits/
              </div>
              <p>
                Debes guardar los archivos con los siguientes nombres en secuencia exacta:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] text-gray-300">
                <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
                  <p className="text-brand-yellow font-black">👦 OPCIONES PARA HOMBRE</p>
                  <ul className="list-disc pl-4 text-gray-400 font-mono">
                    <li>outfit_m1.png</li>
                    <li>outfit_m2.png</li>
                    <li>outfit_m3.png</li>
                    <li>outfit_m4.png</li>
                  </ul>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
                  <p className="text-brand-purple font-black">👧 OPCIONES PARA MUJER</p>
                  <ul className="list-disc pl-4 text-gray-400 font-mono">
                    <li>outfit_f1.png</li>
                    <li>outfit_f2.png</li>
                    <li>outfit_f3.png</li>
                    <li>outfit_f4.png</li>
                  </ul>
                </div>
              </div>
              <p className="text-[9.5px] italic text-[#666]">
                * Si un archivo no se encuentra subido en el servidor, nuestro sistema cargará automáticamente un maniquí de demostración (placeholder de alta calidad) para no interrumpir el flujo.
              </p>
            </div>
          </div>
        </div>

        {/* CLOTHING SELECTOR & TRY-ON OPTIONS (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-brand-dark p-6 rounded-[2rem] border-4 border-boombox-gray flex flex-col space-y-5">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-brand-yellow flex items-center gap-2">
              <Shirt size={20} /> VERSIÓN DIGITAL OUTFITS
            </h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase leading-relaxed tracking-wider">
              Selecciona tu género de identidad para filtrar los catálogos y haz clic sobre el maniquí de RapLife para probártelo.
            </p>

            {/* GENDER TABS */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  setGenderFilter('male');
                  setSelectedOutfit(null);
                }}
                className={`py-2 rounded-lg font-black uppercase text-xs italic tracking-wider transition-colors ${
                  genderFilter === 'male' ? 'bg-brand-yellow text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                👦 COLECCIÓN HOMBRE
              </button>
              <button
                onClick={() => {
                  setGenderFilter('female');
                  setSelectedOutfit(null);
                }}
                className={`py-2 rounded-lg font-black uppercase text-xs italic tracking-wider transition-colors ${
                  genderFilter === 'female' ? 'bg-brand-yellow text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                👧 COLECCIÓN MUJER
              </button>
            </div>

            {/* OUTFITS BENTO GRID */}
            <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {PREDEFINED_OUTFITS.filter(o => o.gender === genderFilter).map((outfit) => {
                const isSelected = selectedOutfit?.id === outfit.id;
                return (
                  <button
                    key={outfit.id}
                    onClick={() => {
                      setSelectedOutfit(outfit);
                      setErrorText(null);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
                      isSelected 
                        ? 'border-brand-yellow bg-brand-yellow/5 scale-[0.98] shadow-glow' 
                        : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Mannequin / Fallback visual layout */}
                      <div className="relative aspect-square w-full rounded-xl bg-black overflow-hidden border border-white/5">
                        <img 
                          src={`/assets/outfits/${outfit.filename}`}
                          onError={(e) => {
                            // Swap with fallback if not uploaded yet
                            e.currentTarget.src = outfit.fallbackUrl;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          alt={outfit.name}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] font-mono font-bold text-center py-0.5 uppercase tracking-wide text-gray-300">
                          {outfit.filename}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-black italic uppercase tracking-tighter text-white leading-normal text-xs truncate group-hover:text-brand-yellow transition-colors">
                          {outfit.name}
                        </h4>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 shrink-0 block leading-none">
                          Pre-diseñado
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* SELECTED OUTFIT DESCRIPTION */}
            {selectedOutfit ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 p-4 border border-white/5 rounded-2xl space-y-2 text-xs"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                  <span className="font-black italic text-brand-yellow uppercase tracking-wider text-[11px]">{selectedOutfit.name}</span>
                  <span className="text-[8px] font-mono text-gray-500 uppercase">{selectedOutfit.filename}</span>
                </div>
                <p className="text-[10px] text-gray-400 font-semibold leading-relaxed uppercase tracking-wide">
                  {selectedOutfit.description}
                </p>
              </motion.div>
            ) : (
              <div className="bg-black/20 p-4 border border-dashed border-white/5 text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest rounded-2xl">
                Selecciona una opción de vestuario de arriba para probártela
              </div>
            )}

            {/* ACTIVATE TryOn BUTTON */}
            <button
              onClick={handleApplyTryon}
              disabled={loading || !selfie || !selectedOutfit}
              className="w-full py-4 bg-brand-yellow text-black font-black italic uppercase tracking-tight text-xs rounded-xl shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> {loading ? 'SINTONIZANDO VESTUARIO IA...' : 'APLICAR VESTUARIO CON IA'}
            </button>

            {/* ERROR LOGS */}
            {errorText && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex flex-col gap-2.5 text-xs">
                <div className="flex gap-2 font-bold uppercase tracking-wider">
                  <AlertTriangle className="shrink-0" size={16} />
                  <span>ERROR AL CAMBIAR VESTIDO</span>
                </div>
                <p className="text-[10px] leading-relaxed lowercase first-letter:uppercase text-gray-400 font-medium">
                  {errorText}
                </p>
                {errorText.includes('RESOURCE_EXHAUSTED') && (
                  <div className="bg-black/40 border border-red-500/25 p-3 rounded-xl space-y-1.5 text-[9px] text-gray-300">
                    <p className="font-black text-brand-yellow">💡 Clave Gemini requerida:</p>
                    <p className="font-semibold leading-relaxed uppercase text-gray-400">
                      Debido al límite en cuotas libres de Gemini, es altamente sugerido colocar tu clave Gemini API comercial en "Settings &gt; Secrets" o en "Mi Perfil" para usar Tryon de inmediato.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATION WARNING ABOUT APPAREL IA CRITERIA */}
            <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-[9px] font-bold text-gray-500 uppercase leading-relaxed tracking-wider space-y-1">
              <p className="text-gray-400 font-black flex items-center gap-1">
                <CheckCircle2 size={12} className="text-brand-green" /> REGLAS DE SINTONIZACIÓN IA
              </p>
              <p>
                1. Mantendrá intacto tu rostro, peinado, pose corporal e iluminación del fondo.
              </p>
              <p>
                2. Solo se reemplazan los tejidos de camisas, suéteres, pantalones y tenis deportivos.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

const DiscIconAnimate = () => (
  <div className="w-16 h-16 bg-brand-dark border-4 border-black speaker-grill rounded-full flex items-center justify-center relative shadow-inner overflow-hidden">
    <div className="w-12 h-12 bg-shadow-glow rounded-full animate-ping absolute" />
    <div className="w-8 h-8 bg-brand-yellow rounded-full relative z-10" />
  </div>
);

export default StudioView;
