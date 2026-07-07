import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useMusic } from './context/MusicContext';
import { 
  Radio, Play, Pause, SkipForward, Volume2, VolumeX, Mic2, User, 
  Settings, LogOut, Shield, Award, Sparkles, Upload, Disc, Menu, X, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Views
import LandingPage from './views/Landing';
import ArtistsView from './views/Artists';
import StudioView from './views/Studio';
import Game from './views/Game';
import UploadTrackView from './views/UploadTrack';
import ArtistProfileView from './views/ArtistProfile';
import ProfileSettings from './views/ProfileSettings';
import AdminView from './views/Admin';

const App = () => {
  const { user, profile, isAdmin, loginWithGoogle, logout } = useAuth();
  const { currentTrack, isPlaying, togglePlay, nextTrack, isMuted, toggleMute, volume, setVolume } = useMusic();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile menu on path changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col justify-between selection:bg-brand-yellow selection:text-black">
      
      {/* HEADER NAVIGATION */}
      <header className="sticky top-0 z-50 bg-[#060606]/95 border-b-2 border-boombox-gray/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-1.5 bg-brand-yellow text-black rounded-lg group-hover:rotate-6 transition-transform">
              <Disc size={20} className="animate-pulse" />
            </div>
            <span className="font-display font-black tracking-tighter italic text-base md:text-lg text-brand-yellow">
              RAPLIFE<span className="text-white">RECORDS</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-black uppercase tracking-wider">
            <Link to="/" className={`hover:text-brand-yellow transition-all ${location.pathname === '/' ? 'text-brand-yellow' : 'text-gray-400'}`}>INICIO</Link>
            <Link to="/artists" className={`hover:text-brand-yellow transition-all ${location.pathname === '/artists' ? 'text-brand-yellow' : 'text-gray-400'}`}>CREW</Link>
            <Link to="/studio" className={`hover:text-brand-yellow transition-all ${location.pathname === '/studio' ? 'text-brand-yellow' : 'text-gray-400'}`}>ESTUDIO</Link>
            <Link to="/game" className={`hover:text-brand-yellow transition-all ${location.pathname === '/game' ? 'text-brand-yellow' : 'text-gray-400'}`}>JUEGO STREET</Link>
            
            {user && (
              <>
                <Link to="/upload" className={`hover:text-brand-yellow transition-all ${location.pathname === '/upload' ? 'text-brand-yellow' : 'text-gray-400'}`}>SUBIR BEAT</Link>
                {isAdmin && (
                  <Link to="/admin" className={`hover:text-brand-yellow transition-all ${location.pathname === '/admin' ? 'text-brand-yellow' : 'text-gray-400'}`}>CONSOLA STAFF</Link>
                )}
              </>
            )}
          </nav>

          {/* Auth Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {/* Profile setting or link */}
                <Link 
                  to={`/profile/${user.uid}`} 
                  className="w-8 h-8 rounded-full border border-boombox-gray bg-neutral-900 overflow-hidden flex items-center justify-center hover:border-brand-yellow transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={14} className="text-gray-400" />
                  )}
                </Link>
                
                {/* Config Icon */}
                <Link to="/settings" className="p-1.5 hover:text-brand-yellow text-gray-400 transition-colors hidden md:block">
                  <Settings size={16} />
                </Link>

                {/* Log Out */}
                <button 
                  onClick={logout}
                  className="p-1.5 hover:text-red-500 text-gray-400 transition-colors hidden md:block"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="px-4 py-2 bg-brand-yellow text-black text-[10px] font-black uppercase italic rounded-full hover:scale-105 transition-transform shadow-glow"
              >
                ENTRAR / REGISTRARSE
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden hover:text-brand-yellow text-gray-300 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-[#060606] border-b-2 border-boombox-gray py-4 px-6 space-y-4 absolute top-16 left-0 right-0 z-40 flex flex-col font-black text-xs uppercase"
          >
            <Link to="/">INICIO</Link>
            <Link to="/artists">CREW</Link>
            <Link to="/studio">ESTUDIO</Link>
            <Link to="/game">JUEGO STREET</Link>
            
            {user && (
              <>
                <Link to="/upload">SUBIR BEAT</Link>
                <Link to="/settings">CONFIGURACIÓN PERFIL</Link>
                {isAdmin && <Link to="/admin">CONSOLA STAFF</Link>}
                <button onClick={logout} className="text-left text-red-500">SALIR</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN VIEW AREA */}
      <main className="flex-grow pt-8 min-h-[calc(100vh-14rem)]">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/artists" element={<ArtistsView />} />
          <Route path="/studio" element={<StudioView />} />
          <Route path="/game" element={<Game />} />
          <Route path="/upload" element={<UploadTrackView />} />
          <Route path="/profile/:id" element={<ArtistProfileView />} />
          <Route path="/settings" element={<ProfileSettings />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </main>

      {/* PERSISTENT GLOBAL MUSIC BAR / MINI-PLAYER */}
      <div className="sticky bottom-0 z-50 bg-black/95 border-t-2 border-boombox-gray/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Active Song info */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
            <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/5 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
              {currentTrack?.coverUrl ? (
                <img src={currentTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <Disc className="text-brand-yellow/30" size={18} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-white truncate">{currentTrack ? currentTrack.title : "RAPLIFE RADIO"}</p>
              <p className="text-[8px] font-bold text-brand-yellow uppercase truncate mt-0.5">{currentTrack ? currentTrack.artistName : "SINTONIZANDO..."}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="p-3 bg-brand-yellow text-black rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            
            <button 
              onClick={nextTrack}
              className="p-2 hover:text-brand-yellow text-gray-400 transition-colors hidden sm:block"
            >
              <SkipForward size={14} />
            </button>
          </div>

          {/* Sound & Volume */}
          <div className="flex items-center gap-2 hidden sm:flex">
            <button 
              onClick={toggleMute}
              className="p-1 hover:text-brand-yellow text-gray-400 transition-colors"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 accent-brand-yellow cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-black/40 border-t border-boombox-gray py-4 text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
        © {new Date().getFullYear()} RAPLIFE RECORDS INC. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
};

export default App;
