import React from 'react';

export function ScreenStateWrapper({
  children,
  state,
}: {
  children: React.ReactNode;
  state?: string;
}) {
  return <>{children}</>;
}

export function useScreenState(_initial?: string) {
  return { state: 'loaded' as const };
}
