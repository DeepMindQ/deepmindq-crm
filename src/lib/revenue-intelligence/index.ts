// ── Phase 7.6: Revenue Intelligence — Barrel Export ──

export { matchSignalPatterns, getPrimaryCategory, DEFAULT_SIGNAL_PATTERNS, type SignalCategory, type SignalPattern, type PatternMatch } from './signal-patterns';
export { detectSignalsForCompany, detectSignalsForCompanies, analyzeSignals, persistDetectedSignals, type RawSignal, type DetectedSignal } from './signal-detector';
export { extractBriefFacts, generateNarrative, generateAndPersistBrief, getBrief, calculateBriefConfidence, type BriefFacts } from './brief-generator';
export { getGlobalOpportunityRadar, type OpportunityRadarItem } from './opportunity-radar';
export { calculateScore, classifyScore, calculateAndPersistScore, type ScoreBreakdown, type ScoreResult } from './account-scorer';
export { generateRecommendations, type Recommendation } from './recommendation-generator';
