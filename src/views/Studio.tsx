import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { 
  Upload, Sparkles, RefreshCw, Undo, ClipboardCheck, 
  ArrowLeft, Check, AlertTriangle, ShieldCheck, Download, 
  Trash2, Image as ImageIcon, Shirt, Eye, Star, Save
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Person {
  id: string;
  label: string;
  description: string;
  originalOutfit: string;
  newOutfit?: string;
}

const StudioView = () => {
  const { user, profile, isAdmin } = useAuth();
  
  // Access control check
  const isPremiumOrAdmin = isAdmin || profile?.plan === 'premium' || profile?.role === 'artist';

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // App States
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorInput, setErrorInput] = useState<string | null>(null);

  // History Stack for versions
  const [history, setHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  // Firestore masterworks library
  const [masterpieces, setMasterpieces] = useState<any[]>([]);
  const [savingCollection, setSavingCollection] = useState<boolean>(false);

  // Load user saved masterpieces
  const fetchMasterpieces = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'studioMasterpieces'),
        where('createdBy', '==', user.uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMasterpieces(items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error('Error fetching masterpieces:', err);
      handleFirestoreError(err, OperationType.LIST, 'studioMasterpieces');
    }
  };

  useEffect(() => {
    if (user && isPremiumOrAdmin) {
      fetchMasterpieces();
    }
  }, [user, isPremiumOrAdmin]);

  // Handle Drag & Drop
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Convert uploaded photo to Base64 and run recognition
  const handleFileProcess = async (file: File) => {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$|\.heif$/i.test(file.name);
    if (!file.type.startsWith('image/') && !isHeic) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    let activeFile: Blob | File = file;
    let mimeType = file.type;

    if (isHeic) {
      setLoading(true);
      setLoadingStep('Convertiendo formato Apple HEIC a formato de imagen estándar...');
      try {
        const heic2any = (await import('heic2any')).default;
        const result = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.85
        });
        const convertedBlob = Array.isArray(result) ? result[0] : result;
        activeFile = new File([convertedBlob], file.name.replace(/\.heic$|\.heif$/i, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        mimeType = 'image/jpeg';
      } catch (err: any) {
        console.error('Error converting HEIC:', err);
        setErrorInput('No se pudo convertir el archivo HEIC. Por favor utiliza JPG, PNG o WEBP.');
        setLoading(false);
        return;
      }
    }

    setImageMime(mimeType);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setOriginalImage(base64);
      setHistory([base64]);
      setCurrentHistoryIndex(0);
      setPeople([]);
      setErrorInput(null);
      
      // Auto analyze people
      await analyzePhoto(base64, mimeType);
    };
    reader.readAsDataURL(activeFile);
  };

  // Step 2: Auto Recognition
  const analyzePhoto = async (base64Img: string, mime: string) => {
    setLoading(true);
    setLoadingStep('Reconociendo personajes en la foto de manera automática...');
    setErrorInput(null);
    try {
      const response = await fetch('/api/studio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Img, mimeType: mime }),
      });

      if (!response.ok) {
        throw new Error('Hubo un error del servidor reconociendo la imagen.');
      }

      const data = await response.json();
      if (data.people && Array.isArray(data.people)) {
        setPeople(data.people.map((p: any) => ({ ...p, newOutfit: '' })));
      } else {
        throw new Error('No se devolvió un formato correcto de personajes.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorInput(err.message || 'Error analizando la imagen.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Step 3: Change Outfit render swap
  const renderNewOutfits = async () => {
    if (!originalImage || history.length === 0) return;
    setLoading(true);
    setLoadingStep('Generando nuevos vestuarios realistas en el servidor...');
    setErrorInput(null);

    const activeImage = history[currentHistoryIndex];

    try {
      const response = await fetch('/api/studio/render-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: activeImage,
          mimeType: imageMime,
          people: people
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Fallo de la API al generar la ropa nueva.');
      }

      const data = await response.json();
      if (data.image) {
        // Successful edit -> Add into history stack & update pointer
        const newHistory = history.slice(0, currentHistoryIndex + 1);
        newHistory.push(data.image);
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
      } else {
        throw new Error('No se pudo generar la nueva foto de vestuario.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorInput(err.message || 'Error generando vestuarios. Asegúrate de configurar GEMINI_API_KEY en Settings > Secrets.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // History traversal
  const goBackHistory = () => {
    if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  };

  const goForwardHistory = () => {
    if (currentHistoryIndex < history.length - 1) {
      setCurrentHistoryIndex(currentHistoryIndex + 1);
    }
  };

  const jumpToHistoryIndex = (idx: number) => {
    if (idx >= 0 && idx < history.length) {
      setCurrentHistoryIndex(idx);
    }
  };

  // Reset workspace
  const clearWorkspace = () => {
    if (window.confirm('¿Deseas vaciar el estudio de diseño y empezar con otra foto?')) {
      setOriginalImage(null);
      setHistory([]);
      setCurrentHistoryIndex(-1);
      setPeople([]);
      setErrorInput(null);
    }
  };

  // Save current masterpiece to Firestore
  const saveMasterpiece = async () => {
    if (!history[currentHistoryIndex] || !user) return;
    setSavingCollection(true);
    try {
      const activeDesc = people
        .map(p => `${p.label} vestirá: ${p.newOutfit || 'Predeterminado'}`)
        .join(', ');

      await addDoc(collection(db, 'studioMasterpieces'), {
        image: history[currentHistoryIndex],
        originalOutfit: people.map(p => `${p.label}: ${p.originalOutfit}`).join(', '),
        outfitPrompt: activeDesc || 'Outfit edit',
        createdBy: user.uid,
        createdByName: user.displayName || 'Admin / Premium Colección',
        createdAt: serverTimestamp()
      });

      alert('¡Obra de vestuario guardada con éxito en tu biblioteca privada de RapLife Records!');
      fetchMasterpieces();
    } catch (err: any) {
      alert('Error guardando en base de datos: ' + err.message);
      handleFirestoreError(err, OperationType.CREATE, 'studioMasterpieces');
    } finally {
      setSavingCollection(false);
    }
  };

  // Delete masterpiece from database
  const deleteMasterpiece = async (id: string) => {
    if (!window.confirm('¿Seguro de eliminar este diseño de tu biblioteca?')) return;
    try {
      await deleteDoc(doc(db, 'studioMasterpieces', id));
      fetchMasterpieces();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, `studioMasterpieces/${id}`);
    }
  };

  // Download Image File safely
  const downloadImage = () => {
    const activeImage = history[currentHistoryIndex];
    if (!activeImage) return;
    const link = document.createElement('a');
    link.href = activeImage;
    link.download = `raplife-outfit-swap-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render access denied UI for regular Fans
  if (!isPremiumOrAdmin) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[75vh]">
        <div className="bg-red-500/10 border-4 border-red-500 max-w-lg p-10 rounded-[2.5rem] text-center boombox-texture">
          <AlertTriangle size={56} className="mx-auto mb-4 text-red-500 animate-bounce" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter glow-yellow">SÓLO PARA MIEMBROS PREMIUM</h1>
          <p className="text-gray-400 mt-4 leading-relaxed font-bold uppercase text-xs tracking-wider">
            Este estudio de diseño virtual mediante Inteligencia Artificial es una herramienta de alta gama exclusiva para Administradores de RapLife Records y artistas con un Plan de Suscripción Premium.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/" className="px-6 py-4 bg-brand-yellow text-black font-black italic uppercase text-xs rounded-xl shadow-glow">
              VOLVER A LA EMISIÓN
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-10 pb-20">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row items-center gap-6 bg-white/5 p-6 md:p-8 rounded-[2.5rem] border border-white/10 boombox-texture">
        <div className="p-4 bg-brand-yellow text-black rounded-2xl rotate-2 shadow-glow">
          <Shirt size={30} />
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter">ESTUDIO VIRTUAL DE VESTUARIO</h1>
            {isAdmin && <span className="bg-brand-yellow/20 text-brand-yellow text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-yellow/30">ADMIN MODE</span>}
            {!isAdmin && <span className="bg-brand-green/20 text-brand-green text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-green/30">PREMIUM MEMBER</span>}
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">Cambia la ropa de tus portadas y fotos de raperos de forma realista mediante Inteligencia Artificial sin alterar rostros ni poses.</p>
        </div>
      </header>

      {/* WORKSPACE AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT WORKSPACE: IMAGE WORKAREA / DISPLAY (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-brand-dark p-6 rounded-[2rem] border-4 border-boombox-gray flex flex-col relative overflow-hidden group">
            
            {/* Ambient Background decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles size={160} />
            </div>

            <div className="flex items-center justify-between mb-4 z-10">
              <span className="text-xs font-black uppercase tracking-wider text-brand-yellow flex items-center gap-1.5">
                <ImageIcon size={14} /> LIENZO DE RETOQUE
              </span>
              {history.length > 0 && (
                <div className="flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                  <span className="text-[10px] font-mono font-bold text-gray-400">VERSIÓN {currentHistoryIndex + 1}/{history.length}</span>
                </div>
              )}
            </div>

            {/* MAIN DRAG & DROP CANVAS */}
            {!originalImage ? (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-4 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[320px] transition-all bg-white/[0.01] hover:bg-white/[0.03] ${
                  isDragOver ? 'border-brand-yellow bg-brand-yellow/5 scale-[0.99]' : 'border-white/10 hover:border-brand-yellow/40'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*,.heic,.heif" 
                  className="hidden" 
                  onChange={handleFileSelect} 
                />
                
                <div className="p-4 bg-white/5 rounded-full text-brand-yellow mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                
                <h3 className="text-lg font-black italic uppercase tracking-tighter">SUBE LA FOTO DEL ARTISTA O PORTADA</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1 max-w-sm">Arrastra y suelta tu archivo aquí, o haz clic para explorar. Se recomiendan fotos claras de medio plano o cuerpo completo.</p>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-4">JPG / PNG / WEBP / HEIC</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ACTIVE IMAGE RENDERING AREA */}
                <div className="relative rounded-xl overflow-hidden border-2 border-black aspect-video max-h-[460px] bg-black/80 flex items-center justify-center group-hover:border-white/20 transition-all shadow-2xl">
                  <img 
                    src={history[currentHistoryIndex]} 
                    alt="Active studio masterpiece" 
                    className="max-h-[440px] max-w-full object-contain"
                  />

                  {/* LOADING OVERLAY SCREEN */}
                  {loading && (
                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-8 z-50 backdrop-blur-sm">
                      <div className="relative w-20 h-20 mb-4">
                        {/* Spinning vinyl disk / cassette reels */}
                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand-yellow animate-spin" />
                        <div className="absolute inset-4 rounded-full bg-brand-dark flex items-center justify-center">
                          <Shirt size={24} className="text-brand-yellow animate-pulse" />
                        </div>
                      </div>
                      <h4 className="text-brand-yellow font-black italic uppercase tracking-tighter text-sm mb-2">AJUSTANDO HILOS Y TEXTURAS</h4>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider max-w-md animate-pulse">{loadingStep}</p>
                    </div>
                  )}
                </div>

                {/* BOTTOM RESTORE / ACTION BUTTONS FOR LIENZO */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={goBackHistory}
                      disabled={currentHistoryIndex <= 0 || loading}
                      className="px-4 py-3 bg-[#1e1e1e] border border-white/10 hover:bg-[#2e2e2e] disabled:opacity-20 disabled:pointer-events-none text-white font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Undo size={14} /> VOLVER A LA ANTERIOR
                    </button>
                    <button 
                      onClick={goForwardHistory}
                      disabled={currentHistoryIndex >= history.length - 1 || loading}
                      className="px-4 py-3 bg-[#1e1e1e] border border-white/10 hover:bg-[#2e2e2e] disabled:opacity-20 disabled:pointer-events-none text-white font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      ADELANTE <Undo size={14} className="rotate-180" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={downloadImage}
                      className="px-4 py-3 bg-brand-green text-black font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                      title="Descargar Foto"
                    >
                      <Download size={14} /> DESCARGAR
                    </button>
                    {user && (
                      <button 
                        onClick={saveMasterpiece}
                        disabled={savingCollection}
                        className="px-4 py-3 bg-brand-yellow text-black font-black uppercase text-[10px] rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                        title="Guardar máster en mi biblioteca"
                      >
                        <Save size={14} /> {savingCollection ? 'GUARDANDO...' : 'GUARDAR EN MI BIBLIOTECA'}
                      </button>
                    )}
                    <button 
                      onClick={clearWorkspace}
                      className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all active:scale-90"
                      title="Nuevas Portadas"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* HISTORIC SUB-THUMBNAILS TRAVERSAL */}
                {history.length > 1 && (
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-2">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">HISTORIAL DE VERSIONES (NAVEGAR ENTRE EDICIONES)</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {history.map((h, i) => (
                        <div 
                          key={i} 
                          onClick={() => jumpToHistoryIndex(i)}
                          className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 cursor-pointer flex-shrink-0 transition-transform hover:scale-105 ${
                            currentHistoryIndex === i ? 'border-brand-yellow scale-[0.98]' : 'border-white/10 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={h} alt="" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] font-mono font-bold text-center py-0.5">
                            {i === 0 ? 'ORIGINAL' : `V${i + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* RIGHT WORKSPACE: DYNAMIC CONTROLS & RECOGNITION PANEL (5 columns) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* PANEL 1: AUTOMATED PERSON RECOGNITION MAP */}
          <div className="bg-brand-dark p-6 rounded-[2rem] border-4 border-boombox-gray flex flex-col space-y-4">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-brand-yellow flex items-center gap-2">
              <Shirt size={20} /> CONFIGURADOR DE VESTUARIOS
            </h2>
            <p className="text-gray-500 text-xs font-semibold leading-relaxed uppercase tracking-wider">
              Una vez que subes una foto, Gemini identificará automáticamente a los personajes de la escena sin pedir prompts. Luego, especifica la nueva ropa para cada rapero.
            </p>

            {originalImage ? (
              <div className="space-y-4 pt-2">
                
                {/* Loader status */}
                {loading && people.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-70">
                    <RefreshCw className="animate-spin text-brand-yellow mb-2" size={30} />
                    <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">GEMINI ANALIZANDO PERSONAJES...</p>
                  </div>
                )}

                {/* Detected People form */}
                {people.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-brand-green uppercase tracking-widest flex items-center gap-1">
                      <Check size={12} /> {people.length} PERSONAJES RECONOCIDOS AUTOMÁTICAMENTE
                    </p>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {people.map((person, index) => (
                        <div key={person.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <span className="w-5 h-5 bg-brand-yellow/20 text-brand-yellow text-[9px] rounded-full flex items-center justify-center font-black">{index + 1}</span>
                            <h4 className="font-black italic uppercase tracking-wider text-xs text-brand-yellow">{person.label}</h4>
                          </div>

                          <div className="text-[10px] text-gray-500 font-bold uppercase space-y-0.5 leading-snug">
                            <p>🔍 <span className="text-gray-400">DESCRIPCIÓN EN FOTO:</span> {person.description}</p>
                            <p>👕 <span className="text-gray-400">ROPA ORIGINAL ENCONTRADA:</span> {person.originalOutfit}</p>
                          </div>

                          <div className="space-y-1 pt-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">NUEVO VESTUARIO DISEÑADO</label>
                            <textarea 
                              placeholder="Ej: Sudadera de terciopelo Supreme negra, cadenas de oro estilo cubano y gafas de sol oscuras..."
                              rows={2}
                              className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-xs focus:border-brand-yellow outline-none transition-all font-bold text-gray-200"
                              value={person.newOutfit || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPeople(prev => prev.map(p => p.id === person.id ? { ...p, newOutfit: val } : p));
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={renderNewOutfits}
                      disabled={loading}
                      className="w-full py-4 bg-brand-yellow text-black font-black italic uppercase text-xs rounded-xl shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} /> {loading ? 'PROCESANDO VESTIDURAS...' : 'CAMBIAR VESTUARIO AHORA'}
                    </button>
                  </div>
                ) : (
                  !loading && (
                    <div className="py-12 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center opacity-40">
                      <RefreshCw size={24} className="mb-2" />
                      <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">REINTENTAR RECONOCIMIENTO VÍA MULTIMODAL</p>
                      <button 
                        onClick={() => analyzePhoto(originalImage, imageMime)}
                        className="mt-3 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase"
                      >
                        RETRY RECOGNITION
                      </button>
                    </div>
                  )
                )}

              </div>
            ) : (
              <div className="py-12 text-center opacity-20 italic font-black uppercase tracking-widest text-[10px]">
                SUBE UNA FOTO PARA INICIAR EL RECONOCIMIENTO
              </div>
            )}

            {/* Error notifications */}
            {errorInput && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-500 text-xs font-semibold leading-relaxed uppercase">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p>{errorInput}</p>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2: SAVED MASTERPIECES LIBRARY */}
          <div className="bg-brand-dark p-6 rounded-[2rem] border-4 border-boombox-gray flex flex-col space-y-4">
            <h3 className="text-lg font-black italic uppercase tracking-tighter text-brand-green flex items-center gap-2">
              <Eye size={18} /> MIS DISEÑOS DE ESTUDIO
            </h3>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {masterpieces.map((master) => (
                <div key={master.id} className="flex gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl group hover:bg-white/5 transition-all text-xs">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black flex items-center justify-center">
                    <img src={master.image} className="w-full h-full object-cover" alt="" />
                  </div>
                  
                  <div className="flex-grow min-w-0 pr-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{master.outfitPrompt}</p>
                      <p className="text-[8px] text-gray-600 uppercase font-bold mt-1">original: {master.originalOutfit || 'N/A'}</p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] text-gray-500 uppercase font-mono">
                        {master.createdAt ? new Date(master.createdAt.seconds * 1000).toLocaleString('es-ES', { dateStyle: 'short' }) : 'Reciente'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setOriginalImage(master.image);
                            setHistory([master.image]);
                            setCurrentHistoryIndex(0);
                            setPeople([]);
                            // Process recognition again
                            analyzePhoto(master.image, 'image/jpeg');
                          }}
                          className="text-[9px] font-black text-brand-yellow hover:underline uppercase"
                          title="Cargar lienzo para editar de nuevo"
                        >
                          EDITAR
                        </button>
                        <button 
                          onClick={() => deleteMasterpiece(master.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          title="Borrar de mi colección"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {masterpieces.length === 0 && (
                <div className="py-12 text-center opacity-30 italic font-black uppercase text-[9px] tracking-widest">
                  NO TIENES DISEÑOS GUARDADOS EN TU GALERÍA
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default StudioView;
