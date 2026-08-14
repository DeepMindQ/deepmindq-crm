'use client';

/**
 * AuthProvider — WI-18.1-08
 *
 * Checks for an active session on mount. If no session exists,
 * redirects to the login page. This prevents unauthenticated users
 * from seeing the full application UI.
 *
 * The provider also exposes session state to child components
 * via React Context, enabling conditional rendering based on auth status.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface SessionContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: { userId: string; email: string; role: string } | null;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  isLoading: true,
  isAuthenticated: false,
  session: null,
  refreshSession: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<{ userId: string; email: string; role: string } | null>(
    null,
  );

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.session) {
          setSession(data.session);
          setIsAuthenticated(true);
          return;
        }
      }
    } catch {
      // Session check failed — treat as unauthenticated
    }

    setSession(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    checkSession().finally(() => setIsLoading(false));
  }, [checkSession]);

  // Redirect unauthenticated users to login (skip on login page itself)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const pathname = window.location.pathname;
      const isLoginPage = pathname === '/login' || pathname === '/demo';
      if (!isLoginPage) {
        window.location.href = '/login';
      }
    }
  }, [isLoading, isAuthenticated]);

  const refreshSession = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  return (
    <SessionContext.Provider value={{ isLoading, isAuthenticated, session, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}
