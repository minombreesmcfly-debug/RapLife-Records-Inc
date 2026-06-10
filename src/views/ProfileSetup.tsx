import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Mic2, ArrowRight, Disc, Sparkles, Upload, Image as ImageIcon, Check, X, AlertCircle } from 'lucide-react';

const ProfileSetupView = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<string>('fan');
  const [category, setCategory] = useState('');
  const [plan, setPlan] = useState<'rookie' | 'pro' | 'fan'>('fan');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [favSong1, setFavSong1] = useState('');
  const [favSong2, setFavSong2] = useState('');
  const [favSong3, setFavSong3] = useState('');
  const [showExtraRoles, setShowExtraRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Avatar-specific onboarding state
  const [acceptedEcosystem, setAcceptedEcosystem] = useState<boolean>(true);
  const [avatarSelfie, setAvatarSelfie] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<string>('image/jpeg');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  if (profile) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-10 text-center animate-pulse">
       <Disc className="animate-spin text-brand-yellow mb-4" size={48} />
       <h1 className="text-2xl font-black italic uppercase">ABRIENDO EL ESTUDIO...</h1>
       <p className="text-gray-500 font-bold mt-2">Ya tienes un perfil configurado.</p>
    </div>
  );

  const handleFinish = async (accepted: boolean, selfieBase64: string | null) => {
    setSubmitting(true);
    try {
      const songsList = [favSong1, favSong2, favSong3].filter(s => s.trim() !== '');
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        category: category,
        plan: role === 'artist' ? plan : 'fan',
        spotifyUrl: role === 'artist' ? spotifyUrl : '',
        spotifySongs: role === 'artist' ? songsList : [],
        points: 0,
        createdAt: serverTimestamp(),
        isPinned: false,
        bio: '',
        acceptedEcosystem: accepted,
        avatarSelfieUrl: selfieBase64 || '',
        avatarUrl: selfieBase64 || '', // Inicialmente es su foto real
        hasAvatar: !!selfieBase64,
      });

      if (role === 'artist' && songsList.length > 0) {
        try {
          await addDoc(collection(db, 'spotify_requests'), {
            userId: user.uid,
            displayName: user?.displayName || 'Artista Sin Nombre',
            spotifyUrl: spotifyUrl || '',
            songs: songsList,
            createdAt: new Date().toISOString(),
            status: 'pending'
          });
        } catch (err) {
          console.error("Error creating spotify request in firebase:", err);
        }
      }

      window.location.href = '/'; // Hard reload to refresh context
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const categories: Record<string, string[]> = {
    artist: ['RAPERO', 'BEATMAKER', 'PRODUCTOR', 'COMPOSITOR', 'FREESTYLER'],
    fan: ['BAILARÍN', 'ME GUSTA EL RAP', 'BEATBOXER', 'GRAFFITERO', 'OYENTE ACTIVO'],
    model: ['MODELO', 'ME GUSTA EL RAP'],
    agent: ['RAPLIFE AGENT', 'ME GUSTA EL RAP'],
    graffiti: ['GRAFFITI', 'ME GUSTA EL RAP'],
    manager: ['MANAGER', 'ME GUSTA EL RAP'],
    music: ['MUSIC', 'ME GUSTA EL RAP']
  };

  const plans = [
    {
      id: 'rookie',
      name: 'RAPLIFE RECORDS ROOKIE',
      price: '$100',
      period: '/mes',
      features: [
        '3 tracks en rotación en Radio',
        '1 Visualizer IA de alta calidad',
        'Cameos en videos de otros artistas'
      ],
      color: 'border-white/10'
    },
    {
      id: 'pro',
      name: 'RAPLIFE PRO',
      price: '$199',
      period: '/mes',
      features: [
        'Rotación prioritaria en Radio',
        '2 Visuales IA de alta calidad',
        'Promoción en nuestras Stories',
        '10 clips cinematográficos TikTok'
      ],
      color: 'border-brand-yellow/50'
    }
  ];

  // Drag and Drop helpers for onboard selfie
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }
    setAvatarMime(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarSelfie(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 md:p-10 max-w-4xl mx-auto text-center py-20">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-10 w-full"
          >
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter glow-yellow leading-none">BIENVENIDO</h1>
              <p className="text-lg text-gray-500 font-bold uppercase tracking-widest italic underline decoration-brand-yellow decoration-2 underline-offset-8">¿QUÉ ERES EN LA CALLE?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mx-auto">
              {/* FAN */}
              <button 
                onClick={() => { setRole('fan'); setPlan('fan'); }}
                className={`p-8 md:p-10 rounded-[2.5rem] border-4 transition-all flex flex-col items-center gap-5 relative overflow-hidden group ${role === 'fan' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/20 bg-white/[0.02]'}`}
              >
                <div className={`p-5 rounded-2xl transition-all shadow-xl ${role === 'fan' ? 'bg-brand-yellow text-black rotate-3' : 'bg-white/10 group-hover:rotate-6'}`}>
                  <User size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tight">RAPLIFE FAN</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-2 leading-relaxed">No rapeo, pero vivo la cultura. Acumulo puntos para premios.</p>
                </div>
              </button>

              {/* ARTIST */}
              <button 
                onClick={() => setRole('artist')}
                className={`p-8 md:p-10 rounded-[2.5rem] border-4 transition-all flex flex-col items-center gap-5 relative overflow-hidden group ${role === 'artist' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/20 bg-white/[0.02]'}`}
              >
                 <div className={`p-5 rounded-2xl transition-all shadow-xl ${role === 'artist' ? 'bg-brand-yellow text-black -rotate-3' : 'bg-white/10 group-hover:-rotate-6'}`}>
                  <Mic2 size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tight">RAPLIFE ARTIST</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-2 leading-relaxed">Raperos, beatmakers y productores. Sube tu música a la radio.</p>
                </div>
              </button>
            </div>

            {!showExtraRoles ? (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowExtraRoles(true)}
                  className="px-6 py-3.5 bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase text-brand-yellow italic tracking-wider rounded-xl hover:bg-neutral-850 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  ✨ ¿ERES MODELO, AGENTE O DE OTRA RAMA? VER MÁS OPCIONES
                </button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-6 pt-2 border-t border-white/5 max-w-4xl mx-auto"
              >
                <p className="text-xs text-brand-yellow font-black uppercase tracking-widest italic">— SECTOR CREATIVO & EMBABAJADORES —</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                  {/* MODEL */}
                  <button 
                    onClick={() => { setRole('model'); setPlan('fan'); }}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group ${role === 'model' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                  >
                     <div className={`p-3 rounded-xl transition-all shadow-xl ${role === 'model' ? 'bg-brand-yellow text-black' : 'bg-white/5'}`}>
                      <Sparkles size={20} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black italic uppercase">MODEL</h4>
                      <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase leading-snug">Modelos de marca y alta moda urbana.</p>
                    </div>
                  </button>

                  {/* AGENT */}
                  <button 
                    onClick={() => { setRole('agent'); setPlan('fan'); }}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group ${role === 'agent' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                  >
                     <div className={`p-3 rounded-xl transition-all shadow-xl ${role === 'agent' ? 'bg-brand-yellow text-black' : 'bg-white/5'}`}>
                      <User size={20} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black italic uppercase">RAPLIFE AGENT</h4>
                      <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase leading-snug">Agentes de talentos y relaciones públicas.</p>
                    </div>
                  </button>

                  {/* GRAFFITI */}
                  <button 
                    onClick={() => { setRole('graffiti'); setPlan('fan'); }}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group ${role === 'graffiti' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                  >
                     <div className={`p-3 rounded-xl transition-all shadow-xl ${role === 'graffiti' ? 'bg-brand-yellow text-black' : 'bg-white/5'}`}>
                      <ImageIcon size={20} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black italic uppercase">GRAFFITI</h4>
                      <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase leading-snug">Artistas murales y grafiteros.</p>
                    </div>
                  </button>

                  {/* MANAGER */}
                  <button 
                    onClick={() => { setRole('manager'); setPlan('fan'); }}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group ${role === 'manager' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                  >
                     <div className={`p-3 rounded-xl transition-all shadow-xl ${role === 'manager' ? 'bg-brand-yellow text-black' : 'bg-white/5'}`}>
                      <Disc size={20} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black italic uppercase">MANAGER</h4>
                      <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase leading-snug">Gestión y representantes de artistas.</p>
                    </div>
                  </button>

                  {/* MUSIC */}
                  <button 
                    onClick={() => { setRole('music'); setPlan('fan'); }}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group ${role === 'music' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                  >
                     <div className={`p-3 rounded-xl transition-all shadow-xl ${role === 'music' ? 'bg-brand-yellow text-black' : 'bg-white/5'}`}>
                      <Mic2 size={20} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black italic uppercase">MUSIC</h4>
                      <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase leading-snug">DJs de casa y distribuidores independientes.</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            <button 
              onClick={() => setStep(2)}
              className="w-full md:w-auto px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-4 mx-auto group cursor-pointer"
            >
              CONTINUAR <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-10 w-full"
          >
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">ELIGE TU ROL</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest italic underline decoration-brand-yellow decoration-2 underline-offset-8">PERSONALIZA TU PERFIL</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {(categories[role] || []).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-8 py-4 rounded-2xl border-2 font-black italic uppercase text-lg transition-all ${category === cat ? 'bg-brand-yellow text-black border-brand-yellow shadow-glow scale-110' : 'bg-white/5 border-white/10 hover:border-white/30 text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {role === 'artist' && (
              <div className="w-full max-w-xl mx-auto space-y-4 text-left bg-black/40 p-6 rounded-3xl border border-white/5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-[#a1a1a1] uppercase block">
                    🎨 TU ENLACE DE ARTISTA EN SPOTIFY (OPCIONAL)
                  </label>
                  <input 
                    type="url"
                    placeholder="https://open.spotify.com/artist/..."
                    className="w-full bg-neutral-900 border border-neutral-800 p-4 rounded-xl text-xs text-white focus:border-brand-yellow outline-none font-bold"
                    value={spotifyUrl}
                    onChange={(e) => setSpotifyUrl(e.target.value)}
                  />
                  <p className="text-[9px] text-[#555] font-black uppercase mt-1 leading-snug">
                    Asocia tu canal original para que tus fans puedan escucharte en las consolas y playlists de RapLife Records.
                  </p>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <div className="space-y-3">
                  <label className="text-[10px] font-black tracking-widest text-[#a1a1a1] uppercase block text-brand-yellow">
                    🎵 TUS TRES CANCIONES FAVORITAS PARA LA PLAYLIST OFICIAL
                  </label>
                  <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed mb-2">
                    Ingresa tus 3 mejores canciones para agregarlas a la playlist oficial de RapLife Records en Spotify.
                  </p>
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="Canción 1 (Título - Artista / Enlace)"
                      className="w-full bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-xs text-white focus:border-brand-yellow outline-none font-bold"
                      value={favSong1}
                      onChange={(e) => setFavSong1(e.target.value)}
                    />
                    <input 
                      type="text"
                      placeholder="Canción 2 (Título - Artista / Enlace)"
                      className="w-full bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-xs text-white focus:border-brand-yellow outline-none font-bold"
                      value={favSong2}
                      onChange={(e) => setFavSong2(e.target.value)}
                    />
                    <input 
                      type="text"
                      placeholder="Canción 3 (Título - Artista / Enlace)"
                      className="w-full bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-xs text-white focus:border-brand-yellow outline-none font-bold"
                      value={favSong3}
                      onChange={(e) => setFavSong3(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button onClick={() => setStep(1)} className="px-8 py-4 bg-white/5 text-white/50 font-bold uppercase italic rounded-xl hover:bg-white/10">ATRÁS</button>
              <button 
                onClick={() => role === 'artist' ? setStep(3) : setStep(4)}
                disabled={!category || submitting}
                className="px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all disabled:opacity-20"
              >
                {role === 'artist' ? 'SELECCIONAR PLAN' : 'CONFIGURAR AVATAR'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && role === 'artist' && (
          <motion.div
            key="step3"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-10 w-full"
          >
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">PLANES PARA EL GHETTO</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest italic underline decoration-brand-yellow decoration-2 underline-offset-8">IMPULSA TU CARRERA MUSICAL</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {plans.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id as any)}
                  className={`p-8 rounded-[2.5rem] border-4 text-left transition-all relative overflow-hidden flex flex-col justify-between ${plan === p.id ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
                >
                   <div className="space-y-6">
                      <div>
                        <h4 className="text-2xl font-black italic uppercase tracking-tight text-white mb-2">{p.name}</h4>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-brand-yellow italic">{p.price}</span>
                          <span className="text-xs font-bold text-gray-500 uppercase">{p.period}</span>
                        </div>
                      </div>
                      
                      <ul className="space-y-3">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-3 text-xs font-bold text-gray-400 uppercase tracking-tight">
                            <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full mt-1 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                   </div>

                   <div className={`mt-8 py-3 w-full text-center rounded-xl font-black italic uppercase text-sm ${plan === p.id ? 'bg-brand-yellow text-black shadow-lg' : 'bg-white/10 text-white'}`}>
                      {plan === p.id ? 'PLAN SELECCIONADO' : 'ELEGIR PLAN'}
                   </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button onClick={() => setStep(2)} className="px-8 py-4 bg-white/5 text-white/50 font-bold uppercase italic rounded-xl hover:bg-white/10">ATRÁS</button>
              <button 
                onClick={() => setStep(4)}
                disabled={submitting}
                className="px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all disabled:opacity-20"
              >
                CONFIGURAR AVATAR
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-8 w-full max-w-2xl mx-auto"
          >
            <div className="space-y-4">
              <span className="px-3.5 py-1 bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow text-[10px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1.5">
                <Sparkles size={11} /> ECOSISTEMA DIGITAL RAPLIFE
              </span>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">¿CREAR TU AVATAR RAPLIFE?</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest max-w-lg mx-auto">
                Crea tu versión digital, únete a la red y forma parte de nuestro ecosistema interactivo de artistas en 3D.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* ACCEPT CARD */}
              <button
                onClick={() => setAcceptedEcosystem(true)}
                className={`p-6 rounded-3xl border-3 text-left transition-all flex flex-col gap-3 relative overflow-hidden group ${acceptedEcosystem ? 'border-brand-yellow bg-brand-yellow/5' : 'border-white/5 bg-white/[0.01]'}`}
              >
                <div className={`p-3 rounded-xl w-fit ${acceptedEcosystem ? 'bg-brand-yellow text-black' : 'bg-white/5 text-white/50'}`}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-black italic uppercase tracking-tight text-white mb-1 text-sm">SÍ, QUIERO MI AVATAR DIGITAL</h4>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-tight leading-relaxed">
                    Únete a RapLife. Podrás subir tu foto, cambiarle de ropa con IA usando outfits exclusivos de RapLife y aparecer en el feed de avatares.
                  </p>
                </div>
              </button>

              {/* DECLINE/SKIP CARD */}
              <button
                onClick={() => {
                  setAcceptedEcosystem(false);
                  setAvatarSelfie(null);
                }}
                className={`p-6 rounded-3xl border-3 text-left transition-all flex flex-col gap-3 relative overflow-hidden group ${!acceptedEcosystem ? 'border-red-500/50 bg-red-500/5' : 'border-white/5 bg-white/[0.01]'}`}
              >
                <div className={`p-3 rounded-xl w-fit ${!acceptedEcosystem ? 'bg-red-500 text-black' : 'bg-white/5 text-white/50'}`}>
                  <X size={20} />
                </div>
                <div>
                  <h4 className="font-black italic uppercase tracking-tight text-white mb-1 text-sm">NO / HACERLO MÁS TARDE</h4>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-tight leading-relaxed">
                    Crear perfil estándar sin versión digital. Puedes omitirlo y configurarlo en cualquier momento desde el menú de la radio.
                  </p>
                </div>
              </button>
            </div>

            {/* CONDITIONAL PHOTO UPLOADER IF ACCEPTED */}
            {acceptedEcosystem && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 border-2 border-dashed border-white/10 rounded-3xl p-6 text-left space-y-4"
              >
                <h4 className="text-xs font-black italic uppercase text-brand-yellow flex items-center gap-1.5">
                  <ImageIcon size={14} /> PASO 1: SUBE TU SELFI O FOTO REAL
                </h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide leading-relaxed">
                  Para poder vestir los outfits exclusivos, necesitamos tu foto base. La IA cambiará solo tu ropa manteniendo tu misma pose, cara y ángulo.
                </p>

                {!avatarSelfie ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03] ${
                      isDragOver ? 'border-brand-yellow bg-brand-yellow/5' : 'border-white/10 hover:border-brand-yellow/40'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileSelect} 
                    />
                    <Upload size={24} className="text-gray-500 mb-2 group-hover:scale-105 transition-transform" />
                    <p className="text-[10px] font-black uppercase text-gray-300">ARRASTRA TU FOTO O HAZ CLIC AQUÍ</p>
                    <p className="text-[8px] text-gray-600 uppercase font-bold mt-1">Recomendamos una foto clara de frente</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-brand-yellow/20">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black flex-shrink-0">
                      <img src={avatarSelfie} className="w-full h-full object-cover" alt="Selfie preview" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-brand-green font-black uppercase tracking-widest flex items-center gap-1">
                        <Check size={12} /> ¡FOTO SELECCIONADA CON ÉXITO!
                      </p>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight mt-1">
                        Esta foto servirá de lienzo para tu Avatar Digital en RapLife.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvatarSelfie(null)}
                      className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-transform active:scale-90"
                      title="Eliminar foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                
                {/* Skip option for photo */}
                {!avatarSelfie && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        // Accept ecosystem, but skip photo for now
                        handleFinish(true, null);
                      }}
                      className="text-[9px] font-black text-gray-500 hover:text-brand-yellow uppercase tracking-wider underline cursor-pointer"
                    >
                      Omitir foto por ahora (puedes subirla más tarde)
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* BUTTONS */}
            <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
              <button onClick={() => setStep(role === 'artist' ? 3 : 2)} className="px-8 py-4 bg-white/5 text-white/50 font-bold uppercase italic rounded-xl hover:bg-white/10">ATRÁS</button>
              <button 
                onClick={() => handleFinish(acceptedEcosystem, avatarSelfie)}
                disabled={submitting}
                className="px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all disabled:opacity-20"
              >
                {submitting ? 'PREPARANDO UNIVERSO...' : 'FINALIZAR Y UNIRSE'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileSetupView;
