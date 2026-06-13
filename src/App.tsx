import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Home, User, Radio, Gamepad2, Settings, LogIn, LogOut, Mic2, Heart, PlusCircle, ShieldCheck, Play, Upload, Volume2, VolumeX, Shirt, X, AlertTriangle, ExternalLink, Compass, Monitor, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, signInWithGoogleRedirect, getRedirectResultHelper, logoutUser } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';

// Views
import HomeView from './views/Home';
import GameView from './views/Game';
import AdminView from './views/Admin';
import ArtistProfileView from './views/ArtistProfile';
import ArtistsView from './views/Artists';
import ProfileSetupView from './views/ProfileSetup';
import ProfileSettingsView from './views/ProfileSettings';
import UploadTrackView from './views/UploadTrack';
import SpotifyTurntable from './components/SpotifyTurntable';
import StudioView from './views/Studio';
import SponsoredCarousel from './components/SponsoredCarousel';

const PlayerBar = () => {
  const { currentTrack, isPlaying, togglePlay, nextTrack } = useMusic();
  
  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-20 md:h-24 bg-boombox-gray border-t-4 md:border-t-8 border-black flex items-center px-4 md:px-10 z-[200] boombox-texture shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3 md:gap-4 w-1/3 md:w-1/4">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-brand-dark rounded-xl overflow-hidden border-2 md:border-4 border-black speaker-grill flex-shrink-0 relative group">
           {currentTrack.coverUrl && <img src={currentTrack.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />}
           <div className="absolute inset-0 bg-brand-yellow/10 animate-pulse-slow pointer-events-none" />
        </div>
        <div className="hidden sm:block min-w-0">
          <h4 className="font-black italic uppercase text-brand-yellow truncate tracking-tight text-xs md:text-sm leading-none mb-1">{currentTrack.title}</h4>
          <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.1em] truncate">{currentTrack.artistName}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 md:gap-2 flex-grow">
        <div className="flex items-center gap-4 md:gap-12">
          <button className="chrome-button p-1.5 rounded-full hidden md:block" title="REW"><div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[8px] border-r-black ml-[-1px]" /></button>
          <button onClick={togglePlay} className="w-12 h-12 md:w-14 md:h-14 chrome-button rounded-full flex items-center justify-center hover:scale-110 shadow-lg group">
             {isPlaying ? <div className="w-5 h-5 bg-black" /> : <Play className="ml-1 text-black" size={24} fill="black" />}
          </button>
          <button onClick={nextTrack} className="chrome-button p-1.5 rounded-full" title="FFW"><div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-black mr-[-1px]" /></button>
        </div>
        <div className="w-full max-w-[120px] sm:max-w-xs md:max-w-md h-2 md:h-3 bg-black rounded-full p-0.5 border border-white/5 overflow-hidden shadow-inner">
           <motion.div 
             className="h-full bg-brand-yellow rounded-full shadow-[0_0_15px_#f8fb02]" 
             initial={{ width: 0 }}
             animate={{ width: '60%' }}
           />
        </div>
      </div>

      <div className="w-1/3 md:w-1/4 flex justify-end items-center gap-4 text-gray-500">
        <div className="lcd-display px-2 py-1 rounded-lg text-[10px] font-mono border-2 border-black hidden lg:block">
           VOL: 92%
        </div>
      </div>
    </div>
  );
};

