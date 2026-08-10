'use client';

import { useEffect, useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { AlertTriangle, RotateCcw, ArrowLeft, Copy, Check } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const errorId = error.digest || `route-${Date.now()}`;

  useEffect(() => {
    console.error('[DeepMindQ] Unhandled error:', error);
    import('@sentry/nextjs').then((mod) => {
      mod.default.captureException(error);
    }).catch(() => { /* Sentry not configured */ });
  }, [error]);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(
        `DeepMindQ Error Report\nError ID: ${errorId}\nDigest: ${error.digest ?? 'N/A'}\nMessage: ${error.message}\nStack: ${error.stack ?? 'N/A'}\nTimestamp: ${new Date().toISOString()}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: tokens.text.inverse }}>
      <div className="text-center px-6 max-w-md">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: tokens.confidence.low.bg, border: '1.5px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle className="w-7 h-7" style={{ color: tokens.domain.risk }} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: tokens.domain.risk }}>
          Error
        </p>
        <h1 className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-[-0.025em] mb-4" style={{ color: tokens.text.primary }}>
          Something went wrong
        </h1>
        <p className="text-[15px] font-light mb-4" style={{ color: tokens.text.secondary }}>
          An unexpected error occurred. This has been logged for investigation.
          You can try again or return to the dashboard.
        </p>

        {/* Error ID & digest display */}
        <div
          className="inline-flex items-center gap-3 rounded-lg px-4 py-2.5 mb-8"
          style={{ background: tokens.surfaceExtended.backdrop, border: '1px solid rgba(42,51,72,0.5)' }}
          aria-live="polite"
        >
          <span className="text-[11px] font-mono" style={{ color: tokens.text.muted }}>
            ID: {errorId}
          </span>
          <button
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: tokens.accent.DEFAULT }}
            aria-label="Copy error ID"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy</>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ background: tokens.accent.dim, color: tokens.flat.white }}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ border: '1px solid #1e2535', color: tokens.text.secondary }}
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
