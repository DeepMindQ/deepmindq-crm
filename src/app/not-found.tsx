'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowLeft } from 'lucide-react';

const C = {
  bg: '#0A0E1A',
  gold: '#c9a84c',
  goldBorder: 'rgba(201,168,76,0.18)',
  goldDim: 'rgba(201,168,76,0.1)',
  textDim: '#6B7280',
  textSub: '#9CA3AF',
  white: '#FFFFFF',
  border: 'rgba(255,255,255,0.06)',
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <motion.div
        className="text-center px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: C.goldDim, border: `1.5px solid ${C.goldBorder}` }}>
          <Sparkles className="w-7 h-7" style={{ color: C.gold }} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>404</p>
        <h1 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-[-0.025em] mb-4" style={{ color: C.white }}>
          Page not found
        </h1>
        <p className="text-[16px] font-light max-w-[400px] mx-auto mb-8" style={{ color: C.textSub }}>
          This page doesn&apos;t exist, or it&apos;s been moved. Let&apos;s get you back to familiar ground.
        </p>
        <a href="/"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-semibold transition-colors"
          style={{ background: C.gold, color: '#0A0E1A' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to DeepMindQ
        </a>
      </motion.div>
    </main>
  );
}