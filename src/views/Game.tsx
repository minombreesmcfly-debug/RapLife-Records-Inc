import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Volume2, VolumeX, ChevronLeft, ChevronRight, ChevronUp, Trophy, Gift, Star, Award, Medal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';

const RewardsTable = () => {
  const rewards = [
    { pts: '100,000', icon: Trophy, title: 'CAMEO / VIDEO MUSICAL', desc: 'Aparición oficial en un video de RapLife Records.' },
    { pts: '7,770', icon: Gift, title: 'PRODUCTO TIKTOK STORE', desc: 'Gana un producto de nuestra tienda oficial.' },
    { pts: '5,000', icon: Star, title: 'MENCIÓN EN STORIES', desc: 'Mención directa en nuestras redes oficiales.' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full">
      {rewards.map((r, i) => (
        <div key={i} className="bg-black/40 border-2 border-boombox-gray p-5 rounded-3xl flex flex-col items-center text-center gap-2 hover:border-brand-yellow/50 transition-all group">
          <div className="p-3 bg-brand-yellow/10 rounded-2xl group-hover:scale-110 transition-transform">
            <r.icon className="text-brand-yellow" size={24} />
          </div>
          <p className="text-brand-yellow font-black italic text-xl leading-none">{r.pts} PTS</p>
          <p className="text-[10px] font-black uppercase tracking-widest">{r.title}</p>
          <p className="text-[9px] text-gray-500 font-bold uppercase leading-tight">{r.desc}</p>
        </div>
      ))}
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

const GameView = () => {
  const { user, profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const loadImages = () => {
      const sources = {
        idle: '/assets/player_idle.png',
        walk: '/assets/player_walk.png',
        jump: '/assets/player_jump.png',
        shoot: '/assets/player_shoot.png',
        jump_shoot: '/assets/player_jump_shoot.png'
      };
      
      const loaded: { [key: string]: HTMLImageElement } = {};
      let count = 0;
      const keys = Object.keys(sources);
      
      keys.forEach(key => {
        const img = new Image();
        img.src = sources[key as keyof typeof sources];
        img.onload = () => {
          loaded[key] = img;
          count++;
          if (count === keys.length) {
            spritesRef.current = loaded;
            setImagesLoaded(true);
          }
        };
        img.onerror = () => {
          count++;
          if (count === keys.length) {
            spritesRef.current = loaded;
            setImagesLoaded(true);
          }
        };
      });
    };
    loadImages();
  }, []);

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
    worldRef.current.bullets.push({
      x: player.x + (player.facingRight ? player.width : 0),
      y: player.y + 32, // Un poco más arriba (antes 36)
      dx: player.facingRight ? 15 : -15,
      radius: 8, // Balas un poco más grandes
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

    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, skyTop);
    sky.addColorStop(0.5, skyMid);
    sky.addColorStop(1, skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    // Buildings (Layer 2)
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
            // Fallback (Biggie Silhouette)
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, player.width, player.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(5, 5, 5, 5); // Eye
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
      const currentPoints = snap.data()?.points || 0;
      const currentHighScore = snap.data()?.highScore || 0;

      await setDoc(userRef, {
        points: currentPoints + score,
        highScore: Math.max(currentHighScore, score)
      }, { merge: true });
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
                className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center overflow-hidden"
              >
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-24 h-24 bg-brand-yellow rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(248,251,2,0.4)] cursor-pointer relative z-10" 
                  onClick={startNewGame}
                >
                  <Play className="text-black ml-1" size={48} fill="black" />
                </motion.div>

                <div className="relative z-10 space-y-2">
                  <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-tight">
                    RAPLIFE<br />
                    <span className="text-white">ARCADE</span>
                  </h2>
                  <p className="text-lg md:text-xl font-black text-brand-yellow uppercase tracking-[0.2em]">HIP HOP EDITION</p>
                  <p className="text-[10px] md:text-[12px] font-bold text-gray-400 uppercase tracking-[0.4em] pt-4">THE STREETS ARE WAITING</p>
                </div>
              </motion.div>
            )}

            {gameState === 'gameOver' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
              >
                <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-2">FAIL</h2>
                <p className="text-xs font-bold uppercase tracking-widest mb-8 text-white/70">LA CALLE NO PERDONA</p>
                <div className="bg-black/60 px-8 py-4 rounded-3xl border-2 border-white/15 mb-8">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">SCORE</p>
                  <p className="text-3xl font-black italic font-mono text-brand-yellow">{score}</p>
                </div>
                <button onClick={startNewGame} className="chrome-button px-10 py-4 rounded-2xl text-black font-black uppercase tracking-widest text-sm flex items-center gap-3">
                  <RotateCcw size={18} /> REINTENTAR
                </button>
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

      <div className="w-full max-w-4xl space-y-10 py-10 px-4">
        <Leaderboard />
        
        <div className="space-y-10">
          <header className="text-center">
            <h3 className="text-4xl font-black italic uppercase italic glow-yellow">RECOMPENSAS</h3>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">CANJEA TUS PUNTOS POR BENEFICIOS REALES</p>
          </header>
          <RewardsTable />
        </div>
      </div>
    </div>
  );
};

export default GameView;
