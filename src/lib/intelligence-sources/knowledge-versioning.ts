/**
 * Sprint 2: Knowledge Versioning
 *
 * Full version history for KnowledgeEntry records.
 * Replaces the inline versioning in knowledge-fabric.ts with
 * proper snapshot-based version tracking via KnowledgeVersion records.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface VersionDiff {
  version1: { id: string; version: number; content: string };
  version2: { id: string; version: number; content: string };
  linesAdded: number;
  linesRemoved: number;
  contentChanged: boolean;
  summary: string;
}

export interface VersionSnapshot {
  id: string;
  knowledgeEntryId: string;
  version: number;
  content: string;
  changedFields: Record<string, boolean>;
  changeReason: string;
  changedBy: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the `changedFields` JSON column into a plain object.
 * Prisma stores `String` columns as strings, so the stored JSON needs parsing.
 */
function parseChangedFields(raw: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Create a version snapshot of the current state of a KnowledgeEntry.
 *
 * @param entryId  - The ID of the KnowledgeEntry to snapshot.
 * @param reason   - Human-readable reason for the snapshot.
 * @param changedBy - Identity of the actor causing the snapshot (defaults to "system").
 * @returns The newly created KnowledgeVersion record.
 * @throws Error if the entry does not exist.
 */
export async function createVersionSnapshot(
  entryId: string,
  reason: string,
  changedBy: string = 'system',
): Promise<VersionSnapshot> {
  const entry = await db.knowledgeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error(`KnowledgeEntry not found: ${entryId}`);
  }

  const version = await db.knowledgeVersion.create({
    data: {
      knowledgeEntryId: entry.id,
      version: entry.version,
      content: entry.content,
      changedFields: JSON.stringify({ content: true }),
      changeReason: reason,
      changedBy,
    },
  });

  return {
    id: version.id,
    knowledgeEntryId: version.knowledgeEntryId,
    version: version.version,
    content: version.content,
    changedFields: parseChangedFields(version.changedFields),
    changeReason: version.changeReason,
    changedBy: version.changedBy,
    createdAt: version.createdAt,
  };
}

/**
 * Atomically snapshot the current state and update a KnowledgeEntry with new content.
 *
 * This replaces the inline versioning previously handled in `updateKnowledgeEntry`
 * inside knowledge-fabric.ts. It creates a full snapshot *before* the update so no
 * history is lost.
 *
 * @param entryId    - The ID of the KnowledgeEntry to update.
 * @param newContent - The new content value.
 * @param reason     - Human-readable reason for the change.
 * @param changedBy  - Identity of the actor (defaults to "system").
 * @returns The updated entry and the version snapshot that was created beforehand.
 * @throws Error if the entry does not exist or if old/new content are identical.
 */
export async function createVersionOnUpdate(
  entryId: string,
  newContent: string,
  reason: string,
  changedBy: string = 'system',
): Promise<{ entry: any; version: VersionSnapshot }> {
  const existing = await db.knowledgeEntry.findUnique({
    where: { id: entryId },
  });

  if (!existing) {
    throw new Error(`KnowledgeEntry not found: ${entryId}`);
  }

  if (existing.content === newContent) {
    throw new Error(
      `New content is identical to current content for KnowledgeEntry: ${entryId}. No version created.`,
    );
  }

  // 1. Snapshot the current state *before* mutating.
  const snapshot = await createVersionSnapshot(entryId, reason, changedBy);

  // 2. Build the changedFields map for the snapshot.
  const changedFields: Record<string, boolean> = { content: true };
  // If the caller also intends to change subCategory or confidence in the future,
  // those can be added here. For now we only track content changes via this path.

  // Update the snapshot's changedFields to reflect what actually changed.
  await db.knowledgeVersion.update({
    where: { id: snapshot.id },
    data: {
      changedFields: JSON.stringify(changedFields),
    },
  });

  // 3. Update the entry itself.
  const entry = await db.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      content: newContent,
      previousValue: existing.content,
      changeReason: reason,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  return { entry, version: { ...snapshot, changedFields } };
}

/**
 * Retrieve the full version history for a KnowledgeEntry.
 *
 * @param entryId - The ID of the KnowledgeEntry.
 * @returns Array of version snapshots ordered newest-first (version DESC).
 * @throws Error if the entry does not exist.
 */
export async function getVersionHistory(entryId: string): Promise<VersionSnapshot[]> {
  const entry = await db.knowledgeEntry.findUnique({
    where: { id: entryId },
    select: { id: true },
  });

  if (!entry) {
    throw new Error(`KnowledgeEntry not found: ${entryId}`);
  }

  const versions = await db.knowledgeVersion.findMany({
    where: { knowledgeEntryId: entryId },
    orderBy: { version: 'desc' },
  });

  return versions.map((v) => ({
    id: v.id,
    knowledgeEntryId: v.knowledgeEntryId,
    version: v.version,
    content: v.content,
    changedFields: parseChangedFields(v.changedFields),
    changeReason: v.changeReason,
    changedBy: v.changedBy,
    createdAt: v.createdAt,
  }));
}

