'use client';

import { useState, useCallback } from 'react';
import { Lock, X } from 'lucide-react';

interface LandingPageProps {
  onLogin?: () => void;
}

/**
 * Landing Page — Full-screen iframe wrapper around public/landing-page.html.
 * The actual marketing content lives in the static HTML file for easy editing
 * without touching the React codebase. A floating Login button provides
 * access to the DeepMindQ app.
 */
export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLoginHint, setShowLoginHint] = useState(false);

  const handleLoginClick = useCallback(() => {
    if (onLogin) {
      onLogin();
    } else {
      // Fallback: navigate to login page
      window.location.href = '/login';
    }
  }, [onLogin]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      {/* Full-screen iframe for the marketing landing page */}
      <iframe
        src="/landing-page.html"
        title="DeepMindQ — Enterprise Intelligence Platform"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          overflow: 'auto',
        }}
      />

      {/* Floating Login Button — positioned top-right, above the iframe */}
      <button
        onClick={handleLoginClick}
        onMouseEnter={() => setShowLoginHint(true)}
        onMouseLeave={() => setShowLoginHint(false)}
        style={{
          position: 'fixed',
          top: 20,
          right: 24,
          zIndex: 10000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 60,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(8, 8, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: '#f0eef5',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '0.82rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.25)';
          e.currentTarget.style.background = 'rgba(255, 107, 53, 0.08)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.background = 'rgba(8, 8, 22, 0.85)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <Lock size={14} />
        Login
        {showLoginHint && (
          <span style={{
            fontSize: '0.65rem',
            color: 'rgba(255, 107, 53, 0.8)',
            marginLeft: 4,
          }}>
            →
          </span>
        )}
      </button>
    </div>
  );
}
