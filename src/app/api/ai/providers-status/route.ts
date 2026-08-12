import { NextRequest, NextResponse } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getAIConfig, getLLMChain, getSearchProvider } from '@/lib/ai-config'
import { logger } from '@/lib/logger'
import { withApiLogging } from '@/lib/api-logging-middleware'

/**
 * GET /api/ai/providers-status
 *
 * Lightweight endpoint for the chat sidebar to check AI provider connectivity.
 * Returns a simple list of providers with their availability status.
 * Also checks if the built-in Z.ai SDK is available as ultimate fallback.
 * The sidebar polls this on open and after each successful/failed AI call.
 */

async function getHandler(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  try {
    const config = await getAIConfig()
    const chain = await getLLMChain()
    const search = await getSearchProvider()

    const providers = Object.entries(config.providers).map(([id, provider]) => ({
      id,
      label: provider.label,
      category: provider.category,
      enabled: provider.enabled,
      hasKey: !!provider.apiKey && !provider.apiKey.startsWith('•'),
      status: provider.enabled && provider.apiKey && !provider.apiKey.startsWith('•') ? 'active' : 'inactive',
      tier: provider.tier,
    }))

    // Check Z.ai SDK availability (the built-in AI that always works)
    let zaiAvailable = false
    try {
      const { getZAI } = await import('@/lib/llm-client')
      const zai = await getZAI()
      zaiAvailable = !!zai
    } catch {
      zaiAvailable = false
    }

    const externalReady = chain.length > 0
    const overallReady = externalReady || zaiAvailable

    return NextResponse.json({
      success: true,
      providers,
      llmChainReady: externalReady,
      searchReady: !!search,
      zaiSdkAvailable: zaiAvailable,
      overallReady,
      activeSource: externalReady ? 'external' : (zaiAvailable ? 'zai-sdk' : 'none'),
    })
  } catch (err) {
    logger.error('[providers-status] Failed to load config:', { error: err instanceof Error ? err.message : err })
    return NextResponse.json({
      success: true,
      providers: [],
      llmChainReady: false,
      searchReady: false,
      zaiSdkAvailable: false,
      overallReady: false,
      activeSource: 'none',
    })
  }
}

export const GET = withApiLogging(getHandler, '/api/ai/providers-status');
