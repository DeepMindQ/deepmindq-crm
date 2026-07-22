/**
 * Intelligence Timeline — DeepMindQ Sprint 3
 *
 * Provides an activity/event timeline for all intelligence-related actions.
 * Every significant mutation (acquisition, merge, conflict, confidence change,
 * human review, connector run, alert, dedup, version restore, etc.) is recorded
 * as an immutable timeline entry so that operators can audit the full history
 * of intelligence lifecycle events per company and per entity.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Exported constants & types
// ---------------------------------------------------------------------------

/** Every valid event type that can appear on the intelligence timeline. */
export const TIMELINE_EVENT_TYPES = [
  'acquired',
  'merged',
  'conflict_detected',
  'conflict_resolved',
  'confidence_updated',
  'knowledge_updated',
  'knowledge_restored',
  'source_health_changed',
  'human_submitted',
  'human_approved',
  'human_rejected',
  'connector_created',
  'connector_run',
  'alert_triggered',
  'alert_resolved',
  'dedup_detected',
  'version_restored',
] as const;

/** Union type derived from the above constant array. */
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/** Input shape for creating a new timeline event. */
export interface TimelineEventInput {
  companyId: string;
  eventType: TimelineEventType | string;
  entityType?: string;
  entityId?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  actor?: string;
}

/** Filter & pagination options for company timeline queries. */
export interface TimelineFilters {
  eventType?: string;
  entityType?: string;
  actor?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Cursor: ISO date string — return events created *before* this time. */
  before?: string;
  /** Max events to return (default 30, max 100). */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 100;
const ENTITY_TIMELINE_LIMIT = 50;

/** Clamp a limit value between 1 and MAX_PAGE_LIMIT. */
function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || limit === null || isNaN(limit)) return fallback;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_LIMIT);
}

/** Safely serialise metadata to a JSON string. */
function serialiseMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return '{}';
  try {
    return JSON.stringify(metadata);
  } catch {
    return '{}';
  }
}

/** Parse the stored metadata JSON string into a plain object. */
function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// 1. logTimelineEvent
// ---------------------------------------------------------------------------

/**
 * Create a new timeline event for a company.
 *
 * Validates that the referenced company exists before inserting the record.
 *
 * @param input - The event payload (companyId, eventType, title, etc.)
 * @returns The created IntelligenceTimeline record
 * @throws {Error} If companyId is missing or the company does not exist
 */
export async function logTimelineEvent(
  input: TimelineEventInput,
): Promise<Prisma.IntelligenceTimelineGetPayload<{}>> {
  const { companyId, eventType, entityType, entityId, title, description, metadata, actor } =
    input;

  if (!companyId) {
    throw new Error('companyId is required to log a timeline event');
  }
  if (!eventType) {
    throw new Error('eventType is required to log a timeline event');
  }
  if (!title) {
    throw new Error('title is required to log a timeline event');
  }

  // Quick check — confirm the company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!company) {
    throw new Error(`Company with id "${companyId}" does not exist`);
  }

  const created = await db.intelligenceTimeline.create({
    data: {
      companyId,
      eventType,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      title,
      description: description ?? null,
      metadata: serialiseMetadata(metadata),
      actor: actor ?? null,
    },
  });

  return created;
}

// ---------------------------------------------------------------------------
// 2. getCompanyTimeline
// ---------------------------------------------------------------------------

/**
 * Retrieve a paginated, filterable timeline of events for a specific company.
 *
 * Supports cursor-based pagination (using `createdAt` as the cursor) as well
 * as optional filters for eventType, entityType, actor, and date range.
 *
 * @param companyId - The company whose timeline to fetch
 * @param filters   - Optional filters and pagination parameters
 * @returns An object containing the matched events (newest first) and the total
 *          number of events for the company (unfiltered by pagination)
 */
