/* ═══════════════════════════════════════════════════════════════
   Score Event Bus — in-process event emitter for score changes

   Events emitted:
     scoreUpdated     — { companyId, score, tier, breakdown }
     batchCompleted   — { totalProcessed, jobId }
     scoresReset      — { resetCount, companyIds? }

   Used by the batch compute engine and DELETE reset handlers
   to notify listeners (e.g. real-time UI updates, webhooks).
   ═══════════════════════════════════════════════════════════════ */

type EventCallback = (data: any) => void;

class ScoreEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: any): void {
    const subs = this.listeners.get(event);
    if (subs) {
      for (const cb of [...subs]) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[ScoreEventBus] Error in listener for "${event}":`, err);
        }
      }
    }
  }

  /** Remove all listeners for a specific event (or all events if no arg) */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const scoreEvents = new ScoreEventBus();
export type { ScoreEventBus, EventCallback };