'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * Legacy Import Screen — Redirects to the real Data Import screen.
 * This screen was 100% mock data and has been replaced by data-import-screen.tsx.
 */
export default function ImportScreen() {
  const setActiveView = useAppStore((s) => s.setActiveView);

  useEffect(() => {
    setActiveView('data-import');
  }, [setActiveView]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Redirecting to Data Import...</p>
    </div>
  );
}
