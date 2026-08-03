'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DeepMindQ] Unhandled error:', error);
    import('@sentry/nextjs').then((mod) => {
      mod.default.captureException(error);
    }).catch(() => { /* Sentry not configured */ });
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c10' }}>
      <div className="text-center px-6 max-w-md">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle className="w-7 h-7" style={{ color: '#EF4444' }} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: '#EF4444' }}>
          Error
        </p>
        <h1 className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-[-0.025em] mb-4" style={{ color: '#e8ecf4' }}>
          Something went wrong
        </h1>
        <p className="text-[15px] font-light mb-8" style={{ color: '#8892a8' }}>
          An unexpected error occurred. This has been logged for investigation.
          You can try again or return to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ background: '#2563EB', color: '#FFFFFF' }}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ border: '1px solid #1e2535', color: '#8892a8' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
