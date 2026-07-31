/**
 * Phase 7.6: Revenue Intelligence — Barrel Export
 */

export * from './signal-patterns';
export * from './signal-extraction';
export * from './account-scoring';
export * from './account-brief';
export {
  type BriefFacts,
  extractBriefFacts,
  generateNarrative,
  generateAndPersistBrief,
  calculateBriefConfidence,
  getBrief as getTemplateBrief,
} from './brief-generator';
export * from './opportunity-radar';
export * from './executive-recommendations';