/**
 * Phase I: AI Engine Integration Tests
 *
 * Tests the critical AI chat flow:
 *   1. Chat sidebar → /api/ai/chat-stream (SSE streaming)
 *   2. Provider status endpoint
 *   3. Multi-turn conversation structure
 *   4. CRM context injection
 *   5. Error handling and fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ──────────────────────────────────────────────────

// Mock ai-config
const mockChain = [
  { label: 'Test Provider', baseUrl: 'https://test.example.com/v1', apiKey: 'test-key', model: 'test-model', enabled: true, category: 'llm', tier: 'Free' }
]

vi.mock('@/lib/ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    providers: {
      test: { label: 'Test Provider', apiKey: 'tk...ey', baseUrl: 'https://test.example.com/v1', model: 'test-model', enabled: true, tier: 'Free', category: 'llm' }
    },
    llmPriority: ['test'],
    searchProvider: 'tavily',
  }),
  getLLMChain: vi.fn().mockResolvedValue(mockChain),
  getSearchProvider: vi.fn().mockResolvedValue(undefined),
  getAIConfigWithKeys: vi.fn().mockResolvedValue({
    providers: { test: { apiKey: 'test-key', baseUrl: 'https://test.example.com/v1', model: 'test-model', enabled: true } },
    llmPriority: ['test'],
    searchProvider: 'tavily',
  }),
}))

// Mock api-auth
vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn().mockResolvedValue({ errorResponse: null, session: { email: 'test@deepmindq.com' } }),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'co-1',
        rawName: 'Acme Corp',
        industry: 'Technology',
        domain: 'acme.com',
        website: 'https://acme.com',
        sizeRange: '50-200',
        country: 'US',
        location: 'San Francisco, CA',
        status: 'active',
        intelligenceScore: 78,
        contacts: [
          { rawName: 'Jane Doe', title: 'CTO', email: 'jane@acme.com', status: 'active' }
        ],
        researchCard: {
          businessOverview: 'AI-powered SaaS platform',
          techLandscape: 'React, Python, GCP',
          potentialChallenges: 'Scaling infrastructure',
          possibleOpportunities: 'Enterprise expansion',
        },
        timeline: [
          { eventType: 'Research Generated', createdAt: new Date().toISOString() }
        ],
      }),
    },
    contact: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ct-1',
        rawName: 'Jane Doe',
        title: 'CTO',
        email: 'jane@acme.com',
        emailHealth: 'valid',
        status: 'active',
        lastContactedAt: null,
        linkedinUrl: 'https://linkedin.com/in/janedoe',
        company: { rawName: 'Acme Corp' },
        drafts: [],
      }),
    },
    pursuit: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'po-1',
        status: 'qualified',
        notes: 'Enterprise deal',
        nextAction: 'Schedule demo',
        company: { rawName: 'Acme Corp' },
        opportunity: { opportunityTitle: 'Enterprise License' },
      }),
    },
  },
}))

// Mock api-logging-middleware
vi.mock('@/lib/api-logging-middleware', () => ({
  withApiLogging: (handler: unknown) => handler,
}))

// Mock apiHelpers
vi.mock('@/lib/apiHelpers', () => ({
  apiError: vi.fn().mockImplementation((msg: string) => {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}),
  apiSuccess: vi.fn().mockImplementation((data: unknown) => {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}),
  validateBody: vi.fn().mockImplementation((_schema: unknown, body: unknown) => body),
}))

// Mock validation-schemas
vi.mock('@/lib/validation-schemas', () => ({
  aiChatSchema: {},
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock ai-governance
const mockSSEStream = new ReadableStream<string>({
  start(controller) {
    controller.enqueue('event: chunk\ndata: "Hello"\n\n')
    controller.enqueue('event: chunk\ndata: " from"\n\n')
    controller.enqueue('event: chunk\ndata: " DeepMindQ"\n\n')
    controller.enqueue('event: done\ndata: ""\n\n')
    controller.close()
  },
})

vi.mock('@/lib/ai-governance', () => ({
  governedStreamAICall: vi.fn().mockResolvedValue({
    stream: mockSSEStream,
    governanceResult: {
      passed: true,
      canProceed: true,
      checks: {},
      overallMessage: 'OK',
      rejectionReason: null,
    },
    groundingNote: '',
    promptAddon: '',
  }),
  governedAICallAggregate: vi.fn().mockResolvedValue({
    success: true,
    response: 'AI response text',
    governanceResult: {
      passed: true,
      canProceed: true,
      checks: {},
      overallMessage: 'OK',
      rejectionReason: null,
    },
  }),
}))

// Mock ai-agent-loop (new tool-use system) — simulate agent loop that falls back to legacy
vi.mock('@/lib/ai-agent-loop', () => ({
  agentLoopWithTools: vi.fn().mockRejectedValue(new Error('Agent loop not available in test')),
  agentLoopZaiFallback: vi.fn(),
  TOOL_USE_SYSTEM_ADDON: '## Tool Use Instructions',
}))

// ── Tests ──────────────────────────────────────────────────────────────

describe('AI Engine — Chat Stream Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('chat-stream route', () => {
    it('should export POST handler', async () => {
      const mod = await import('@/app/api/ai/chat-stream/route')
      expect(mod.POST).toBeDefined()
      expect(typeof mod.POST).toBe('function')
    })

    it('should reject requests without messages', async () => {
      const { POST } = await import('@/app/api/ai/chat-stream/route')
      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('messages array is required')
    })

    it('should accept valid messages array', async () => {
      const { POST } = await import('@/app/api/ai/chat-stream/route')
      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    })

    it('should pass multi-turn conversation to governance', async () => {
      const { governedStreamAICall } = await import('@/lib/ai-governance')
      const { POST } = await import('@/app/api/ai/chat-stream/route')

      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'What companies do I have?' },
            { role: 'assistant', content: 'You have 5 companies.' },
            { role: 'user', content: 'Tell me about Acme Corp' },
          ],
        }),
      })
      await POST(req as any)

      expect(governedStreamAICall).toHaveBeenCalled()
      const callArgs = (governedStreamAICall as any).mock.calls[0][0]
      // The user prompt should contain the full conversation
      expect(callArgs.userPrompt).toContain('User: What companies do I have?')
      expect(callArgs.userPrompt).toContain('Assistant: You have 5 companies.')
      expect(callArgs.userPrompt).toContain('User: Tell me about Acme Corp')
    })

    it('should include CRM context when companyId provided', async () => {
      const { governedStreamAICall } = await import('@/lib/ai-governance')
      const { POST } = await import('@/app/api/ai/chat-stream/route')
      const { db } = await import('@/lib/db')

      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Summarize this company' }],
          context: { companyId: 'co-1' },
        }),
      })
      await POST(req as any)

      // DB should have been queried for company context
      expect(db.company.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'co-1' } })
      )

      // System prompt should include CRM context
      const callArgs = (governedStreamAICall as any).mock.calls[0][0]
      expect(callArgs.systemPrompt).toContain('Acme Corp')
      expect(callArgs.systemPrompt).toContain('Technology')
      expect(callArgs.systemPrompt).toContain('Jane Doe')
    })

    it('should include CRM context when contactId provided', async () => {
      const { POST } = await import('@/app/api/ai/chat-stream/route')
      const { db } = await import('@/lib/db')

      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Tell me about this contact' }],
          context: { contactId: 'ct-1' },
        }),
      })
      await POST(req as any)

      expect(db.contact.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ct-1' } })
      )
    })

    it('should use custom system message when provided', async () => {
      const { governedStreamAICall } = await import('@/lib/ai-governance')
      const { POST } = await import('@/app/api/ai/chat-stream/route')

      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a sales coach.' },
            { role: 'user', content: 'Give me advice' },
          ],
        }),
      })
      await POST(req as any)

      const callArgs = (governedStreamAICall as any).mock.calls[0][0]
      expect(callArgs.systemPrompt).toContain('You are a sales coach.')
    })

    it('should validate message structure', async () => {
      const { POST } = await import('@/app/api/ai/chat-stream/route')

      const req = new Request('http://localhost:3000/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 123 }],
        }),
      })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
    })
  })

  describe('providers-status endpoint', () => {
    it('should export GET handler', async () => {
      const mod = await import('@/app/api/ai/providers-status/route')
      expect(mod.GET).toBeDefined()
      expect(typeof mod.GET).toBe('function')
    })

    it('should return provider status with overallReady flag', async () => {
      const { GET } = await import('@/app/api/ai/providers-status/route')

      const req = new Request('http://localhost:3000/api/ai/providers-status')
      const res = await GET(req as any)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.overallReady).toBe(true)
      expect(data.llmChainReady).toBe(true)
      expect(Array.isArray(data.providers)).toBe(true)
      expect(data.providers.length).toBeGreaterThan(0)
    })

    it('should include provider labels and status', async () => {
      const { GET } = await import('@/app/api/ai/providers-status/route')

      const req = new Request('http://localhost:3000/api/ai/providers-status')
      const res = await GET(req as any)
      const data = await res.json()

      const provider = data.providers[0]
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('label')
      expect(provider).toHaveProperty('status')
      expect(['active', 'inactive']).toContain(provider.status)
    })
  })

  describe('non-streaming chat route (fallback)', () => {
    it('should still work for backward compatibility', async () => {
      const { POST } = await import('@/app/api/ai/chat/route')

      const req = new Request('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What are my hottest leads?',
        }),
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBeTruthy()
    })

    it('should include sources when context provided', async () => {
      const { POST } = await import('@/app/api/ai/chat/route')

      const req = new Request('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Summarize this company',
          context: { companyId: 'co-1' },
        }),
      })
      const res = await POST(req as any)
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.sources).toBeDefined()
      expect(data.sources).toContain('Company: Acme Corp')
    })
  })
})