const MobileNav = () => (
  <div className="fixed bottom-0 left-0 right-0 h-16 bg-black flex items-center justify-around px-6 md:hidden z-[300] border-t border-white/10 safe-area-inset-bottom">
    <button onClick={() => document.getElementById('game')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[#444] active:text-brand-yellow transition-colors">
      <Gamepad2 size={24} />
      <span className="text-[8px] font-black uppercase tracking-widest">JUEGO</span>
    </button>
    <button onClick={() => document.getElementById('spotify-vinyl')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[#444] active:text-brand-yellow transition-colors">
      <Radio size={24} />
      <span className="text-[8px] font-black uppercase tracking-widest">RADIO</span>
    </button>
    <button className="flex flex-col items-center gap-1 text-[#444] active:text-brand-yellow transition-colors">
      <User size={24} />
      <span className="text-[8px] font-black uppercase tracking-widest">PERFIL</span>
    </button>
  </div>
);

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-10 border-b-4 border-black pb-4">
    <div className="p-2 md:p-3 bg-brand-yellow text-black rounded-xl rotate-3 shadow-lg flex-shrink-0"><Icon size={20} /></div>
    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter glow-yellow truncate">{title}</h2>
  </div>
);

const RadioStrip = () => {
  const { currentTrack, isPlaying } = useMusic();

  return (
    <div className="bg-black border-b-2 border-brand-yellow/20 py-2 px-4 shadow-lg fixed top-[68px] md:top-[104px] left-0 right-0 z-[90] overflow-hidden">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse shadow-[0_0_8px_#39ff14]" />
          <span className="text-[10px] md:text-xs font-black italic uppercase tracking-tighter text-brand-green">RADIO REPLAY ON</span>
        </div>
        
        <div className="flex-grow overflow-hidden whitespace-nowrap">
           <div className="inline-block animate-marquee-slower text-[9px] md:text-xs font-mono uppercase tracking-[0.2em] text-brand-green/80">
             {currentTrack 
               ? `SONANDO: ${currentTrack.title} — ARTISTA: ${currentTrack.artistName} — EMISIÓN EN VIVO DESDE EL CORAZÓN DE LA CALLE — 99.1 FM ST — COMPARTIDAS CON LA NUBE`
               : 'EMISIÓN EN VIVO DESDE EL CORAZÓN DE LA CALLE — 99.1 FM ST — LA SINTONÍA QUE MUEVE EL GHETTO —'
             }
           </div>
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0">
           <div className="flex gap-1 h-3 items-end">
              {isPlaying && [1,2,3,4,5,6].map(i => (
                <motion.div 
                  key={i} 
                  className="w-0.5 bg-brand-green" 
                  animate={{ height: [4, 12, 8, 14, 6] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                />
              ))}
           </div>
           <span className="text-[10px] font-mono text-brand-green/40">100% SIGNAL</span>
        </div>
      </div>
    </div>
  );
};

const LandingPage = () => (
  <div className="max-w-6xl mx-auto px-2 md:px-0 pt-4 md:pt-6 space-y-20 md:space-y-32">
    {/* PORTADA PRINCIPAL DE ARTISTAS DESTACADOS */}
    <div className="bg-black/40 border-4 border-boombox-gray rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl relative boombox-texture">
      <SponsoredCarousel />
    </div>

    {/* GAME SECTION (PLATFORMER) */}
    <section id="game" className="scroll-mt-24 md:scroll-mt-32">
      <SectionHeader title="DESAFÍO CALLEJERO" icon={Gamepad2} />
      <div className="bg-black border-4 md:border-8 border-boombox-gray rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl relative boombox-texture min-h-[400px]">
        <GameView />
        {/* Screws */}
        <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border-2 md:border-4 border-black transition-transform hover:rotate-45" />
        <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border-2 md:border-4 border-black transition-transform hover:rotate-45" />
        <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-boombox-gray border-2 md:border-4 border-black transition-transform hover:rotate-45" />
        <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-boombox-gray border-2 md:border-4 border-black transition-transform hover:rotate-45" />
      </div>
    </section>

    {/* SPOTIFY & VINILO SECTION */}
    <section id="spotify-vinyl" className="scroll-mt-24 md:scroll-mt-32">
      <SectionHeader title="VINILO DIGITAL & SPOTIFY" icon={Radio} />
      <SpotifyTurntable />
    </section>

    {/* FEED SECTION */}
    <section id="music" className="scroll-mt-48 md:scroll-mt-56">
      <HomeView />
    </section>
  </div>
);

const AppContent = () => {
  const { user, profile, isAdmin } = useAuth();
  const { currentTrack, isMuted, toggleMute } = useMusic();
  const [loginError, setLoginError] = React.useState<any | null>(null);
  const [isLoginPending, setIsLoginPending] = React.useState(false);
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  // Check for redirect sign-in results on app mount
  React.useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResultHelper();
        if (result) {
          console.log("Successfully logged in via redirect! User:", result.user);
        }
      } catch (err: any) {
        console.error("Firebase redirect login error on load:", err);
        setLoginError(err);
      }
    };
    checkRedirect();
  }, []);

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
  };

  const handleLoginPopup = async () => {
    setLoginError(null);
    setIsLoginPending(true);
    setShowLoginModal(false);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Firebase Popup Login Error details:", err);
      setLoginError(err);
    } finally {
      setIsLoginPending(false);
    }
  };

  const handleLoginRedirect = async () => {
    setLoginError(null);
    setIsLoginPending(true);
    setShowLoginModal(false);
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      console.error("Firebase Redirect Login Error details:", err);
      setLoginError(err);
      setIsLoginPending(false);
    }
  };

  const handleDirectLogin = async () => {
    setLoginError(null);
    setIsLoginPending(true);
    
    try {
      console.log("Triggering Google login popup...");
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Direct Google popup login error, trying redirect fallback:", err);
      try {
        await signInWithGoogleRedirect();
      } catch (redirErr: any) {
        console.error("Google redirect fallback also failed:", redirErr);
        setLoginError(redirErr);
      }
    } finally {
      setIsLoginPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-yellow selection:text-black overflow-x-hidden boombox-texture pb-20 md:pb-8">
      {/* BOOMBOX TOP HANDLE / HEADER */}
      <header className="bg-black border-b-4 md:border-b-8 border-black p-3 md:p-6 fixed top-0 left-0 right-0 z-[100] shadow-2xl">
        <div className="flex items-center justify-between gap-4 w-full max-w-[1920px] mx-auto">
          
          {/* LEFT: BRANDING */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-brand-dark rounded-full border-2 md:border-4 border-black speaker-grill flex items-center justify-center shadow-inner relative overflow-hidden group-hover:scale-105 transition-transform">
                 <div className="w-8 h-8 md:w-12 md:h-12 bg-brand-yellow/20 rounded-full animate-ping absolute" />
                 <div className="w-5 h-5 md:w-8 md:h-8 bg-brand-yellow rounded-full shadow-glow relative z-10" />
              </div>
              <div className="text-left">
                <h1 className="text-lg md:text-3xl font-black tracking-tighter glow-yellow italic uppercase leading-none">RAPLIFE</h1>
                <p className="text-[7px] md:text-[10px] font-black text-white/40 tracking-[0.4em]">BOOMBOX RADIO</p>
              </div>
            </Link>
          </div>

          {/* RIGHT: ACTIONS & LCD STATUS */}
          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            {/* LCD STATUS DISPLAY WITH BUILT-IN SILENCIAR BUTTON */}
            <div className="lcd-display px-2.5 py-1 md:px-4 md:py-2 rounded-lg border-2 md:border-4 border-black min-w-[150px] sm:min-w-[190px] md:min-w-[240px] flex items-center justify-between gap-2 text-left">
              <div className="min-w-0 flex-grow">
                <div className="text-[8px] md:text-[10px] opacity-75 font-mono uppercase font-black text-brand-green">FM 108.9 MHz</div>
                <div className="text-[10px] md:text-xs font-mono truncate uppercase tracking-widest text-brand-yellow font-black mt-0.5">
                  {currentTrack ? `PLAYING: ${currentTrack.title}` : 'STATUS: READY'}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleMute();
                }}
                className={`flex-shrink-0 flex items-center justify-center p-1 md:p-1.5 rounded-md transition-all cursor-pointer border active:scale-90 ${
                  isMuted 
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/35 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                    : 'bg-brand-green/20 text-brand-green border-brand-green/30 hover:bg-brand-green/30 shadow-[0_0_8px_rgba(57,255,20,0.2)]'
                }`}
                title={isMuted ? "Quitar Silencio" : "Silenciar Radio"}
              >
                {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 md:gap-3">
              {(isAdmin || profile?.role === 'artist') && (
                <Link to="/upload" className="chrome-button flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl text-black font-black uppercase text-[8px] md:text-[10px] shadow-lg hover:scale-105 transition-all">
                  <Upload size={11} />
                  <span className="hidden md:inline">SUBIR</span>
                </Link>
              )}
              {user && (
                <Link to="/studio" className="chrome-button flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl text-black font-black uppercase text-[8px] md:text-[10px] shadow-lg hover:scale-105 transition-all">
                  <User size={11} />
                  <span className="hidden md:inline">AVATAR RAPLIFE</span>
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="chrome-button flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl text-black font-black uppercase text-[8px] md:text-[10px] shadow-lg hover:scale-105 transition-all">
                  <ShieldCheck size={11} />
                  <span className="hidden md:inline">ADMIN</span>
                </Link>
              )}
              {user ? (
                <div className="flex items-center gap-1.5 md:gap-3">
                  <Link to="/settings" className="flex items-center gap-1.5 md:gap-3 bg-black/30 p-1 md:p-1.5 md:pr-3.5 rounded-lg md:rounded-2xl border-2 md:border-4 border-black group">
                    <img src={user.photoURL || ''} className="w-5 h-5 md:w-9 md:h-9 rounded-lg border border-brand-yellow group-hover:scale-110 transition-transform" alt="avatar" />
                    <div className="hidden sm:block text-left">
                      <p className="text-[8px] md:text-[9px] font-black uppercase italic leading-none">{user.displayName?.split(' ')[0]}</p>
                      <p className="text-[7px] text-brand-yellow font-bold uppercase tracking-widest">{profile?.role || (isAdmin ? 'Admin' : 'Fan')}</p>
                    </div>
                  </Link>
                  <button 
                    onClick={() => logoutUser()} 
                    className="chrome-button px-2.5 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl text-black font-black uppercase text-[8px] md:text-[10px] shadow-lg hover:scale-105 transition-all flex items-center gap-1 cursor-pointer"
                    title="Cerrar Sesión"
                  >
                    <LogOut size={11} />
                    <span className="hidden md:inline">SALIR</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleDirectLogin} 
                  disabled={isLoginPending}
                  className="chrome-button px-3.5 py-1.5 md:px-5 md:py-3 rounded-lg md:rounded-xl text-black font-black uppercase text-[9px] md:text-xs shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                >
                  {isLoginPending ? 'LOGGING...' : 'LOGIN'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>


      {/* NEW RADIO STRIP */}
      <RadioStrip />

      {/* SEARCH/ROUTED CONTENT */}
      <main className="pt-28 md:pt-40">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={isAdmin ? <AdminView /> : <Navigate to="/" />} />
          <Route path="/artists" element={<ArtistsView />} />
          <Route path="/profile/:id" element={<ArtistProfileView />} />
          <Route path="/profile-setup" element={user ? <ProfileSetupView /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <ProfileSettingsView /> : <Navigate to="/" />} />
          <Route path="/studio" element={<StudioView />} />
          <Route path="/upload" element={user && (profile?.role === 'artist' || isAdmin) ? <UploadTrackView /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <MobileNav />
      
      {/* BACKGROUND ELEMENTS */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-[-1]">
         <div className="absolute top-20 left-10 w-96 h-96 bg-brand-yellow rounded-full blur-[150px]" />
         <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-yellow rounded-full blur-[150px]" />
      </div>

      {/* AUTH ERROR DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {loginError && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-boombox-gray border-4 border-black p-6 rounded-3xl max-w-lg w-full shadow-2xl relative text-left boombox-texture font-sans"
            >
              {/* Retro decorative bolts */}
              <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" />

              <div className="flex items-center gap-3 border-b-2 border-black pb-3 mb-4">
                <div className="p-2 bg-red-500 rounded-lg text-black leading-none flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-red-500 glow-red">
                  PROBLEMA CON GOOGLE LOGIN
                </h3>
                <button 
                  onClick={() => setLoginError(null)}
                  className="ml-auto text-gray-400 hover:text-white p-1 hover:bg-black/20 rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {loginError?.code === 'auth/unauthorized-domain' || (loginError?.message && loginError.message.includes('unauthorized-domain')) ? (
                  <>
                    <p className="text-xs uppercase font-black tracking-wider text-brand-yellow">
                      ⚠️ ¡Dominio no autorizado o Configuración incorrecta en Vercel!
                    </p>
                    <div className="space-y-3 text-xs text-gray-300 font-medium leading-relaxed">
                      <p>
                        Si has configurado tu propio proyecto personal de Firebase (<strong>raplife</strong>) pero al entrar en <strong>rapliferecordsinc.vercel.app</strong> sigues viendo este error, se debe a que tu sitio en Vercel sigue apuntando al Firebase Sandbox de AI Studio (gen-lang-client-...).
                      </p>

                      <div className="bg-black/50 p-3 rounded-2xl border border-brand-yellow/10 space-y-2">
                        <p className="text-[10px] font-black uppercase text-brand-yellow tracking-wider">
                          💡 SOLUCIÓN DEFINITIVA PARA TU SITIO WEB (VERCEL):
                        </p>
                        <p className="text-[9.5px] text-gray-400">
                          Ve al panel de control de tu proyecto en <strong>Vercel &gt; Settings &gt; Environment Variables</strong> y agrega las siguientes variables de entorno con las credenciales de tu proyecto de Firebase personal (<strong>raplife</strong>):
                        </p>
                        <div className="bg-black/60 p-2.5 rounded border border-white/5 font-mono text-[9px] text-brand-green space-y-1 select-all">
                          <div>VITE_FIREBASE_API_KEY=tu-api-key</div>
                          <div>VITE_FIREBASE_AUTH_DOMAIN=raplife.firebaseapp.com</div>
                          <div>VITE_FIREBASE_PROJECT_ID=raplife</div>
                          <div>VITE_FIREBASE_STORAGE_BUCKET=raplife.firebasestorage.app</div>
                          <div>VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id</div>
                          <div>VITE_FIREBASE_APP_ID=tu-app-id</div>
                        </div>
                        <p className="text-[9.5px] text-gray-400">
                          Al hacer esto, tu sitio en Vercel se conectará automáticamente a tu base de datos y autenticación de <strong>raplife</strong> en segundos.
                        </p>
                      </div>

                      <p className="font-bold text-white mt-1">Cómo solucionar el error si usas el sandbox de AI Studio:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-gray-400">
                        <li>Abre tu <a href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-brand-yellow hover:underline inline-flex items-center gap-1 font-bold">Consola Firebase <ExternalLink size={10} /></a>.</li>
                        <li>Entra en <strong>Authentication &gt; Settings &gt; Authorized domains</strong>.</li>
                        <li>Haz clic en <strong>Add domain</strong> (Añadir dominio).</li>
                        <li>Añade <strong>{window.location.hostname}</strong> y guarda.</li>
                        <li>Intenta de nuevo en un minuto.</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase font-black tracking-wider text-brand-yellow">
                      ⚠️ Error de inicio de sesión
                    </p>
                    <div className="space-y-2 text-xs text-gray-300 font-medium leading-relaxed">
                      <p>
                        Ocurrió un inconveniente al intentar iniciar sesión:
                      </p>
                      <p className="text-gray-400">
                        Por favor, asegúrate de que no estás en una pestaña privada estricta que bloquee cookies o almacenamiento local, y que tu conexión sea estable.
                      </p>
                    </div>
                  </>
                )}

                <div className="text-[10px] font-mono text-gray-500 border-t border-black pt-3 mt-2 overflow-x-auto whitespace-pre">
                  Código de Firebase: {loginError?.code || 'Desconocido'}{'\n'}
                  Mensaje: {loginError?.message || String(loginError)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <button 
                    onClick={() => setLoginError(null)}
                    className="py-3 text-center rounded-xl bg-black/40 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white hover:bg-black/65 transition-colors border-2 border-black"
                  >
                    Cerrar Detalle
                  </button>
                  <button 
                    onClick={handleLoginPopup}
                    className="py-3 text-center rounded-xl bg-boombox-gray text-white font-black uppercase text-xs hover:bg-black border-2 border-black transition-transform active:scale-95"
                  >
                    Usar Popup
                  </button>
                  <button 
                    onClick={handleLoginRedirect}
                    className="py-3 text-center rounded-xl bg-brand-yellow hover:bg-brand-yellow/85 text-black font-black uppercase text-xs shadow-md transition-all font-sans border-2 border-black flex items-center justify-center gap-1.5 animate-pulse"
                  >
                    <Smartphone size={13} />
                    Usar Redirección
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MusicProvider>
          <AppContent />
        </MusicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