/**
 * Retrieve a specific version of a KnowledgeEntry.
 *
 * @param entryId - The ID of the KnowledgeEntry.
 * @param version - The version number to look up.
 * @returns The matching version snapshot, or null if not found.
 * @throws Error if the entry does not exist.
 */
export async function getVersion(
  entryId: string,
  version: number,
): Promise<VersionSnapshot | null> {
  const entry = await db.knowledgeEntry.findUnique({
    where: { id: entryId },
    select: { id: true },
  });

  if (!entry) {
    throw new Error(`KnowledgeEntry not found: ${entryId}`);
  }

  const v = await db.knowledgeVersion.findUnique({
    where: {
      knowledgeEntryId_version: {
        knowledgeEntryId: entryId,
        version,
      },
    },
  });

  if (!v) {
    return null;
  }

  return {
    id: v.id,
    knowledgeEntryId: v.knowledgeEntryId,
    version: v.version,
    content: v.content,
    changedFields: parseChangedFields(v.changedFields),
    changeReason: v.changeReason,
    changedBy: v.changedBy,
    createdAt: v.createdAt,
  };
}

/**
 * Compare two versions of a knowledge entry and produce a line-level diff.
 *
 * Uses a simple line-by-line comparison. Lines present only in version1 are
 * counted as removed; lines present only in version2 are counted as added.
 *
 * @param versionId1 - ID of the first KnowledgeVersion to compare.
 * @param versionId2 - ID of the second KnowledgeVersion to compare.
 * @returns A structured diff result.
 * @throws Error if either version does not exist.
 */
export async function compareVersions(
  versionId1: string,
  versionId2: string,
): Promise<VersionDiff> {
  const [v1, v2] = await Promise.all([
    db.knowledgeVersion.findUnique({ where: { id: versionId1 } }),
    db.knowledgeVersion.findUnique({ where: { id: versionId2 } }),
  ]);

  if (!v1) {
    throw new Error(`KnowledgeVersion not found: ${versionId1}`);
  }
  if (!v2) {
    throw new Error(`KnowledgeVersion not found: ${versionId2}`);
  }

  const lines1 = v1.content.split('\n');
  const lines2 = v2.content.split('\n');

  const set1 = new Set(lines1);
  const set2 = new Set(lines2);

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of lines2) {
    if (!set1.has(line)) {
      linesAdded++;
    }
  }

  for (const line of lines1) {
    if (!set2.has(line)) {
      linesRemoved++;
    }
  }

  const contentChanged = v1.content !== v2.content;

  const parts: string[] = [];
  if (linesAdded > 0) parts.push(`${linesAdded} line${linesAdded !== 1 ? 's' : ''} added`);
  if (linesRemoved > 0) parts.push(`${linesRemoved} line${linesRemoved !== 1 ? 's' : ''} removed`);
  const summary = parts.length > 0 ? parts.join(', ') : 'No changes';

  return {
    version1: { id: v1.id, version: v1.version, content: v1.content },
    version2: { id: v2.id, version: v2.version, content: v2.content },
    linesAdded,
    linesRemoved,
    contentChanged,
    summary,
  };
}

/**
 * Restore a KnowledgeEntry to a previous version's content.
 *
 * A snapshot of the *current* state is created before the restore so the
 * pre-restore content is not lost.
 *
 * @param versionId - The ID of the KnowledgeVersion to restore.
 * @param reason    - Human-readable reason for the restore.
 * @param changedBy - Identity of the actor (defaults to "system").
 * @returns The updated entry and the pre-restore version snapshot.
 * @throws Error if the version or its parent entry does not exist.
 */
export async function restoreVersion(
  versionId: string,
  reason: string,
  changedBy: string = 'system',
): Promise<{ entry: any; version: VersionSnapshot }> {
  const targetVersion = await db.knowledgeVersion.findUnique({
    where: { id: versionId },
  });

  if (!targetVersion) {
    throw new Error(`KnowledgeVersion not found: ${versionId}`);
  }

  const entry = await db.knowledgeEntry.findUnique({
    where: { id: targetVersion.knowledgeEntryId },
  });

  if (!entry) {
    throw new Error(
      `KnowledgeEntry not found for version ${versionId}: ${targetVersion.knowledgeEntryId}`,
    );
  }

  // 1. Snapshot the current state before restoring.
  const preRestoreSnapshot = await createVersionSnapshot(
    entry.id,
    reason,
    changedBy,
  );

  // 2. Update the entry to the target version's content.
  const updatedEntry = await db.knowledgeEntry.update({
    where: { id: entry.id },
    data: {
      content: targetVersion.content,
      previousValue: entry.content,
      changeReason: reason,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  return { entry: updatedEntry, version: preRestoreSnapshot };
}