/**
 * Data Intelligence Engine — Public API
 *
 * This is the barrel export for the engine.
 * All consumers should import from this file.
 */

export { analyzeFile, createUploadJob, processChunk, getReviewSummary, getReviewRows, applyCorrections, commitUpload, cancelUpload, getUploadProgress, listUploads } from './engine';
export type { AnalyzeResult, ChunkProcessResult, ReviewRow, ReviewSummary, CommitResult } from './engine';

export { detectColumns, buildReverseMapping } from './column-detector';
export type { ColumnDetectionResult } from './column-detector';

export { validateRow, validateRows } from './validator';
export type { ValidationIssue } from './validator';

export { normalizeRow, getNormalizationCategories } from './normalizer';
export type { NormalizationResult } from './normalizer';

export { checkAgainstExisting, checkWithinBatch, invalidateDedupCache } from './deduplicator';
export type { DuplicateMatch, DedupResult } from './deduplicator';

export { scoreRowQuality, calculateAggregateScore } from './quality-scorer';
export type { QualityScore } from './quality-scorer';

export { suggestCorrections } from './correction-suggester';
export type { SuggestedCorrection } from './correction-suggester';

export {
  getColumnMappingRules, getValidationRules, getNormalizationMappings,
  getScoringWeights, getNormalizedValue, getNormalizationByCategory,
  getScoringByDimension, invalidateCache, TARGET_FIELDS
} from './config-store';
export type {
  ColumnMappingRuleConfig, ValidationRuleConfig,
  NormalizationMappingConfig, ScoringWeightConfig
} from './config-store';