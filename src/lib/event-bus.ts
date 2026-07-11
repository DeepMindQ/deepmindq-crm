// Simple in-memory event bus for SSE and inter-module communication.
// In production this would be replaced by Redis pub/sub or similar.

type Listener = (data: unknown) => void

class EventBus {
  private listeners = new Map<string, Set<Listener>>()

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /** Emit an event to all subscribers. */
  emit(event: string, data: unknown): void {
    const subs = this.listeners.get(event)
    if (subs) {
      // Iterate over a copy so that unsubscribe handlers called within
      // a listener don't mutate the Set while we're iterating it.
      for (const fn of [...subs]) {
        try {
          fn(data)
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err)
        }
      }
    }
  }

  /** Remove all listeners for a given event (useful for testing). */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /** Get count of listeners for an event. */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }
}

/** Singleton event bus instance shared across the server. */
export const eventBus = new EventBus()