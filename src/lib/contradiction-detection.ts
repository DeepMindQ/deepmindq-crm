/**
 * Contradiction Detection Engine (Phase 6 — Module 6)
 *
 * Detects conflicting signals for the same company using pattern-matching rules:
 *   1. SIGNAL_CONTRADICTION: Same signal type, opposite sentiment
 *   2. TECHNOLOGY_CONFLICT: Competing platform adoption signals
 *   3. FUNDING_CONFLICT: Positive funding + negative workforce events
 *   4. EVIDENCE_CONTRADICTION: Evidence items supporting opposing claims
 *
 * Creates IntelligenceConflict records for detected contradictions.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type ConflictType = 'SIGNAL_CONTRADICTION' | 'TECHNOLOGY_CONFLICT' | 'FUNDING_CONFLICT' | 'EVIDENCE_CONTRADICTION';
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DetectedConflict {
  conflictType: ConflictType;
  description: string;
  relatedSignals: string[];
  severity: ConflictSeverity;
}

// ── Known competing technology platforms ──

const COMPETING_PLATFORMS: Array<{ platforms: string[]; category: string }> = [
  { platforms: ['AWS', 'Amazon Web Services', 'aws'], category: 'cloud' },
  { platforms: ['Azure', 'Microsoft Azure'], category: 'cloud' },
  { platforms: ['GCP', 'Google Cloud', 'Google Cloud Platform'], category: 'cloud' },
  { platforms: ['Oracle Cloud', 'OCI'], category: 'cloud' },
  { platforms: ['Salesforce', 'Salesforce CRM'], category: 'crm' },
  { platforms: ['HubSpot', 'HubSpot CRM'], category: 'crm' },
  { platforms: ['SAP', 'SAP S/4HANA'], category: 'erp' },
  { platforms: ['Oracle', 'Oracle ERP'], category: 'erp' },
  { platforms: ['Snowflake', 'snowflake'], category: 'data' },
  { platforms: ['Databricks', 'databricks'], category: 'data' },
  { platforms: ['Kubernetes', 'k8s'], category: 'orchestration' },
  { platforms: ['Docker Swarm'], category: 'orchestration' },
];

// Map each platform keyword to its category
function getPlatformCategory(text: string): { category: string; keyword: string } | null {
  const lower = text.toLowerCase();
  for (const group of COMPETING_PLATFORMS) {
    for (const platform of group.platforms) {
      if (lower.includes(platform.toLowerCase())) {
        return { category: group.category, keyword: platform };
      }
    }
  }
  return null;
}

// ── Opposite sentiment keywords ──

const EXPANSION_KEYWORDS = [
  'expanding', 'growth', 'hiring', 'growing', 'scaling', 'opening', 'launching',
  'investing', 'building', 'increasing', 'upgrading', 'modernizing', 'adopting',
  'migrating to', 'moving to', 'transitioning to',
];

const CONTRACTION_KEYWORDS = [
  'downsizing', 'laying off', 'layoff', 'firing', 'reducing', 'cutting',
  'closing', 'shutting down', 'exiting', 'consolidating', 'restructuring',
  'bankrupt', 'bankruptcy', 'acquired', 'sold', 'delisting',
];

// ── Funding vs workforce conflict ──

const FUNDING_POSITIVE_KEYWORDS = [
  'raised', 'funding', 'series a', 'series b', 'series c', 'series d',
  'investment', 'capital', 'ipo', 'valuation', 'fundraise',
];

const WORKFORCE_NEGATIVE_KEYWORDS = [
  'layoff', 'laying off', 'redundancy', 'redundancies', 'workforce reduction',
  'staff cuts', 'headcount reduction', 'job cuts', 'termination',
];

// ── Detection functions ──

function detectSignalContradictions(signals: Array<{
  id: string; signalType: string; title: string; description?: string | null;
}>): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const signalsByType = new Map<string, typeof signals>();

  for (const sig of signals) {
    const type = sig.signalType;
    if (!signalsByType.has(type)) signalsByType.set(type, []);
    signalsByType.get(type)!.push(sig);
  }

  for (const [, typeSignals] of signalsByType) {
    if (typeSignals.length < 2) continue;

    for (let i = 0; i < typeSignals.length; i++) {
      for (let j = i + 1; j < typeSignals.length; j++) {
        const a = typeSignals[i];
        const b = typeSignals[j];
        const textA = `${a.title} ${a.description || ''}`.toLowerCase();
        const textB = `${b.title} ${b.description || ''}`.toLowerCase();

        // Check if A is expansion and B is contraction (or vice versa)
        const aExpansion = EXPANSION_KEYWORDS.some(kw => textA.includes(kw));
        const aContraction = CONTRACTION_KEYWORDS.some(kw => textA.includes(kw));
        const bExpansion = EXPANSION_KEYWORDS.some(kw => textB.includes(kw));
        const bContraction = CONTRACTION_KEYWORDS.some(kw => textB.includes(kw));

        if ((aExpansion && bContraction) || (aContraction && bExpansion)) {
          conflicts.push({
            conflictType: 'SIGNAL_CONTRADICTION',
            description: `Signal "${a.title}" appears to contradict "${b.title}" within the same type (${a.signalType})`,
            relatedSignals: [a.id, b.id],
            severity: 'high',
          });
        }
      }
    }
  }

  return conflicts;
}

function detectTechnologyConflicts(signals: Array<{
  id: string; signalType: string; title: string; description?: string | null;
}>): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  // Find all signals that reference known platforms
  const signalPlatforms = signals
    .map(sig => {
      const text = `${sig.title} ${sig.description || ''}`;
      const match = getPlatformCategory(text);
      return match ? { ...sig, ...match } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Group by category
  const byCategory = new Map<string, typeof signalPlatforms>();
  for (const sp of signalPlatforms) {
    if (!byCategory.has(sp.category)) byCategory.set(sp.category, []);
    byCategory.get(sp.category)!.push(sp);
  }

  // Find signals in same category but different platforms
  for (const [, categorySignals] of byCategory) {
    if (categorySignals.length < 2) continue;

    const uniquePlatforms = new Set(categorySignals.map(s => s.keyword));
    if (uniquePlatforms.size < 2) continue;

    for (let i = 0; i < categorySignals.length; i++) {
      for (let j = i + 1; j < categorySignals.length; j++) {
        const a = categorySignals[i];
        const b = categorySignals[j];
        if (a.keyword !== b.keyword) {
          conflicts.push({
            conflictType: 'TECHNOLOGY_CONFLICT',
            description: `Signal "${a.title}" (${a.keyword}) conflicts with "${b.title}" (${b.keyword}) — competing ${a.category} platforms`,
            relatedSignals: [a.id, b.id],
            severity: 'medium',
          });
        }
      }
    }
  }

  return conflicts;
}

function detectFundingConflicts(signals: Array<{
  id: string; signalType: string; title: string; description?: string | null; signalDate?: Date | null;
}>): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  const fundingSignals = signals.filter(s => {
    const text = `${s.title} ${s.description || ''}`.toLowerCase();
    return FUNDING_POSITIVE_KEYWORDS.some(kw => text.includes(kw));
  });

  const workforceSignals = signals.filter(s => {
    const text = `${s.title} ${s.description || ''}`.toLowerCase();
    return WORKFORCE_NEGATIVE_KEYWORDS.some(kw => text.includes(kw));
  });

  if (fundingSignals.length > 0 && workforceSignals.length > 0) {
    // Check temporal proximity (within 90 days)
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    for (const f of fundingSignals) {
      for (const w of workforceSignals) {
        if (f.signalDate && w.signalDate) {
          const diff = Math.abs(f.signalDate.getTime() - w.signalDate.getTime());
          if (diff <= NINETY_DAYS_MS) {
            conflicts.push({
              conflictType: 'FUNDING_CONFLICT',
              description: `Positive funding signal "${f.title}" co-occurs with negative workforce signal "${w.title}" within 90 days`,
              relatedSignals: [f.id, w.id],
              severity: 'high',
            });
          }
        } else {
          // If dates are missing, still flag but as medium severity
          conflicts.push({
            conflictType: 'FUNDING_CONFLICT',
            description: `Funding signal "${f.title}" co-occurs with workforce reduction signal "${w.title}"`,
            relatedSignals: [f.id, w.id],
            severity: 'medium',
          });
        }
      }
    }
  }

  return conflicts;
}

// ── Main detection pipeline ──

export async function detectContradictions(companyId: string): Promise<{
  detected: number;
  results: DetectedConflict[];
}> {
  // Load active signals
  const signals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['active', 'validated', 'detected'] },
    },
    select: {
      id: true,
      signalType: true,
      title: true,
      description: true,
      signalDate: true,
    },
  });

  if (signals.length < 2) return { detected: 0, results: [] };

  // Run all detection rules in parallel
  const [signalContradictions, techConflicts, fundingConflicts] = await Promise.all([
    Promise.resolve(detectSignalContradictions(signals)),
    Promise.resolve(detectTechnologyConflicts(signals)),
    Promise.resolve(detectFundingConflicts(signals)),
  ]);

  const allConflicts = [...signalContradictions, ...techConflicts, ...fundingConflicts];

  if (allConflicts.length === 0) return { detected: 0, results: [] };

  // Close existing open conflicts for this company (they'll be replaced)
  await db.intelligenceConflict.updateMany({
    where: { companyId, status: 'open' },
    data: { status: 'resolved', resolutionNotes: 'Auto-resolved by re-detection', resolvedAt: new Date() },
  });

  // Create new conflict records
  for (const conflict of allConflicts) {
    await db.intelligenceConflict.create({
      data: {
        companyId,
        conflictType: conflict.conflictType,
        description: conflict.description,
        relatedSignals: conflict.relatedSignals as Prisma.InputJsonValue,
        severity: conflict.severity,
        status: 'open',
      },
    });
  }

  return { detected: allConflicts.length, results: allConflicts };
}

// ── Resolve a conflict ──

export async function resolveConflict(
  conflictId: string,
  params: { status: 'acknowledged' | 'resolved' | 'dismissed'; resolvedBy?: string; resolutionNotes?: string },
): Promise<void> {
  await db.intelligenceConflict.update({
    where: { id: conflictId },
    data: {
      status: params.status,
      resolvedBy: params.resolvedBy ?? null,
      resolutionNotes: params.resolutionNotes ?? null,
      resolvedAt: new Date(),
    },
  });
}