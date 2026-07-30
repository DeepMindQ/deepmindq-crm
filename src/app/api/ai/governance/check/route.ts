/**
 * GET /api/ai/governance/check
 *
 * Runtime governance introspection endpoint.
 * Returns the current state of AI governance:
 *   - All registered generation types with their thresholds
 *   - Recent audit entries (last 50)
 *   - Governance check summary (pass/fail counts)
 *   - ModelRouter health status
 *
 * Ticket 3: AI Governance Hardening
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/apiHelpers'
import { getGovernanceConfig, type GovernanceConfig } from '@/lib/ai-governance'
// eslint-disable-next-line no-ungoverned-llm/no-ungoverned-llm -- governance check endpoint needs health status
import { ModelRouter } from '@/lib/engines/model-router'

// Hardcoded list of all registered generation types (single source of truth mirrors GOVERNANCE_CONFIGS)
const ALL_GENERATION_TYPES = [
  'email_draft',
  'conversation_plan',
  'account_brief',
  'signal_analysis',
  'suggested_contacts',
  'enrichment',
  'insights',
  'opportunities',
  'recommendations',
  'score_leads',
  'pdf_report',
  'ppt_generation',
  'query_parsing',
  'summarize',
  'knowledge_enrichment',
  'command_center_query',
  'command_center_analysis',
  'research_agent_person',
  'ab_test_variant',
  'data_health_analysis',
  'playbook_generation',
  'strategy_generation',
  'chat',
  'relationship_memory',
  'research_extraction',
  'signal_detection',
  'workflow_email_generation',
] as const

interface GenerationTypeInfo {
  type: string
  config: GovernanceConfig
}

interface AuditSummary {
  total: number
  passed: number
  failed: number
  recentFailures: Array<{
    id: string
    generationType: string
    companyId: string | null
    governancePassed: boolean
    createdAt: string
    outputSummary: string | null
  }>
}

export async function GET(_request: NextRequest) {
  try {
    // 1. All generation type configs
    const generationTypes: GenerationTypeInfo[] = ALL_GENERATION_TYPES.map((type) => ({
      type,
      config: getGovernanceConfig(type),
    }))

    // 2. Recent audit summary (last 50 entries)
    const recentAudits = await db.aIGenerationAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        generationType: true,
        companyId: true,
        governancePassed: true,
        createdAt: true,
        outputSummary: true,
      },
    })

    const auditSummary: AuditSummary = {
      total: recentAudits.length,
      passed: recentAudits.filter((a) => a.governancePassed).length,
      failed: recentAudits.filter((a) => !a.governancePassed).length,
      recentFailures: recentAudits
        .filter((a) => !a.governancePassed)
        .slice(0, 10)
        .map((a) => ({
          id: a.id,
          generationType: a.generationType,
          companyId: a.companyId,
          governancePassed: a.governancePassed,
          createdAt: a.createdAt.toISOString(),
          outputSummary: a.outputSummary,
        })),
    }

    // 3. ModelRouter health
    const modelHealth = await ModelRouter.health()

    return apiSuccess({
      generationTypes,
      auditSummary,
      modelRouterHealth: modelHealth,
      promptVersion: 'v3-phase3-harden',
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Governance check failed'
    return apiError(message, 500)
  }
}
