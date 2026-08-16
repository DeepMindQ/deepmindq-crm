'use client';

import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { tokens } from '@/components/intelligence-os/design-tokens';

interface EnterpriseErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  correlationId?: string;
}

export function EnterpriseErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. This has been logged for investigation.',
  onRetry,
  onBack,
  correlationId,
}: EnterpriseErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: tokens.confidence.low.bg, border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <AlertTriangle className="w-6 h-6" style={{ color: tokens.domain.risk }} />
      </div>

      <h3 className="text-sm font-semibold mb-2" style={{ color: tokens.text.primary }}>
        {title}
      </h3>
      <p className="text-xs mb-6" style={{ color: tokens.text.secondary, maxWidth: '360px' }}>
        {message}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: tokens.accent.dim, color: tokens.flat.white }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ border: '1px solid #1e2535', color: tokens.text.secondary }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
        )}
      </div>

      {correlationId && (
        <p className="text-[10px] mt-4" style={{ color: tokens.text.muted }}>
          Correlation: {correlationId}
        </p>
      )}
    </div>
  );
}
