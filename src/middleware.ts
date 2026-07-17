import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware: maps clean frontend URLs to the g-* group routes.
 *
 * Frontend calls:     /api/companies/123
 * Actual route:       /api/g-crm/companies/123
 *
 * This avoids changing 100+ fetch() calls across the codebase.
 */

// Map of clean prefix → group directory
const ROUTE_GROUPS: Record<string, string> = {
  // Auth (exact match prefix)
  'auth': 'g-auth/auth',

  // CRM
  'companies': 'g-crm/companies',
  'contacts': 'g-crm/contacts',
  'leads': 'g-crm/leads',
  'segments': 'g-crm/segments',
  'signals': 'g-crm/signals',
  'batches': 'g-crm/batches',
  'pipeline': 'g-crm/pipeline',
  'duplicates': 'g-crm/duplicates',
  'suppressions': 'g-crm/suppressions',
  'bounces': 'g-crm/bounces',

  // AI
  'ai': 'g-ai/ai',
  'research-agent': 'g-ai/research-agent',
  'command-center': 'g-ai/command-center',
  'knowledge': 'g-ai/knowledge',
  'capabilities': 'g-ai/capabilities',
  'conversation-plans': 'g-ai/conversation-plans',

  // Data
  'dashboard': 'g-data/dashboard',
  'analytics': 'g-data/analytics',
  'audit': 'g-data/audit',
  'audit-logs': 'g-data/audit-logs',
  'notifications': 'g-data/notifications',
  'ab-tests': 'g-data/ab-tests',
  'data-health': 'g-data/data-health',
  'stats': 'g-data/stats',
  'team': 'g-data/team',
  'compliance': 'g-data/compliance',

  // Outreach
  'sequences': 'g-outreach/sequences',
  'templates': 'g-outreach/templates',
  'drafts': 'g-outreach/drafts',
  'prompt-templates': 'g-outreach/prompt-templates',
  'queue': 'g-outreach/queue',
  'replies': 'g-outreach/replies',
  'tracking': 'g-outreach/tracking',
  'unsubscribe': 'g-outreach/unsubscribe',
  'verify-email': 'g-outreach/verify-email',
  'verify-queue': 'g-outreach/verify-queue',
  'email-worker': 'g-outreach/email-worker',
  'webhooks': 'g-outreach/webhooks',

  // Strategy
  'playbooks': 'g-strategy/playbooks',
  'strategy-room': 'g-strategy/strategy-room',

  // System
  'seed': 'g-system/seed',
  'settings': 'g-system/settings',
}

// Routes that exist directly (not under any g-* group) — skip rewrite
const DIRECT_ROUTES = new Set(['healthz', ''])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only handle /api/* paths
  if (!pathname.startsWith('/api/')) return

  // Extract the part after /api/
  const afterApi = pathname.slice(5) // e.g. "companies/123" or "auth/request-otp"

  // Find the longest matching prefix
  let bestMatch = ''
  let bestGroup = ''

  for (const [prefix, group] of Object.entries(ROUTE_GROUPS)) {
    if (afterApi === prefix || afterApi.startsWith(prefix + '/')) {
      if (prefix.length > bestMatch.length) {
        bestMatch = prefix
        bestGroup = group
      }
    }
  }

  // If we found a group mapping, rewrite to it
  if (bestGroup) {
    const rest = afterApi.slice(bestMatch.length) // e.g. "/123" or ""
    const newUrl = request.nextUrl.clone()
    newUrl.pathname = `/api/${bestGroup}${rest}`
    return NextResponse.rewrite(newUrl)
  }

  return
}

export const config = {
  matcher: '/api/:path*',
}