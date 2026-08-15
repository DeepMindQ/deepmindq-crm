'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useState, type ReactNode } from 'react';

/* ── Shared error toast helper (F2) ── */
function showErrorToast(error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error('Request failed', { description: message });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
        queryCache: new QueryCache({
          onError: (error) => showErrorToast(error),
        }),
        mutationCache: new MutationCache({
          onError: (error) => showErrorToast(error),
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
