// ═══ Intelligence OS — Experience Pattern Components ═══
// These are NOT UI components. They are EXPERIENCE PATTERNS that
// embody the DeepMindQ Intelligence Design DNA.

export { IntelligenceNarrative, type IntelligenceNarrativeProps, type EvidenceItem, type NarrativeAction, type NarrativeVariant } from './intelligence-narrative';
export { IntelligenceCard, type IntelligenceCardProps, type CardVariant } from './intelligence-card';
export { EvidenceChain, type EvidenceChainProps, type EvidenceChainItem } from './evidence-chain';
export { IntelligencePanel, type IntelligencePanelProps, type IntelligencePanelSection } from './intelligence-panel';
export { ConfidenceIndicator, type ConfidenceIndicatorProps, type ConfidenceMode } from './confidence-indicator';
export { ActionCTA, type ActionCTAProps, type ActionVariant, type ActionPriority } from './action-cta';

// Design tokens — single source of truth
export { tokens, getConfidenceTier, getPriorityTier, spacing, radius, typography, motion, elevation } from './design-tokens';

// Existing components
export { ActivationWorkspace } from './activation-workspace';
export { CommandCenter } from './command-center';
export { CompanyWorkspace } from './company-workspace';
export { KnowledgeWorkspace } from './knowledge-workspace';
export { CapabilityWorkspace } from './capability-workspace';
export { IntelligenceBriefing } from './intelligence-briefing';
export { IntelligenceSearch } from './intelligence-search';
export { ProgressiveDisclosure } from './progressive-disclosure';
