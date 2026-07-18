import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const ArtistsView = () => {
  const [artists, setArtists] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const q = query(collection(db, 'users'), limit(100));
        const snap = await getDocs(q);
        const rawUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const filteredArtists = rawUsers.filter((data: any) => {
          const dispName = (data.displayName || '').trim();
          const isDefaultProfile = !dispName || dispName === 'RapLife Member' || dispName === 'Artista Sin Nombre';
          
          return data.role === 'artist' || 
                 data.isPinned === true || 
                 data.isExclusive === true ||
                 (!isDefaultProfile && (
                   data.hasAvatar === true || 
                   (data.avatarUrl && data.avatarUrl !== '') || 
                   (data.photoURL && data.photoURL !== '') ||
                   (data.avatarSelfieUrl && data.avatarSelfieUrl !== '')
                 ));
        });

        setArtists(filteredArtists);
      } catch (err) {
        console.warn("[ARTISTS] Failed to fetch artists roster offline:", err);
        setArtists([]);
      } finally {
        setLoading(false);
      }
    };
    fetchArtists();
  }, []);

  const filtered = artists.filter(a => 
    a.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto space-y-10 mb-20">
      <header className="space-y-6">
        <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter glow-yellow leading-none">ROSTER DE TALENTO</h1>
        
        <div className="relative group max-w-md">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-brand-yellow transition-colors" size={20} />
           <input 
             type="text" 
             placeholder="BUSCAR ARTISTA..."
             className="w-full bg-brand-dark border-4 border-boombox-gray p-4 pl-12 rounded-2xl focus:border-brand-yellow outline-none font-bold uppercase italic shadow-lg"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center animate-pulse italic font-black uppercase text-xl">SINTONIZANDO SEÑAL...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filtered.map((artist) => (
             <Link key={artist.id} to={`/profile/${artist.id}`}>
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white/5 border border-white/5 rounded-[2.5rem] p-6 hover:border-brand-yellow/30 transition-all group flex flex-col items-center text-center boombox-texture overflow-hidden"
                >
                   <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-boombox-gray mb-6 shadow-2xl group-hover:border-brand-yellow transition-colors bg-gray-900">
                      <img src={artist.photoURL || 'https://via.placeholder.com/200'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                   </div>
                   <h3 className="text-2xl font-black italic uppercase tracking-tight mb-2 group-hover:text-brand-yellow transition-colors">{artist.displayName}</h3>
                   <p className="text-gray-500 text-xs font-bold uppercase tracking-widest line-clamp-2 px-4 italic mb-6">
                      {artist.bio || "Bio no disponible. Dale play a sus tracks abajo."}
                   </p>
                   <div className="mt-auto w-full pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-brand-yellow font-black italic uppercase text-xs">
                      VER PERFIL <ArrowRight size={14} />
                   </div>
                </motion.div>
             </Link>
           ))}
           {filtered.length === 0 && (
             <div className="col-span-full py-32 text-center opacity-30 italic font-black uppercase text-sm tracking-widest">
                NO SE ENCONTRARON ARTISTAS CON ESE NOMBRE
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ArtistsView;
