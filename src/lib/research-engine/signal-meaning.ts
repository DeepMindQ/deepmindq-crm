/**
 * Signal Meaning Inference Engine (Track C-6)
 *
 * Rule-based inference: Signal attributes → buying stage implication.
 * No LLM dependency — pure deterministic mapping.
 *
 * Maps each (signalType, severity, impact) combination to a
 * meaningCategory that indicates the buyer's likely mindset
 * and purchasing stage.
 *
 * Meaning categories:
 *   budget_available       — Funding/secured budget signals buying capacity
 *   leadership_openness    — New leadership signals openness to change
 *   tech_dissatisfaction   — Tech change/migration signals dissatisfaction
 *   growth_pressure        — Expansion/hiring signals growth creating demand
 *   compliance_requirement — Regulatory/audit signals forced action
 *   vendor_evaluation      — Partnership/RFP signals active vendor search
 *   unknown                — Cannot determine meaning from attributes
 */

import { normalizeSignalType } from '@/lib/signal-types';

// ── Types ──

export type MeaningCategory =
  | 'budget_available'
  | 'leadership_openness'
  | 'tech_dissatisfaction'
  | 'growth_pressure'
  | 'compliance_requirement'
  | 'vendor_evaluation'
  | 'unknown';

export interface SignalMeaning {
  meaningCategory: MeaningCategory;
  confidence: number;        // 0-1 confidence in this classification
  buyingStageImplication: string;  // Human-readable explanation
  recommendedAction: string;       // Suggested intelligence action
}

// ── Inference Rules ──
// Ordered by specificity (most specific first).
// First matching rule wins.

interface InferenceRule {
  signalTypes: string[];
  severity?: string[];
  impact?: string[];
  meaning: MeaningCategory;
  confidence: number;
  implication: string;
  action: string;
}

