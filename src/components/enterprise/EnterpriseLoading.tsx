'use client';

import { Loader2 } from 'lucide-react';
import { tokens } from '@/components/intelligence-os/design-tokens';

interface EnterpriseLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const sizeConfig = {
  sm: { spinner: 'w-4 h-4', text: 'text-xs', gap: 'gap-2', padding: 'p-4' },
  md: { spinner: 'w-8 h-8', text: 'text-sm', gap: 'gap-3', padding: 'p-8' },
  lg: { spinner: 'w-10 h-10', text: 'text-sm', gap: 'gap-4', padding: 'p-16' },
};

export function EnterpriseLoading({
  message = 'Loading...',
  size = 'md',
  fullScreen = false,
}: EnterpriseLoadingProps) {
  const config = sizeConfig[size];

  const content = (
    <div className={`flex flex-col items-center justify-center ${config.padding} ${config.gap}`}>
      <div
        className={`${config.spinner} rounded-lg flex items-center justify-center`}
        style={{ background: tokens.accent.subtle }}
      >
        <Loader2
          className={`${config.spinner} animate-spin`}
          style={{ color: tokens.accent.DEFAULT }}
        />
      </div>
      <p className={config.text} style={{ color: tokens.text.secondary }}>
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: tokens.text.inverse }}
      >
        {content}
      </div>
    );
  }

  return content;
}