export async function getCompanyTimeline(
  companyId: string,
  filters?: TimelineFilters,
): Promise<{ events: Prisma.IntelligenceTimelineGetPayload<{}>[]; total: number }> {
  if (!companyId) {
    throw new Error('companyId is required');
  }

  const limit = clampLimit(filters?.limit, DEFAULT_PAGE_LIMIT);

  // Build the createdAt sub-filter separately so we can merge cleanly
  const createdAtFilter: Prisma.DateTimeFilter<'IntelligenceTimeline'> = {};

  if (filters?.dateFrom) {
    createdAtFilter.gte = filters.dateFrom;
  }
  if (filters?.dateTo) {
    createdAtFilter.lte = filters.dateTo;
  }

  // Cursor-based pagination: return events created *before* the cursor
  if (filters?.before) {
    const cursorDate = new Date(filters.before);
    if (!isNaN(cursorDate.getTime())) {
      createdAtFilter.lt = cursorDate;
    }
  }

  // Build the where clause incrementally
  const where: Prisma.IntelligenceTimelineWhereInput = { companyId };

  if (filters?.eventType) {
    where.eventType = filters.eventType;
  }
  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters?.actor) {
    where.actor = filters.actor;
  }

  // Only assign createdAt if we have at least one date constraint
  if (Object.keys(createdAtFilter).length > 0) {
    where.createdAt = createdAtFilter;
  }

  // Total count for the company (respects filters but not pagination)
  const [events, total] = await Promise.all([
    db.intelligenceTimeline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.intelligenceTimeline.count({ where }),
  ]);

  return { events, total };
}

// ---------------------------------------------------------------------------
// 3. getEntityTimeline
// ---------------------------------------------------------------------------

/**
 * Get all timeline events for a specific entity (e.g. an IntelligenceObject,
 * KnowledgeEntry, Connector, etc.).
 *
 * Events are returned newest-first, limited to 50 records.
 *
 * @param entityType - The type of entity (e.g. 'IntelligenceObject')
 * @param entityId   - The unique identifier of the entity
 * @returns Array of timeline events for the entity
 */
export async function getEntityTimeline(
  entityType: string,
  entityId: string,
): Promise<Prisma.IntelligenceTimelineGetPayload<{}>[]> {
  if (!entityType || !entityId) {
    throw new Error('entityType and entityId are both required');
  }

  return db.intelligenceTimeline.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: ENTITY_TIMELINE_LIMIT,
  });
}

// ---------------------------------------------------------------------------
// 4. getRecentEvents
// ---------------------------------------------------------------------------

/**
 * Get the most recent timeline events across **all** companies.
 *
 * Useful for a global activity feed / dashboard.  Each event includes the
 * associated company's id and rawName.
 *
 * @param limit - Maximum events to return (default 20, max 100)
 * @returns Array of timeline events with company info, newest first
 */
export async function getRecentEvents(
  limit?: number,
): Promise<
  (Prisma.IntelligenceTimelineGetPayload<{
    include: { company: { select: { id: true; rawName: true } } };
  }>)[]
> {
  const effectiveLimit = clampLimit(limit, 20);

  return db.intelligenceTimeline.findMany({
    include: {
      company: {
        select: { id: true, rawName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: effectiveLimit,
  });
}

// ---------------------------------------------------------------------------
// 5. deleteOldEvents
// ---------------------------------------------------------------------------

/**
 * Delete timeline events older than a given number of days.
 *
 * Runs inside a Prisma transaction for safety — either all qualifying events
 * are deleted or none are.
 *
 * @param daysOld - Events whose `createdAt` is older than this many days will
 *                  be removed
 * @returns The number of deleted events
 * @throws {Error} If daysOld is not a positive number
 */
export async function deleteOldEvents(daysOld: number): Promise<{ deleted: number }> {
  if (!daysOld || daysOld <= 0 || !isFinite(daysOld)) {
    throw new Error('daysOld must be a positive number');
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return db.$transaction(async (tx) => {
    // Count first so we can return the deleted count
    const count = await tx.intelligenceTimeline.count({
      where: { createdAt: { lt: cutoff } },
    });

    if (count === 0) {
      return { deleted: 0 };
    }

    await tx.intelligenceTimeline.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { deleted: count };
  });
}