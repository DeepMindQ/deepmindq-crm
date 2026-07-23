/**
 * Phase 7.5: Company Resolution Engine
 *
 * Resolves company name strings to existing Company records using a
 * tiered matching strategy with confidence scoring.
 *
 * Resolution scoring rules (locked):
 * - Domain match: 95%
 * - Exact company name match: 90%
 * - Alias match: 85%
 * - Partial name similarity: 70-80%
 * - No match: 0%
 *
 * Thresholds:
 * - >= 95%: auto resolve
 * - 70-94%: return candidates for user confirmation
 * - < 70%: create new unverified company
 */

import { db } from '@/lib/db';
import type { CompanyResolutionCandidate, ResolutionConfidence } from './types';

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function calculatePartialSimilarity(input: string, target: string): number {
  const normInput = normalizeForComparison(input);
  const normTarget = normalizeForComparison(target);

  // Check if one contains the other
  if (normTarget.includes(normInput) || normInput.includes(normTarget)) {
    return 0.8;
  }

  // Simple word overlap
  const inputWords = normInput.split(' ');
  const targetWords = normTarget.split(' ');
  const overlap = inputWords.filter((w) => targetWords.includes(w));
  if (overlap.length === 0) return 0;

  const score =
    (2 * overlap.length) / (inputWords.length + targetWords.length);
  return Math.min(0.8, Math.max(0.7, score));
}

export async function resolveCompany(
  inputName: string,
  inputDomain?: string
): Promise<{
  resolved: boolean;
  candidate?: CompanyResolutionCandidate;
  candidates?: CompanyResolutionCandidate[];
  needsNewCompany: boolean;
}> {
  // 1. Domain match (95%)
  if (inputDomain) {
    const domainMatch = await db.company.findFirst({
      where: { domain: inputDomain.toLowerCase() },
    });
    if (domainMatch) {
      return {
        resolved: true,
        candidate: {
          companyId: domainMatch.id,
          name: domainMatch.rawName,
          domain: domainMatch.domain ?? undefined,
          industry: domainMatch.industry ?? undefined,
          country: domainMatch.country ?? undefined,
          confidence: 0.95,
          matchType: 'domain_match',
        },
        needsNewCompany: false,
      };
    }
  }

  // 2. Fetch all companies for subsequent matching
  const normalizedName = normalizeForComparison(inputName);
  const allCompanies = await db.company.findMany({
    select: {
      id: true,
      rawName: true,
      normalizedName: true,
      domain: true,
      industry: true,
      country: true,
    },
  });

  // 3. Alias match (85%)
  for (const company of allCompanies) {
    const alias = await db.companyAlias.findFirst({
      where: {
        companyId: company.id,
        alias: { equals: inputName },
      },
    });
    if (alias) {
      return {
        resolved: true,
        candidate: {
          companyId: company.id,
          name: company.rawName,
          domain: company.domain ?? undefined,
          industry: company.industry ?? undefined,
          country: company.country ?? undefined,
          confidence: 0.85,
          matchType: 'alias_match',
        },
        needsNewCompany: false,
      };
    }
  }

  // 4. Exact normalized name match (90%)
  const exactMatch = allCompanies.find(
    (c) => normalizeForComparison(c.rawName) === normalizedName
  );
  if (exactMatch) {
    return {
      resolved: true,
      candidate: {
        companyId: exactMatch.id,
        name: exactMatch.rawName,
        domain: exactMatch.domain ?? undefined,
        industry: exactMatch.industry ?? undefined,
        country: exactMatch.country ?? undefined,
        confidence: 0.9,
        matchType: 'exact_name',
      },
      needsNewCompany: false,
    };
  }

  // 5. Partial name similarity (70-80%)
  const candidates: CompanyResolutionCandidate[] = [];
  for (const company of allCompanies) {
    const similarity = calculatePartialSimilarity(inputName, company.rawName);
    if (similarity >= 0.7) {
      candidates.push({
        companyId: company.id,
        name: company.rawName,
        domain: company.domain ?? undefined,
        industry: company.industry ?? undefined,
        country: company.country ?? undefined,
        confidence: Math.round(similarity * 100) / 100,
        matchType: 'partial_name' as ResolutionConfidence,
      });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const topCandidates = candidates.slice(0, 5);

  if (topCandidates.length > 0) {
    return { resolved: false, candidates: topCandidates, needsNewCompany: false };
  }

  // 6. No match
  return { resolved: false, needsNewCompany: true };
}

export async function confirmResolution(companyId: string, aliasInput: string) {
  // Store the alias used for resolution
  await db.companyAlias.create({
    data: { companyId, alias: aliasInput, source: 'resolution', confidence: 0.9 },
  });
  return db.company.findUnique({ where: { id: companyId } });
}

export async function createUnverifiedCompany(name: string, domain?: string) {
  const normalizedName = name.trim().toLowerCase();
  const company = await db.company.create({
    data: {
      rawName: name,
      normalizedName,
      domain: domain ?? null,
      source: 'intelligence_acquisition',
      status: 'prospect',
    },
  });
  // Create self-alias
  await db.companyAlias.create({
    data: { companyId: company.id, alias: name, source: 'resolution', confidence: 1.0 },
  });
  return company;
}