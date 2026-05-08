import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export const GoldenShowerEffect: React.FC = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20 - Math.random() * 30,
      size: Math.random() * 4 + 1,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 10,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden mix-blend-screen opacity-60">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#d4af37]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            boxShadow: '0 0 10px #d4af37, 0 0 20px #d4af37',
          }}
          animate={{
            y: ['0vh', '110vh'],
            x: [`${p.x}%`, `${p.x + (Math.random() * 10 - 5)}%`],
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1, 1, 0.5],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

export const OCSignature: React.FC = () => {
  return (
    <div className="relative group overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="relative">
          <div className="text-4xl font-display font-black text-[#d4af37] tracking-tighter drop-shadow-[0_0_20px_rgba(212,175,55,0.6)]">
            OC
          </div>
          <motion.div 
            className="absolute -inset-2 bg-[#d4af37]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] font-tech font-black tracking-[0.4em] text-[#d4af37] -mb-1">INVESTIGATIONS</span>
          <span className="text-[9px] font-mono text-white/40 uppercase tracking-[0.15em] font-medium">Lattice Intelligence System</span>
        </div>
      </motion.div>
    </div>
  );
};
