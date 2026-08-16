'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

const C = {
  bg: '#0a0a0f',
  emerald: '#34d399',
  emeraldDim: 'rgba(52,211,153,0.15)',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  muted: '#71717a',
  border: 'rgba(63,63,70,0.5)',
  surface: 'rgba(24,24,27,0.6)',
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="antialiased" style={{ background: C.bg }}>
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center px-6 max-w-md">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1.5px solid rgba(239,68,68,0.2)',
              }}
            >
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-3 text-red-400">
              Critical Error
            </p>
            <h1 className="text-2xl font-bold mb-3 text-zinc-100">Application Error</h1>
            <p className="text-sm text-zinc-400 mb-2">
              An unhandled error occurred in the application root.
            </p>
            {error.message && (
              <p className="text-xs font-mono text-zinc-600 mb-6 break-all">{error.message}</p>
            )}
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: C.emeraldDim, color: C.emerald }}
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
