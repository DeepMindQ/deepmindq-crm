// Stub for cold start loader

export function getPersistenceStartupReport() {
  return {
    loadedAt: new Date().toISOString(),
    loadDurationMs: 0,
    entriesLoaded: 0,
  };
}

export function getPersistenceStartupStatus(): string {
  return 'loaded';
}

export function isPersistenceDegraded(): boolean {
  return false;
}