const RULES: InferenceRule[] = [
  // ── Budget Available ──
  {
    signalTypes: ['funding'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'budget_available',
    confidence: 0.9,
    implication: 'Recent funding with high severity indicates newly available budget for strategic initiatives.',
    action: 'Prioritize for immediate outreach. Funding events create a 60-90 day engagement window.',
  },
  {
    signalTypes: ['funding'],
    impact: ['high', 'medium'],
    meaning: 'budget_available',
    confidence: 0.7,
    implication: 'Funding activity suggests budget availability, though timing may vary.',
    action: 'Include in near-term pipeline. Research funding earmarks for IT/services spend.',
  },

  // ── Leadership Openness ──
  {
    signalTypes: ['leadership_change'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'leadership_openness',
    confidence: 0.85,
    implication: 'New executive leadership signals openness to new vendor relationships and strategic changes.',
    action: 'Map new leadership background. New leaders typically evaluate vendors within first 90 days.',
  },
  {
    signalTypes: ['leadership_change'],
    meaning: 'leadership_openness',
    confidence: 0.65,
    implication: 'Leadership change creates potential for new engagement, though impact depends on role.',
    action: 'Monitor for follow-up signals. Cross-reference with capability alignment.',
  },

  // ── Tech Dissatisfaction ──
  {
    signalTypes: ['technology'],
    severity: ['high', 'critical'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.85,
    implication: 'High-severity technology change signals dissatisfaction with current stack or platform.',
    action: 'Position capabilities around migration/modernization. Reference similar transformation case studies.',
  },
  {
    signalTypes: ['technology'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.6,
    implication: 'Technology change signals potential dissatisfaction or evolution needs.',
    action: 'Assess tech stack overlap with capabilities. Match to relevant solutions.',
  },

  // ── Acquisition → Tech Dissatisfaction / Growth Pressure ──
  {
    signalTypes: ['acquisition'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.8,
    implication: 'Post-acquisition integration signals technology harmonization needs.',
    action: 'Position integration and consolidation capabilities. Reference post-merger IT harmonization case studies.',
  },
  {
    signalTypes: ['acquisition'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.6,
    implication: 'Acquisition activity may signal technology stack consolidation needs.',
    action: 'Assess integration complexity. Match to system consolidation and migration capabilities.',
  },

  // ── Regulatory → Compliance Requirement ──
  {
    signalTypes: ['regulatory'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'compliance_requirement',
    confidence: 0.9,
    implication: 'Regulatory signal with high impact indicates forced compliance action timeline.',
    action: 'Lead with compliance expertise and certifications. Emphasize audit-readiness and risk mitigation.',
  },
  {
    signalTypes: ['regulatory'],
    meaning: 'compliance_requirement',
    confidence: 0.7,
    implication: 'Regulatory activity suggests compliance-driven purchasing requirements.',
    action: 'Position compliance-as-code and automated audit capabilities.',
  },

  // ── Financial Pressure → Tech Dissatisfaction (cost optimization) ──
  {
    signalTypes: ['financial_pressure'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.75,
    implication: 'Financial pressure signals need for cost optimization, often driving technology consolidation.',
    action: 'Position cost-reduction and efficiency capabilities. Reference ROI-focused case studies.',
  },
  {
    signalTypes: ['financial_pressure'],
    meaning: 'tech_dissatisfaction',
    confidence: 0.5,
    implication: 'Financial pressure may create budget constraints but also urgency for efficiency gains.',
    action: 'Monitor for follow-up signals. Financial pressure can accelerate or delay purchasing decisions.',
  },

  // ── Growth Pressure ──
  {
    signalTypes: ['hiring'],
    severity: ['high'],
    impact: ['high'],
    meaning: 'growth_pressure',
    confidence: 0.8,
    implication: 'Aggressive hiring in technical roles signals growth pressure creating demand for services.',
    action: 'Research hiring roles for capability alignment. High-volume hiring often needs implementation support.',
  },
  {
    signalTypes: ['hiring'],
    meaning: 'growth_pressure',
    confidence: 0.6,
    implication: 'Hiring activity indicates growth that may create service demand.',
    action: 'Evaluate hiring patterns for capability relevance. IT/staff hiring suggests scaling needs.',
  },
  {
    signalTypes: ['expansion'],
    severity: ['high', 'critical'],
    impact: ['high'],
    meaning: 'growth_pressure',
    confidence: 0.8,
    implication: 'Major expansion (new markets, offices) creates urgent need for technology and services.',
    action: 'Align capabilities with expansion context. New markets often need localization/infrastructure support.',
  },
  {
    signalTypes: ['expansion'],
    meaning: 'growth_pressure',
    confidence: 0.55,
    implication: 'Expansion signals growth trajectory that may create future demand.',
    action: 'Monitor for follow-up signals. Expansion often precedes technology investment.',
  },

  // ── Vendor Evaluation ──
  {
    signalTypes: ['partnership'],
    severity: ['high'],
    impact: ['high'],
    meaning: 'vendor_evaluation',
    confidence: 0.8,
    implication: 'Strategic partnership activity signals active vendor evaluation and selection.',
    action: 'Research partnership scope for competitive positioning. May indicate RFP pipeline.',
  },
  {
    signalTypes: ['partnership'],
    meaning: 'vendor_evaluation',
    confidence: 0.55,
    implication: 'Partnership signals some level of vendor evaluation activity.',
    action: 'Monitor partnership scope. Could indicate ecosystem expansion needs.',
  },

  // ── Compliance Requirement ──
  // No specific signalType maps directly — inferred from RFP/opportunity types
  // This is handled by the opportunityType field on CompanySignal, not signalType

  // ── Product signals → Growth Pressure ──
  {
    signalTypes: ['product'],
    severity: ['high'],
    impact: ['high'],
    meaning: 'growth_pressure',
    confidence: 0.7,
    implication: 'Major product launch signals growth investment and potential need for supporting services.',
    action: 'Assess product-technology alignment. Product launches often need implementation partners.',
  },
  {
    signalTypes: ['product'],
    meaning: 'growth_pressure',
    confidence: 0.5,
    implication: 'Product activity indicates innovation investment.',
    action: 'Low priority — monitor for stronger signals.',
  },

  // ── Default: Unknown ──
  {
    signalTypes: ['news', 'mention'],
    meaning: 'unknown',
    confidence: 0.3,
    implication: 'General news/mention without specific buying signal attributes.',
    action: 'Monitor for follow-up signals before prioritizing.',
  },
];

// ── Opportunity Type Override ──
// CompanySignal.opportunityType can override meaningCategory for RFP/procurement signals.

const OPPORTUNITY_TYPE_OVERRIDES: Record<string, { meaning: MeaningCategory; confidence: number }> = {
  rfp: { meaning: 'vendor_evaluation', confidence: 0.95 },
  rfi: { meaning: 'vendor_evaluation', confidence: 0.9 },
  tender: { meaning: 'compliance_requirement', confidence: 0.9 },
  vendor_search: { meaning: 'vendor_evaluation', confidence: 0.85 },
  procurement: { meaning: 'compliance_requirement', confidence: 0.85 },
  tech_transformation: { meaning: 'tech_dissatisfaction', confidence: 0.8 },
  partner_requirement: { meaning: 'vendor_evaluation', confidence: 0.8 },
};

// ── Main Inference Function ──

export function inferSignalMeaning(params: {
  signalType: string;
  severity: string;
  impact: string;
  opportunityType?: string | null;
  title?: string;
  description?: string | null;
}): SignalMeaning {
  const { signalType: rawType, severity, impact, opportunityType, title, description } = params;
  const signalType = normalizeSignalType(rawType);

  // 1. Check opportunityType override first (highest priority)
  if (opportunityType) {
    const override = OPPORTUNITY_TYPE_OVERRIDES[opportunityType];
    if (override) {
      return {
        meaningCategory: override.meaning,
        confidence: override.confidence,
        buyingStageImplication: getImplication(override.meaning, opportunityType),
        recommendedAction: getAction(override.meaning),
      };
    }
  }

  // 2. Check title/description keywords for compliance signals
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  if (/(compliance|regulation|audit|gdpr|soc|hipaa|pci|sox|iso 27001)/.test(text)) {
    return {
      meaningCategory: 'compliance_requirement',
      confidence: 0.7,
      buyingStageImplication: 'Compliance/regulatory language in signal suggests forced action timeline.',
      recommendedAction: 'Position capabilities around compliance frameworks. Regulatory deadlines create urgency.',
    };
  }

  // 3. Rule-based matching
  for (const rule of RULES) {
    if (!rule.signalTypes.includes(signalType)) continue;
    if (rule.severity && !rule.severity.includes(severity)) continue;
    if (rule.impact && !rule.impact.includes(impact)) continue;

    return {
      meaningCategory: rule.meaning,
      confidence: rule.confidence,
      buyingStageImplication: rule.implication,
      recommendedAction: rule.action,
    };
  }

  // 4. Fallback
  return {
    meaningCategory: 'unknown',
    confidence: 0.2,
    buyingStageImplication: 'Signal does not match any known buying stage pattern.',
    recommendedAction: 'Monitor for corroborating signals before acting.',
  };
}

// ── Batch Inference for all signals ──

export interface BatchMeaningResult {
  updated: number;
  results: Array<{
    signalId: string;
    previousCategory: string | null;
    newCategory: MeaningCategory;
    confidence: number;
  }>;
}

/**
 * Infer meaning for all company signals that lack a meaningCategory.
 * Returns count of signals updated with their new categories.
 * Does NOT call the DB — caller handles persistence.
 */
export function batchInferMeaning(signals: Array<{
  id: string;
  signalType: string;
  severity: string;
  impact: string;
  opportunityType?: string | null;
  title: string;
  description?: string | null;
  meaningCategory?: string | null;
}>): BatchMeaningResult {
  const results: BatchMeaningResult['results'] = [];

  for (const signal of signals) {
    // Skip signals that already have a meaning category
    if (signal.meaningCategory && signal.meaningCategory !== 'unknown') continue;

    const meaning = inferSignalMeaning(signal);
    if (meaning.meaningCategory !== 'unknown' || !signal.meaningCategory) {
      results.push({
        signalId: signal.id,
        previousCategory: signal.meaningCategory || null,
        newCategory: meaning.meaningCategory,
        confidence: meaning.confidence,
      });
    }
  }

  return { updated: results.length, results };
}

// ── Helpers ──

function getImplication(meaning: MeaningCategory, context: string): string {
  const implications: Record<MeaningCategory, string> = {
    budget_available: `${context} signals active budget allocation — company is in a buying position.`,
    leadership_openness: `${context} indicates leadership change creating vendor evaluation window.`,
    tech_dissatisfaction: `${context} signals technology pain points requiring external expertise.`,
    growth_pressure: `${context} indicates growth creating operational demand for services.`,
    compliance_requirement: `${context} signals regulatory-driven action with fixed timelines.`,
    vendor_evaluation: `${context} confirms active vendor evaluation — company is in buying cycle.`,
    unknown: `${context} detected but buying stage unclear.`,
  };
  return implications[meaning] || implications.unknown;
}

function getAction(meaning: MeaningCategory): string {
  const actions: Record<MeaningCategory, string> = {
    budget_available: 'Prioritize for outreach within funding deployment window. Align pitch to funded initiative.',
    leadership_openness: 'Map new leader\'s background and priorities. Time outreach to first 90-day evaluation window.',
    tech_dissatisfaction: 'Position migration/modernization capabilities. Lead with relevant case studies and proof points.',
    growth_pressure: 'Align capabilities to scaling needs. Reference similar growth-stage engagement outcomes.',
    compliance_requirement: 'Lead with compliance expertise and certifications. Emphasize audit-readiness and risk mitigation.',
    vendor_evaluation: 'Engage immediately — company is actively evaluating vendors. Differentiate on capability depth.',
    unknown: 'Monitor for corroborating signals. Do not prioritize until stronger evidence emerges.',
  };
  return actions[meaning] || actions.unknown;
}