'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

const C = {
  bg: '#0A0E1A',
  blue: '#3B82F6',
  blueDim: '#2563EB',
  blueBg: 'rgba(59,130,246,0.1)',
  blueBorder: 'rgba(59,130,246,0.2)',
  textSub: '#8892A8',
  white: '#E8ECF4',
};

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Note: Sentry capture not possible here — global-error runs outside of React lifecycle.
  // Errors are captured by the Sentry server config's error handler instead.
  return (
    <html lang="en">
      <body style={{ background: C.bg, margin: 0 }}>
        <main className="min-h-screen flex items-center justify-center" role="alert">
          <div className="text-center px-6 max-w-md">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
              style={{ background: C.blueBg, border: `1.5px solid ${C.blueBorder}` }}
            >
              <AlertTriangle className="w-7 h-7" style={{ color: C.blue }} />
            </div>
            <p
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: C.blue }}
            >
              Critical Error
            </p>
            <h1
              className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-[-0.025em] mb-4"
              style={{ color: C.white }}
            >
              Application Error
            </h1>
            <p className="text-[15px] font-light mb-8" style={{ color: C.textSub }}>
              A critical error occurred that prevented the application from loading.
              Please try again or contact support if the issue persists.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
                style={{ background: C.blueDim, color: '#FFFFFF' }}
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
                style={{ border: '1px solid #1e2535', color: C.textSub }}
              >
                Reload
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
