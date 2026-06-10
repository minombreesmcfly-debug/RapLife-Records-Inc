import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Volume2, VolumeX, ChevronLeft, ChevronRight, ChevronUp, Trophy, Gift, Star, Award, Medal, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const RewardsTable = () => {
  const { user } = useAuth();
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [confirmingReward, setConfirmingReward] = useState<any | null>(null);
  const [claimingState, setClaimingState] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
  const [claimingError, setClaimingError] = useState<string | null>(null);

  const rewards = [
    { pts: 100000, display_pts: '100,000', icon: Trophy, title: 'CAMEO / VIDEO MUSICAL', desc: 'Aparición estelar y co-producción en el próximo videoclip oficial promocional de RapLife Records.' },
    { pts: 50000, display_pts: '50,000', icon: Sparkles, title: 'CAMEO EN VIDEO DE RAP LIFE', desc: 'Aparición especial en un video oficial de la música y proyectos de Rap Life.' },
    { pts: 5000, display_pts: '5,000', icon: Star, title: 'MENCIÓN EN STORIES', desc: 'Mención directa o promoción exclusiva en nuestras redes sociales e historias oficiales.' }
  ];

  useEffect(() => {
    if (!user) {
      setLoadingPoints(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserPoints(docSnap.data()?.points || 0);
      } else {
        setUserPoints(0);
      }
      setLoadingPoints(false);
    }, (error) => {
      console.error("Error watching user points:", error);
      setLoadingPoints(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleClaimReward = async (reward: any) => {
    if (!user) return;
    setClaimingState('claiming');
    setClaimingError(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentPoints = userSnap.data()?.points || 0;

      if (currentPoints < reward.pts) {
        setClaimingState('error');
        setClaimingError('No tienes suficientes puntos para reclamar esta recompensa.');
        return;
      }

      // Secure database operations:
      // 1. Subtract points using increment(-pts)
      await updateDoc(userRef, {
        points: increment(-reward.pts)
      });

      // 2. Track redemption record in 'redemptions'
      const redemptionId = `${user.uid}_${Date.now()}`;
      await setDoc(doc(db, 'redemptions', redemptionId), {
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: userSnap.data()?.displayName || user.displayName || 'ANÓNIMO',
        rewardTitle: reward.title,
        pointsSpent: reward.pts,
        claimedAt: new Date().toISOString(),
        status: 'pending'
      });

      setClaimingState('success');
    } catch (err: any) {
      console.error("Error during redemption:", err);
      setClaimingState('error');
      setClaimingError(err?.message || 'Hubo un error al procesar el canje. Por favor inténtalo más tarde.');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* User Score Summary Header */}
      {user && (
        <div className="max-w-md mx-auto bg-black/60 border-2 border-brand-yellow/30 rounded-3xl p-4 text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-brand-yellow" />
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest leading-none">TU SALDO DE STREET-CRED</p>
          {loadingPoints ? (
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <Loader2 className="animate-spin text-brand-yellow" size={12} />
              <span className="text-xs font-mono font-bold uppercase text-gray-500">Cargando puntos...</span>
            </div>
          ) : (
            <p className="text-2xl font-black italic text-brand-yellow font-mono mt-1">
              {userPoints?.toLocaleString() || 0} <span className="text-xs text-white">PTS</span>
            </p>
          )}
        </div>
      )}

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {rewards.map((r, i) => {
          const hasEnough = userPoints !== null && userPoints >= r.pts;
          return (
            <div 
              key={i} 
              className={`bg-black/40 border-2 rounded-3xl p-5 flex flex-col items-center text-center gap-2 transition-all group relative ${
                hasEnough 
                  ? 'border-boombox-gray hover:border-brand-yellow shadow-[0_0_15px_rgba(248,251,2,0.05)]' 
                  : 'border-white/5 opacity-80'
              }`}
            >
              <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${
                hasEnough ? 'bg-brand-yellow/10' : 'bg-white/5'
              }`}>
                <r.icon className={hasEnough ? "text-brand-yellow" : "text-gray-500"} size={24} />
              </div>
              <p className={`font-black italic text-xl leading-none ${hasEnough ? 'text-brand-yellow' : 'text-gray-500'}`}>
                {r.display_pts} PTS
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest">{r.title}</p>
              <p className="text-[9px] text-gray-500 font-bold uppercase leading-tight flex-grow">{r.desc}</p>
              
              {user ? (
                <button
                  disabled={!hasEnough}
                  onClick={() => {
                    setConfirmingReward(r);
                    setClaimingState('idle');
                    setClaimingError(null);
                  }}
                  className={`mt-3 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${
                    hasEnough
                      ? 'border-brand-yellow bg-brand-yellow text-black shadow-[0_0_15px_rgba(248,251,2,0.2)] hover:brightness-110 active:scale-95 cursor-pointer'
                      : 'border-white/5 bg-black/40 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {hasEnough ? 'CANJEAR' : 'NECESITAS MÁS PTS'}
                </button>
              ) : (
                <p className="text-[8px] text-brand-yellow/60 font-black uppercase tracking-widest mt-3">INICIA SESIÓN PARA CANJEAR</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation & Status Overlay Modal */}
      <AnimatePresence>
        {confirmingReward && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 rounded-[2.5rem]"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#151515] border-4 border-boombox-gray rounded-[2rem] p-6 max-w-sm w-full text-center relative overflow-hidden"
            >
              {claimingState === 'idle' && (
                <>
                  <div className="w-12 h-12 bg-brand-yellow/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <confirmingReward.icon className="text-brand-yellow" size={24} />
                  </div>
                  <h4 className="text-lg font-black italic uppercase text-white mb-2">¿CONFIRMAR CANJE?</h4>
                  <p className="text-xs text-gray-300 mb-4 font-bold uppercase leading-relaxed">
                    ¿Quieres canjear <span className="text-brand-yellow">{confirmingReward.display_pts} PTS</span> por <span className="text-white">"{confirmingReward.title}"</span>?
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button 
                      onClick={() => setConfirmingReward(null)}
                      className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-bold uppercase tracking-wider text-[10px] transition-all"
                    >
                      CANCELAR
                    </button>
                    <button 
                      onClick={() => handleClaimReward(confirmingReward)}
                      className="px-5 py-2.5 rounded-xl bg-brand-yellow text-black font-black uppercase tracking-wider text-[10px] shadow-lg hover:brightness-110 active:scale-95 transition-all"
                    >
                      SÍ, CANJEAR
                    </button>
                  </div>
                </>
              )}

              {claimingState === 'claiming' && (
                <div className="py-6 flex flex-col items-center">
                  <Loader2 className="animate-spin text-brand-yellow mb-4" size={32} />
                  <p className="text-xs font-black uppercase tracking-widest text-brand-yellow">PROCESANDO RECOMPENSA...</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Conectando con el sello de RapLife...</p>
                </div>
              )}

              {claimingState === 'success' && (
                <div className="py-4 flex flex-col items-center">
                  <CheckCircle className="text-green-500 mb-4 animate-bounce" size={36} />
                  <h4 className="text-base font-black italic uppercase text-white mb-2">¡CANJE RECOMPENSADO!</h4>
                  <p className="text-xs text-gray-300 leading-relaxed font-bold uppercase mb-4">
                    ¡Nos pondremos en contacto contigo en tu correo registrado <span className="text-brand-yellow">{user?.email}</span> para coordinar tu beneficio y agendar tu acción comercial!
                  </p>
                  <button 
                    onClick={() => setConfirmingReward(null)}
                    className="w-full py-2.5 rounded-xl bg-brand-yellow text-black font-black uppercase tracking-wider text-[10px] shadow-lg transition-all"
                  >
                    CONTINUAR JUGANDO
                  </button>
                </div>
              )}

              {claimingState === 'error' && (
                <div className="py-4 flex flex-col items-center">
                  <p className="text-3xl mb-4">❌</p>
                  <h4 className="text-base font-black italic uppercase text-red-500 mb-2">ERROR EN EL PROCESO</h4>
                  <p className="text-xs text-gray-300 leading-relaxed font-bold uppercase mb-4">
                    {claimingError || 'Hubo un error con tu saldo o conexión.'}
                  </p>
                  <button 
                    onClick={() => setConfirmingReward(null)}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-wider text-[10px] transition-all"
                  >
                    CERRAR
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Leaderboard = () => {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      const q = query(collection(db, 'users'), orderBy('highScore', 'desc'), limit(5));
      const snap = await getDocs(q);
      setLeaders(snap.docs.map(d => d.data()));
    };
    fetchLeaders();
  }, []);

  return (
    <div className="bg-black/60 border-4 border-boombox-gray rounded-[2.5rem] p-6 w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6 justify-center">
        <Award className="text-brand-yellow" size={24} />
        <h3 className="text-2xl font-black italic uppercase tracking-tighter">TOP LEYENDAS</h3>
      </div>
      <div className="space-y-3">
        {leaders.map((l, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
             <div className="flex items-center gap-3">
               <span className="text-brand-yellow font-black italic w-4">{i + 1}.</span>
               <span className="text-xs font-black uppercase truncate max-w-[120px]">{l.displayName || 'ANÓNIMO'}</span>
             </div>
             <span className="font-mono text-brand-yellow text-sm font-bold">{l.highScore?.toLocaleString() || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CHARACTERS = [
  { id: 'biggie', name: 'Biggie', subtitle: 'The Notorious', description: 'Leyenda del East Coast. Peso pesado con flow insuperable.', prefix: 'player', avatarFallback: '#ffae00', bulletOffsetY: 35, bulletOffsetX: 0 },
  { id: '2pac', name: '2Pac', subtitle: 'Makaveli', description: 'Poeta lírico de la West Coast. Rapidez mental, pasión y estilo legendario.', prefix: 'player2', avatarFallback: '#ff4444', bulletOffsetY: 22, bulletOffsetX: 6 },
  { id: 'mcfly', name: 'McFly', subtitle: 'Fly Boy', description: 'Pionero futurista de RapLife. Ágil de pies, saltos propulsados y beats cósmicos.', prefix: 'player3', avatarFallback: '#9b5de5', bulletOffsetY: 28, bulletOffsetX: 2 }
] as const;

const GameView = () => {
  const { user, profile, isAdmin } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedCharId, setSelectedCharId] = useState<'biggie' | '2pac' | 'mcfly'>('biggie');
  const [showGuide, setShowGuide] = useState(false);
  const selectedCharIdRef = useRef(selectedCharId);

  useEffect(() => {
    selectedCharIdRef.current = selectedCharId;
  }, [selectedCharId]);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
  const gameStateRef = useRef(gameState);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const spritesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  const [worldTime, setWorldTime] = useState(0);
  const worldTimeRef = useRef(0);

  const keysRef = useRef<Record<string, boolean>>({});
  const animationRef = useRef<number | null>(null);

  // Joystick state and refs
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Smooth visual joystick return and sync with keyboard
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDraggingRef.current) return;
      
      const keys = keysRef.current;
      let targetX = 0;
      let targetY = 0;
      if (keys['arrowleft'] || keys['a']) targetX = -25;
      if (keys['arrowright'] || keys['d']) targetX = 25;
      if (keys['arrowup'] || keys['w'] || keys[' ']) targetY = -25;

      setJoystickPos(prev => {
        const dx = (targetX - prev.x) * 0.35;
        const dy = (targetY - prev.y) * 0.35;
        return { x: prev.x + dx, y: prev.y + dy };
      });
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, []);

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Map to 128-unit coordinates relative to element dimensions
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    
    dx = dx * (128 / rect.width);
    dy = dy * (128 / rect.height);
    
    const maxRadius = 35; // viewBox constraint
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    setJoystickPos({ x: dx, y: dy });
    
    const keys = keysRef.current;
    
    // Left/Right thresholds
    if (dx < -12) {
      keys['arrowleft'] = true;
      keys['arrowright'] = false;
    } else if (dx > 12) {
      keys['arrowright'] = true;
      keys['arrowleft'] = false;
    } else {
      keys['arrowleft'] = false;
      keys['arrowright'] = false;
    }
    
    // Up / Jump threshold (tap upwards to jump)
    if (dy < -20) {
      jump();
    }
  };

  const handleJoystickStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    handleJoystickMove(clientX, clientY);
  };

  // Global tracking for dragging off-bezel
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      handleJoystickMove(clientX, clientY);
    };

    const handleGlobalEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setJoystickPos({ x: 0, y: 0 });
      keysRef.current['arrowleft'] = false;
      keysRef.current['arrowright'] = false;
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, []);

  useEffect(() => {
    setImagesLoaded(false);
    const activeChar = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
    const prefix = activeChar.prefix;

    // Player assets
    const playerSources = {
      idle: `/assets/${prefix}_idle.png`,
      walk: `/assets/${prefix}_walk.png`,
      jump: `/assets/${prefix}_jump.png`,
      shoot: `/assets/${prefix}_shoot.png`,
      jump_shoot: `/assets/${prefix}_jump_shoot.png`
    };

    // Props & background assets (optional)
    const optionalSources = {
      bg_sky: '/assets/bg_sky.png',
      bg_buildings: '/assets/bg_buildings.png',
      bg_hills: '/assets/bg_hills.png',
      tile_ground: '/assets/tile_ground.png',
      tile_platform: '/assets/tile_platform.png',
      enemy_walk: '/assets/enemy_walk.png'
    };

    const loaded: { [key: string]: HTMLImageElement } = {};
    const totalRequired = Object.keys(playerSources).length;
    let loadedRequiredCount = 0;

    // Load required player assets
    Object.entries(playerSources).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded[key] = img;
        loadedRequiredCount++;
        if (loadedRequiredCount === totalRequired) {
          spritesRef.current = { ...spritesRef.current, ...loaded };
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedRequiredCount++;
        if (loadedRequiredCount === totalRequired) {
          spritesRef.current = { ...spritesRef.current, ...loaded };
          setImagesLoaded(true);
        }
      };
    });

    // Load optional background/prop assets
    Object.entries(optionalSources).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        spritesRef.current[key] = img;
      };
      img.onerror = () => {
        delete spritesRef.current[key];
      };
    });

  }, [selectedCharId]);

  // Sync ref with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Game Refs
  const playerRef = useRef({
    x: 150,
    y: 250,
    width: 64,   // Tamaño mucho más grande
    height: 100, // Tamaño mucho más grande
    dy: 0,
    jumpForce: -18, // Ajustado para el nuevo peso
    grounded: false,
    facingRight: true,
    frame: 0,
    shootTimer: 0
  });

  const worldRef = useRef({
    gravity: 0.85,
    offsetX: 0,
    speedMultiplier: 1.0,
    lastPlatformX: 2500,
    platforms: [
      { id: 'start-ground', x: 0, y: 460, width: 3000, height: 40, type: 'ground' }, 
      { id: 'l1', x: 500, y: 340, width: 140, height: 15, type: 'ledge' },
      { id: 'l2', x: 800, y: 260, width: 140, height: 15, type: 'ledge' },
      { id: 'l3', x: 1100, y: 340, width: 200, height: 15, type: 'ledge' },
      { id: 'l4', x: 1500, y: 220, width: 160, height: 15, type: 'ledge' },
    ],
    enemies: [
      { id: 'e1', x: 600, y: 360, width: 64, height: 100, dx: 3, range: 150, startX: 600, active: true, type: 'reptile' },
      { id: 'e2', x: 1200, y: 360, width: 64, height: 100, dx: 4, range: 100, startX: 1200, active: true, type: 'reptile' },
    ] as any[],
    bullets: [] as any[]
  });

  const generateChunk = (startX: number) => {
    const world = worldRef.current;
    const chunkWidth = 1000;
    const endX = startX + chunkWidth;

    // Add Ground
    world.platforms.push({
      id: `g-${startX}`,
      x: startX,
      y: 460,
      width: chunkWidth,
      height: 40,
      type: 'ground'
    });

    // Add Ledges
    for (let i = 0; i < 3; i++) {
        const lx = startX + Math.random() * (chunkWidth - 200);
        const ly = 200 + Math.random() * 200;
        world.platforms.push({
          id: `l-${startX}-${i}`,
          x: lx,
          y: ly,
          width: 120 + Math.random() * 80,
          height: 15,
          type: 'ledge'
        });

        // Chance to spawn reptile on ledge
        if (Math.random() > 0.6) {
            world.enemies.push({
                id: `r-${startX}-${i}`,
                x: lx + 20,
                y: ly - 100, // Ajustado para el tamaño del personaje (100)
                width: 64,
                height: 100,
                dx: (2 + Math.random() * 3) * world.speedMultiplier,
                range: 40,
                startX: lx + 20,
                active: true,
                type: 'reptile'
            });
        }
    }

    // Spawn reptiles on ground
    for (let i = 0; i < 2; i++) {
        const rx = startX + Math.random() * chunkWidth;
        world.enemies.push({
            id: `rg-${startX}-${i}`,
            x: rx,
            y: 360, // 460 (suelo) - 100 (altura)
            width: 64,
            height: 100,
            dx: (3 + Math.random() * 2) * world.speedMultiplier,
            range: 150,
            startX: rx,
            active: true,
            type: 'reptile'
        });
    }

    world.lastPlatformX = endX;
  };

  const startNewGame = () => {
    gameStateRef.current = 'playing';
    setGameState('playing');
    setScore(0);
    playerRef.current = {
      x: 150,
      y: 250,
      width: 64,
      height: 100,
      dy: 0,
      jumpForce: -18,
      grounded: false,
      facingRight: true,
      frame: 0,
      shootTimer: 0
    };
    worldTimeRef.current = 0;
    setWorldTime(0);
    worldRef.current.offsetX = 0;
    worldRef.current.speedMultiplier = 1.0;
    worldRef.current.bullets = [];
    worldRef.current.lastPlatformX = 2000;
    worldRef.current.platforms = [
        { id: 'start-ground', x: 0, y: 460, width: 2500, height: 40, type: 'ground' }, 
        { id: 'l1', x: 500, y: 340, width: 140, height: 15, type: 'ledge' },
        { id: 'l2', x: 800, y: 260, width: 140, height: 15, type: 'ledge' },
    ];
    worldRef.current.enemies = [
        { id: 'e1', x: 600, y: 360, width: 64, height: 100, dx: 3, range: 150, startX: 600, active: true, type: 'reptile' },
    ];
  };

  const shoot = () => {
    if (gameStateRef.current !== 'playing') return;
    const player = playerRef.current;
    player.shootTimer = 5; // Duración corta para que no interfiera con caminar
    
    // Buscar el personaje activo para obtener su alineación de disparo
    const activeChar = CHARACTERS.find(c => c.id === selectedCharIdRef.current) || CHARACTERS[0];
    const bulletOffsetY = activeChar.bulletOffsetY;
    const bulletOffsetX = activeChar.bulletOffsetX;

    worldRef.current.bullets.push({
      x: player.x + (player.facingRight ? player.width + bulletOffsetX : -bulletOffsetX),
      y: player.y + bulletOffsetY, // Centrado de bala vertical específico por personaje
      dx: player.facingRight ? 16 : -16,
      radius: 4, // Balas reducidas a la mitad de tamaño (antes 8)
      active: true
    });
  };

  const jump = () => {
    if (gameStateRef.current !== 'playing') return;
    const player = playerRef.current;
    if (player.grounded) {
      player.dy = player.jumpForce;
      player.grounded = false;
    }
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const player = playerRef.current;
    const keys = keysRef.current;
    const world = worldRef.current;

    if (gameStateRef.current === 'playing') {
      // Update timers
      if (player.shootTimer > 0) player.shootTimer--;

      // Difficulty progression
      world.speedMultiplier += 0.0001;
      
      // Day/Night Cycle Progression
      worldTimeRef.current += 0.0015;
      if (worldTimeRef.current > Math.PI * 2) worldTimeRef.current = 0;

      // Movement
      const moveSpeed = 7 * world.speedMultiplier;
      if (keys['arrowleft'] || keys['a']) {
        player.x -= moveSpeed;
        player.facingRight = false;
        player.frame += 0.2;
      }
      if (keys['arrowright'] || keys['d']) {
        player.x += moveSpeed;
        player.facingRight = true;
        player.frame += 0.2;
      }

      // Physics
      player.dy += world.gravity;
      player.y += player.dy;
      player.grounded = false;

      // Platform Collision
      world.platforms.forEach(p => {
        if (
          player.x < p.x + p.width &&
          player.x + player.width > p.x &&
          player.y + player.height > p.y &&
          player.y + player.height < p.y + 30 &&
          player.dy >= 0
        ) {
          player.y = p.y - player.height;
          player.dy = 0;
          player.grounded = true;
        }
      });

      // Procedural Generation
      if (player.x + canvas.width > world.lastPlatformX) {
        generateChunk(world.lastPlatformX);
      }

      // Camera
      const targetX = player.x - canvas.width / 4;
      world.offsetX += (targetX - world.offsetX) * 0.1;
      if (world.offsetX < 0) world.offsetX = 0;

      // cleanup old stuff to save memory
      if (world.platforms.length > 50) {
          world.platforms = world.platforms.filter(p => p.x + p.width > world.offsetX - 500);
          world.enemies = world.enemies.filter(e => e.x + e.width > world.offsetX - 500);
      }

      // Bullets
      world.bullets = world.bullets.filter(b => b.active);
      world.bullets.forEach(b => {
        b.x += b.dx;
        world.enemies.forEach(e => {
          if (e.active && b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
            b.active = false;
            e.active = false;
            setScore(s => s + 10);
          }
        });
        if (Math.abs(b.x - player.x) > canvas.width) b.active = false;
      });

      // Enemies
      world.enemies.forEach(e => {
        if (!e.active) return;
        e.x += e.dx;
        if (Math.abs(e.x - e.startX) > e.range) e.dx *= -1;
        
        if (player.x < e.x + e.width && player.x + player.width > e.x && player.y < e.y + e.height && player.y + player.height > e.y) {
          gameStateRef.current = 'gameOver';
          setGameState('gameOver');
          handleGameEnd();
        }
      });

      if (player.y > canvas.height) {
        gameStateRef.current = 'gameOver';
        setGameState('gameOver');
        handleGameEnd();
      }
    }

    // DRAWING
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // DAY/NIGHT CYCLE CALCULATIONS
    const time = worldTimeRef.current;
    const isNight = Math.sin(time) < -0.3;
    const isSunset = Math.sin(time) >= -0.3 && Math.sin(time) < 0.3;
    
    // Sky Colors Mapping
    let skyTop, skyMid, skyBot;
    const nightIntensity = Math.max(0, -Math.sin(time));
    const dayIntensity = Math.max(0, Math.sin(time));

    if (Math.sin(time) > 0.5) { // Full Day
        skyTop = '#4facfe';
        skyMid = '#00f2fe';
        skyBot = '#e0f7fa';
    } else if (Math.sin(time) > -0.2) { // Sunset
        skyTop = '#ff0844';
        skyMid = '#ffb199';
        skyBot = '#ffecd2';
    } else { // Night
        skyTop = '#09203f';
        skyMid = '#1d6092';
        skyBot = '#0f2027';
    }

    if (spritesRef.current.bg_sky && spritesRef.current.bg_sky.complete && spritesRef.current.bg_sky.naturalWidth > 0) {
        ctx.drawImage(spritesRef.current.bg_sky, 0, 0, canvas.width, canvas.height);
    } else {
        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, skyTop);
        sky.addColorStop(0.5, skyMid);
        sky.addColorStop(1, skyBot);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Star Overlay (Only at night)
    if (Math.sin(time) < 0) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = Math.abs(Math.sin(time)) * 0.8;
        for(let i=0; i<40; i++) {
            const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * canvas.width;
            const sy = (Math.cos(i * 543.21) * 0.5 + 0.5) * (canvas.height / 2);
            ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1.0;
    }

    // Distant Hills (Layer 3)
    if (spritesRef.current.bg_hills && spritesRef.current.bg_hills.complete && spritesRef.current.bg_hills.naturalWidth > 0) {
        ctx.save();
        const hillsImg = spritesRef.current.bg_hills;
        ctx.translate(-(world.offsetX * 0.1) % canvas.width, 0);
        ctx.drawImage(hillsImg, 0, canvas.height - 200, canvas.width, 200);
        ctx.translate(canvas.width, 0);
        ctx.drawImage(hillsImg, 0, canvas.height - 200, canvas.width, 200);
        ctx.restore();
    } else {
        ctx.save();
        ctx.translate(-(world.offsetX * 0.1) % 800, 0);
        ctx.fillStyle = '#1a0a2a';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for(let i=0; i<=10; i++) {
            ctx.lineTo(i * 100, canvas.height - 80 - Math.sin(i*2) * 40);
        }
        ctx.lineTo(1000, canvas.height);
        ctx.fill();
        // Second copy for tiling
        ctx.translate(1000, 0);
        ctx.fill();
        ctx.restore();
    }

    // Buildings (Layer 2)
    if (spritesRef.current.bg_buildings && spritesRef.current.bg_buildings.complete && spritesRef.current.bg_buildings.naturalWidth > 0) {
        ctx.save();
        const bldImg = spritesRef.current.bg_buildings;
        ctx.translate(-(world.offsetX * 0.25) % canvas.width, 0);
        ctx.drawImage(bldImg, 0, canvas.height - 350, canvas.width, 350);
        ctx.translate(canvas.width, 0);
        ctx.drawImage(bldImg, 0, canvas.height - 350, canvas.width, 350);
        ctx.restore();
    } else {
        ctx.save();
        ctx.translate(-(world.offsetX * 0.25) % 1200, 0);
        for (let i = 0; i < 15; i++) {
           const bx = i * 160;
           const bh = 180 + Math.sin(i * 33) * 100;
           const bw = 100;
           
           // Front Face
           ctx.fillStyle = '#141e30';
           ctx.fillRect(bx, canvas.height - bh, bw, bh);
           
           // 3D Depth
           ctx.fillStyle = '#0a0a20';
           ctx.beginPath();
           ctx.moveTo(bx + bw, canvas.height - bh);
           ctx.lineTo(bx + bw + 15, canvas.height - bh - 15);
           ctx.lineTo(bx + bw + 15, canvas.height);
           ctx.lineTo(bx + bw, canvas.height);
           ctx.fill();

           // Windows
           const windowsOn = Math.sin(time) < 0.2;
           ctx.fillStyle = (windowsOn && Math.sin(i + Date.now()/1000) > 0.4) ? '#f8fb02' : '#1a1a2e';
           for(let r=0; r<bh/40; r++) {
               for(let c=0; c<bw/35; c++) {
                   ctx.fillRect(bx + 12 + c*30, canvas.height - bh + 15 + r*40, 8, 8);
               }
           }
        }
        ctx.restore();
    }

    // Near Palm Trees (Layer 1)
    ctx.save();
    ctx.translate(-(world.offsetX * 0.5) % 1600, 0);
    ctx.fillStyle = '#050a05';
    for (let i = 0; i < 6; i++) {
        const tx = i * 400 + 100;
        const th = 280;
        ctx.fillRect(tx, canvas.height - th, 12, th); 
        ctx.save();
        ctx.translate(tx + 6, canvas.height - th);
        for(let j=0; j<6; j++) {
            ctx.rotate(Math.PI * 2 / 6);
            ctx.fillStyle = '#0a1d0a';
            ctx.beginPath();
            ctx.ellipse(30, 0, 45, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-world.offsetX, 0);

    // Platforms with Perspective
    world.platforms.forEach(p => {
      if (p.type === 'ground' && spritesRef.current.tile_ground && spritesRef.current.tile_ground.complete && spritesRef.current.tile_ground.naturalWidth > 0) {
        ctx.save();
        const tile = spritesRef.current.tile_ground;
        for (let tx = p.x; tx < p.x + p.width; tx += tile.width) {
          ctx.drawImage(tile, tx, p.y, Math.min(tile.width, p.x + p.width - tx), p.height);
        }
        ctx.restore();
      } else if (p.type === 'ledge' && spritesRef.current.tile_platform && spritesRef.current.tile_platform.complete && spritesRef.current.tile_platform.naturalWidth > 0) {
        ctx.save();
        const tile = spritesRef.current.tile_platform;
        for (let tx = p.x; tx < p.x + p.width; tx += tile.width) {
          ctx.drawImage(tile, tx, p.y, Math.min(tile.width, p.x + p.width - tx), p.height);
        }
        ctx.restore();
      } else {
        // Front face
        ctx.fillStyle = p.type === 'ground' ? '#0a0a0a' : '#1a1a1a';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        
        // Top lip highlight
        ctx.fillStyle = '#f8fb02';
        ctx.fillRect(p.x, p.y, p.width, 3);

        // Side depth
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.moveTo(p.x + p.width, p.y);
        ctx.lineTo(p.x + p.width + 10, p.y - 10);
        ctx.lineTo(p.x + p.width + 10, p.y + p.height - 10);
        ctx.lineTo(p.x + p.width, p.y + p.height);
        ctx.fill();
      }
    });

    // Bullets with Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fff';
    world.bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // HUMANOID REPTILIAN ENEMIES
    world.enemies.forEach(e => {
        if (!e.active) return;
        const ex = e.x;
        const ey = e.y;
        
        if (spritesRef.current.enemy_walk && spritesRef.current.enemy_walk.complete && spritesRef.current.enemy_walk.naturalWidth > 0) {
            ctx.save();
            const enemyImg = spritesRef.current.enemy_walk;
            ctx.translate(ex + e.width / 2, ey + e.height / 2);
            if (e.dx > 0) ctx.scale(-1, 1);
            
            const frameCount = 6; // Caminado animado por defecto
            const currentFrame = Math.floor((Date.now() / 150) % frameCount);
            const sw = enemyImg.naturalWidth / frameCount;
            const sh = enemyImg.naturalHeight;
            
            ctx.drawImage(
                enemyImg,
                currentFrame * sw, 0, sw, sh,
                -e.width / 2, -e.height / 2, e.width, e.height
            );
            ctx.restore();
        } else {
            const eFrame = (Date.now() / 150);
            const legMov = Math.sin(eFrame) * 6;
            
            ctx.save();
            ctx.translate(ex + e.width / 2, ey + e.height / 2);
            if (e.dx > 0) ctx.scale(-1, 1);
            
            // Escalar todo el dibujo basado en el tamaño asignado (hitbox height 100)
            const scale = e.height / 40;
            ctx.scale(scale, scale);
            ctx.translate(-20, -20); // Centrar el dibujo original en el nuevo eje
            

            // Legs (Humanoid)
            ctx.fillStyle = '#1b5e20';
            ctx.fillRect(5, 30 + legMov, 12, 15);
            ctx.fillRect(25, 30 - legMov, 12, 15);
            
            // Torso
            const torsoGrad = ctx.createLinearGradient(0, 5, 40, 5);
            torsoGrad.addColorStop(0, '#2e7d32');
            torsoGrad.addColorStop(1, '#1b5e20');
            ctx.fillStyle = torsoGrad;
            ctx.fillRect(5, 10, 30, 25);
            
            // Arms (Humanoid but long)
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(-5, 12 - legMov/2, 10, 20); // Arm 1
            ctx.fillRect(35, 12 + legMov/2, 10, 20); // Arm 2

            // Head (Reptilian Humanoid)
            ctx.fillStyle = '#388e3c';
            ctx.beginPath();
            ctx.moveTo(10, 10);
            ctx.lineTo(30, 10);
            ctx.lineTo(40, -5); // Snout
            ctx.lineTo(30, -15);
            ctx.lineTo(10, -15);
            ctx.fill();

            // Glowing Eyes
            ctx.fillStyle = '#ff1744';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f00';
            ctx.fillRect(25, -10, 8, 4);
            ctx.shadowBlur = 0;

            // Spikes/Scales on back
            ctx.fillStyle = '#0a330a';
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.moveTo(5, 10 + i * 8);
                ctx.lineTo(-5, 14 + i * 8);
                ctx.lineTo(5, 18 + i * 8);
                ctx.fill();
            }

            // Thick Tail
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath();
            const tailSwing = Math.sin(eFrame * 0.8) * 12;
            ctx.moveTo(10, 30);
            ctx.quadraticCurveTo(-20, 35 + tailSwing, -30, 45 + tailSwing);
            ctx.lineTo(-10, 42);
            ctx.fill();

            ctx.restore();
        }
    });

    // PLAYER RENDERING
    const drawPlayer = () => {
        const px = player.x;
        const py = player.y;
        const isMoving = keys['arrowleft'] || keys['a'] || keys['arrowright'] || keys['d'];
        const isJumping = !player.grounded;
        const isShooting = player.shootTimer > 0;

        ctx.save();
        if (!player.facingRight) {
            ctx.translate(px + player.width, py);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(px, py);
        }

        let currentImage = spritesRef.current.idle;
        let frameCount = 1;
        let currentFrame = 0;

        if (isJumping && isShooting && spritesRef.current.jump_shoot) {
            currentImage = spritesRef.current.jump_shoot;
        } else if (isShooting && spritesRef.current.shoot) {
            currentImage = spritesRef.current.shoot;
        } else if (isJumping && spritesRef.current.jump) {
            currentImage = spritesRef.current.jump;
        } else if (isMoving && spritesRef.current.walk) {
            currentImage = spritesRef.current.walk;
            frameCount = 12; // Configurado para tu nueva tira de 12 frames
            currentFrame = Math.floor(player.frame % frameCount);
        }

        if (currentImage && currentImage.complete && currentImage.naturalWidth > 0) {
            const sw = currentImage.naturalWidth / frameCount;
            const sh = currentImage.naturalHeight;
            const aspectRatio = sw / sh;
            
            // Mantener proporciones exactas del dibujo
            const renderHeight = player.height + 40;
            const renderWidth = renderHeight * aspectRatio;
            
            // Centrar horizontalmente respecto al hitbox
            const offsetX = (player.width - renderWidth) / 2;
            const offsetY = -30; // Ajuste vertical para que los pies toquen el suelo

            if (frameCount > 1) {
                ctx.drawImage(
                    currentImage, 
                    currentFrame * sw, 0, sw, sh,
                    offsetX, offsetY, renderWidth, renderHeight
                );
            } else {
                ctx.drawImage(currentImage, offsetX, offsetY, renderWidth, renderHeight);
            }
        } else {
            // Dynamic styled silhouette fallback for active character selection
            const character = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
            
            // Draw stylized shadow body
            ctx.fillStyle = character.avatarFallback;
            ctx.beginPath();
            ctx.arc(player.width / 2, 25, 20, 0, Math.PI * 2); // Head
            ctx.fill();
            
            ctx.fillRect(10, 45, player.width - 20, player.height - 45); // Body
            
            // Signature golden crown or cool street shades decoration!
            ctx.fillStyle = '#000000';
            ctx.fillRect(player.facingRight ? 32 : 12, 18, 20, 6); // Sunglasses
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px monospace';
            ctx.fillText(character.name.toUpperCase(), 12, 60);
        }

        ctx.restore();
    };

    drawPlayer();
    
    ctx.restore(); // Restore world offset

    if (gameStateRef.current === 'playing') {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (k === ' ' || k === 'w' || k === 'arrowup') jump();
      if (k === 'f' || k === 'enter') shoot();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Game Loop setup
    if (gameState === 'playing') {
      animationRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState === 'idle') {
      const timer = setTimeout(() => gameLoop(), 100);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState]);

  const handleGameEnd = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
        // Create clean profile so standard validation rules pass perfectly
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'ANÓNIMO',
          role: 'fan',
          category: 'OYENTE ACTIVO',
          plan: 'fan',
          points: score,
          highScore: score,
          createdAt: new Date().toISOString(),
          isPinned: false,
          bio: '',
          photoURL: user.photoURL || '',
          acceptedEcosystem: true,
          avatarSelfieUrl: '',
          avatarUrl: user.photoURL || '',
          hasAvatar: false
        });
      } else {
        const currentPoints = snap.data()?.points || 0;
        const currentHighScore = snap.data()?.highScore || 0;

        await setDoc(userRef, {
          points: currentPoints + score,
          highScore: Math.max(currentHighScore, score)
        }, { merge: true });
      }
    } catch (e) {
      console.error("Error updating score", e);
    }
  };

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score]);

  const handleTouchStart = (k: string) => { keysRef.current[k] = true; };
  const handleTouchEnd = (k: string) => { keysRef.current[k] = false; };

  return (
    <div className="w-full h-full flex flex-col items-center bg-brand-dark p-2 md:p-6 select-none overflow-hidden touch-none">
      {/* HANDHELD CONSOLE FRAME */}
      <div className="relative w-full max-w-2xl bg-[#2a2a2a] rounded-[2.5rem] p-4 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-t border-white/10 flex flex-col">
        
        {/* SCREEN SECTION */}
        <div className="relative bg-[#0a0a0a] rounded-[1.5rem] border-8 border-black overflow-hidden shadow-inner aspect-[4/3] sm:aspect-video font-sans">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={500} 
            className="w-full h-full object-cover"
          />

          {/* OVERLAY SCREENS */}
          <AnimatePresence>
            {gameState === 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-between p-4 py-6 text-center overflow-hidden"
              >
                {/* Header Section */}
                <div className="relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white leading-none">
                    RAPLIFE <span className="text-brand-yellow">ARCADE</span>
                  </h2>
                  <p className="text-[8px] font-black text-white/55 tracking-[0.2em] uppercase mt-1">SELECCIONA TU LEYENDA DEL RAP</p>
                </div>

                {/* Character Selection Layout */}
                <div className="relative z-10 w-full max-w-lg my-1 sm:my-2 px-1">
                  <div className="grid grid-cols-3 gap-2">
                    {CHARACTERS.map((char) => {
                      const isSelected = selectedCharId === char.id;
                      return (
                        <button
                          key={char.id}
                          onClick={() => setSelectedCharId(char.id as any)}
                          className={`flex flex-col p-2.5 rounded-2xl text-center border-2 transition-all relative group overflow-hidden ${
                            isSelected 
                              ? 'border-brand-yellow bg-brand-yellow/10 shadow-[0_0_20px_rgba(248,251,2,0.3)] scale-[1.03]' 
                              : 'border-white/5 bg-black/50 hover:border-white/25'
                          }`}
                        >
                          {/* Circle Avatar with character brand color */}
                          <div 
                            className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full mb-1.5 flex items-center justify-center font-black text-sm text-black uppercase shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]" 
                            style={{ backgroundColor: char.avatarFallback }}
                          >
                            {char.name[0]}
                          </div>
                          
                          <span className="text-[10px] sm:text-xs font-black uppercase text-white truncate leading-tight block">
                            {char.name}
                          </span>
                          <span className="text-[6px] sm:text-[7px] text-brand-yellow font-black uppercase tracking-wider block mt-0.5 truncate">
                            {char.subtitle}
                          </span>
                          <p className="text-[5px] sm:text-[6px] leading-tight text-gray-500 font-bold uppercase mt-1.5 line-clamp-2 h-5 text-center px-0.5 pointer-events-none">
                            {char.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Loading / Action Section */}
                <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
                  {!imagesLoaded ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-5 h-5 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[7px] font-black text-brand-yellow uppercase tracking-widest animate-pulse">CARGANDO RECURSOS DEL MC...</p>
                    </div>
                  ) : (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={startNewGame}
                      className="chrome-button px-8 py-2.5 rounded-xl text-black font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-[0_0_25px_rgba(248,251,2,0.3)] hover:brightness-110 active:brightness-95 transition-all"
                    >
                      <Play size={12} fill="black" /> INSERT COIN / JUGAR
                    </motion.button>
                  )}
                  <p className="text-[6px] sm:text-[7px] font-bold text-gray-400 uppercase tracking-widest">
                    PULSA SPACE / FLECHA ARRIBA PARA SALTAR • F / ENTER PARA DISPARAR
                  </p>
                </div>
              </motion.div>
            )}

            {gameState === 'gameOver' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-red-910/50 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10"
              >
                <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-1">FAIL</h2>
                <p className="text-xs font-bold uppercase tracking-widest mb-6 text-white/70">LA CALLE NO PERDONA</p>
                <div className="bg-black/60 px-8 py-3 rounded-2xl border-2 border-white/15 mb-6">
                  <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">SCORE</p>
                  <p className="text-2xl font-black italic font-mono text-brand-yellow leading-none">{score}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md justify-center">
                  <button onClick={startNewGame} className="chrome-button px-6 py-3 rounded-xl text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(248,251,2,0.2)]">
                    <RotateCcw size={14} /> REINTENTAR
                  </button>
                  <button 
                    onClick={() => {
                      setGameState('idle');
                      gameStateRef.current = 'idle';
                    }} 
                    className="bg-black/80 hover:bg-black/100 text-white border-2 border-white/20 hover:border-brand-yellow/80 rounded-xl px-6 py-3 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    CAMBIAR LEYENDA
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HUD AREA */}
          {gameState === 'playing' && (
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
              <div className="lcd-display px-4 py-2 rounded-xl border-4 border-black/40 bg-black/30 backdrop-blur-sm shadow-xl">
                <p className="text-[8px] font-black uppercase opacity-60">SCORE</p>
                <p className="text-xl font-bold font-mono leading-none">{score.toString().padStart(6, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-brand-yellow/50">HI: {highScore}</p>
              </div>
            </div>
          )}
        </div>

        {/* PHYSICAL CONTROLS AREA */}
        <div className="mt-6 flex flex-col gap-4 relative z-10">
          <div className="flex justify-between items-center px-2 md:px-4">
            
            {/* LEFT: JOYSTICK */}
            <div className="flex flex-col items-center gap-2">
              <div 
                ref={joystickRef}
                onMouseDown={handleJoystickStart}
                onTouchStart={handleJoystickStart}
                className="relative w-32 h-32 md:w-36 md:h-36 bg-gradient-to-b from-[#1b1b1b] to-[#0a0a0a] rounded-full border-4 border-[#121212] shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),_0_8px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-grab active:cursor-grabbing group select-none"
              >
                {/* Outer Ring guide details */}
                <div className="absolute inset-2 rounded-full border border-white/5 opacity-50 pointer-events-none" />
                <div className="absolute top-2 text-white/10 font-bold text-[8px] tracking-widest pointer-events-none">UP</div>
                <div className="absolute bottom-2 text-white/10 font-bold text-[8px] tracking-widest pointer-events-none">DOWN</div>
                <div className="absolute left-2 text-white/10 font-bold text-[8px] tracking-widest pointer-events-none">LEFT</div>
                <div className="absolute right-2 text-white/10 font-bold text-[8px] tracking-widest pointer-events-none">RIGHT</div>

                {/* SVG Visual Elements for Washer, Shaft, and Ball Top */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 128 128">
                  <defs>
                    <linearGradient id="metal-shaft" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="35%" stopColor="#9e9e9e" />
                      <stop offset="65%" stopColor="#cccccc" />
                      <stop offset="100%" stopColor="#3a3a3a" />
                    </linearGradient>
                    <radialGradient id="red-ball" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#ff5d5d" />
                      <stop offset="55%" stopColor="#d30000" />
                      <stop offset="100%" stopColor="#600000" />
                    </radialGradient>
                    <radialGradient id="washer-grad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#1e1e1e" />
                      <stop offset="85%" stopColor="#121212" />
                      <stop offset="100%" stopColor="#252525" />
                    </radialGradient>
                  </defs>

                  {/* Black dust washer (rounds and moves slightly with stick) */}
                  <circle 
                    cx={64 + joystickPos.x * 0.25} 
                    cy={64 + joystickPos.y * 0.25} 
                    r="26" 
                    fill="url(#washer-grad)" 
                    stroke="#050505" 
                    strokeWidth="2.5"
                    filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.8))"
                  />

                  {/* Steel Shaft */}
                  <line 
                    x1="64" 
                    y1="64" 
                    x2={64 + joystickPos.x} 
                    y2={64 + joystickPos.y} 
                    stroke="url(#metal-shaft)" 
                    strokeWidth="9" 
                    strokeLinecap="round" 
                  />

                  {/* Red Ball Top */}
                  <circle 
                    cx={64 + joystickPos.x} 
                    cy={64 + joystickPos.y} 
                    r="20" 
                    fill="url(#red-ball)" 
                    filter="drop-shadow(0px 6px 8px rgba(0,0,0,0.7))" 
                  />
                </svg>
              </div>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1">PALANCA</span>
            </div>

            {/* RIGHT: ACTION BUTTONS */}
            <div className="flex gap-4 md:gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className="p-1 bg-black rounded-full shadow-inner">
                  <button 
                    className="w-16 h-16 md:w-20 md:h-20 bg-[#ff4444] rounded-full border-b-8 border-red-900 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center shadow-lg" 
                    onMouseDown={jump}
                    onTouchStart={(e) => { e.preventDefault(); jump(); }}
                  >
                    <span className="text-black font-black text-xl">A</span>
                  </button>
                </div>
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">JUMP</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                 <div className="p-1 bg-black rounded-full shadow-inner">
                    <button 
                      className="w-16 h-16 md:w-20 md:h-20 bg-brand-yellow rounded-full border-b-8 border-yellow-700 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center shadow-lg" 
                      onMouseDown={shoot}
                      onTouchStart={(e) => { e.preventDefault(); shoot(); }}
                    >
                      <span className="text-black font-black text-xl">B</span>
                    </button>
                 </div>
                 <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">FIRE</span>
              </div>
            </div>
          </div>

          {/* START / SELECT BUTTONS */}
          <div className="flex justify-center gap-10 py-4 opacity-40">
            <div className="flex flex-col items-center gap-1">
              <button className="w-12 h-3 bg-[#111] rounded-full rotate-[-25deg] shadow-lg border border-white/5 active:bg-[#222]" />
              <span className="text-[7px] font-black tracking-widest">SELECT</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button 
                className="w-12 h-3 bg-[#111] rounded-full rotate-[-25deg] shadow-lg border border-white/5 active:bg-[#222]" 
                onClick={() => {
                  if (gameState === 'idle') startNewGame();
                  else setGameState('idle');
                }}
              />
              <span className="text-[7px] font-black tracking-widest">START</span>
            </div>
          </div>
        </div>

      </div>

      <div className="w-full max-w-4xl space-y-10 py-10 px-4 animate-fadeIn">
        <Leaderboard />
        
        <div className="space-y-10">
          <header className="text-center">
            <h3 className="text-4xl font-black italic uppercase italic glow-yellow">RECOMPENSAS</h3>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">CANJEA TUS PUNTOS POR BENEFICIOS REALES</p>
          </header>
          <RewardsTable />
        </div>

        {/* Toggleable Developer Sprite Guide */}
        {isAdmin && (
          <div className="flex justify-center pt-2">
            <button 
              onClick={() => setShowGuide(!showGuide)} 
              className="text-[9px] text-gray-500 hover:text-brand-yellow font-black uppercase tracking-widest flex items-center gap-1.5 bg-black/40 border border-white/5 hover:border-brand-yellow/30 px-4 py-2 rounded-full transition-all cursor-pointer"
            >
              🛠️ {showGuide ? 'OCULTAR' : 'MOSTRAR'} GUÍA DE RECURSOS & SPRITES (DESARROLLADOR)
            </button>
          </div>
        )}

        {/* ASSETS SPECIFICATION BLUEPRINT */}
        {isAdmin && showGuide && (
          <div className="bg-black/60 border-4 border-boombox-gray rounded-[2.5rem] p-6 sm:p-8 w-full max-w-4xl mx-auto shadow-2xl relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Award size={180} />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Award className="text-brand-yellow" size={28} />
                <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-white">GUÍA DE RECURSOS & SPRITES</h3>
              </div>
              <span className="text-[8px] bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                ARCADE INTERACTIVE BLUEPRINT
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-gray-300">
              {/* Column 1: Personajes */}
              <div className="space-y-4">
                <h4 className="font-black text-brand-yellow uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-brand-yellow block" />
                  📂 SPRITES DE PERSONAJES (ORIENTADOS DERECHA)
                </h4>
                <p className="text-gray-400 leading-normal font-bold uppercase text-[9px] bg-red-950/20 border-l-2 border-red-500 p-2.5 rounded-r-lg">
                  ⚠️ <span className="text-brand-yellow font-black">REGLA DE ORIENTACIÓN:</span> Los sprites deben estar dibujados <span className="text-white underline">MIRANDO HACIA LA DERECHA</span> por defecto en tu archivo PNG. El motor los rotará automáticamente 180° hacia la izquierda en pantalla cuando cambies de dirección.
                </p>
                
                <div className="space-y-4 font-mono text-[9px] bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-brand-yellow font-black text-[10px] border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>🕶️ P1: BIGGIE (player)</span>
                      <span className="text-[7px] text-gray-500">FORMATO REQUERIDO</span>
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-white">/assets/player_idle.png</span> - Reposo (1 frame)</li>
                      <li><span className="text-white">/assets/player_walk.png</span> - Caminar (Hoja de 12 frames horizontales)</li>
                      <li><span className="text-white">/assets/player_jump.png</span> - Salto (1 frame)</li>
                      <li><span className="text-white">/assets/player_shoot.png</span> - Disparar (1 frame)</li>
                      <li><span className="text-white">/assets/player_jump_shoot.png</span> - Disparar en aire</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-brand-yellow font-black text-[10px] border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>🎤 P2: 2PAC (player2)</span>
                      <span className="text-[7px] text-gray-500">FORMATO REQUERIDO</span>
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-white">/assets/player2_idle.png</span></li>
                      <li><span className="text-white">/assets/player2_walk.png</span> (Hoja de 12 frames horizontales)</li>
                      <li><span className="text-white">/assets/player2_jump.png</span></li>
                      <li><span className="text-white">/assets/player2_shoot.png</span></li>
                      <li><span className="text-white">/assets/player2_jump_shoot.png</span></li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-brand-yellow font-black text-[10px] border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>🛹 P3: MCFLY (player3)</span>
                      <span className="text-[7px] text-gray-500">FORMATO REQUERIDO</span>
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-white">/assets/player3_idle.png</span></li>
                      <li><span className="text-white">/assets/player3_walk.png</span> (Hoja de 12 frames horizontales)</li>
                      <li><span className="text-white">/assets/player3_jump.png</span></li>
                      <li><span className="text-white">/assets/player3_shoot.png</span></li>
                      <li><span className="text-white">/assets/player3_jump_shoot.png</span></li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Column 2: Escenarios y Enemigos */}
              <div className="space-y-4">
                <h4 className="font-black text-brand-yellow uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-brand-yellow block" />
                  🏙️ FONDOS, EDIFICIOS & TEXTURAS (OPCIONALES)
                </h4>
                <p className="text-gray-400 leading-normal font-bold uppercase text-[9px]">
                  ¡Sube estos nombres a tu carpeta para cambiar todo el estilo! El juego usa vectores mate si no los encuentra.
                </p>
                
                <div className="space-y-4 font-mono text-[9px] bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-white font-bold uppercase text-[10px] border-b border-white/5 pb-1">
                      🌆 ARCHIVOS DEL ESCENARIO (PARALLAX)
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-brand-yellow">/assets/bg_sky.png</span> - Cielo de fondo</li>
                      <li><span className="text-brand-yellow">/assets/bg_buildings.png</span> - Edificios de Siluetas (Middleground)</li>
                      <li><span className="text-brand-yellow">/assets/bg_hills.png</span> - Montañas / Colinas (Far Background)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-white font-bold uppercase text-[10px] border-b border-white/5 pb-1">
                      🧱 PLATAFORMAS Y SUELOS (TILADO)
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-brand-yellow">/assets/tile_ground.png</span> - Piso/Asfalto inferior principal</li>
                      <li><span className="text-brand-yellow">/assets/tile_platform.png</span> - Bloques/Repisas flotantes suspendidas</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-white font-bold uppercase text-[10px] border-b border-white/5 pb-1">
                      🦎 ENEMIGO REPTIL
                    </p>
                    <ul className="list-none space-y-1 text-gray-400 mt-1.5 pl-1">
                      <li><span className="text-brand-yellow">/assets/enemy_walk.png</span> - Hoja de caminata para el reptil (6 frames)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameView;
