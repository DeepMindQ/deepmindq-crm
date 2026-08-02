'use client';

import { AlertTriangle } from 'lucide-react';

const C = {
  bg: '#0A0E1A',
  gold: '#C9A84C',
  goldDim: 'rgba(201,168,76,0.1)',
  goldBorder: 'rgba(201,168,76,0.18)',
  textSub: '#9CA3AF',
  white: '#FFFFFF',
};

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: C.bg, margin: 0 }}>
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center px-6 max-w-md">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
              style={{ background: C.goldDim, border: `1.5px solid ${C.goldBorder}` }}
            >
              <AlertTriangle className="w-7 h-7" style={{ color: C.gold }} />
            </div>
            <p
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: C.gold }}
            >
              Critical Error
            </p>
            <h1
              className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-[-0.025em] mb-4"
              style={{ color: C.white }}
            >
              Application Error
            </h1>
            <p className="text-[15px] font-light mb-6" style={{ color: C.textSub }}>
              A critical error occurred that prevented the application from loading.
              Please refresh the page or contact support if the issue persists.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
              style={{ background: C.gold, color: '#0A0E1A' }}
            >
              Reload
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
