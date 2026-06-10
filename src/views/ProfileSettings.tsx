import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settings, Save, Instagram, Music, MessageSquare, User, Globe, AlertCircle, Key } from 'lucide-react';

const ProfileSettingsView = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    instagramUrl: '',
    spotifyUrl: '',
    appleMusicUrl: '',
    geminiApiKey: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        instagramUrl: profile.instagramUrl || '',
        spotifyUrl: profile.spotifyUrl || '',
        appleMusicUrl: profile.appleMusicUrl || '',
        geminiApiKey: profile.geminiApiKey || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Error al guardar cambios");
    }
    setLoading(false);
  };

  if (!user) return <div className="p-20 text-center">Debes iniciar sesión.</div>;

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto space-y-10 mb-20">
      <header className="flex items-center gap-6">
        <div className="p-4 bg-brand-yellow text-black rounded-3xl shadow-glow">
          <Settings size={32} />
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter glow-yellow">AJUSTES DE PERFIL</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Configura tu presencia en RAPLIFE RECORDS</p>
        </div>
      </header>

      <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray space-y-8 boombox-texture">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* General Info */}
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><User size={12}/> NOMBRE PÚBLICO / AKA</label>
                 <input 
                   type="text" 
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none font-bold"
                   value={formData.displayName}
                   onChange={e => setFormData({...formData, displayName: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={12}/> MINI BIO</label>
                 <textarea 
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none font-medium h-32 resize-none"
                   placeholder="Cuéntale al mundo quién eres..."
                   value={formData.bio}
                   onChange={e => setFormData({...formData, bio: e.target.value})}
                 />
              </div>
           </div>

           {/* Social Links */}
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Instagram size={12}/> INSTAGRAM URL</label>
                 <input 
                   type="url" 
                   placeholder="https://instagram.com/tuusuario"
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm"
                   value={formData.instagramUrl}
                   onChange={e => setFormData({...formData, instagramUrl: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Music size={12}/> SPOTIFY ARTIST URL</label>
                 <input 
                   type="url" 
                   placeholder="https://open.spotify.com/artist/..."
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm"
                   value={formData.spotifyUrl}
                   onChange={e => setFormData({...formData, spotifyUrl: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12}/> APPLE MUSIC URL</label>
                 <input 
                   type="url" 
                   placeholder="https://music.apple.com/artist/..."
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm"
                   value={formData.appleMusicUrl}
                   onChange={e => setFormData({...formData, appleMusicUrl: e.target.value})}
                 />
              </div>

              <div className="border border-white/5 bg-white/[0.02] p-4 rounded-2xl relative space-y-3">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-yellow uppercase tracking-widest flex items-center gap-2">
                      <Key size={12}/> CLAVE API DE GEMINI PERSONAL (OPCIONAL)
                    </label>
                    <input 
                      type="password" 
                      placeholder="AIzaSy..."
                      className="w-full bg-black/50 border border-brand-yellow/10 focus:border-brand-yellow p-4 rounded-xl outline-none text-xs font-mono"
                      value={formData.geminiApiKey}
                      onChange={e => setFormData({...formData, geminiApiKey: e.target.value})}
                    />
                 </div>
                 <p className="text-[9px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                   💡 ¿Quieres usar tus propios limites gratuitos? Crea una clave sin cargo en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-yellow hover:underline">Google AI Studio</a> y guardala aquí para no consumir la cuota general.
                 </p>
              </div>
           </div>
        </div>

        <div className="p-4 bg-brand-yellow/5 rounded-2xl border border-brand-yellow/20 flex gap-4 items-center">
           <AlertCircle className="text-brand-yellow flex-shrink-0" size={20} />
           <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-wider italic">
             Tu perfil es t&uacute; carta de presentaci&oacute;n. Aseg&uacute;rate de que los enlaces funcionen correctamente para que tus fans puedan seguirte en todas partes.
           </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full py-5 bg-brand-yellow text-black font-black italic uppercase text-lg rounded-xl shadow-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {loading ? 'GUARDANDO...' : (
            <>
              {success ? '¡CAMBIOS GUARDADOS!' : 'GUARDAR CONFIGURACIÓN'}
              <Save size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProfileSettingsView;
