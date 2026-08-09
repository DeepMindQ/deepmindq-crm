/**
 * Intelligence Sources — Barrel Export
 *
 * Public API for the intelligence acquisition layer.
 * Import from '@/lib/intelligence-sources' to access types,
 * interfaces, base classes, and connector implementations.
 *
 * Phase 2: Removed dead modules (zero consumers):
 *   - acquisition-engine, adaptive-intelligence, analytics-dashboard
 *   - cross-account-propagation, evidence-lifecycle, knowledge-versioning
 *   - reasoning-engine (deleted in prior cleanup)
 *
// Retained: three-date-model, signal-type-mapping (have internal consumers)
 */

export * from './types';
export * from './connector-interface';
export * from './base-connector';
export { CsvConnector } from './connectors/csv-connector';
export { ExcelConnector } from './connectors/excel-connector';
export { WebsiteConnector } from './connectors/website-connector';
export { RssConnector } from './connectors/rss-connector';
export { CrunchbaseConnector, crunchbaseConnector } from './connectors/crunchbase-connector';
export { resolveCompany, confirmResolution, createUnverifiedCompany } from './company-resolution';
export { adaptToEvidence } from './evidence-adapter';
export * from './job-queue';
export * from './knowledge-fabric';

// Intelligence Fabric Layer
export * from './association-engine';
export * from './confidence-engine';

// Human Intelligence, Timeline, Scheduler, Alerts
export * from './human-intelligence';
export * from './intelligence-timeline';
export * from './connector-scheduler';
export * from './intelligence-alerts';

// Phase 2A: External Intelligence Collection & Classification
export { collectIntelligenceForCompany, collectIntelligenceBatch } from './external-intelligence-collector';
export type { IntelligenceCollectionResult, SearchResult, SearchProvider, CollectionOptions } from './external-intelligence-collector';
export { classifyEvidence, batchClassifyEvidence, buildReasoningChain, scoreSourceReliability } from './evidence-classifier';
export type { ClassifiedSignal, RawEvidenceInput } from './evidence-classifier';

// Phase 2B: Cross-Signal Correlation & AI Evidence Engine
export { detectCorrelations } from './cross-signal-correlation';
export type { CorrelationInsight, CorrelationPattern } from './cross-signal-correlation';
export { classifyEvidenceWithAI, batchClassifyEvidenceWithAI, classifyEvidenceRule } from './ai-evidence-engine';

// Phase 2C: Predictive Intelligence, Learning Loop, Cross-Account & Monitoring
export { generatePredictions } from './predictive-intelligence';
export type { IntelligencePrediction, PredictionType } from './predictive-intelligence';
export { recordSignalFeedback, computeLearningInsights } from './learning-loop';
export type { SignalFeedback, LearningInsight, FeedbackType } from './learning-loop';
export { detectCrossAccountPatterns } from './cross-account-intelligence';
export type { CrossAccountInsight, CrossAccountPattern } from './cross-account-intelligence';
export { runMonitoringCheck, runMonitoringBatch, runMonitoringBatchWithPersistence, runCrossAccountAnalysisWithPersistence, runPredictionBatchWithPersistence, runLearningLoopWithPersistence } from './autonomous-monitor';
export type { IntelligenceAlert, AlertSeverity, AlertType } from './autonomous-monitor';

// Signal Taxonomy Normalization
export {
  normalizeSignalType, normalizeType, normalizeSignalTypes, groupByCanonicalType,
  isCanonicalType, isLegacyType,
  CANONICAL_SIGNAL_TYPES,
} from './signal-type-mapping';
export type { CanonicalSignalType, TypeMappingResult } from './signal-type-mapping';

// Three-Date Evidence Model
export {
  buildThreeDateModel, getBestDateForFreshness, dateModelQuality,
  extractPublishedDateFromSnippet, extractDateFromUrl, serializeThreeDateModel,
} from './three-date-model';
export type { EvidenceDates } from './three-date-model';

// Mid-Market Intelligence Sensor
export { runMidMarketSensor } from './mid-market-sensor';
export type { SensorConfig } from './mid-market-sensor';
