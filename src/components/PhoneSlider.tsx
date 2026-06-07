import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PhoneSliderProps {
  images: string[];
}

const PhoneSlider: React.FC<PhoneSliderProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  if (images.length === 0) {
    return (
      <div className="w-full aspect-[9/16] bg-white/5 rounded-[3rem] border-4 border-white/10 flex items-center justify-center p-8 text-center">
        <p className="text-gray-500 text-sm italic uppercase font-bold">Sube tus flyers verticales para activarlos aquí</p>
      </div>
    );
  }

  return (
    <div className="relative group mx-auto max-w-[320px]">
      {/* Phone Frame */}
      <div className="relative aspect-[9/19] bg-black rounded-[3.5rem] border-[12px] border-[#121212] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden ring-1 ring-white/10">
        {/* Notch / Dynamic Island style */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/4 h-5 bg-[#0a0a0a] rounded-full z-20 flex items-center justify-center border border-white/5 shadow-inner">
           <div className="w-1.5 h-1.5 rounded-full bg-[#1a1a2a] ml-auto mr-2 border border-blue-500/20" />
        </div>

        {/* Side Buttons (Simulated 3D) */}
        <div className="absolute left-[-14px] top-24 w-1 h-12 bg-[#1a1a1a] rounded-r shadow-lg border-y border-white/5" />
        <div className="absolute left-[-14px] top-40 w-1 h-8 bg-[#1a1a1a] rounded-r shadow-lg border-y border-white/5" />
        <div className="absolute right-[-14px] top-32 w-1 h-16 bg-[#1a1a1a] rounded-l shadow-lg border-y border-white/5" />
        
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            initial={{ opacity: 0, filter: 'blur(10px)', scale: 1.1 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.9 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="w-full h-full object-cover"
            alt={`Flyer ${currentIndex + 1}`}
          />
        </AnimatePresence>

        {/* Reflections & Gloss */}
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-40 rounded-full blur-2xl -translate-y-1/2 -translate-x-1/4 rotate-45" />
          <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-white/5 blur-3xl rounded-full" />
        </div>
      </div>

      {/* Navigation */}
      <button 
        onClick={prevSlide}
        className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-yellow hover:text-black"
      >
        <ChevronLeft size={20} />
      </button>
      <button 
        onClick={nextSlide}
        className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-yellow hover:text-black"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {images.map((_, i) => (
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-brand-yellow w-4' : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PhoneSlider;
