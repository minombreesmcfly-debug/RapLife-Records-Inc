import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Settings, 
  Save, 
  Instagram, 
  Music, 
  MessageSquare, 
  User, 
  Globe, 
  AlertCircle, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  Check, 
  Crown, 
  RefreshCw,
  X
} from 'lucide-react';

const ProfileSettingsView = () => {
  const { user, profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Non-blocking toast/alert notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    instagramUrl: '',
    spotifyUrl: '',
    appleMusicUrl: '',
  });

  // VIP / AI Avatar Generation State
  const [avatarSelfie, setAvatarSelfie] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<string>('image/jpeg');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [submittingSubscription, setSubmittingSubscription] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        instagramUrl: profile.instagramUrl || '',
        spotifyUrl: profile.spotifyUrl || '',
        appleMusicUrl: profile.appleMusicUrl || '',
      });
    }
  }, [profile]);

  const isSubscribed = profile?.isSubscribed === true || profile?.plan === 'rookie' || profile?.plan === 'pro' || isAdmin;

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
    } catch (e: any) {
      console.error(e);
      showToast("Error al guardar cambios", 'error');
    }
    setLoading(false);
  };

  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido.', 'error');
      return;
    }

    setAvatarMime('image/jpeg');
    setAvatarError(null);
    setGeneratedAvatar(null);
    setGeneratingAvatar(true);

    try {
      const compressedBase64 = await compressAndGetBase64(file);
      setAvatarSelfie(compressedBase64);
      await generateAIAvatar(compressedBase64, 'image/jpeg');
    } catch (err: any) {
      console.error(err);
      setAvatarError('No se pudo procesar o comprimir la imagen original.');
      setGeneratingAvatar(false);
    }
  };

  const generateAIAvatar = async (base64Image: string, mime: string) => {
    setGeneratingAvatar(true);
    setAvatarError(null);
    try {
      const response = await fetch('/api/studio/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          mimeType: mime
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al generar el avatar.');
      }

      const data = await response.json();
      if (data.image) {
        setGeneratedAvatar(data.image);
        if (data.warning) {
          setAvatarError(data.warning);
        }
      } else {
        throw new Error('No se recibió la imagen generada.');
      }
    } catch (err: any) {
      console.error(err);
      // Localized friendly error message for quota or server load
      const userFriendlyMsg = "La plataforma está experimentando alta demanda actualmente. Por favor, intenta de nuevo más tarde o en las próximas 24 horas. Mientras tanto, hemos cargado tu foto original para que puedas guardarla y completar tu perfil sin problemas.";
      setAvatarError(userFriendlyMsg);
      // Auto-set generated avatar to the original compressed photo so they can still save it
      setGeneratedAvatar(base64Image);
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!user || !generatedAvatar) return;
    setSavingAvatar(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        avatarUrl: generatedAvatar,
        photoURL: generatedAvatar,
        updatedAt: serverTimestamp(),
      });
      showToast("🎉 ¡Tu foto de perfil ha sido guardada con éxito!", 'success');
    } catch (e: any) {
      console.error(e);
      showToast("Error al guardar la foto: " + e.message, 'error');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleDownloadAvatar = () => {
    if (!generatedAvatar) return;
    const link = document.createElement('a');
    link.href = generatedAvatar;
    link.download = `raplife_profile_${user?.uid || 'user'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setSubmittingSubscription(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isSubscribed: true,
        plan: 'pro',
        updatedAt: serverTimestamp(),
      });
      showToast("🎉 ¡FELICIDADES! Te has suscrito con éxito al club VIP de RapLife Records. Disfruta de tus beneficios.", 'success');
    } catch (e: any) {
      console.error(e);
      showToast("Error al activar suscripción: " + e.message, 'error');
    } finally {
      setSubmittingSubscription(false);
    }
  };

  if (!user) return <div className="p-20 text-center font-black uppercase text-xl">Debes iniciar sesión para configurar tu perfil.</div>;

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto space-y-10 mb-20">
      <header className="flex items-center gap-6">
        <div className="p-4 bg-brand-yellow text-black rounded-3xl shadow-glow">
          <Settings size={32} />
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter glow-yellow">AJUSTES DE PERFIL</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Configura tu presencia y crea tu avatar virtual</p>
        </div>
      </header>

      {/* Subscription Card Section */}
      <div className={`p-8 rounded-[2.5rem] border-4 flex flex-col md:flex-row items-center justify-between gap-6 transition-all relative overflow-hidden ${
        isSubscribed 
          ? 'border-brand-yellow/30 bg-brand-yellow/[0.02]' 
          : 'border-red-500/40 bg-red-500/[0.02] shadow-[0_0_15px_rgba(239,68,68,0.1)]'
      }`}>
        <div className="space-y-3 max-w-xl text-left">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <div className="flex items-center gap-2 bg-brand-yellow text-black px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                <Crown size={12} /> MIEMBRO VIP / {isAdmin ? 'ADMIN' : 'SUSCRITO'}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase animate-pulse">
                <Crown size={12} /> SUSCRIPCIÓN INACTIVA
              </div>
            )}
          </div>
          <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tight text-white">
            {isSubscribed ? 'BENEFICIOS VIP ACTIVADOS' : 'ÚNETE AL CLUB RAPLIFE RECORDS VIP'}
          </h3>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            {isSubscribed 
              ? 'Tienes acceso exclusivo al Generador de Avatar Retro 2D con IA, rotación VIP en la radio y el distintivo plateado en el chat. ¡Crea tu avatar a continuación!'
              : 'Suscríbete ahora para desbloquear el creador automático de Avatares Virtuales Retro 2D con Inteligencia Artificial, subir tus propias fotos de perfil reales, obtener prioridad en la radio y más.'
            }
          </p>
        </div>

        {!isSubscribed && (
          <button
            onClick={handleSubscribe}
            disabled={submittingSubscription}
            className="w-full md:w-auto px-8 py-4.5 bg-brand-yellow text-black font-black italic uppercase rounded-xl shadow-glow hover:scale-[1.03] transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            {submittingSubscription ? 'ACTIVANDO...' : (
              <>
                <Crown size={18} />
                SUSCRIBIRME POR $199/mes
              </>
            )}
          </button>
        )}
      </div>

      {/* AI Avatar Creator / Upload Selfie Section (VIP only) */}
      {isSubscribed && (
        <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray space-y-6 text-left relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-yellow/10 text-brand-yellow rounded-2xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tight text-white">AVATAR VIRTUAL VIP RAPLIFE (IA)</h3>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sube tu foto y transfórmala al instante con IA de Gemini</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-2">
            {/* Input portrait picker */}
            <div className="flex flex-col justify-center items-center p-6 border-4 border-dashed border-white/10 hover:border-brand-yellow/30 bg-black/40 rounded-3xl transition-all relative text-center min-h-[300px]">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handlePhotoSelect} 
                className="hidden" 
              />
              
              {avatarSelfie ? (
                <div className="space-y-4 w-full">
                  <div className="relative w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-white/10 shadow-lg">
                    <img src={avatarSelfie} alt="Tu Foto original" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Foto original cargada</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-xs font-black uppercase text-brand-yellow hover:underline flex items-center gap-1.5 mx-auto"
                    >
                      <RefreshCw size={12} /> CAMBIAR FOTO
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 bg-white/5 rounded-full inline-block text-white/50">
                    <Upload size={36} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic text-white">SUBE TU FOTO</h4>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1 max-w-xs mx-auto leading-relaxed">
                      Sube un retrato frontal con buena iluminación para convertirlo en caricatura retro de RapLife
                    </p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3.5 bg-white/5 border border-white/10 hover:border-brand-yellow text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    SELECCIONAR ARCHIVO
                  </button>
                </div>
              )}
            </div>

            {/* AI Output / Result preview */}
            <div className="flex flex-col justify-center items-center p-6 bg-black/40 border border-white/5 rounded-3xl min-h-[300px] text-center relative">
              {generatingAvatar ? (
                <div className="space-y-4">
                  <DiscProgress />
                  <p className="text-xs font-black text-brand-yellow uppercase tracking-widest animate-pulse max-w-xs mx-auto leading-relaxed">
                    ⚡ TRANSFORMANDO TU RETRATO A AVATAR RETRO 2D CON INTELIGENCIA ARTIFICIAL... POR FAVOR ESPERA
                  </p>
                </div>
              ) : generatedAvatar ? (
                <div className="space-y-4 w-full flex flex-col justify-between h-full">
                  <div className="space-y-3">
                    <div className={`mx-auto rounded-full overflow-hidden border-4 border-brand-yellow shadow-glow transition-all duration-300 ${avatarError ? 'w-28 h-28' : 'w-44 h-44'}`}>
                      <img src={generatedAvatar} alt="Avatar Generado por IA" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex items-center gap-1.5 justify-center text-brand-yellow">
                      <Check size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {avatarError ? 'FOTO DE PERFIL DISPONIBLE' : '¡AVATAR LISTO PARA EL GHETTO!'}
                      </span>
                    </div>

                    {avatarError && (
                      <div className="relative bg-brand-yellow border-[3px] border-black text-black px-4 py-3 rounded-xl text-[10px] md:text-[11px] font-black tracking-wide leading-relaxed text-center shadow-[4px_4px_0px_rgba(0,0,0,1)] my-3 mx-2">
                        {/* Comic speech bubble tail pointing UP towards the avatar */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-yellow border-t-[3px] border-l-[3px] border-black rotate-45"></div>
                        <p className="relative z-10 text-red-600 font-extrabold uppercase tracking-widest text-[8px] mb-0.5">⚠️ ALTA DEMANDA VIP</p>
                        <p className="relative z-10 text-black uppercase tracking-tight font-extrabold leading-normal">{avatarError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={handleSaveAvatar}
                      disabled={savingAvatar}
                      className="w-full py-3.5 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-glow hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingAvatar ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          GUARDANDO EN EL SERVIDOR...
                        </>
                      ) : (
                        '💾 GUARDAR COMO FOTO DE PERFIL'
                      )}
                    </button>
                    <button
                      onClick={handleDownloadAvatar}
                      className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={14} /> DESCARGAR MI AVATAR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-gray-500">
                  <div className="p-6 bg-white/[0.01] rounded-full inline-block text-white/10">
                    <ImageIcon size={36} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider">PREVIEW DE AVATAR IA</h4>
                    <p className="text-xs text-gray-600 font-bold uppercase mt-1 max-w-xs mx-auto leading-relaxed">
                      El resultado aparecerá aquí automáticamente al cargar tu foto original
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Profile Form Card */}
      <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray space-y-8 boombox-texture">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* General Info */}
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><User size={12}/> NOMBRE PÚBLICO / AKA</label>
                 <input 
                   type="text" 
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none font-bold text-white"
                   value={formData.displayName}
                   onChange={e => setFormData({...formData, displayName: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={12}/> MINI BIO</label>
                 <textarea 
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none font-medium h-32 resize-none text-white"
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
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm text-white"
                   value={formData.instagramUrl}
                   onChange={e => setFormData({...formData, instagramUrl: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Music size={12}/> SPOTIFY ARTIST URL</label>
                 <input 
                   type="url" 
                   placeholder="https://open.spotify.com/artist/..."
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm text-white"
                   value={formData.spotifyUrl}
                   onChange={e => setFormData({...formData, spotifyUrl: e.target.value})}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12}/> APPLE MUSIC URL</label>
                 <input 
                   type="url" 
                   placeholder="https://music.apple.com/artist/..."
                   className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none text-sm text-white"
                   value={formData.appleMusicUrl}
                   onChange={e => setFormData({...formData, appleMusicUrl: e.target.value})}
                 />
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

      {/* Toast Notification */}
      {toast && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-2xl border-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-black border-brand-yellow text-white' 
              : toast.type === 'error'
              ? 'bg-black border-red-500 text-white'
              : 'bg-black border-blue-500 text-white'
          }`}
        >
          <div className={`p-2 rounded-xl ${
            toast.type === 'success' 
              ? 'bg-brand-yellow/10 text-brand-yellow' 
              : toast.type === 'error'
              ? 'bg-red-500/10 text-red-500'
              : 'bg-blue-500/10 text-blue-500'
          }`}>
            {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {toast.type === 'success' ? 'ÉXITO' : toast.type === 'error' ? 'ERROR' : 'AVISO'}
            </p>
            <p className="text-[11px] font-bold text-white uppercase tracking-tight leading-normal mt-0.5">
              {toast.message}
            </p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
};

// Simple rotating loading disc component
const DiscProgress = () => (
  <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full border-4 border-brand-yellow/20 animate-pulse"></div>
    <div className="absolute inset-0 rounded-full border-4 border-t-brand-yellow border-r-transparent border-b-transparent border-l-transparent animate-spin duration-500"></div>
    <div className="w-4 h-4 rounded-full bg-brand-yellow"></div>
  </div>
);

export default ProfileSettingsView;
