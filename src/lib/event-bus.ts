// Auto-generated stub for event-bus
type Handler = (...args: unknown[]) => void; const bus = new Map<string, Set<Handler>>(); export const eventBus = { on(e: string, h: Handler) { if (!bus.has(e)) bus.set(e, new Set()); bus.get(e)!.add(h); }, off(e: string, h: Handler) { bus.get(e)?.delete(h); }, emit(e: string, ...args: unknown[]) { bus.get(e)?.forEach(h => h(...args)); } };
