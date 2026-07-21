/**
 * Evidence Source Reliability (Phase 6.1)
 *
 * Tracks per-domain reliability based on user feedback.
 * Used to weight evidence quality scoring.
 */

import { db } from '@/lib/db';

const DEFAULT_RELIABILITY = 0.5;

export async function getSourceReliability(domain: string): Promise<number> {
  const record = await db.evidenceSourceReliability.findUnique({
    where: { domain },
    select: { reliabilityScore: true },
  });
  return record?.reliabilityScore ?? DEFAULT_RELIABILITY;
}

export async function updateSourceReliability(
  domain: string,
  isCorrect: boolean,
): Promise<number> {
  const existing = await db.evidenceSourceReliability.findUnique({
    where: { domain },
  });

  const totalEvidence = (existing?.totalEvidence ?? 0) + 1;
  const validatedCorrect = (existing?.validatedCorrect ?? 0) + (isCorrect ? 1 : 0);
  const validatedIncorrect = (existing?.validatedIncorrect ?? 0) + (isCorrect ? 0 : 1);

  // Bayesian-inspired: start with prior of 0.5, update with evidence
  const totalValidated = validatedCorrect + validatedIncorrect;
  const reliabilityScore = totalValidated > 0
    ? (validatedCorrect + 1) / (totalValidated + 2) // Laplace smoothing
    : DEFAULT_RELIABILITY;

  await db.evidenceSourceReliability.upsert({
    where: { domain },
    create: {
      domain,
      totalEvidence,
      validatedCorrect,
      validatedIncorrect,
      reliabilityScore,
    },
    update: {
      totalEvidence,
      validatedCorrect,
      validatedIncorrect,
      reliabilityScore,
      lastUpdated: new Date(),
    },
  });

  return reliabilityScore;
}

export async function getReliabilityMultiplier(domain: string): Promise<number> {
  const reliability = await getSourceReliability(domain);
  // Scale reliability to a 0.5-1.0 multiplier range
  return 0.5 + (reliability * 0.5);
}

export async function getTopReliableSources(limit: number = 20): Promise<
  { domain: string; reliabilityScore: number; totalEvidence: number }[]
> {
  return db.evidenceSourceReliability.findMany({
    orderBy: { reliabilityScore: 'desc' },
    take: limit,
    select: { domain: true, reliabilityScore: true, totalEvidence: true },
  });
}

export async function getUnreliableSources(limit: number = 20): Promise<
  { domain: string; reliabilityScore: number; totalEvidence: number }[]
> {
  return db.evidenceSourceReliability.findMany({
    where: { totalEvidence: { gte: 3 } },
    orderBy: { reliabilityScore: 'asc' },
    take: limit,
    select: { domain: true, reliabilityScore: true, totalEvidence: true },
  });
}