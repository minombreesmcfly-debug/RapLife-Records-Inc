import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Flame, Star, TrendingUp, Music, Play, ExternalLink, Radio, 
  Send, CheckCircle2, Video, Sparkles, Phone, User, Link2, HelpCircle, 
  ChevronRight, ArrowUpRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';
import ElfsightTikTok from '../components/ElfsightTikTok';

// Formato de Servicios Promocionales
const PROM_SERVICES = [
  {
    id: 'music-video',
    title: 'VIDEOCLIPS MUSICALES',
    tagline: 'Dirección de Arte y Producción',
    desc: '¿Necesitas un videoclip musical? Llevamos tu canción a la pantalla grande. Dirección de fotografía cinematográfica de alta gama, edición rítmica avanzada y corrección de color profesional para que tu propuesta destaque al máximo nivel visual.',
    accent: 'from-brand-yellow to-yellow-600',
    stat: 'Videoclips 4K UHD'
  },
  {
    id: 'audiovisual-visualizer',
    title: 'VISUALIZER DE CALIDAD',
    tagline: 'Audio-Reactivos y Loops en Tendencia',
    desc: 'Buscamos un visualizer de calidad para tu proyecto musical. Creamos animaciones loops elegantes con efectos audio-reactivos perfectos para YouTube, Instagram Reels y TikTok. Convierte tu MP3 en un imán estético de clics e interacciones.',
    accent: 'from-brand-green to-teal-500',
    stat: 'Formatos 16:9 y 9:16'
  },
  {
    id: 'merch-streetwear',
    title: 'MODELOS 3D Y STREETWEAR',
    tagline: 'Promociones Virtuales de Merchandising',
    desc: 'Ilustramos tus prendas y merchandising de marca RapLife con modelaje hiperrealista utilizando maniquíes 3D de alta definición, ropa virtual interactiva y escenarios urbanos cyber-artísticos listos para romper esquemas comerciales.',
    accent: 'from-blue-500 to-indigo-600',
    stat: 'Maniquíes 3D Activos'
  },
  {
    id: 'artist-career',
    title: 'ASESORÍA DE ARTISTA INDEPENDIENTE',
    tagline: 'Despliegue y Distribución Estratégica',
    desc: '¿Necesitas ayuda con tu carrera de artista independiente? Creamos una ruta estratégica a tu medida para optimizar lanzamientos en Spotify, diseñar portadas de discos con alto nivel comercial y formular tus pitches ágiles a listas de reproducción oficiales.',
    accent: 'from-red-500 to-pink-600',
    stat: 'Mentoría Editorial'
  }
];

