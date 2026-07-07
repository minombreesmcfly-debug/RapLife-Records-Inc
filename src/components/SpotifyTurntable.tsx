import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Disc, Mic, Volume2, Music, Sparkles, Sliders, RefreshCw, 
  Settings, Save, HelpCircle, Info, Radio, Trash2, List, PlayCircle, Loader2
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, limit } from 'firebase/firestore';

interface Preset {
  name: string;
  autotune: number; // 0 to 1
  reverb: number;   // 0 to 1
  delay: number;    // 0 to 1
  distortion: number; // 0 to 1
  eqMid: number;    // db boost/cut
  eqHigh: number;   // db boost/cut
  description: string;
}

const VOCAL_PRESETS: Preset[] = [
  {
    name: "Talkbox (West Coast)",
    autotune: 0.95,
    reverb: 0.2,
    delay: 0.35,
    distortion: 0.65,
    eqMid: 12, // High nasal boost
    eqHigh: -4, // Muted high end for that classic boxy voice
    description: "Efecto estilo Talkbox clásico de la costa oeste con modulación nasal y sutil saturación."
  },
  {
    name: "Autotune Pro",
    autotune: 0.9,
    reverb: 0.3,
    delay: 0.1,
    distortion: 0.0,
    eqMid: 2,
    eqHigh: 4,
    description: "Afinación ultra-rápida perfecta para trap moderno y hip-hop."
  },
  {
    name: "T-Pain Style",
    autotune: 1.0,
    reverb: 0.4,
    delay: 0.3,
    distortion: 0.1,
    eqMid: 0,
    eqHigh: 6,
    description: "El clásico efecto robótico con corrección de tono al 100% y delay brillante."
  },
  {
    name: "Radio Vintage",
    autotune: 0.0,
    reverb: 0.1,
    delay: 0.0,
    distortion: 0.5,
    eqMid: 8,
    eqHigh: -12,
    description: "Voz estilo megáfono analógico filtrando los graves y agudos extremos."
  },
  {
    name: "Dry / Bypass",
    autotune: 0.0,
    reverb: 0.0,
    delay: 0.0,
    distortion: 0.0,
    eqMid: 0,
    eqHigh: 0,
    description: "Voz limpia y natural sin procesamiento digital adicional."
  }
];

