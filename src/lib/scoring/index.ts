/**
 * Scoring Engines — Barrel Export
 *
 * Re-exports all scoring engines from the @/lib/scoring module.
 */

// ── Data Completeness (Session 8 — Component 4.1) ──
export {
  DataCompletenessEngine,
  toGrade,
  type CompletenessResult,
  type CompletenessGrade,
  type ContactWithFields,
  type CompanyWithRelations,
  type DataGap,
  type DimensionScore,
  type EnrichmentPriority,
  type GapImportance,
  type PortfolioCompletenessReport,
  type SuggestedAction,
} from './data-completeness-engine';

// ── Opportunity Probability ──
export * from './opportunity-probability-engine';

// ── Buying Intent ──
export * from './buying-intent-engine';

// ── Freshness Ranking ──
export * from './freshness-ranking';

// ── Contact Influence ──
export * from './contact-influence-engine';

// ── Revenue Opportunity ──
export * from './revenue-opportunity-engine';
