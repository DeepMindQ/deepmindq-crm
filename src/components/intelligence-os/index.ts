// ═══ Intelligence OS — Experience Pattern Components ═══
// These are NOT UI components. They are EXPERIENCE PATTERNS that
// embody the DeepMindQ Intelligence Design DNA.

export { IntelligenceNarrative, type IntelligenceNarrativeProps, type EvidenceItem, type NarrativeAction, type NarrativeVariant, type RelatedSignal } from './intelligence-narrative';
export { useIntelligenceNarratives, type UseIntelligenceNarrativesOptions, type UseIntelligenceNarrativesReturn } from './use-intelligence-narratives';
export { IntelligenceCard, type IntelligenceCardProps, type CardVariant } from './intelligence-card';
export { EvidenceChain, type EvidenceChainProps, type EvidenceChainItem } from './evidence-chain';
export { IntelligencePanel, type IntelligencePanelProps, type IntelligencePanelSection } from './intelligence-panel';
export { ConfidenceIndicator, type ConfidenceIndicatorProps, type ConfidenceMode } from './confidence-indicator';
export { ActionCTA, type ActionCTAProps, type ActionVariant, type ActionPriority } from './action-cta';

// Design tokens — single source of truth
export { tokens, getConfidenceTier, getPriorityTier, spacing, radius, typography, motion, elevation } from './design-tokens';

// ── Phase 1B Extracted Components ──
export { HeroNarrative, type HeroNarrativeProps } from './hero-narrative';
export { StatusMetricsBar, type StatusMetricsBarProps, type StatusMetricsKPIs, type SystemHealth } from './status-metrics-bar';
export { IntelligenceQueue, type IntelligenceQueueProps } from './intelligence-queue';
export { ActionQueue, type ActionQueueProps, type ExtractedAction } from './action-queue';
export { InlineReasoning, type InlineReasoningProps } from './inline-reasoning';
export { AccountDeltaTracker, type AccountDeltaTrackerProps, type AccountDelta, type DeltaType } from './account-delta-tracker';

// Existing components
export { IntelligenceOperationsCenter } from './intelligence-operations-center';
export { ActivationWorkspace } from './activation-workspace';
export { CommandCenter } from './command-center';
export { CompanyWorkspace } from './company-workspace';
export { KnowledgeWorkspace } from './knowledge-workspace';
export { CapabilityWorkspace } from './capability-workspace';
export { IntelligenceBriefing } from './intelligence-briefing';
export { IntelligenceSearch } from './intelligence-search';
export { ProgressiveDisclosure } from './progressive-disclosure';

// ── MS8 Depth & Trust Components ──
// Types (imported for re-export convenience)
export type {
  TrustTier,
  EvidenceQuality,
  SourceCategory,
  SourceColorDomain,
  EvidenceChainItem as MS8EvidenceChainItem,
  EvidenceFootprint,
  ConfidenceFactorCategory,
  ConfidenceFactor,
  ConfidenceBreakdown as MS8ConfidenceBreakdown,
  VerificationStatus,
  EvidenceLayerData,
  ExplorationCard,
  AIContextBox,
  InvestigationPath,
  ExplorationLayerData,
  IntelligenceGrade,
  AccountTrustData,
  AccountIntelligenceTab,
  AccountSignalEntry,
} from '@/types/ms8-evidence';

export {
  TRUST_TIER_THRESHOLDS,
  SOURCE_CATEGORY_CONFIG,
  evidenceQualityToTrustTier,
  scoreToGrade,
  formatTrustScore,
  computeFreshnessLevel,
  buildSourceBreakdown,
  buildEvidenceFootprint,
} from '@/types/ms8-evidence';

// MS8 Layers
export { EvidenceLayer, type EvidenceLayerProps } from './layers/evidence-layer';
export { ExplorationLayer, type ExplorationLayerProps } from './layers/exploration-layer';

// MS8 Organisms
export { ConfidenceBreakdown, type ConfidenceBreakdownProps } from './confidence-breakdown';

// MS8 Screens
export { AccountIntelligenceScreen, type AccountIntelligenceScreenProps } from './account-intelligence-screen';
export { CompanyIntelligenceHeader, type CompanyIntelligenceHeaderProps } from './company-intelligence-header';
export { AccountTrustPanel, type AccountTrustPanelProps } from './screens/account-trust-panel';
export { SignalTimeline, type SignalTimelineProps } from './screens/signal-timeline';
