import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Mic2, ArrowRight, Disc } from 'lucide-react';

const ProfileSetupView = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'fan' | 'artist'>('fan');
  const [category, setCategory] = useState('');
  const [plan, setPlan] = useState<'rookie' | 'pro' | 'fan'>('fan');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  if (profile) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-10 text-center animate-pulse">
       <Disc className="animate-spin text-brand-yellow mb-4" size={48} />
       <h1 className="text-2xl font-black italic uppercase">ABRIENDO EL ESTUDIO...</h1>
       <p className="text-gray-500 font-bold mt-2">Ya tienes un perfil configurado.</p>
    </div>
  );

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        category: category,
        plan: role === 'artist' ? plan : 'fan',
        points: 0,
        createdAt: serverTimestamp(),
        isPinned: false,
        bio: '',
      });
      window.location.href = '/'; // Hard reload to refresh context
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const categories = {
    artist: ['RAPERO', 'BEATMAKER', 'PRODUCTOR', 'COMPOSITOR', 'FREESTYLER'],
    fan: ['BAILARÍN', 'ME GUSTA EL RAP', 'BEATBOXER', 'GRAFFITERO', 'OYENTE ACTIVO']
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
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

              <button 
                onClick={() => setRole('artist')}
                className={`p-8 md:p-10 rounded-[2.5rem] border-4 transition-all flex flex-col items-center gap-5 relative overflow-hidden group ${role === 'artist' ? 'border-brand-yellow bg-brand-yellow/5 shadow-glow scale-[1.02]' : 'border-white/5 hover:border-white/20 bg-white/[0.02]'}`}
              >
                 <div className={`p-5 rounded-2xl transition-all shadow-xl ${role === 'artist' ? 'bg-brand-yellow text-black -rotate-3' : 'bg-white/10 group-hover:-rotate-6'}`}>
                  <Mic2 size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tight">ARTISTA</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-2 leading-relaxed">Raperos, beatmakers y productores. Sube tu música a la radio.</p>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full md:w-auto px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-4 mx-auto group"
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
              {categories[role].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-8 py-4 rounded-2xl border-2 font-black italic uppercase text-lg transition-all ${category === cat ? 'bg-brand-yellow text-black border-brand-yellow shadow-glow scale-110' : 'bg-white/5 border-white/10 hover:border-white/30 text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button onClick={() => setStep(1)} className="px-8 py-4 bg-white/5 text-white/50 font-bold uppercase italic rounded-xl hover:bg-white/10">ATRÁS</button>
              <button 
                onClick={() => role === 'artist' ? setStep(3) : handleFinish()}
                disabled={!category || submitting}
                className="px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all disabled:opacity-20"
              >
                {role === 'artist' ? 'SELECCIONAR PLAN' : (submitting ? 'PREPARANDO...' : 'FINALIZAR')}
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
                onClick={handleFinish}
                disabled={submitting}
                className="px-12 py-5 bg-brand-yellow text-black font-black italic text-xl uppercase tracking-tighter rounded-xl hover:scale-105 transition-all disabled:opacity-20"
              >
                {submitting ? 'MONTANDO EL EQUIPO...' : 'LANZAR MI CARRERA'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileSetupView;
