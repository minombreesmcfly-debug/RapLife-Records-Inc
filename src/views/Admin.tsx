import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, where, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Shield, Upload, Star, Music, User, Check, X, Radio, PlayCircle, PlusCircle, Pencil, Trash, Link2, ChevronUp, ChevronDown, Save, Play } from 'lucide-react';

const AdminView = () => {
  const { user, isAdmin, loading } = useAuth();
  const { play, setRadioMode, playRadioPlaylist } = useMusic();
  
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
  const [radioStatus, setRadioStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });

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
    isPinned: false,
    isExclusive: true,
    reels: [] as string[]
  });
  const [adminFormReelInput, setAdminFormReelInput] = useState('');
  const [uploadingAdminPhoto, setUploadingAdminPhoto] = useState(false);

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

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAdminPhoto(true);
    try {
      const storageRef = ref(storage, `artists/photos/admin_${Date.now()}_${file.name}`);
      const uploadPromise = uploadBytes(storageRef, file).then(() => getDownloadURL(storageRef));
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
      
      let finalUrl = '';
      try {
        finalUrl = await Promise.race([uploadPromise, timeoutPromise]);
        alert('¡Imagen de perfil del artista subida al servidor con éxito!');
      } catch (uploadError) {
        console.warn("Admin storage upload failed or timed out, falling back to local optimized Base64:", uploadError);
        finalUrl = await compressAndGetBase64(file);
        alert('¡Imagen del artista optimizada y cargada localmente con éxito (modo Base64-Ultra)!');
      }

      setArtistForm(prev => ({ ...prev, photoURL: finalUrl }));
    } catch (err: any) {
      console.error(err);
      alert('Error al procesar la imagen del artista: ' + err.message);
    } finally {
      setUploadingAdminPhoto(false);
    }
  };

  // Local radio states
  const [localRadioTracks, setLocalRadioTracks] = useState<any[]>([]);
  const [uploadingLocalRadio, setUploadingLocalRadio] = useState(false);
  const [localRadioFile, setLocalRadioFile] = useState<File | null>(null);
  const [savingRadioOrder, setSavingRadioOrder] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<string>('');

  const fetchLocalRadioTracks = async () => {
    try {
      const res = await fetch('/api/radio-local-songs');
      let data: any[] = [];
      if (res.ok) {
        data = await res.json();
      }

      // Fetch approved or legacy database tracks and map them to track items
      try {
        const tracksQ = query(collection(db, 'tracks'));
        const tracksSnap = await getDocs(tracksQ);
        const dbTracks = tracksSnap.docs
          .map(docSnap => {
            const pt = docSnap.data();
            const status = pt.status || (pt.approved ? 'approved' : 'pending');
            return {
              id: docSnap.id,
              artistId: pt.artistId || '',
              artistName: pt.artistName || 'Artista',
              title: pt.title || 'Track sin título',
              audioUrl: pt.audioUrl,
              coverUrl: pt.coverUrl || '/assets/player_idle.png',
              isRadioInterstitial: false,
              fullName: pt.title || docSnap.id,
              status
            };
          })
          .filter(t => t.status === 'approved' || !t.status);
        data = [...data, ...dbTracks];
      } catch (dbErr) {
        console.warn("[ADMIN RADIO] Approved/legacy db tracks fetch error:", dbErr);
      }
        
      let fileOrder: string[] = [];
      // First try to fetch from Firestore
      try {
        const docRef = doc(db, 'config', 'radioOrder');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          fileOrder = docSnap.data().fileOrder || [];
          try {
            localStorage.setItem('raplife_radio_order', JSON.stringify(fileOrder));
          } catch (_) {}
        } else {
          // Check localStorage
          const cached = localStorage.getItem('raplife_radio_order');
          if (cached) {
            fileOrder = JSON.parse(cached);
          }
        }
      } catch (err) {
        console.warn("[RADIO ADM] Firestore offline or error getting radioOrder. Using localStorage fallback:", err);
        try {
          const cached = localStorage.getItem('raplife_radio_order');
          if (cached) {
            fileOrder = JSON.parse(cached);
          }
        } catch (_) {}
      }

      if (fileOrder && fileOrder.length > 0) {
        const sorted = [...data].sort((a: any, b: any) => {
          const indexA = fileOrder.indexOf(a.fullName || a.id || '');
          const indexB = fileOrder.indexOf(b.fullName || b.id || '');
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return 0;
        });
        setLocalRadioTracks(sorted);
      } else {
        setLocalRadioTracks(data);
      }
    } catch (e) {
      console.error("Error fetching local radio tracks:", e);
    }
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const updated = [...localRadioTracks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setLocalRadioTracks(updated);
  };

  const handleSaveRadioOrder = async () => {
    setSavingRadioOrder(true);
    const fileOrder = localRadioTracks.map(t => t.fullName || t.id).filter(Boolean);
    
    // Always save to localStorage immediately for fast, offline-first reliability
    try {
      localStorage.setItem('raplife_radio_order', JSON.stringify(fileOrder));
    } catch (_) {}

    try {
      await setDoc(doc(db, 'config', 'radioOrder'), {
        fileOrder,
        updatedAt: serverTimestamp()
      });
      alert('¡Orden de reproducción guardado con éxito en la nube y localmente!');
    } catch (err: any) {
      console.warn("Soft error setting Firestore radioOrder, but saved in localStorage:", err);
      alert('¡Orden de reproducción guardado localmente en tu navegador! (El servidor de base de datos está offline transitoriamente)');
    } finally {
      setSavingRadioOrder(false);
    }
  };

  const handlePlayRadioWithOrder = async () => {
    if (localRadioTracks.length === 0) {
      alert('No hay canciones locales disponibles para reproducir.');
      return;
    }
    setSavingRadioOrder(true);
    const fileOrder = localRadioTracks.map(t => t.fullName || t.id).filter(Boolean);
    try {
      localStorage.setItem('raplife_radio_order', JSON.stringify(fileOrder));
    } catch (_) {}

    try {
      await setDoc(doc(db, 'config', 'radioOrder'), {
        fileOrder,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Soft error saving order before playing:", err);
    } finally {
      setSavingRadioOrder(false);
    }
    const firstTrack = localRadioTracks[0];
    playRadioPlaylist(localRadioTracks, 0);
    alert(`¡Iniciando RapLife Radio en el orden de reproducción elegido! Sonando ahora: "${firstTrack.title || firstTrack.fullName}"`);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      // Fetch Artists
      let loadedArtists: any[] = [];
      try {
        const artistQ = query(collection(db, 'users'));
        const artistSnap = await getDocs(artistQ);
        loadedArtists = artistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setArtists(loadedArtists);
      } catch (err) {
        console.error("Error loading artists in Admin dashboard:", err);
      }

      // Safe isolated seeding
      try {
        const hasAitana = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('aitana'));
        const hasJay = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('jay'));
        const hasMcFly = loadedArtists.some(a => (a as any).displayName?.toLowerCase().includes('mcfly'));

        let needsReload = false;

        if (!hasAitana) {
          try {
            const docId = 'artist_aitana_blue';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'Aitana Blue Dream',
              role: 'artist',
              category: 'G FUNK / EDM',
              bio: 'Fusión sublime que une las melodías grooves del G-Funk clásico de West Coast con la vibración electrónica y bailable del EDM moderno.',
              photoURL: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            needsReload = true;
          } catch (e) {
            console.warn("Could not auto-seed Aitana:", e);
          }
        }

        if (!hasJay) {
          try {
            const docId = 'artist_jay_santana';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'Jay Santana',
              role: 'artist',
              category: 'RAP / REGIONAL MEXICANO TRAP',
              bio: 'Fusión pionera que une la crudeza del rap de calle con los arreglos profundos y el alma del Regional Mexicano en ritmo Trap.',
              photoURL: '/src/assets/images/jay_santana_ghetto_1781111479453.png',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            needsReload = true;
          } catch (e) {
            console.warn("Could not auto-seed Jay Santana:", e);
          }
        }

        if (!hasMcFly) {
          try {
            const docId = 'artist_mcfly_emece';
            await setDoc(doc(db, 'users', docId), {
              uid: docId,
              displayName: 'McFly EmeCe',
              role: 'artist',
              category: 'RAP TRAP CONSPIRACIONES',
              bio: 'Líricas punzantes y bases oscuras cargadas de verdades incómodas, enigmas y teorías de conspiración sobre el asfalto pesado.',
              photoURL: '/src/assets/images/mcfly_ninja_rapper_1781111492480.png',
              spotifyUrl: 'https://open.spotify.com/artist/1fYkTNZmwjgP3RkkRPhnsG',
              instagramUrl: 'https://instagram.com/',
              appleMusicUrl: '',
              isPinned: true,
              isExclusive: true,
              plan: 'premium',
              createdAt: serverTimestamp()
            });
            needsReload = true;
          } catch (e) {
            console.warn("Could not auto-seed McFly EmeCe:", e);
          }
        }

        if (needsReload) {
          const artistQ = query(collection(db, 'users'));
          const artistSnap = await getDocs(artistQ);
          setArtists(artistSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error("Error checking or seeding default artists:", err);
      }

      // Pending tracks
      try {
        const trackQ = query(collection(db, 'tracks'), where('status', '==', 'pending'));
        const trackSnap = await getDocs(trackQ);
        setPendingTracks(trackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading pending tracks in Admin dashboard:", err);
      }

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
  }, [isAdmin, loading]);

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
          isExclusive: artistForm.isExclusive !== false,
          reels: artistForm.reels || [],
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
          isExclusive: artistForm.isExclusive !== false,
          reels: artistForm.reels || [],
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
        isPinned: false,
        isExclusive: true,
        reels: []
      });
      setAdminFormReelInput('');
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
      isPinned: artist.isPinned || false,
      isExclusive: artist.isExclusive !== false,
      reels: artist.reels || []
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

  const handleDeleteLocalRadio = async (fullName: string, id?: string) => {
    // Check if it is a database-backed track or local disk file
    const isDbTrack = id && !fullName.endsWith('.mp3') && !fullName.endsWith('.wav') && !fullName.endsWith('.m4a') && !fullName.endsWith('.ogg');
    
    if (isDbTrack) {
      if (!window.confirm(`¿Seguro que quieres eliminar el track de base de datos "${fullName}" de la radio?`)) return;
      try {
        await deleteDoc(doc(db, 'tracks', id));
        alert('¡Track de base de datos eliminado con éxito!');
        await fetchLocalRadioTracks();
      } catch (err: any) {
        alert('Error al eliminar track de Firestore: ' + err.message);
      }
      return;
    }

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

  const handleRenameLocalRadio = (idx: number, fullName: string) => {
    const extIndex = fullName.lastIndexOf('.');
    const baseSuggestion = extIndex !== -1 ? fullName.substring(0, extIndex) : fullName;
    setEditingTrackIndex(idx);
    setEditingTrackName(baseSuggestion);
  };

  const saveInlineRename = async (oldFullName: string, newBaseName: string, id?: string) => {
    if (!newBaseName || newBaseName.trim() === '') {
      alert('El nombre no puede estar vacío.');
      return;
    }

    // Check if it is a database-backed track or local disk file
    const isDbTrack = id && !oldFullName.endsWith('.mp3') && !oldFullName.endsWith('.wav') && !oldFullName.endsWith('.m4a') && !oldFullName.endsWith('.ogg');

    if (isDbTrack) {
      try {
        await updateDoc(doc(db, 'tracks', id), {
          title: newBaseName.trim()
        });
        setEditingTrackIndex(null);
        await fetchLocalRadioTracks();
        alert('¡Track de base de datos renombrado con éxito!');
      } catch (err: any) {
        alert('Error al renombrar track en Firestore: ' + err.message);
      }
      return;
    }
    
    const extIndex = oldFullName.lastIndexOf('.');
    const oldBase = extIndex !== -1 ? oldFullName.substring(0, extIndex) : oldFullName;
    if (newBaseName.trim() === oldBase) {
      setEditingTrackIndex(null);
      return;
    }

    try {
      const res = await fetch('/api/rename-radio-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldFileName: oldFullName, newFileName: newBaseName.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al renombrar');
      }

      setEditingTrackIndex(null);
      await fetchLocalRadioTracks();
    } catch (err: any) {
      alert('Error al de renombre: ' + err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh]">
      <div className="py-20 text-center animate-pulse italic font-black uppercase text-xl text-brand-yellow">
        SINTONIZANDO ACCESO...
      </div>
    </div>
  );

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
    if (!radioFile) {
      alert('Por favor selecciona un archivo de audio (.mp3 o .wav) primero.');
      return;
    }
    if (!radioTitle) {
      alert('Por favor introduce un título para el clip en la nube.');
      return;
    }
    setUploading(true);
    setRadioStatus({ type: '', message: '' });
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
      
      setRadioStatus({ type: 'success', message: '¡Audio/Clip inyectado en la radio con éxito!' });
      setRadioFile(null);
      setRadioTitle('');
      setTimeout(() => setRadioStatus({ type: '', message: '' }), 6000);
    } catch (e: any) {
      console.error(e);
      setRadioStatus({ type: 'error', message: '⚠️ Error al subir: ' + (e.message || 'Error desconocido') });
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
        {/* Left Column: Unified Radio Controls */}
        <div className="space-y-10 flex flex-col">
          {/* Card: Unified Local Radio Workspace */}
          <div className="bg-brand-dark p-8 rounded-[2rem] border-4 border-boombox-gray space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Radio size={150} />
            </div>

            <div className="flex items-center gap-3 relative">
              <Radio className="text-brand-yellow animate-pulse" size={26} />
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">RAPLIFE RADIO</h2>
            </div>
            
            <p className="text-gray-400 text-xs font-semibold leading-relaxed uppercase tracking-wider">
              ¡Sube canciones, promos, anuncios o intros directamente en la radio local! Alterna y acomoda el orden de reproducción como prefieras.
            </p>

            {/* Drop and Pick Upload Area */}
            <div className="space-y-4">
              <div className="p-4 bg-black/45 border border-white/5 rounded-2xl space-y-3">
                <input 
                  type="file" 
                  ref={localRadioFileInputRef}
                  accept="audio/*" 
                  className="hidden"
                  onChange={e => setLocalRadioFile(e.target.files?.[0] || null)}
                />
                
                <div 
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setLocalRadioFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => localRadioFileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed p-6 rounded-xl flex flex-col items-center justify-center transition-all bg-white/[0.01] cursor-pointer ${
                    dragActive 
                      ? 'border-brand-yellow bg-brand-yellow/10 scale-[1.01]' 
                      : 'border-white/10 hover:border-brand-yellow/40'
                  }`}
                >
                  <Upload size={24} className={`mb-2 transition-transform ${dragActive ? 'text-brand-yellow scale-110' : 'text-gray-650'}`} />
                  <p className="text-xs font-black uppercase text-gray-400 text-center truncate max-w-full">
                    {localRadioFile ? localRadioFile.name : 'ARRASTRA O SELECCIONA AUDIO'}
                  </p>
                  <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase tracking-widest">WAV, MP3, M4A, OGG</p>
                </div>

                {localRadioFile && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setLocalRadioFile(null)}
                      className="px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 text-xs font-black uppercase rounded-xl transition-all cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                    <button 
                      onClick={handleUploadLocalRadio}
                      disabled={uploadingLocalRadio}
                      className="flex-1 py-3 bg-brand-yellow text-black font-black uppercase text-xs rounded-xl shadow-glow hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale cursor-pointer"
                    >
                      {uploadingLocalRadio ? 'CARGANDO AUDIO...' : 'SUBIR E INYECTAR DIRECTO'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sequential Playlist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black italic uppercase tracking-wider text-gray-500">
                    SECUENCIA DE REPRODUCCIÓN ({localRadioTracks.length})
                  </span>
                  {localRadioTracks.length > 0 && (
                    <span className="text-[9px] font-sans text-brand-yellow/60 uppercase font-mono">
                      ARRASTRA CON LAS FLECHAS PARA ORDENAR
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {localRadioTracks.map((track, idx) => {
                    const isEditing = editingTrackIndex === idx;
                    if (isEditing) {
                      return (
                        <div key={track.fullName || track.id || `local-track-${idx}`} className="flex items-center justify-between p-3 bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl text-xs transition-all gap-2">
                          <div className="flex items-center gap-2 overflow-hidden flex-grow">
                            <Music size={14} className="text-brand-yellow flex-shrink-0 animate-pulse" />
                            <div className="flex items-center gap-1.5 flex-grow">
                              <span className="text-brand-yellow font-mono text-[10px] mr-0.5">#{idx + 1}</span>
                              <input
                                type="text"
                                className="bg-black/80 border border-brand-yellow/45 text-white font-bold text-xs px-2 py-1 rounded outline-none w-full focus:border-brand-yellow"
                                value={editingTrackName}
                                onChange={(e) => setEditingTrackName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveInlineRename(track.fullName, editingTrackName, track.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingTrackIndex(null);
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => saveInlineRename(track.fullName, editingTrackName, track.id)}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded-lg transition-colors active:scale-95"
                              title="Guardar nombre"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingTrackIndex(null)}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/15 rounded-lg transition-colors active:scale-95"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={track.fullName || track.id || `local-track-${idx}`} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs hover:bg-white/5 transition-all gap-2">
                        <div className="flex items-center gap-2 overflow-hidden flex-grow">
                          {/* Move Up / Down Buttons */}
                          <div className="flex flex-col gap-0.5 mr-1 flex-shrink-0">
                            <button
                              onClick={() => moveTrack(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-gray-500 hover:text-brand-yellow hover:bg-white/5 disabled:opacity-10 disabled:hover:text-gray-500 disabled:hover:bg-transparent rounded transition-all cursor-pointer"
                              title="Subir posición"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => moveTrack(idx, 'down')}
                              disabled={idx === localRadioTracks.length - 1}
                              className="p-1 text-gray-500 hover:text-brand-yellow hover:bg-white/5 disabled:opacity-10 disabled:hover:text-gray-500 disabled:hover:bg-transparent rounded transition-all cursor-pointer"
                              title="Bajar posición"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          <Music size={14} className="text-brand-yellow/70 flex-shrink-0" />
                          <div className="truncate animate-fadeIn">
                            <p className="font-bold truncate text-gray-300">
                              <span className="text-brand-yellow font-mono text-[10px] mr-1.5">#{idx + 1}</span>
                              {track.title || track.fullName}
                            </p>
                            <p className="text-[9px] text-gray-550 uppercase font-mono mt-0.5">
                              {track.artistName} {track.fileSizeHuman && `• ${track.fileSizeHuman}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button 
                            onClick={() => handleRenameLocalRadio(idx, track.fullName || '')}
                            className="p-2 text-gray-400 hover:text-brand-yellow hover:bg-brand-yellow/10 rounded-lg transition-colors active:scale-95"
                            title="Cambiar nombre / Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteLocalRadio(track.fullName || '', track.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                            title="Eliminar audio"
                          >
                            <Trash size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {localRadioTracks.length === 0 && (
                    <div className="py-12 text-center text-gray-600 border border-white/[0.03] rounded-2xl bg-black/20 text-[10px] font-black uppercase tracking-wider italic">
                      NO HAY ARCHIVOS EN LA RADIO LOCAL. ¡SUBE UNO ARRIBA!
                    </div>
                  )}
                </div>
              </div>

              {localRadioTracks.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={handleSaveRadioOrder}
                    disabled={savingRadioOrder}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-white/10 text-white hover:bg-white/15 active:scale-95 border-2 border-white/20 hover:border-white/30 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer"
                    title="Guardar el orden personalizado actual"
                  >
                    <Save size={13} className="text-brand-yellow" />
                    {savingRadioOrder ? "GUARDANDO..." : "GUARDAR ORDEN"}
                  </button>
                  <button
                    onClick={handlePlayRadioWithOrder}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-brand-yellow text-black hover:bg-brand-yellow/90 active:scale-95 border-2 border-brand-yellow hover:border-brand-yellow/90 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-[0_4px_15px_rgba(248,251,2,0.15)] cursor-pointer"
                    title="Iniciar radio con el orden guardado"
                  >
                    <Play size={13} fill="black" />
                    INICIAR RADIO
                  </button>
                </div>
              )}
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
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left block">Imagen de Perfil</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" placeholder="Ej: https://images.unsplash.com/... o sube un archivo"
                    className="flex-grow bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-white bg-neutral-900"
                    value={artistForm.photoURL}
                    onChange={e => setArtistForm({...artistForm, photoURL: e.target.value})}
                  />
                  <label className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black text-[10px] uppercase rounded-xl cursor-pointer flex items-center gap-1.5 transition-all">
                    <Upload size={12} />
                    {uploadingAdminPhoto ? 'SUBIENDO...' : 'SUBIR FOTO'}
                    <input 
                      type="file" accept="image/*" className="hidden"
                      onChange={handleAdminPhotoUpload} disabled={uploadingAdminPhoto}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left block">Biografía o Slogan</label>
                <textarea 
                  placeholder="Escribe la biografía del artista..." rows={2}
                  className="w-full bg-black/60 border border-white/10 p-3.5 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold"
                  value={artistForm.bio}
                  onChange={e => setArtistForm({...artistForm, bio: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left block">Spotify URL</label>
                  <input 
                    type="text" placeholder="https://open.spotify.com/artist/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.spotifyUrl}
                    onChange={e => setArtistForm({...artistForm, spotifyUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left block">Instagram URL</label>
                  <input 
                    type="text" placeholder="https://instagram.com/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.instagramUrl}
                    onChange={e => setArtistForm({...artistForm, instagramUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left block">Apple Music URL</label>
                  <input 
                    type="text" placeholder="https://music.apple.com/..."
                    className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={artistForm.appleMusicUrl}
                    onChange={e => setArtistForm({...artistForm, appleMusicUrl: e.target.value})}
                  />
                </div>
              </div>

              {/* REELS SECTION FOR ADMIN */}
              <div className="p-4 bg-black/30 border border-white/5 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-brand-yellow uppercase tracking-widest">REELS / VIDEOCLIPS</label>
                  <span className="text-[8px] font-mono font-bold text-gray-500">{(artistForm.reels || []).length} CARGADOS</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="Ej: https://www.youtube.com/shorts/VIDEO_ID"
                    className="flex-grow bg-black/50 border border-white/10 p-3 rounded-lg text-[10px] focus:border-brand-yellow outline-none transition-all font-bold"
                    value={adminFormReelInput}
                    onChange={e => setAdminFormReelInput(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (adminFormReelInput.trim()) {
                        const updatedReels = [...(artistForm.reels || []), adminFormReelInput.trim()];
                        setArtistForm({ ...artistForm, reels: updatedReels });
                        setAdminFormReelInput('');
                      }
                    }}
                    className="px-4 bg-brand-yellow text-black font-black uppercase text-[10px] rounded-lg hover:scale-[1.01] active:scale-95 transition-all text-center"
                  >
                    AGREGAR
                  </button>
                </div>
                <div className="space-y-1 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar text-[10px]">
                  {(artistForm.reels || []).map((url, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/[0.01] p-2 rounded border border-white/5 text-[10px]">
                      <span className="truncate flex-1 font-mono text-gray-400 mr-2">{url}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const updatedReels = (artistForm.reels || []).filter((_, idx) => idx !== i);
                          setArtistForm({ ...artistForm, reels: updatedReels });
                        }}
                        className="text-gray-500 hover:text-red-500 p-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" id="artist-pin"
                    className="rounded bg-black border-white/10 text-brand-yellow focus:ring-brand-yellow"
                    checked={artistForm.isPinned}
                    onChange={e => setArtistForm({...artistForm, isPinned: e.target.checked})}
                  />
                  <label htmlFor="artist-pin" className="text-[11px] font-black uppercase text-gray-400 cursor-pointer">Fijar destacado (PIN)</label>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" id="artist-exclusive"
                    className="rounded bg-black border-white/10 text-brand-yellow focus:ring-brand-yellow"
                    checked={artistForm.isExclusive !== false}
                    onChange={e => setArtistForm({...artistForm, isExclusive: e.target.checked})}
                  />
                  <label htmlFor="artist-exclusive" className="text-[11px] font-black uppercase text-gray-400 cursor-pointer">Artista Exclusivo RapLife</label>
                </div>
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
