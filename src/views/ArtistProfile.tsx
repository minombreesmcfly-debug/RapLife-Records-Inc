import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Music, Instagram, Share2, Heart, Play, ExternalLink, Disc, Mic2, ArrowLeft, Pencil, Trash2, Plus, Upload, Film, Video } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';

const ArtistProfileView = () => {
  const { id } = useParams();
  const uid = id;
  const { play } = useMusic();
  const { user, isAdmin } = useAuth();
  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    photoURL: '',
    spotifyUrl: '',
    instagramUrl: '',
    appleMusicUrl: '',
    isPinned: false,
    isExclusive: true
  });
  const [reelsList, setReelsList] = useState<string[]>([]);
  const [newReelUrl, setNewReelUrl] = useState('');

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `artists/photos/${uid}/${Date.now()}_${file.name}`);
      const uploadPromise = uploadBytes(storageRef, file).then(() => getDownloadURL(storageRef));
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
      
      let finalUrl = '';
      try {
        finalUrl = await Promise.race([uploadPromise, timeoutPromise]);
        alert('¡Imagen subida al servidor con éxito!');
      } catch (uploadError) {
        console.warn("Storage upload failed or timed out, falling back to local optimized Base64:", uploadError);
        finalUrl = await compressAndGetBase64(file);
        alert('¡Imagen optimizada y cargada localmente con éxito (modo Base64-Ultra)!');
      }

      setEditForm(prev => ({ ...prev, photoURL: finalUrl }));
    } catch (err: any) {
      console.error(err);
      alert('Error al procesar la imagen: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        displayName: editForm.displayName,
        bio: editForm.bio,
        photoURL: editForm.photoURL,
        spotifyUrl: editForm.spotifyUrl,
        instagramUrl: editForm.instagramUrl,
        appleMusicUrl: editForm.appleMusicUrl,
        isPinned: editForm.isPinned,
        isExclusive: editForm.isExclusive,
        reels: reelsList,
        updatedAt: serverTimestamp()
      });
      
      setArtist({
        ...artist,
        displayName: editForm.displayName,
        bio: editForm.bio,
        photoURL: editForm.photoURL,
        spotifyUrl: editForm.spotifyUrl,
        instagramUrl: editForm.instagramUrl,
        appleMusicUrl: editForm.appleMusicUrl,
        isPinned: editForm.isPinned,
        isExclusive: editForm.isExclusive,
        reels: reelsList
      });
      
      setShowEditForm(false);
      alert('¡Perfil del artista actualizado correctamente!');
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchArtist = async () => {
      if (!uid) return;
      try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setArtist(data);
          setEditForm({
            displayName: data.displayName || '',
            bio: data.bio || '',
            photoURL: data.photoURL || '',
            spotifyUrl: data.spotifyUrl || '',
            instagramUrl: data.instagramUrl || '',
            appleMusicUrl: data.appleMusicUrl || '',
            isPinned: data.isPinned || false,
            isExclusive: data.isExclusive !== false
          });
          setReelsList(data.reels || []);
        }

        const q = query(collection(db, 'tracks'), where('artistId', '==', uid), orderBy('createdAt', 'desc'));
        const trackSnap = await getDocs(q);
        setTracks(trackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading artist in profile page:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtist();
  }, [uid]);

  const renderReelEmbed = (url: string) => {
    // Detect YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
    const videoId = ytMatch ? ytMatch[1] : null;

    if (videoId) {
      return (
        <div className="aspect-[9/16] w-full rounded-2xl overflow-hidden border border-white/10 bg-black relative shadow-lg">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
    }

    // Direct video formats
    if (url.match(/\.(mp4|webm|ogg)$/i) || url.includes('storage.googleapis.com')) {
      return (
        <div className="aspect-[9/16] w-full rounded-2xl overflow-hidden border border-white/10 bg-black relative flex items-center shadow-lg">
          <video src={url} controls className="w-full h-full object-cover" />
        </div>
      );
    }

    // Generic link card
    return (
      <div className="aspect-[9/16] w-full bg-neutral-900 border-2 border-dashed border-white/10 p-5 rounded-2xl flex flex-col justify-between hover:border-brand-yellow/30 transition-all group/card shadow-lg">
        <div className="p-3 bg-white/5 rounded-xl self-start text-brand-yellow group-hover/card:scale-110 transition-transform">
          <Film size={20} />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">REEL EXTERNO</p>
          <p className="text-[11px] font-bold text-gray-300 line-clamp-2 truncate break-all">{url}</p>
        </div>
        <a 
          href={url} target="_blank" rel="noopener noreferrer"
          className="w-full py-2.5 bg-brand-yellow text-black text-center font-black uppercase text-[9px] tracking-wider rounded-xl transition-all shadow-glow hover:scale-[1.02] flex items-center justify-center gap-1.5"
        >
          <Play size={10} className="fill-black" /> VER VIDEO
        </a>
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center animate-pulse italic font-black uppercase text-xl text-brand-yellow">CARGANDO PERFIL...</div>;
  if (!artist) return <div className="p-20 text-center text-white font-bold italic uppercase">Artista no encontrado.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-10 max-w-6xl mx-auto space-y-10"
    >
      <div className="flex justify-between items-center mb-4">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-yellow font-bold uppercase text-xs tracking-widest transition-colors">
          <ArrowLeft size={16} /> REGRESAR
        </Link>
        {isAdmin && (
          <button 
            type="button"
            onClick={() => setShowEditForm(!showEditForm)}
            className="px-4 py-2 bg-brand-yellow hover:scale-[1.03] text-black font-black uppercase text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Pencil size={14} /> {showEditForm ? 'CERRAR EDICIÓN' : 'EDITAR PERFIL (ADMIN)'}
          </button>
        )}
      </div>

      {showEditForm && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-dark p-6 md:p-8 rounded-[2rem] border-4 border-boombox-gray space-y-6"
        >
          <div className="flex items-center gap-3">
            <Pencil className="text-brand-yellow" size={24} />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">EDITAR PERFIL DE ARTISTA</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nombre del Artista *</label>
                <input 
                  type="text" required
                  className="w-full bg-black/60 border border-white/10 p-4 rounded-xl text-sm focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                  value={editForm.displayName}
                  onChange={e => setEditForm({...editForm, displayName: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Foto de Perfil</label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="text"
                    className="flex-grow bg-black/60 border border-white/10 p-4 rounded-xl text-sm focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                    placeholder="URL de foto o sube un archivo"
                    value={editForm.photoURL}
                    onChange={e => setEditForm({...editForm, photoURL: e.target.value})}
                  />
                  <label className="px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center gap-2 transition-all">
                    <Upload size={14} />
                    {uploadingPhoto ? 'SUBIENDO...' : 'SUBIR FOTO'}
                    <input 
                      type="file" accept="image/*" className="hidden"
                      onChange={handlePhotoUpload} disabled={uploadingPhoto}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Biografía o Slogan</label>
              <textarea 
                rows={3}
                className="w-full bg-black/60 border border-white/10 p-4 rounded-xl text-sm focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                value={editForm.bio}
                onChange={e => setEditForm({...editForm, bio: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Spotify URL</label>
                <input 
                  type="text" placeholder="https://open.spotify.com/artist/..."
                  className="w-full bg-black/60 border border-white/10 p-4 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                  value={editForm.spotifyUrl}
                  onChange={e => setEditForm({...editForm, spotifyUrl: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Instagram URL</label>
                <input 
                  type="text" placeholder="https://instagram.com/..."
                  className="w-full bg-black/60 border border-white/10 p-4 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                  value={editForm.instagramUrl}
                  onChange={e => setEditForm({...editForm, instagramUrl: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Apple Music URL</label>
                <input 
                  type="text" placeholder="https://music.apple.com/..."
                  className="w-full bg-black/60 border border-white/10 p-4 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                  value={editForm.appleMusicUrl}
                  onChange={e => setEditForm({...editForm, appleMusicUrl: e.target.value})}
                />
              </div>
            </div>

            {/* REELS BUILDER */}
            <div className="bg-black/50 p-5 rounded-2xl border border-white/5 space-y-4">
              <div>
                <h4 className="text-xs font-black italic uppercase text-brand-yellow">VIDEOCLIPS / REELS DE ARTISTA</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide leading-relaxed mt-1">Ingresa enlaces de Youtube Shorts, videos, Instagram reels o archivos .mp4 directos.</p>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Ej: https://www.youtube.com/shorts/VIDEO_ID"
                  className="flex-grow bg-black/85 border border-white/10 p-4 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                  value={newReelUrl}
                  onChange={e => setNewReelUrl(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (newReelUrl.trim()) {
                      setReelsList([...reelsList, newReelUrl.trim()]);
                      setNewReelUrl('');
                    }
                  }}
                  className="px-6 bg-brand-yellow text-black font-black uppercase text-xs rounded-xl flex items-center gap-1 hover:scale-[1.01] transition-all cursor-pointer"
                >
                  <Plus size={14} /> AGREGAR
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                {reelsList.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                    <span className="font-mono text-gray-400 select-all truncate flex-1 mr-4">{url}</span>
                    <button 
                      type="button"
                      onClick={() => setReelsList(reelsList.filter((_, i) => i !== index))}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {reelsList.length === 0 && (
                  <p className="text-center text-[10px] text-gray-650 font-bold uppercase tracking-wider italic">No hay reels cargados todavía</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" id="profile-pin"
                  className="rounded bg-black border-white/10 text-brand-yellow focus:ring-brand-yellow"
                  checked={editForm.isPinned}
                  onChange={e => setEditForm({...editForm, isPinned: e.target.checked})}
                />
                <label htmlFor="profile-pin" className="text-[11px] font-black uppercase text-gray-400 cursor-pointer">Fijar artista destacado (PIN)</label>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <input 
                  type="checkbox" id="profile-exclusive"
                  className="rounded bg-black border-white/10 text-brand-yellow focus:ring-brand-yellow"
                  checked={editForm.isExclusive}
                  onChange={e => setEditForm({...editForm, isExclusive: e.target.checked})}
                />
                <label htmlFor="profile-exclusive" className="text-[11px] font-black uppercase text-gray-400 cursor-pointer">Artista Exclusivo RapLife</label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="submit" disabled={saving}
                className="flex-grow py-4 bg-brand-yellow text-black font-black uppercase text-xs rounded-xl shadow-glow hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-20 cursor-pointer"
              >
                {saving ? 'GUARDANDO CAMBIOS...' : 'GUARDAR CAMBIOS EN PERFIL'}
              </button>
              <button 
                type="button"
                onClick={() => setShowEditForm(false)}
                className="px-6 py-4 bg-white/5 text-white font-black uppercase text-xs rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <header className="relative flex flex-col md:flex-row gap-10 items-end">
        {/* Profile Image with Boombox Frame */}
        <div className="relative w-full md:w-80 aspect-square group">
           <div className="absolute inset-0 bg-brand-yellow rounded-3xl rotate-3 scale-105 opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
           <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border-4 border-boombox-gray shadow-2xl">
              <img src={artist.photoURL || 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?q=80&w=400&auto=format&fit=crop'} className="w-full h-full object-cover grayscale-0 md:grayscale group-hover:grayscale-0 transition-all duration-700" alt={artist.displayName} />
           </div>
           <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-brand-yellow rounded-2xl flex items-center justify-center text-black shadow-lg transform rotate-6 z-20">
              <Disc className="animate-spin-slow" size={32} />
           </div>
        </div>

        <div className="flex-1 space-y-4 text-left">
           <div className="flex flex-wrap gap-2">
             {artist.isPinned && (
               <span className="bg-brand-yellow text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-glow">DESTACADO RAPLIFE</span>
             )}
             {artist.isExclusive !== false && (
               <span className="bg-black/50 text-brand-green border border-brand-green/35 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-md">EXCLUSIVO RAP LIFE RECORDS</span>
             )}
           </div>
           <div>
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter glow-yellow leading-[0.8] mb-4">{artist.displayName}</h1>
              <div className="flex gap-4">
                 {artist.spotifyUrl && (
                   <a href={artist.spotifyUrl} target="_blank" className="p-3 bg-[#1DB954]/20 border border-[#1DB954]/50 rounded-xl text-[#1DB954] hover:bg-[#1DB954] hover:text-white transition-all">
                      <Music size={20} />
                   </a>
                 )}
                 {artist.appleMusicUrl && (
                   <a href={artist.appleMusicUrl} target="_blank" className="p-3 bg-[#FA243C]/20 border border-[#FA243C]/50 rounded-xl text-[#FA243C] hover:bg-[#FA243C] hover:text-white transition-all">
                      <ExternalLink size={20} />
                   </a>
                 )}
                 {artist.instagramUrl && (
                   <a href={artist.instagramUrl} target="_blank" className="p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white hover:text-black transition-all">
                      <Instagram size={20} />
                   </a>
                 )}
              </div>
           </div>
           <p className="text-gray-400 font-medium leading-relaxed max-w-xl italic">
              {artist.bio || "Este artista aún no ha escrito su biografía oficial. Sigue su música en RAPLIFE RECORDS."}
           </p>
        </div>
      </header>

      {/* Visualizer & Tracks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-10">
         <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
               <Mic2 className="text-brand-yellow" size={24} />
               <h2 className="text-2xl font-black italic uppercase tracking-tighter">DISCOGRAFÍA</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
               {tracks.map((track, i) => (
                 <motion.div 
                   key={track.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="group flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-brand-yellow/30 transition-all cursor-pointer relative overflow-hidden"
                   onClick={() => play(track)}
                 >
                    <div className="text-xs font-mono opacity-30 group-hover:opacity-100 transition-opacity w-4">{(i + 1).toString().padStart(2, '0')}</div>
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                       <img src={track.coverUrl || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="font-bold italic uppercase tracking-tight truncate group-hover:text-brand-yellow transition-colors">{track.title}</h3>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{artist.displayName}</p>
                    </div>
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Heart size={18} className="text-gray-500 hover:text-brand-yellow transition-colors" />
                       <Share2 size={18} className="text-gray-500 hover:text-brand-yellow transition-colors" />
                       <Play size={20} className="text-brand-yellow fill-brand-yellow" />
                    </div>
                 </motion.div>
               ))}
               {tracks.length === 0 && (
                 <div className="py-20 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/5 opacity-30 italic font-black uppercase text-xs tracking-widest">
                    EL ESTUDIO ESTÁ VACÍO... POR AHORA.
                 </div>
               )}
            </div>
         </div>

         {/* Visualizer Placeholder / Interactive sidebar */}
         <aside className="space-y-8">
            <div className="bg-black border-4 border-boombox-gray rounded-[2.5rem] p-8 h-80 flex flex-col items-center justify-center relative overflow-hidden boombox-texture">
               <div className="flex items-center gap-1 h-32 w-full justify-center">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                    <motion.div 
                      key={i} 
                      className="w-2 bg-brand-yellow shadow-glow"
                      animate={{ height: [10, 80, 40, 100, 20, 90, 10] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                      style={{ opacity: 0.2 + (i * 0.05) }}
                    />
                  ))}
               </div>
               <p className="text-[10px] font-mono uppercase tracking-[0.3em] mt-6 text-brand-yellow">REAL-TIME VISUALIZER</p>
               
               {/* Screws */}
               <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
               <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-boombox-gray border border-black/50" />
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-brand-yellow">RANKING DE LA CALLE</h3>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-gray-500">Popularidad</span>
                  <span className="font-mono text-brand-yellow">TOP 10</span>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-gray-500">Oyentes Mensuales</span>
                  <span className="font-mono text-brand-yellow">12.5K</span>
               </div>
            </div>
         </aside>
      </div>

      {/* REELS SECTION */}
      {artist.reels && artist.reels.length > 0 && (
        <section className="space-y-6 pt-10 border-t border-white/10 text-left">
          <div className="flex items-center gap-3">
             <Video className="text-brand-yellow" size={24} />
             <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">REELS Y VIDEOCLIPS EXCLUSIVOS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {artist.reels.map((reel: string, i: number) => (
                <div key={i} className="flex flex-col">
                   {renderReelEmbed(reel)}
                </div>
             ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default ArtistProfileView;
