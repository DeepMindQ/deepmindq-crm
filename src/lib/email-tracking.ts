// ── In-memory email tracking store (demo) ────────────────────────────
// In production, this would be a database table (e.g. EmailTrackingEvent).

export interface TrackingEvent {
  type: 'open' | 'click'
  timestamp: Date
  ip: string
  userAgent: string
  targetUrl?: string
}

export interface TrackingRecord {
  contactId: string
  draftId: string
  createdAt: Date
  events: TrackingEvent[]
}

const trackingStore = new Map<string, TrackingRecord>()

/** Register a new tracking event (called from the send route). */
export function registerTrackingEvent(
  eventId: string,
  contactId: string,
  draftId: string,
): void {
  trackingStore.set(eventId, {
    contactId,
    draftId,
    createdAt: new Date(),
    events: [],
  })
}

/** Record an open or click event. */
export function recordTrackingEvent(
  eventId: string,
  event: TrackingEvent,
): TrackingRecord | undefined {
  const record = trackingStore.get(eventId)
  if (record) {
    record.events.push(event)
  }
  return record
}

/** Retrieve a tracking record (useful for analytics). */
export function getTrackingRecord(eventId: string): TrackingRecord | undefined {
  return trackingStore.get(eventId)
}