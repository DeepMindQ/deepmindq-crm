'use client';

import { Loader2 } from 'lucide-react';

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
        style={{ background: 'rgba(59,130,246,0.1)' }}
      >
        <Loader2 className={`${config.spinner} animate-spin`} style={{ color: '#3B82F6' }} />
      </div>
      <p className={config.text} style={{ color: '#8892a8' }}>{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c10' }}>
        {content}
      </div>
    );
  }

  return content;
}
