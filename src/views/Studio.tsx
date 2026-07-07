import React from 'react';
import SpotifyTurntable from '../components/SpotifyTurntable';
import { useAuth } from '../context/AuthContext';
import { Radio, Mic2 } from 'lucide-react';

const StudioView = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20 space-y-6">
      {/* Dynamic header details */}
      <div className="flex items-center justify-between border-b-2 border-boombox-gray pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-yellow/10 rounded-xl border border-brand-yellow/30">
            <Mic2 className="text-brand-yellow" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight text-white leading-none">RAPLIFE STUDIO CONSOLE</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
              PROCESADOR DE AUDIO DIGITAL CON AUTOTUNE EN VIVO Y EFECTOS INTEGRADOS
            </p>
          </div>
        </div>
      </div>

      {/* RENDER THE ACTUAL AUDIO STUDIO TURNTABLE CONSOLE */}
      <div className="w-full">
        <SpotifyTurntable />
      </div>
    </div>
  );
};

export default StudioView;
