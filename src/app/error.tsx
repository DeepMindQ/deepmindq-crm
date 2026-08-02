'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

const C = {
  bg: '#0A0E1A',
  gold: 'var(--color-gold)',
  goldBorder: 'rgba(201,168,76,0.18)',
  goldDim: 'rgba(201,168,76,0.1)',
  textDim: '#6B7280',
  textSub: '#9CA3AF',
  white: '#FFFFFF',
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DeepMindQ] Unhandled error:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="text-center px-6 max-w-md">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: C.goldDim, border: `1.5px solid ${C.goldBorder}` }}
        >
          <AlertTriangle className="w-7 h-7" style={{ color: C.gold }} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>
          Error
        </p>
        <h1 className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-[-0.025em] mb-4" style={{ color: C.white }}>
          Something went wrong
        </h1>
        <p className="text-[15px] font-light mb-8" style={{ color: C.textSub }}>
          An unexpected error occurred. This has been logged for investigation.
          You can try again or return to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ background: C.gold, color: '#0A0E1A' }}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ border: `1px solid ${C.goldBorder}`, color: C.textSub }}
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
