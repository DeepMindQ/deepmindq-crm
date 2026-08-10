'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, useEffect, type ReactNode } from 'react';
import { initCsrfInterceptor } from '@/lib/csrf-interceptor';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  // Initialize global CSRF interceptor on mount
  // Auto-injects x-csrf-token header on all /api/* POST/PUT/DELETE
  useEffect(() => {
    initCsrfInterceptor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}