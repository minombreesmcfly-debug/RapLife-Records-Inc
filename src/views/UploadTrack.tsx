import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Upload, Music, Image as ImageIcon, CheckCircle, AlertCircle, Disc } from 'lucide-react';

const UploadTrackView = () => {
  const { user, profile, isAdmin } = useAuth();
  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (user && !artistName) setArtistName(user.displayName || '');
  }, [user]);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [trackCount, setTrackCount] = useState(0);

  React.useEffect(() => {
    const checkCount = async () => {
      if (!user) return;
      const q = query(collection(db, 'tracks'), where('artistId', '==', user.uid));
      const snap = await getDocs(q);
      setTrackCount(snap.docs.length);
    };
    checkCount();
  }, [user]);

  const handleUpload = async () => {
    if (!user || !trackFile || !title) {
       alert("Faltan campos obligatorios (Archivo y Título)");
       return;
    }
    
    // Free limit check (unless admin)
    if (trackCount >= 3 && !isAdmin) {
      alert("Has alcanzado el límite gratuito de 3 canciones. Contacta con RAPLIFE para planes Pro.");
      return;
    }

    setUploading(true);
    setProgress(10);
    console.log("Upload started via Server Proxy for track:", trackFile.name);
    
    try {
      const formData = new FormData();
      formData.append('track', trackFile);
      if (coverFile) formData.append('cover', coverFile);
      formData.append('userId', user.uid);
      formData.append('title', title);
      formData.append('artistName', artistName);

      // We'll simulate progress because fetch doesn't easily support upload progress without XHR
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90;
          return prev + 5;
        });
      }, 1000);

      const response = await fetch('/api/upload-track', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        let errorMessage = 'Error desconocido en el servidor';
        try {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
            console.error("[UPLOAD] Server error details:", errorData);
          } catch (e) {
            errorMessage = errorText || errorMessage;
            console.error("[UPLOAD] Raw server error text:", errorText);
          }
        } catch (parseError) {
          console.error("[UPLOAD] Failed to read error response body");
        }
        throw new Error(errorMessage);
      }

      console.log("[UPLOAD] Server response received successfully");
      const { audioUrl, coverUrl } = await response.json();
      setProgress(95);

      // 2. Save to Firestore (Client-side is fine for this)
      console.log("[UPLOAD] Saving track record to Firestore...");
      const trackData = {
        artistId: user.uid,
        artistName: artistName || user.displayName || 'Artista Desconocido',
        title,
        audioUrl,
        coverUrl,
        isRadioInterstitial: false,
        createdAt: serverTimestamp(),
        playCount: 0,
        approved: isAdmin ? true : false,
        status: isAdmin ? 'approved' : 'pending'
      };
      
      const docRef = await addDoc(collection(db, 'tracks'), trackData);
      console.log("[UPLOAD] Firestore record saved with ID:", docRef.id);

      setProgress(100);
      setSuccess(true);

      // Stay on success screen longer or don't reset automatically
      setTimeout(() => {
        // Only reset if they haven't started another upload? 
        // For now just keep it simple but longer duration
      }, 10000);

    } catch (e: any) {
      console.error("[UPLOAD] FULL ERROR CATCH:", e);
      alert("⚠️ ERROR EN LA SUBIDA:\n" + (e.message || "Error desconocido. Por favor, revisa tu conexión."));
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setTitle('');
    setTrackFile(null);
    setCoverFile(null);
    setProgress(0);
  };

  if (profile?.role !== 'artist' && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-10 text-center space-y-6">
        <Disc size={64} className="text-gray-700 animate-pulse" />
        <h1 className="text-3xl font-black uppercase italic">SOLO PARA ARTISTAS</h1>
        <p className="text-gray-500 max-w-md">Para subir m&uacute;sica debes tener una cuenta de artista. Puedes cambiar tu rol en configuraci&oacute;n si eres nuevo.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto space-y-10 mb-20">
      <header>
        <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter glow-yellow">PROPUESTA MUSICAL</h1>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4">
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ESTADO DO PERFIL:</span>
              <span className="text-[10px] font-black text-brand-yellow uppercase tracking-widest bg-brand-yellow/10 px-3 py-1 rounded-full border border-brand-yellow/20">
                {isAdmin ? 'ADMINISTRADOR (SIN LÍMITES)' : (profile?.plan?.toUpperCase() || 'GRATUITO')}
              </span>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">TRACKS:</span>
              <span className="text-[10px] font-black text-white uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">{trackCount} SUBIDOS</span>
           </div>
        </div>
      </header>

      <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray space-y-8 relative overflow-hidden boombox-texture">
        {success ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-10 text-center space-y-6"
          >
             <CheckCircle className="text-brand-yellow mx-auto" size={80} />
             <div className="space-y-2">
               <h2 className="text-2xl font-black uppercase italic">{isAdmin ? '¡TRACK PUBLICADO!' : 'PROPUESTA RECIBIDA'}</h2>
               <p className="text-gray-500 uppercase font-black text-xs tracking-widest leading-relaxed max-w-md mx-auto">
                 {isAdmin 
                   ? 'TU TRACK YA ESTÁ DISPONIBLE EN EL FEED Y EN LA RADIO.' 
                   : 'TU TRACK HA SIDO ENVIADO A REVISIÓN. TE NOTIFICAREMOS SI ES APROBADO.'}
               </p>
             </div>
             
             <button 
               onClick={resetForm}
               className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black italic uppercase text-xs rounded-xl border border-white/10 transition-all"
             >
               SUBIR OTRA CANCIÓN
             </button>
          </motion.div>
        ) : (
          <>
          {!isAdmin && (
            <div className="p-6 bg-brand-yellow/10 rounded-3xl border-2 border-brand-yellow/30 flex gap-5 items-start">
               <AlertCircle className="text-brand-yellow shrink-0 mt-1" size={24} />
               <div className="space-y-1">
                 <p className="text-sm font-black uppercase italic text-brand-yellow">PROCESO DE REVISIÓN</p>
                 <p className="text-[11px] font-bold text-gray-300 leading-relaxed uppercase tracking-wide">
                   TODOS LOS TRACKS SERÁN REVISADOS POR NUESTRO EQUIPO EN UN MÁXIMO DE 15 DÍAS. SI ES APROBADO, SE SUBIRÁ A <span className="text-white">RAPLIFE RADIO</span> AUTOMÁTICAMENTE.
                 </p>
               </div>
            </div>
          )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">TÍTULO DE LA CANCIÓN</label>
                <input 
                  type="text" 
                  placeholder="EJ: MI VIDA EN EL BEAT"
                  className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl focus:border-brand-yellow outline-none transition-all font-black italic uppercase text-lg"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">NOMBRE DEL ARTISTA</label>
                <input 
                  type="text" 
                  placeholder="EJ: MC FLY"
                  className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl focus:border-brand-yellow outline-none transition-all font-black italic uppercase text-lg"
                  value={artistName}
                  onChange={e => setArtistName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Audio Upload */}
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">ARCHIVO DE AUDIO (.MP3)</label>
                  <div className="relative group min-h-[200px]">
                     <input 
                       type="file" accept="audio/*" 
                       className="absolute inset-0 opacity-0 cursor-pointer z-10"
                       onChange={e => setTrackFile(e.target.files?.[0] || null)}
                     />
                     <div className={`w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all ${trackFile ? 'border-brand-yellow bg-brand-yellow/5' : 'border-white/10 bg-white/[0.02] hover:border-white/30'}`}>
                        <Music size={40} className={`mb-4 ${trackFile ? 'text-brand-yellow' : 'text-gray-600'}`} />
                        <p className="text-[10px] font-black uppercase tracking-tighter text-center line-clamp-1">{trackFile ? trackFile.name : 'ARRASTRA O SELECCIONA AUDIO'}</p>
                     </div>
                  </div>
               </div>

               {/* Cover Upload */}
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">ARTE / PORTADA (OBLIGATORIO)</label>
                  <div className="relative group min-h-[200px]">
                     <input 
                       type="file" accept="image/*" 
                       className="absolute inset-0 opacity-0 cursor-pointer z-10"
                       onChange={e => setCoverFile(e.target.files?.[0] || null)}
                     />
                     <div className={`w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all ${coverFile ? 'border-brand-yellow bg-brand-yellow/5' : 'border-white/10 bg-white/[0.02] hover:border-white/30'}`}>
                        {coverFile ? (
                           <img src={URL.createObjectURL(coverFile)} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <>
                            <ImageIcon size={40} className="text-gray-600 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-tighter text-center">SUBIR IMAGEN</p>
                          </>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-4 bg-brand-yellow/5 rounded-2xl border border-brand-yellow/20 flex gap-4 items-center">
               <AlertCircle className="text-brand-yellow flex-shrink-0" size={20} />
               <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-wider italic">
                 AL SUBIR ESTE TRACK, CONFIRMAS QUE TIENES LOS DERECHOS DE AUTOR O PERMISO DEL PRODUCTOR PARA LA DISTRIBUCIÓN EN RAPLIFE RECORDS.
               </p>
            </div>

            {(!trackFile || !coverFile || !title) && !uploading && (
              <p className="text-[10px] font-black text-brand-yellow/60 uppercase text-center animate-pulse">
                DEBES SELECCIONAR MP3, PORTADA Y PONER UN TÍTULO
              </p>
            )}

            {uploading && (
              <p className="text-[10px] font-black text-brand-yellow/60 uppercase text-center animate-pulse">
                POR FAVOR, NO CIERRES ESTA VENTANA HASTA QUE TERMINE LA SUBIDA
              </p>
            )}

            <button 
              onClick={handleUpload}
              disabled={uploading || !trackFile || !coverFile || !title}
              className="w-full py-6 bg-brand-yellow text-black font-black italic uppercase text-2xl rounded-2xl shadow-glow active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4 group relative overflow-hidden"
            >
              {uploading && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="absolute inset-y-0 left-0 bg-white/40 z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-4">
                {uploading ? (
                   <>
                     <Disc className="animate-spin" size={28} />
                     {progress < 95 ? `SUBIENDO ${Math.round(progress)}%` : 'FINALIZANDO...'}
                   </>
                ) : (
                  <>
                    LANZAR TRACK <Upload size={24} className="group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadTrackView;
