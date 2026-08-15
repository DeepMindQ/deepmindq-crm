'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * Legacy Intelligence Sources Screen — Redirects to the real Data Import screen.
 * This screen was 100% mock data with fake connectors.
 * Real connector management will be built as a future enhancement.
 */
export default function IntelligenceSourcesScreen() {
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
