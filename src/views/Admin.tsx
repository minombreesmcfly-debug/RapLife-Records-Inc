import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, where, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Shield, Upload, Star, Music, User, Check, X, Radio, PlayCircle, PlusCircle, Pencil, Trash, Link2 } from 'lucide-react';

const AdminView = () => {
  const { user, isAdmin } = useAuth();
  
  // Refs for hidden file inputs
  const radioFileInputRef = useRef<HTMLInputElement>(null);
  const localRadioFileInputRef = useRef<HTMLInputElement>(null);

  const [artists, setArtists] = useState<any[]>([]);
  const [pendingTracks, setPendingTracks] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [radioFile, setRadioFile] = useState<File | null>(null);
  const [radioTitle, setRadioTitle] = useState('');
  const [spotifyInput, setSpotifyInput] = useState('');
  const [savingSpotify, setSavingSpotify] = useState(false);

  // Artist form states
  const [showArtistForm, setShowArtistForm] = useState(false);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [artistForm, setArtistForm] = useState({
    displayName: '',
    email: '',
    bio: '',
    photoURL: '',
    spotifyUrl: '',
    instagramUrl: '',
    appleMusicUrl: '',
    isPinned: false
  });

  // Local radio states
  const [localRadioTracks, setLocalRadioTracks] = useState<any[]>([]);
  const [uploadingLocalRadio, setUploadingLocalRadio] = useState(false);
  const [localRadioFile, setLocalRadioFile] = useState<File | null>(null);

  const fetchLocalRadioTracks = async () => {
    try {
      const res = await fetch('/api/radio-local-songs');
      if (res.ok) {
        const data = await res.json();
        setLocalRadioTracks(data);
      }
    } catch (e) {
      console.error("Error fetching local radio tracks:", e);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      // Artists
      const artistQ = query(collection(db, 'users'));
      const artistSnap = await getDocs(artistQ);
      setArtists(artistSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Pending tracks
      const trackQ = query(collection(db, 'tracks'), where('status', '==', 'pending'));
      const trackSnap = await getDocs(trackQ);
      setPendingTracks(trackSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Spotify config
      try {
        const docRef = doc(db, 'config', 'spotify');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.playlistId) {
            setSpotifyInput(`https://open.spotify.com/playlist/${data.playlistId}`);
          }
        }
      } catch (err) {
        console.error("Error fetching spotify admin config:", err);
      }

      // Fetch local radio tracks
      await fetchLocalRadioTracks();
    };
    fetchData();
  }, [isAdmin]);

  const approveTrack = async (id: string) => {
    try {
      await updateDoc(doc(db, 'tracks', id), {
        status: 'approved',
        approved: true,
        approvedAt: serverTimestamp()
      });
      setPendingTracks(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const rejectTrack = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tracks', id));
      setPendingTracks(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const togglePin = async (artistId: string, currentPin: boolean) => {
    try {
      await updateDoc(doc(db, 'users', artistId), {
        isPinned: !currentPin,
        pinnedAt: !currentPin ? serverTimestamp() : null
      });
      setArtists(prev => prev.map(a => a.id === artistId ? { ...a, isPinned: !currentPin } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistForm.displayName) {
      alert('El nombre del artista es obligatorio');
      return;
    }

    try {
      const emailValue = artistForm.email.trim() || `${artistForm.displayName.toLowerCase().replace(/\s+/g, '')}@raplife.com`;
      const photoValue = artistForm.photoURL.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

      if (editingArtistId) {
        // Mode: EDIT
        const docRef = doc(db, 'users', editingArtistId);
        await updateDoc(docRef, {
          displayName: artistForm.displayName,
          email: emailValue,
          bio: artistForm.bio,
          photoURL: photoValue,
          spotifyUrl: artistForm.spotifyUrl,
          instagramUrl: artistForm.instagramUrl,
          appleMusicUrl: artistForm.appleMusicUrl,
          isPinned: artistForm.isPinned,
          updatedAt: serverTimestamp()
        });
        alert('¡Perfil del artista actualizado correctamente!');
      } else {
        // Mode: CREATE
        const newArtistId = `artist-${Date.now()}`;
        const docRef = doc(db, 'users', newArtistId);
        await setDoc(docRef, {
          uid: newArtistId,
          displayName: artistForm.displayName,
          email: emailValue,
          bio: artistForm.bio,
          photoURL: photoValue,
          spotifyUrl: artistForm.spotifyUrl,
          instagramUrl: artistForm.instagramUrl,
          appleMusicUrl: artistForm.appleMusicUrl,
          role: 'artist',
          plan: 'premium',
          isPinned: artistForm.isPinned,
          createdAt: serverTimestamp()
        });
        alert('¡Nuevo artista registrado con éxito!');
      }

      // Reset form
      setArtistForm({
        displayName: '',
        email: '',
        bio: '',
        photoURL: '',
        spotifyUrl: '',
        instagramUrl: '',
        appleMusicUrl: '',
        isPinned: false
      });
      setEditingArtistId(null);
      setShowArtistForm(false);

      // Refresh list
      const artistQ = query(collection(db, 'users'));
      const artistSnap = await getDocs(artistQ);
      setArtists(artistSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    }
  };

  const handleEditClick = (artist: any) => {
    setArtistForm({
      displayName: artist.displayName || '',
      email: artist.email || '',
      bio: artist.bio || '',
      photoURL: artist.photoURL || '',
      spotifyUrl: artist.spotifyUrl || '',
      instagramUrl: artist.instagramUrl || '',
      appleMusicUrl: artist.appleMusicUrl || '',
      isPinned: artist.isPinned || false
    });
    setEditingArtistId(artist.id);
    setShowArtistForm(true);
  };

  const handleUploadLocalRadio = async () => {
    if (!localRadioFile) {
      alert('Por favor selecciona un archivo de audio (.mp3, .wav, .m4a)');
      return;
    }
    setUploadingLocalRadio(true);
    try {
      const formData = new FormData();
      formData.append('track', localRadioFile);

      const res = await fetch('/api/upload-radio-local', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al subir archivo a la radio local');
      }

      alert('¡Archivo de radio local agregado correctamente!');
      setLocalRadioFile(null);
      await fetchLocalRadioTracks();
    } catch (err: any) {
      alert('Error al subir: ' + err.message);
    } finally {
      setUploadingLocalRadio(false);
    }
  };

  const handleDeleteLocalRadio = async (fullName: string) => {
    if (!window.confirm(`¿Seguro que quieres eliminar ${fullName} de la radio local?`)) return;
    try {
      const res = await fetch('/api/delete-radio-local', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fullName })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      alert('¡Archivo eliminado con éxito!');
      await fetchLocalRadioTracks();
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-[80vh]">
      <div className="bg-red-500/10 border-2 border-red-500 p-10 rounded-3xl text-center">
        <X size={48} className="mx-auto mb-4 text-red-500" />
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">ACCESO DENEGADO</h1>
        <p className="text-gray-400 mt-2">No tienes permisos para ver esta sección.</p>
      </div>
    </div>
  );

  const handleUploadRadio = async () => {
    if (!radioFile || !radioTitle) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('track', radioFile);
      formData.append('userId', 'ADMIN');
      formData.append('title', radioTitle);
      formData.append('artistName', 'RAPLIFE RADIO');

      const response = await fetch('/api/upload-track', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Error en el servidor de control radio';
        try {
          const errText = await response.text();
          try {
            const errJson = JSON.parse(errText);
            errorMessage = errJson.error || errorMessage;
          } catch {
            errorMessage = errText || errorMessage;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const { audioUrl } = await response.json();

      await addDoc(collection(db, 'tracks'), {
        title: radioTitle,
        artistId: 'ADMIN',
        artistName: 'RAPLIFE RADIO',
        audioUrl: audioUrl,
        isRadioInterstitial: true,
        createdAt: serverTimestamp()
      });
      alert('Podcast/Clip de radio subido con éxito');
      setRadioFile(null);
      setRadioTitle('');
    } catch (e: any) {
      console.error(e);
      alert('Error en la carga: ' + (e.message || 'Error desconocido'));
    }
    setUploading(false);
  };

  const saveSpotifyPlaylist = async () => {
    if (!spotifyInput) return;
    setSavingSpotify(true);
    try {
      let extractedId = spotifyInput.trim();
      const playlistMatch = extractedId.match(/playlist\/([a-zA-Z0-9]+)/);
      const albumMatch = extractedId.match(/album\/([a-zA-Z0-9]+)/);
      const artistMatch = extractedId.match(/artist\/([a-zA-Z0-9]+)/);
      
      if (playlistMatch) {
         extractedId = playlistMatch[1];
      } else if (albumMatch) {
         extractedId = albumMatch[1];
      } else if (artistMatch) {
         extractedId = artistMatch[1];
      }

      await setDoc(doc(db, 'config', 'spotify'), {
        playlistId: extractedId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'ADMIN'
      }, { merge: true });

      alert('¡Lista de Spotify de RapLife actualizada con éxito!');
    } catch (e: any) {
      console.error(e);
      alert('Error al guardar: ' + e.message);
    } finally {
      setSavingSpotify(false);
    }
  };

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row items-center gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 boombox-texture">
        <div className="p-5 bg-brand-yellow text-black rounded-3xl shadow-glow">
          <Shield size={32} />
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter underline decoration-brand-yellow/30">PANEL DE CONTROL</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm mt-1">Gesti&oacute;n maestra de RAPLIFE RECORDS INC.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Left Column: Radio Controls */}
        <div className="space-y-10 flex flex-col">
          {/* Card 1: Radio Interstitials Nube */}
          <div className="bg-brand-dark p-8 rounded-[2rem] border-4 border-boombox-gray space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Radio size={120} />
            </div>
            
            <div className="flex items-center gap-3 relative">
              <Music className="text-brand-yellow" size={24} />
              <h2 className="text-2xl font-black italic tracking-tighter uppercase">RADIO INTERSTITIALS</h2>
            </div>
            <p className="text-gray-500 text-xs font-semibold leading-relaxed uppercase tracking-wider">Sube notas de voz o intros de radio que se reproducirán automáticamente entre cada 2-3 canciones en la nube.</p>
            
            <div className="space-y-4 pt-2">
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">TÍTULO DEL CLIP EN NUBE</label>
                  <input 
                    type="text" placeholder="Ej: RapLife ID 01" 
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl focus:border-brand-yellow outline-none transition-all font-bold text-sm"
                    value={radioTitle} onChange={e => setRadioTitle(e.target.value)}
                  />
               </div>
               
               <div 
                 onClick={() => radioFileInputRef.current?.click()}
                 className="relative group/upload cursor-pointer"
               >
                  <input 
                    type="file" 
                    ref={radioFileInputRef}
                    accept="audio/*" 
                    className="hidden"
                    onChange={e => setRadioFile(e.target.files?.[0] || null)}
                  />
                  <div className="w-full border-2 border-dashed border-white/10 p-6 rounded-xl flex flex-col items-center group-hover/upload:border-brand-yellow/50 transition-all bg-white/[0.02]">
                     <Upload size={24} className="text-gray-600 group-hover/upload:text-brand-yellow mb-2 group-hover/upload:scale-110 transition-transform" />
                     <p className="text-xs font-black italic uppercase tracking-tighter text-gray-500 text-center truncate max-w-full">
                       {radioFile ? radioFile.name : 'SELECCIONA AUDIO NUBE'}
                     </p>
                     <p className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">MP3 / WAV</p>
                  </div>
               </div>
               <button 
                 onClick={handleUploadRadio}
                 disabled={uploading || !radioFile || !radioTitle}
                 className="w-full py-4 bg-brand-yellow text-black font-black italic uppercase text-xs rounded-xl shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale cursor-pointer"
               >
                 {uploading ? 'PROCESANDO...' : 'INYECTAR EN RADIO NUBE'}
               </button>
            </div>
          </div>

          {/* Card 2: Local Server Radio Folder */}
          <div className="bg-brand-dark p-8 rounded-[2rem] border-4 border-boombox-gray space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Radio size={120} />
            </div>

            <h3 className="text-xl font-black italic tracking-tighter uppercase text-brand-yellow flex items-center gap-2">
              <Radio size={22} /> AUDIO LOCAL (SERVIDOR)
            </h3>
            <p className="text-gray-500 text-xs font-semibold leading-relaxed uppercase tracking-wider">
              Sube música o elimina archivos directamente de la carpeta <code className="lowercase text-gray-400">public/assets/radio</code>.
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                <div 
                  onClick={() => localRadioFileInputRef.current?.click()}
                  className="relative group/local cursor-pointer"
                >
                   <input 
                     type="file" 
                     ref={localRadioFileInputRef}
                     accept="audio/*" 
                     className="hidden"
                     onChange={e => setLocalRadioFile(e.target.files?.[0] || null)}
                   />
                   <div className="w-full border-2 border-dashed border-white/5 p-4 rounded-xl flex flex-col items-center group-hover/local:border-brand-yellow/40 transition-all bg-white/[0.01]">
                      <Upload size={18} className="text-gray-600 group-hover/local:text-brand-yellow mb-1" />
                      <p className="text-[10px] font-black uppercase text-gray-500 text-center truncate max-w-full">
                        {localRadioFile ? localRadioFile.name : 'SELECCIONAR .MP3 LOCAL'}
                      </p>
                   </div>
                </div>
                {localRadioFile && (
                  <button 
                    onClick={handleUploadLocalRadio}
                    disabled={uploadingLocalRadio}
                    className="w-full py-3 bg-brand-yellow text-black font-black uppercase text-xs rounded-xl transition-all cursor-pointer"
                  >
                    {uploadingLocalRadio ? 'SUBIENDO...' : 'SUBIR ARCHIVO DIRECTO'}
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {localRadioTracks.map((track) => (
                  <div key={track.fullName} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Music size={14} className="text-brand-yellow flex-shrink-0" />
                      <div className="truncate">
                        <p className="font-bold truncate text-gray-300">{track.title || track.fullName}</p>
                        <p className="text-[9px] text-gray-500 uppercase font-mono mt-0.5">
                          {track.artistName} {track.fileSizeHuman && `• ${track.fileSizeHuman}`}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteLocalRadio(track.fullName)}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 active:scale-95"
                      title="Eliminar del Servidor"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
                {localRadioTracks.length === 0 && (
                  <div className="py-8 text-center text-gray-650 text-[10px] font-black uppercase tracking-wider italic">
                    NO HAY ARCHIVOS LOCALES EN EL SERVIDOR
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Artist Management */}
        <div className="bg-brand-dark p-8 rounded-[2rem] border-4 border-boombox-gray space-y-6 flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <User className="text-brand-yellow" size={24} />
              <h2 className="text-2xl font-black italic tracking-tighter uppercase underline decoration-white/10">GESTIÓN DE ARTISTAS</h2>
            </div>
            
            <button 
              onClick={() => {
                setEditingArtistId(null);
                setArtistForm({
                  displayName: '',
                  email: '',
                  bio: '',
                  photoURL: '',
                  spotifyUrl: '',
                  instagramUrl: '',
                  appleMusicUrl: '',
                  isPinned: false
                });
                setShowArtistForm(!showArtistForm);
              }}
              className="px-4 py-2 bg-brand-yellow hover:bg-brand-yellow hover:scale-[1.03] text-black font-black uppercase text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95"
            >
              {showArtistForm && !editingArtistId ? (
                <> <X size={14} /> CANCELAR </>
              ) : (
                <> <PlusCircle size={14} /> REGISTRAR <span className="hidden sm:inline">ARTISTA</span> </>
              )}
            </button>
          </div>

          {/* Form wrapper */}
          {showArtistForm && (
            <form onSubmit={handleSaveArtist} className="bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs font-black italic uppercase tracking-wider text-brand-yellow">
                {editingArtistId ? '✏️ EDITAR PERFIL DE ARTISTA' : '➕ REGISTRAR ARTISTA DIRECTO'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Nombre del Artista *</label>
                  <input 
                    type="text" required placeholder="Ej: Travis Scott"
                    className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.displayName}
                    onChange={e => setArtistForm({...artistForm, displayName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Email (Opcional)</label>
                  <input 
                    type="email" placeholder="Ej: artista@raplife.com"
                    className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.email}
                    onChange={e => setArtistForm({...artistForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">URL Imagen de Perfil (Opcional)</label>
                <input 
                  type="text" placeholder="Ej: https://images.unsplash.com/... o /assets/default.png"
                  className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold"
                  value={artistForm.photoURL}
                  onChange={e => setArtistForm({...artistForm, photoURL: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Biografía o Slogan</label>
                <textarea 
                  placeholder="Escribe la biografía del artista..." rows={2}
                  className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold"
                  value={artistForm.bio}
                  onChange={e => setArtistForm({...artistForm, bio: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Spotify URL</label>
                  <input 
                    type="text" placeholder="https://open.spotify.com/artist/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.spotifyUrl}
                    onChange={e => setArtistForm({...artistForm, spotifyUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Instagram URL</label>
                  <input 
                    type="text" placeholder="https://instagram.com/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.instagramUrl}
                    onChange={e => setArtistForm({...artistForm, instagramUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Apple Music URL</label>
                  <input 
                    type="text" placeholder="https://music.apple.com/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.appleMusicUrl}
                    onChange={e => setArtistForm({...artistForm, appleMusicUrl: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" id="artist-pin"
                  className="rounded bg-black border-white/10 text-brand-yellow focus:ring-brand-yellow"
                  checked={artistForm.isPinned}
                  onChange={e => setArtistForm({...artistForm, isPinned: e.target.checked})}
                />
                <label htmlFor="artist-pin" className="text-[11px] font-black uppercase text-gray-400 cursor-pointer">Fijar artista destacado (PIN)</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-brand-yellow text-black font-black uppercase text-xs rounded-xl hover:scale-[1.01] transition-all"
                >
                  {editingArtistId ? 'GUARDAR PERFIL' : 'REGISTRAR ARTISTA'}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingArtistId(null);
                    setShowArtistForm(false);
                  }}
                  className="px-4 py-3 bg-white/5 text-white font-black uppercase text-xs rounded-xl hover:bg-white/10 transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
          
          <div className="flex-1 max-h-[480px] overflow-y-auto space-y-4 pr-3 scrollbar-hide">
            {artists.filter(a => a.role === 'artist').map(artist => (
              <div key={artist.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                <div className="flex items-center gap-4">
                   <div className="relative">
                     <img src={artist.photoURL || 'https://via.placeholder.com/150'} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10 group-hover:border-brand-yellow transition-colors" />
                     {artist.isPinned && <div className="absolute -top-2 -right-2 w-5 h-5 bg-brand-yellow rounded-full flex items-center justify-center text-black border-2 border-brand-dark"><Star size={10} fill="black" /></div>}
                   </div>
                   <div>
                     <p className="font-black italic uppercase tracking-tighter text-lg">{artist.displayName}</p>
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{artist.email || 'Sin Correo'}</p>
                   </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditClick(artist)}
                    className="p-3 rounded-xl bg-white/5 hover:bg-brand-yellow hover:text-black text-gray-400 transition-all active:scale-95"
                    title="Editar Perfil"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => togglePin(artist.id, artist.isPinned)}
                    className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${artist.isPinned ? 'bg-brand-yellow text-black' : 'bg-black/50 text-gray-600 hover:text-white border border-white/5'}`}
                    title={artist.isPinned ? 'Quitar Pin' : 'Hacer Pin'}
                  >
                    <Star size={16} fill={artist.isPinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            ))}
            {artists.filter(a => a.role === 'artist').length === 0 && (
              <div className="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-sm">SIN ARTISTAS REGISTRADOS</div>
            )}
          </div>
        </div>
      </div>

      {/* SPOTIFY PLAYLIST MASTER CONTROL CARD */}
      <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
           <Radio size={120} />
         </div>
         <div className="flex flex-col md:flex-row md:items-center gap-6 relative">
            <div className="p-3 bg-brand-yellow/10 rounded-2xl text-brand-yellow self-start">
               <Radio size={28} />
            </div>
            <div className="flex-1">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter">PLAYLIST OFICIAL DE SPOTIFY (VINILO DIGITAL)</h2>
               <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Sintonizador maestro de RapLife Records Inc.</p>
               <p className="text-gray-500 text-xs font-medium leading-relaxed mt-2 max-w-2xl">
                 Ingresa el enlace o ID de tu playlist de Spotify. La web lo detectará automáticamente, actualizará el reproductor del Vinilo Digital en vivo para todos tus fans, y lo mantendrá sincronizado.
               </p>
            </div>
         </div>

         <div className="mt-6 flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="Ej: https://open.spotify.com/playlist/37i9dQZF1DX186v5A68pAI" 
              className="flex-grow bg-black/50 border border-white/10 p-5 rounded-2xl focus:border-brand-yellow outline-none transition-all font-bold text-sm"
              value={spotifyInput} 
              onChange={e => setSpotifyInput(e.target.value)}
            />
            <button 
              onClick={saveSpotifyPlaylist}
              disabled={savingSpotify || !spotifyInput}
              className="py-5 px-10 bg-brand-yellow text-black font-black italic uppercase text-sm rounded-2xl shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale md:w-auto w-full"
            >
              {savingSpotify ? 'GUARDANDO...' : 'ACTUALIZAR SPOTIFY'}
            </button>
         </div>
      </div>

      {/* TRACK MODERATION SECTION */}
      <div className="bg-brand-dark p-8 rounded-[2.5rem] border-4 border-boombox-gray space-y-8 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-yellow/10 rounded-2xl text-brand-yellow">
            <Radio size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">MODERACIÓN DE TRACKS</h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">PENDIENTES DE APROBACIÓN PARA LA RADIO</p>
          </div>
          <div className="px-4 py-2 bg-brand-yellow/10 rounded-xl border border-brand-yellow/20">
            <span className="text-brand-yellow font-black italic text-xl">{pendingTracks.length}</span>
            <span className="text-gray-500 font-black uppercase text-[10px] ml-2">PENDIENTES</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingTracks.map(track => (
            <div key={track.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-brand-yellow/40 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden border border-white/5 relative group-hover:scale-105 transition-transform">
                  <img src={track.coverUrl} className="w-full h-full object-cover opacity-60" alt="" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-black italic uppercase tracking-tighter text-lg truncate">{track.title}</p>
                  <p className="text-[10px] text-brand-yellow font-bold uppercase tracking-widest truncate">{track.artistName}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => approveTrack(track.id)}
                  className="flex-1 bg-brand-green/20 text-brand-green border border-brand-green/20 py-3 rounded-xl font-black italic uppercase text-xs hover:bg-brand-green hover:text-black transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} /> APROBAR
                </button>
                <button 
                  onClick={() => rejectTrack(track.id)}
                  className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 py-3 rounded-xl font-black italic uppercase text-xs hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <X size={16} /> RECHAZAR
                </button>
              </div>
            </div>
          ))}
          {pendingTracks.length === 0 && (
            <div className="col-span-full py-20 bg-white/[0.02] rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4 text-center opacity-30">
               <Music size={48} />
               <p className="font-black italic uppercase tracking-widest text-sm">LIMPIEZA TOTAL EN LA COLA DE REVISIÓN</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;
