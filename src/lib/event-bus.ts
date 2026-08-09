/**
 * Lightweight in-process event bus for SSE propagation.
 * When data changes (contact created, score updated, etc.),
 * API routes publish events here, and the SSE endpoint broadcasts them.
 */

import { logger } from '@/lib/logger';

type EventCallback = (_event: { type: string; data: unknown; timestamp: string }) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();
  private globalListeners = new Set<EventCallback>();
  private history: Array<{ type: string; data: unknown; timestamp: string }> = [];
  private readonly maxHistory = 100;

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on(type: string, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /** Subscribe to ALL events. Returns an unsubscribe function. */
  onAny(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /** Publish an event. */
  emit(type: string, data: unknown): void {
    const event = { type, data, timestamp: new Date().toISOString() };

    // Store in history
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    // Notify type-specific listeners (iterate a copy so unsubscribes mid-iteration are safe)
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const cb of [...typeListeners]) {
        try {
          cb(event);
        } catch (err) {
          logger.error(`[EventBus] Error in listener for "${type}":`, { error: err });
        }
      }
    }

    // Notify global listeners
    for (const cb of [...this.globalListeners]) {
      try {
        cb(event);
      } catch (err) {
        logger.error('[EventBus] Global listener error:', { error: err });
      }
    }
  }

  /** Get recent events, optionally filtered by type. */
  getRecent(type?: string, limit = 10): Array<{ type: string; data: unknown; timestamp: string }> {
    const filtered = type ? this.history.filter(e => e.type === type) : this.history;
    return filtered.slice(-limit);
  }

  /** Remove all listeners for a given event (useful for testing). */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.globalListeners.clear();
    }
  }

  /** Get count of listeners for an event. */
  listenerCount(event: string): number {
    return (this.listeners.get(event)?.size ?? 0) + this.globalListeners.size;
  }
}

/** Singleton event bus instance shared across the server. */
export const eventBus = new EventBus();
