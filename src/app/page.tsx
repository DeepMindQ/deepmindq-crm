'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { QueryProvider } from '@/providers/query-provider';
import { AppShell } from '@/components/app-shell';
import LandingPage from '@/app/landing-page';

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/auth/me', { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok && !cancelled) setLoggedIn(true);
      } catch {
        // Not authenticated — show landing
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setLoggedIn(true);
        window.location.hash = '#intelligence-operations';
        return;
      }
    } catch { /* fall through */ }
    setLoggedIn(false);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        document.cookie = 'dmq_session=; path=/; max-age=0';
        window.location.replace('/');
        return;
      }
    } catch { /* fall through */ }
    document.cookie = 'dmq_session=; path=/; max-age=0';
    window.location.replace('/');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c10' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppShell onLogout={handleLogout} />
      </QueryProvider>
    </ErrorBoundary>
  );
}
