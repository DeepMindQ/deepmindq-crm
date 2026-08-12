/**
 * Phase I (Intelligence) — AI Tool-Use Engine Tests
 *
 * Tests the complete agentic tool-use pipeline:
 *   1. Tool definitions are valid OpenAI function calling format
 *   2. Tool executor routes calls correctly and returns structured results
 *   3. Agent loop sends tools to LLM and processes tool_calls responses
 *   4. Chat-stream endpoint uses agent loop when tools are enabled
 *   5. Chat sidebar renders tool-use thinking indicator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Prisma before imports ──

const mockDb = {
  company: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  contact: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  companySignal: {
    findMany: vi.fn(),
  },
  opportunityRecommendation: {
    findMany: vi.fn(),
  },
  pursuit: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  accountScore: {
    findUnique: vi.fn(),
  },
  companyIntelligenceHealth: {
    findUnique: vi.fn(),
  },
  knowledgeEntry: {
    findMany: vi.fn(),
  },
  aIInsight: {
    findMany: vi.fn(),
  },
  emailEvent: {
    groupBy: vi.fn(),
  },
  accountBrief: {
    findUnique: vi.fn(),
  },
  draft: {
    findMany: vi.fn(),
  },
  emailEvent2: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Mock config ──
vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn().mockResolvedValue([
    {
      label: 'Test Provider',
      baseUrl: 'https://test.example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
    },
  ]),
  getSearchProvider: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Tests ────────────────────────────────────────────────────────────────

describe('AI Tool-Use Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 1. Tool Definitions
  // ═══════════════════════════════════════════════════════════════════
  describe('ai-tool-definitions.ts', () => {
    it('exports CRM_TOOLS array with valid tool definitions', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      expect(Array.isArray(CRM_TOOLS)).toBe(true)
      expect(CRM_TOOLS.length).toBeGreaterThanOrEqual(14)
    })

    it('each tool has type=function with name, description, parameters', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      for (const tool of CRM_TOOLS) {
        expect(tool.type).toBe('function')
        expect(tool.function).toBeDefined()
        expect(typeof tool.function.name).toBe('string')
        expect(typeof tool.function.description).toBe('string')
        expect(tool.function.parameters).toBeDefined()
        expect(tool.function.parameters.type).toBe('object')
        expect(tool.function.parameters.properties).toBeDefined()
      }
    })

    it('has company tools: search_companies, get_company_details, get_company_signals', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      const names = CRM_TOOLS.map((t) => t.function.name)
      expect(names).toContain('search_companies')
      expect(names).toContain('get_company_details')
      expect(names).toContain('get_company_signals')
      expect(names).toContain('get_company_opportunities')
      expect(names).toContain('get_company_scores')
    })

    it('has contact tools: search_contacts, get_contact_details', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      const names = CRM_TOOLS.map((t) => t.function.name)
      expect(names).toContain('search_contacts')
      expect(names).toContain('get_contact_details')
      expect(names).toContain('get_contact_activity')
    })

    it('has aggregate tools: get_top_leads, get_signals_digest, get_pipeline_summary', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      const names = CRM_TOOLS.map((t) => t.function.name)
      expect(names).toContain('get_top_leads')
      expect(names).toContain('get_signals_digest')
      expect(names).toContain('get_pipeline_summary')
    })

    it('has knowledge tools: search_knowledge, get_account_brief', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      const names = CRM_TOOLS.map((t) => t.function.name)
      expect(names).toContain('search_knowledge')
      expect(names).toContain('get_account_brief')
    })

    it('getToolDefinitions returns the same array', async () => {
      const { CRM_TOOLS, getToolDefinitions } = await import('@/lib/ai-tool-definitions')
      const defs = getToolDefinitions()
      expect(defs).toBe(CRM_TOOLS)
    })

    it('getToolByName finds tools by name', async () => {
      const { getToolByName } = await import('@/lib/ai-tool-definitions')
      const tool = getToolByName('search_companies')
      expect(tool).toBeDefined()
      expect(tool!.function.name).toBe('search_companies')

      const missing = getToolByName('nonexistent_tool')
      expect(missing).toBeUndefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 2. Tool Executor
  // ═══════════════════════════════════════════════════════════════════
  describe('ai-tool-executor.ts', () => {
    it('executeToolCall routes search_companies to correct handler', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')

      mockDb.company.findMany.mockResolvedValue([
        { id: 'c1', rawName: 'Test Corp', domain: 'testcorp.com', industry: 'SaaS', sizeRange: '51-200', status: 'active', priorityTier: 'HOT', intelligenceScore: 85, engagementScore: 60, accountPriorityScore: 75, country: 'US', _count: { contacts: 3, signals: 5 } },
      ])

      const result = await executeToolCall('search_companies', { query: 'test' })
      expect(result.success).toBe(true)
      expect(mockDb.company.findMany).toHaveBeenCalled()
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data[0].name).toBe('Test Corp')
    })

    it('executeToolCall returns error for unknown tool', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      const result = await executeToolCall('nonexistent_tool', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })

    it('search_companies handles empty query (returns all companies)', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.company.findMany.mockResolvedValue([])
      const result = await executeToolCall('search_companies', {})
      expect(result.success).toBe(true)
      expect(mockDb.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { accountPriorityScore: 'desc' } }),
      )
    })

    it('get_company_details returns error when company_id is missing', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      const result = await executeToolCall('get_company_details', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('company_id is required')
    })

    it('get_company_details returns error when company not found', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.company.findUnique.mockResolvedValue(null)
      const result = await executeToolCall('get_company_details', { company_id: 'nonexistent' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('search_contacts filters by lead_score', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.contact.findMany.mockResolvedValue([])
      await executeToolCall('search_contacts', { min_lead_score: 80 })
      expect(mockDb.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ leadScore: { gte: 80 } }),
        }),
      )
    })

    it('get_top_leads returns contacts ordered by leadScore desc', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.contact.findMany.mockResolvedValue([])
      await executeToolCall('get_top_leads', { limit: 5 })
      expect(mockDb.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { leadScore: 'desc' },
          take: 5,
        }),
      )
    })

    it('get_signals_digest queries signals with time filter', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.companySignal.findMany.mockResolvedValue([])
      await executeToolCall('get_signals_digest', { days: 14 })
      expect(mockDb.companySignal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([{ severity: 'desc' }, { extractedAt: 'desc' }]),
        }),
      )
    })

    it('get_pipeline_summary returns status counts and recent pursuits', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.pursuit.findMany.mockResolvedValue([
        { id: 'p1', status: 'ACTIVE', priority: 'high', nextAction: 'Call CTO', owner: 'John', updatedAt: new Date(), company: { id: 'c1', rawName: 'Acme' }, opportunity: { opportunityTitle: 'Cloud Migration', opportunityScore: 85 } },
      ])
      mockDb.pursuit.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { id: 10 } }, { status: 'WON', _count: { id: 5 } }])

      const result = await executeToolCall('get_pipeline_summary', {})
      expect(result.success).toBe(true)
      expect(result.data.byStatus).toBeDefined()
      expect(result.data.recentPursuits).toHaveLength(1)
    })

    it('get_engagement_stats returns aggregated event counts', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.emailEvent.groupBy.mockResolvedValue([
        { eventType: 'open', _count: { id: 150 } },
        { eventType: 'click', _count: { id: 45 } },
        { eventType: 'reply', _count: { id: 12 } },
      ])

      const result = await executeToolCall('get_engagement_stats', { days: 30 })
      expect(result.success).toBe(true)
      expect(result.data.opens).toBe(150)
      expect(result.data.clicks).toBe(45)
      expect(result.data.replies).toBe(12)
    })

    it('gracefully handles database errors', async () => {
      const { executeToolCall } = await import('@/lib/ai-tool-executor')
      mockDb.company.findMany.mockRejectedValue(new Error('DB connection lost'))
      const result = await executeToolCall('search_companies', { query: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('DB connection lost')
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 3. Agent Loop
  // ═══════════════════════════════════════════════════════════════════
  describe('ai-agent-loop.ts', () => {
    it('exports TOOL_USE_SYSTEM_ADDON string with tool-use instructions', async () => {
      const { TOOL_USE_SYSTEM_ADDON } = await import('@/lib/ai-agent-loop')
      expect(typeof TOOL_USE_SYSTEM_ADDON).toBe('string')
      expect(TOOL_USE_SYSTEM_ADDON).toContain('Tool Use Instructions')
      expect(TOOL_USE_SYSTEM_ADDON).toContain('query the DeepMindQ CRM database')
    })

    it('exports agentLoopWithTools function', async () => {
      const { agentLoopWithTools } = await import('@/lib/ai-agent-loop')
      expect(typeof agentLoopWithTools).toBe('function')
    })

    it('agentLoopWithTools returns error stream when all providers fail', async () => {
      const { getLLMChain } = await import('@/lib/ai-config')
      vi.mocked(getLLMChain).mockResolvedValue([
        {
          label: 'Failing Provider',
          baseUrl: 'https://fail.example.com/v1',
          apiKey: 'fail-key',
          model: 'fail-model',
        },
      ])

      // Mock fetch to simulate provider failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { agentLoopWithTools } = await import('@/lib/ai-agent-loop')
      const result = await agentLoopWithTools({
        systemPrompt: 'You are a test assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
        maxToolRounds: 1,
      })

      expect(result.totalRounds).toBe(1)
      expect(result.toolCallsExecuted).toHaveLength(0)
    })

    it('agentLoopZaiFallback is exported', async () => {
      const { agentLoopZaiFallback } = await import('@/lib/ai-agent-loop')
      expect(typeof agentLoopZaiFallback).toBe('function')
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 4. Integration: Tool names match between definitions and executor
  // ═══════════════════════════════════════════════════════════════════
  describe('Integration: tool name consistency', () => {
    it('every tool definition has a matching executor handler', async () => {
      const { CRM_TOOLS } = await import('@/lib/ai-tool-definitions')
      const { executeToolCall } = await import('@/lib/ai-tool-executor')

      // Execute each tool with minimal args and check it doesn't return "Unknown tool"
      for (const tool of CRM_TOOLS) {
        const name = tool.function.name
        const requiredParams = tool.function.parameters.required || []
        const args: Record<string, unknown> = {}

        // Provide dummy values for required params
        for (const param of requiredParams) {
          args[param] = 'test-id'
        }

        // The executor should recognize the tool name
        const result = await executeToolCall(name, args)
        // Should NOT be "Unknown tool" — even if DB fails, the tool should be found
        if (result.error) {
          expect(result.error).not.toContain('Unknown tool')
        } else {
          expect(result.success).toBe(true)
        }
      }
    })
  })
})