const HomeView = () => {
  const { profile } = useAuth();
  const { play } = useMusic();
  const [pinnedArtists, setPinnedArtists] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  // Promo selector
  const [activePromTab, setActivePromTab] = useState(0);

  // Contact Form state variables
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSocials, setContactSocials] = useState('');
  const [selectedService, setSelectedService] = useState('VIDEOCLIP MUSICAL');
  const [contactDetails, setContactDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false);

  // Watch for Auth profile to pre-fill coordinates
  useEffect(() => {
    if (profile) {
      setContactName(profile.displayName || '');
    }
  }, [profile]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Pinned Artists
        const qPinned = query(collection(db, 'users'), where('role', '==', 'artist'), where('isPinned', '==', true), limit(6));
        const snapPinned = await getDocs(qPinned);
        setPinnedArtists(snapPinned.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Recent Tracks
        const qTracks = query(collection(db, 'tracks'), where('isRadioInterstitial', '==', false), orderBy('createdAt', 'desc'), limit(10));
        const snapTracks = await getDocs(qTracks);
        setRecentTracks(snapTracks.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching home data:", e);
      }
    };
    fetchData();
  }, []);

  // Handle Contact Form Submission
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      alert("Por favor introduce al menos tu Nombre y un WhatsApp de contacto.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Compose a rich comments block storing the WhatsApp and Social Links to respect strict collection schemas of ContactMessage
      const finalCommentsString = `WhatsApp / Teléfono: ${contactPhone} | Redes Sociales: ${contactSocials} | Mensaje: ${contactDetails || 'Sin comentarios adicionales.'}`;
      
      const payload = {
        name: contactName,
        email: profile?.email || 'anonimo@raplife.records',
        projectType: selectedService,
        comments: finalCommentsString,
        submittedAt: new Date().toISOString(),
        status: 'pending' // Enum requirement match
      };

      await addDoc(collection(db, 'contact_messages'), payload);
      
      setIsSubmittedSuccessfully(true);
      // Reset form variables
      setContactPhone('');
      setContactSocials('');
      setContactDetails('');
    } catch (error) {
      console.error("Error submitting contact inquiry to Firestore:", error);
      alert("Hubo un error al enviar tu consulta. Por favor inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 md:p-10 space-y-16 max-w-7xl mx-auto"
    >
      {/* Pinned Artists (Top Talents banner grid) */}
      <section id="top-artists-section">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-brand-yellow" />
            <h2 className="text-3xl font-black italic tracking-tighter uppercase underline decoration-brand-yellow/30 decoration-4 underline-offset-8">TOP ARTISTAS</h2>
          </div>
          <Link to="/artists" className="text-xs font-bold text-gray-500 hover:text-brand-yellow transition-colors tracking-widest uppercase">VER TODOS +</Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pinnedArtists.map((artist) => (
            <Link key={artist.id} to={`/profile/${artist.id}`} className="group" id={`artist-card-${artist.id}`}>
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 border-2 border-transparent group-hover:border-brand-yellow transition-all shadow-lg group-hover:shadow-[0_0_20px_rgba(248,251,2,0.3)]">
                <img referrerPolicy="no-referrer" src={artist.photoURL || 'https://images.unsplash.com/photo-1601643143482-96cb344070fb?q=80&w=400&auto=format&fit=crop'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              </div>
              <h3 className="text-sm font-black italic uppercase text-center group-hover:text-brand-yellow truncate">{artist.displayName}</h3>
            </Link>
          ))}
          {pinnedArtists.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-650 italic font-bold uppercase tracking-widest text-sm bg-white/5 rounded-3xl border-2 border-dashed border-white/5">
               BUSCANDO TALENTO...
            </div>
          )}
        </div>
      </section>

      {/* Full-width tracks list (stretched to fill the empty space of the removed TikTok widget) */}
      <section className="space-y-6" id="recent-tracks-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {recentTracks.map((track) => (
            <motion.div 
              key={track.id}
              whileHover={{ y: -4 }}
              className="group flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-brand-yellow/30 transition-all relative overflow-hidden"
              id={`track-${track.id}`}
            >
              <div className="w-16 h-16 bg-gray-900 rounded-xl flex-shrink-0 relative border border-white/10 overflow-hidden">
                 <img src={track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop'} className="w-full h-full object-cover" />
                 <button 
                   onClick={() => play(track)}
                   className="absolute inset-0 flex items-center justify-center bg-brand-yellow/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                   <Play className="text-black fill-black" size={24} />
                 </button>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-black italic uppercase text-base truncate group-hover:text-brand-yellow transition-colors tracking-tight">{track.title}</h4>
                <p className="text-gray-500 text-[10px] uppercase font-semibold tracking-wider">Artista: <span className="text-gray-300">{track.artistName}</span></p>
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <ExternalLink size={16} className="text-brand-yellow" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* WIDE FULL-WIDTH DISPLAY FOR PROMOTIONS AND ARTIST CAREER (Replaces old phone-like slider) */}
      <section className="w-full bg-neutral-900 border-4 border-neutral-850 rounded-[3rem] p-6 md:p-10 relative overflow-hidden" id="promotional-contact-segment">
        
        {/* Floating background glowing grids */}
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-brand-yellow/10 rounded-full blur-3xl -mr-36 -mb-36 pointer-events-none" />
        <div className="absolute left-0 top-0 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl -ml-36 -mt-36 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* LEFT COLUMN: THE PROMOTION SLIDESHOW WITH 3D RAPPER MODEL */}
          <div className="lg:col-span-7 space-y-6 flex flex-col justify-between h-full text-left">
            
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow/10 border border-brand-yellow/20 rounded-full text-brand-yellow text-[9px] font-mono font-black uppercase tracking-widest">
                <Sparkles size={11} className="animate-spin duration-3000" />
                <span>SOLUCIONES AUDIOVISUALES PREMIUM</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold italic tracking-tighter text-white uppercase leading-none">
                ¿Necesitas un videoclip musical o ayuda con tu carrera de artista independiente?
              </h2>
              <div className="h-1.5 w-32 bg-brand-yellow rounded-full" />
            </div>

            {/* TAB SELECTOR BUTTONS */}
            <div className="flex flex-wrap gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/5">
              {PROM_SERVICES.map((serv, index) => (
                <button
                  key={serv.id}
                  onClick={() => setActivePromTab(index)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activePromTab === index 
                      ? 'bg-neutral-850 text-brand-yellow border border-neutral-750 shadow-md' 
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  {serv.id === 'music-video' && '🎥 VIDEOS'}
                  {serv.id === 'audiovisual-visualizer' && '⚡ VISUALIZERS'}
                  {serv.id === 'merch-streetwear' && '🧢 MODELOS 3D'}
                  {serv.id === 'artist-career' && '📈 ASESORÍA'}
                </button>
              ))}
            </div>

            {/* MAIN SLIDE PRELOAD BLOCK */}
            <div className="bg-black/60 border border-white/5 p-5 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center gap-6 shadow-inner grow min-h-[220px]">
              
              {/* Illustration element using 3D generated rapper model */}
              {activePromTab === 2 ? (
                <div className="w-full md:w-40 h-40 shrink-0 rounded-2xl overflow-hidden bg-neutral-950 border border-brand-yellow/20 relative group self-center flex items-center justify-center">
                  <img 
                    referrerPolicy="no-referrer"
                    src="/src/assets/images/raplife_merch_rapper_1781109159375.png" 
                    className="w-full h-full object-contain scale-110 group-hover:scale-115 transition-transform duration-700 animate-pulse" 
                    alt="Streetwear Mannequin 3D Model"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-60" />
                  <span className="absolute bottom-2 left-2 text-[6.5px] font-mono bg-black px-1.5 py-0.5 rounded text-brand-green font-bold">LIVE STYLIST</span>
                </div>
              ) : (
                <div className="w-full md:w-40 h-40 shrink-0 rounded-2xl overflow-hidden bg-neutral-950 border border-white/5 relative group self-center flex items-center justify-center">
                  {/* Subtle placeholder illustrations with cyberpunk studio vibes */}
                  <img 
                    referrerPolicy="no-referrer"
                    src="/src/assets/images/raplife_merch_rapper_1781109159375.png" 
                    className="w-full h-full object-contain opacity-25 filter blur-[1px] transition-transform duration-700" 
                    alt="RapLife aesthetic background"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/70">
                    <Video size={24} className="text-brand-yellow mb-2 animate-bounce" />
                    <span className="text-[8px] font-mono uppercase text-neutral-500 font-black tracking-widest">
                      {PROM_SERVICES[activePromTab].stat}
                    </span>
                  </div>
                </div>
              )}

              {/* Textual descriptions with motion triggers */}
              <div className="space-y-3 flex-1 text-left">
                <span className={`text-[9px] font-mono font-black uppercase tracking-widest text-brand-green bg-gradient-to-r ${PROM_SERVICES[activePromTab].accent} bg-clip-text text-transparent`}>
                  {PROM_SERVICES[activePromTab].tagline}
                </span>
                <h3 className="text-xl font-extrabold italic uppercase tracking-tight text-white leading-tight">
                  {PROM_SERVICES[activePromTab].title}
                </h3>
                <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                  {PROM_SERVICES[activePromTab].desc}
                </p>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: INTERACTIVE FORM WITH IMMERSIVE VISUAL HOVER FEEDBACK */}
          <div className="lg:col-span-5 bg-black/40 border border-white/5 p-6 md:p-8 rounded-[2.5rem] relative shadow-2xl">
            
            <AnimatePresence mode="wait">
              {isSubmittedSuccessfully ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-12 flex flex-col items-center text-center space-y-4"
                  id="contact-submission-success"
                >
                  <div className="p-4 bg-brand-green/10 text-brand-green rounded-full shadow-[0_0_20px_rgba(57,255,20,0.1)]">
                    <CheckCircle2 size={40} className="animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tight text-white uppercase">¡SOLICITUD ENVIADA!</h3>
                    <p className="text-[10px] font-mono text-brand-green uppercase font-black tracking-widest mt-1">Conexión Segura con el Sello</p>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
                    Un miembro de nuestro equipo se pondrá en contacto contigo a la brevedad posible para agendar tu audición u optimizar tu producción.
                  </p>
                  <button
                    onClick={() => setIsSubmittedSuccessfully(false)}
                    className="mt-4 px-6 py-2.5 bg-neutral-900 border border-neutral-800 text-brand-yellow hover:text-white rounded-xl text-[9px] font-mono font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                  >
                    Enviar otra consulta +
                  </button>
                </motion.div>
              ) : (
                <motion.form 
                  onSubmit={handleContactSubmit}
                  className="space-y-4 text-left"
                  id="homepage-contact-form"
                >
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter text-brand-yellow">
                      SOLICITAR PRESUPUESTO / REUNIÓN
                    </h3>
                    <p className="text-[8.5px] text-gray-500 font-mono uppercase font-black tracking-widest">
                      Respuesta en menos de 24 horas garantizada
                    </p>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black tracking-widest text-[#6c6c6c] uppercase flex items-center gap-1.5">
                      <User size={10} />
                      <span>TU NOMBRE COMPLETO *</span>
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-sans text-xs text-white focus:border-brand-yellow outline-none uppercase font-bold"
                      placeholder="Ej. MC Drozky"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      required
                    />
                  </div>

                  {/* WhatsApp Input */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black tracking-widest text-[#6c6c6c] uppercase flex items-center gap-1.5">
                      <Phone size={10} />
                      <span>TELÉFONO / WHATSAPP *</span>
                    </label>
                    <input 
                      type="tel"
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-mono text-xs text-white focus:border-brand-yellow outline-none font-bold"
                      placeholder="Ej. +52 1 55 ..."
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* Social Networks Link */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black tracking-widest text-[#6c6c6c] uppercase flex items-center gap-1.5">
                      <Link2 size={10} />
                      <span>INSTAGRAM O TIKTOK PROFILE (OPCIONAL)</span>
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-mono text-xs text-white focus:border-brand-yellow outline-none"
                      placeholder="Ej. @raplife.records"
                      value={contactSocials}
                      onChange={e => setContactSocials(e.target.value)}
                    />
                  </div>

                  {/* Service type selector */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black tracking-widest text-[#6c6c6c] uppercase flex items-center gap-1.5">
                      <HelpCircle size={10} />
                      <span>¿QUÉ SERVICIO EN ESPECÍFICO BUSCAS?</span>
                    </label>
                    <select
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-mono text-xs text-brand-yellow font-black focus:border-brand-yellow outline-none cursor-pointer"
                      value={selectedService}
                      onChange={e => setSelectedService(e.target.value)}
                    >
                      <option value="VIDEOCLIP MUSICAL" className="bg-neutral-900 text-white">REQUERIMIENTO DE VIDEOCLIPS</option>
                      <option value="HD VISUALIZER" className="bg-neutral-900 text-white">REQUERIMIENTO VISUALIZERS DE CALIDAD</option>
                      <option value="MODELO MERCH 3D" className="bg-neutral-900 text-white">RENDER DE MODELOS STREETWEAR 3D</option>
                      <option value="ASESORÍA INDEPENDIENTE" className="bg-neutral-900 text-white">ASESORÍA PROFESIONAL DE ARTISTA</option>
                    </select>
                  </div>

                  {/* Comments */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black tracking-widest text-[#6c6c6c] uppercase">DETALLES DE TU PROYECTO MUSICAL</label>
                    <textarea 
                      className="w-full bg-black/60 border border-white/10 p-3 rounded-xl font-sans text-xs text-neutral-300 focus:border-brand-yellow outline-none h-20 resize-none font-medium h-24"
                      placeholder="Cuéntanos un poco sobre tu presupuesto, ideas para el videoclip o canciones a distribuir..."
                      value={contactDetails}
                      onChange={e => setContactDetails(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-brand-yellow hover:bg-white text-black font-black uppercase text-xs rounded-xl shadow-glow transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={11} />
                    <span>{isSubmitting ? 'ENVIANDO COORDINADAS...' : 'ENVIAR CONSULTA AL EQUIPO ✨'}</span>
                  </button>

                  <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wide text-center leading-normal">
                    🔒 Envío bajo cifrado seguro de RapLife Cloud. Al enviar, autorizas la comunicación vía WhatsApp de soporte.
                  </p>

                </motion.form>
              )}
            </AnimatePresence>

          </div>

        </div>

      </section>

      {/* COMPACT FOOTER SOCIAL ACCENTS */}
      <footer className="w-full border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-6 px-1 text-center md:text-left select-none pb-4">
        <div>
          <span className="text-[10px] font-mono font-black text-brand-yellow uppercase tracking-widest">RAPLIFE STUDIO ENG™</span>
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-wider mt-1">© {new Date().getFullYear()} RAPLIFE RECORDS. TODOS LOS DERECHOS RESERVADOS.</p>
        </div>
        
        {/* Social Networks Row */}
        <div className="flex items-center gap-4 text-xs font-mono font-black text-neutral-400 uppercase tracking-widest select-none">
          <a href="https://facebook.com" target="_blank" rel="noreferrer" className="hover:text-brand-yellow transition-colors flex items-center gap-1">
            <span>FB</span>
            <ArrowUpRight size={10} />
          </a>
          <span className="text-neutral-800">|</span>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-brand-yellow transition-colors flex items-center gap-1">
            <span>IG</span>
            <ArrowUpRight size={10} />
          </a>
          <span className="text-neutral-800">|</span>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="hover:text-brand-yellow transition-colors flex items-center gap-1">
            <span>TK</span>
            <ArrowUpRight size={10} />
          </a>
          <span className="text-neutral-800">|</span>
          <a href="https://patreon.com" target="_blank" rel="noreferrer" className="hover:text-brand-yellow transition-colors flex items-center gap-1">
            <span>PATREON</span>
            <ArrowUpRight size={10} />
          </a>
        </div>
      </footer>

    </motion.div>
  );
};

export default HomeView;