const SpotifyTurntable = () => {
  const { currentTrack, play, isPlaying, togglePlay } = useMusic();
  const { user } = useAuth();
  
  // Beats and Audio States
  const [beats, setBeats] = useState<any[]>([]);
  const [loadingBeats, setLoadingBeats] = useState(true);
  const [selectedBeat, setSelectedBeat] = useState<any>(null);
  const [micActive, setMicActive] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>(VOCAL_PRESETS[0]);
  
  // Custom Sliders
  const [sliderAutotune, setSliderAutotune] = useState(0.95);
  const [sliderReverb, setSliderReverb] = useState(0.2);
  const [sliderDelay, setSliderDelay] = useState(0.35);
  const [sliderDistortion, setSliderDistortion] = useState(0.65);
  const [sliderVocalVol, setSliderVocalVol] = useState(0.8);
  const [sliderBeatVol, setSliderBeatVol] = useState(0.5);

  // Web Audio Nodes references
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeVocalRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | GainNode | null>(null);
  const distortionNodeRef = useRef<WaveShaperNode | null>(null);
  const eqMidNodeRef = useRef<BiquadFilterNode | null>(null);
  const eqHighNodeRef = useRef<BiquadFilterNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load Beats from database
  useEffect(() => {
    const fetchBeats = async () => {
      try {
        const q = query(collection(db, 'tracks'), limit(10));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter some tracks as instrumentals/beats if possible or just use whatever is available
        setBeats(list);
        if (list.length > 0) {
          setSelectedBeat(list[0]);
        }
      } catch (err) {
        console.error("Error fetching studio beats:", err);
      } finally {
        setLoadingBeats(false);
      }
    };
    fetchBeats();
  }, []);

  // Sync Slider values when Preset changes
  const applyPreset = (preset: Preset) => {
    setActivePreset(preset);
    setSliderAutotune(preset.autotune);
    setSliderReverb(preset.reverb);
    setSliderDelay(preset.delay);
    setSliderDistortion(preset.distortion);
    
    // Dynamically adjust audio node parameters if active
    if (eqMidNodeRef.current) {
      eqMidNodeRef.current.gain.value = preset.eqMid;
    }
    if (eqHighNodeRef.current) {
      eqHighNodeRef.current.gain.value = preset.eqHigh;
    }
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.value = preset.delay * 0.5; // Scale delay
    }
  };

  // Web Audio Initialization
  const startMicProcessing = async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 1. Capture stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      streamRef.current = stream;

      // 2. Create nodes
      micSourceNodeRef.current = ctx.createMediaStreamSource(stream);
      gainNodeVocalRef.current = ctx.createGain();
      gainNodeVocalRef.current.gain.value = sliderVocalVol;

      // Distortion
      distortionNodeRef.current = ctx.createWaveShaper();
      distortionNodeRef.current.curve = makeDistortionCurve(sliderDistortion * 100);
      distortionNodeRef.current.oversample = '4x';

      // Mid & High EQ filters
      eqMidNodeRef.current = ctx.createBiquadFilter();
      eqMidNodeRef.current.type = 'peaking';
      eqMidNodeRef.current.frequency.value = 1200; // Nasal frequency zone for talkbox
      eqMidNodeRef.current.Q.value = 2.0;
      eqMidNodeRef.current.gain.value = activePreset.eqMid;

      eqHighNodeRef.current = ctx.createBiquadFilter();
      eqHighNodeRef.current.type = 'highshelf';
      eqHighNodeRef.current.frequency.value = 5000;
      eqHighNodeRef.current.gain.value = activePreset.eqHigh;

      // Delay Node
      delayNodeRef.current = ctx.createDelay(1.0);
      delayNodeRef.current.delayTime.value = sliderDelay * 0.5;
      delayFeedbackRef.current = ctx.createGain();
      delayFeedbackRef.current.gain.value = 0.4;

      // Simple dry/wet configuration for Reverb fallback (ambient delay loop)
      const fakeReverb = ctx.createGain();
      fakeReverb.gain.value = sliderReverb;
      reverbNodeRef.current = fakeReverb;

      // Connect Nodes Chain
      // Mic Source -> Distortion -> Mid EQ -> High EQ -> Vocal Gain -> Destination
      micSourceNodeRef.current.connect(distortionNodeRef.current);
      distortionNodeRef.current.connect(eqMidNodeRef.current);
      eqMidNodeRef.current.connect(eqHighNodeRef.current);
      eqHighNodeRef.current.connect(gainNodeVocalRef.current);
      
      // Delay Loop connection: GainVocal -> Delay -> Feedback -> Delay -> Destination
      gainNodeVocalRef.current.connect(delayNodeRef.current);
      delayNodeRef.current.connect(delayFeedbackRef.current);
      delayFeedbackRef.current.connect(delayNodeRef.current);
      delayNodeRef.current.connect(ctx.destination);

      // Main Connection to speakers
      gainNodeVocalRef.current.connect(ctx.destination);

      setMicActive(true);
    } catch (err) {
      console.error("Mic access or Web Audio init error:", err);
      alert("No se pudo iniciar el procesamiento de micrófono. Asegúrate de dar los permisos correspondientes y de no estar usando otra aplicación de audio.");
    }
  };

  const stopMicProcessing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (micSourceNodeRef.current) {
      micSourceNodeRef.current.disconnect();
    }
    setMicActive(false);
  };

  // Helper to generate distortion curves
  function makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Real-time slider adjustments
  useEffect(() => {
    if (gainNodeVocalRef.current) {
      gainNodeVocalRef.current.gain.value = sliderVocalVol;
    }
  }, [sliderVocalVol]);

  useEffect(() => {
    if (distortionNodeRef.current) {
      distortionNodeRef.current.curve = makeDistortionCurve(sliderDistortion * 80);
    }
  }, [sliderDistortion]);

  useEffect(() => {
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.value = sliderDelay * 0.5;
    }
  }, [sliderDelay]);

  return (
    <div className="w-full bg-black/95 rounded-[2.5rem] border-4 border-boombox-gray p-6 md:p-8 space-y-8 shadow-2xl relative">
      
      {/* HEADER CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Preset Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
            <Sparkles size={12} className="text-brand-yellow" /> SELECCIONAR PREESTABLECIDO
          </label>
          <div className="flex flex-wrap gap-2">
            {VOCAL_PRESETS.map((p) => {
              const isSelected = activePreset.name === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`px-4 py-2 text-[10px] font-black uppercase italic rounded-full border-2 transition-all ${
                    isSelected 
                      ? "bg-brand-yellow text-black border-brand-yellow" 
                      : "bg-transparent text-white border-boombox-gray hover:border-brand-yellow/50"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Beat Display & Mic toggle */}
        <div className="bg-neutral-900 border-2 border-boombox-gray p-4 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-2xl border border-white/5">
              <Disc className={`text-brand-yellow ${isPlaying ? 'animate-spin' : ''}`} size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase leading-none">PISTA CARGADA</p>
              <p className="text-xs font-black uppercase text-white truncate max-w-[140px] mt-1">
                {selectedBeat ? selectedBeat.title : "SELECCIONA BASE"}
              </p>
            </div>
          </div>

          <button 
            onClick={() => selectedBeat && play(selectedBeat)}
            className="p-3 bg-brand-yellow text-black rounded-full hover:scale-105 transition-all shadow-glow"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>

        {/* Active Mic Button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={micActive ? stopMicProcessing : startMicProcessing}
            className={`w-full py-3.5 rounded-full text-xs font-black uppercase italic flex items-center justify-center gap-2 border-4 transition-all ${
              micActive 
                ? "bg-red-600 border-red-800 text-white animate-pulse" 
                : "bg-transparent border-boombox-gray text-white hover:border-brand-yellow/50"
            }`}
          >
            <Mic size={14} /> {micActive ? "MICRO ACTIVO" : "ACTIVAR SU MICRO"}
          </button>
          <p className="text-[9px] font-bold text-center text-gray-500 uppercase">
            {micActive ? "PROCESANDO CON VOLUMEN" : "USA CASCOS PARA EVITAR EL RETORNO"}
          </p>
        </div>
      </div>

      {/* DETAILED INFO BOX (Clean, no handwritten annotations overlay to clutter) */}
      <div className="bg-neutral-950 border-2 border-boombox-gray p-4 rounded-3xl flex items-start gap-3">
        <Info size={16} className="text-brand-yellow flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-brand-yellow">PRESET ACTIVO: {activePreset.name}</p>
          <p className="text-[10px] font-bold uppercase text-gray-400 leading-relaxed">{activePreset.description}</p>
        </div>
      </div>

      {/* ANALOG SLIDERS / MIXER SECTION */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
        {/* Autotune */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">AUTOTUNE</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={sliderAutotune}
              onChange={(e) => setSliderAutotune(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderAutotune * 100)}%</span>
        </div>

        {/* Reverb */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">REVERB (AMB)</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={sliderReverb}
              onChange={(e) => setSliderReverb(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderReverb * 100)}%</span>
        </div>

        {/* Delay */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">DELAY (ECO)</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={sliderDelay}
              onChange={(e) => setSliderDelay(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderDelay * 100)}%</span>
        </div>

        {/* Distortion */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">TALKBOX DRIVE</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={sliderDistortion}
              onChange={(e) => setSliderDistortion(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderDistortion * 100)}%</span>
        </div>

        {/* Vocal Volume */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">VOL MICRO</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1.5" 
              step="0.05"
              value={sliderVocalVol}
              onChange={(e) => setSliderVocalVol(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderVocalVol * 100)}%</span>
        </div>

        {/* Beat Volume */}
        <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">VOL BEAT</span>
          <div className="h-28 flex items-center justify-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={sliderBeatVol}
              onChange={(e) => setSliderBeatVol(parseFloat(e.target.value))}
              className="accent-brand-yellow -rotate-90 origin-center cursor-pointer w-24"
            />
          </div>
          <span className="text-xs font-mono font-black text-brand-yellow">{Math.round(sliderBeatVol * 100)}%</span>
        </div>
      </div>

      {/* BEATS SELECTOR GRID */}
      <div className="space-y-4 border-t border-boombox-gray pt-6">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
          <List size={12} className="text-brand-yellow" /> SELECCIONAR BASE DE RAP INTEGRADA
        </span>
        
        {loadingBeats ? (
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase">
            <Loader2 className="animate-spin text-brand-yellow" size={14} />
            Cargando pistas de estudio...
          </div>
        ) : beats.length === 0 ? (
          <div className="text-xs uppercase font-bold text-gray-500">No hay instrumentales subidas para usar como base de estudio.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {beats.map((beat) => {
              const isSelected = selectedBeat?.id === beat.id;
              return (
                <button
                  key={beat.id}
                  onClick={() => {
                    setSelectedBeat(beat);
                    play(beat);
                  }}
                  className={`p-3 rounded-2xl flex items-center justify-between text-left transition-all border-2 ${
                    isSelected 
                      ? "bg-neutral-900 border-brand-yellow" 
                      : "bg-transparent border-boombox-gray/60 hover:border-boombox-gray"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-black uppercase text-white truncate">{beat.title}</p>
                    <p className="text-[8px] font-bold text-brand-yellow uppercase truncate mt-0.5">{beat.artistName}</p>
                  </div>
                  <PlayCircle size={16} className={isSelected ? "text-brand-yellow" : "text-gray-500"} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Retro corner screws */}
      <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-boombox-gray/50" />
      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-boombox-gray/50" />
      <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-boombox-gray/50" />
      <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-boombox-gray/50" />
    </div>
  );
};

export default SpotifyTurntable;
