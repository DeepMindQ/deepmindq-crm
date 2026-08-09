import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const V1_ENDPOINTS = [
  { path: '/api/v1/companies', methods: ['GET', 'POST'], description: 'Company CRUD' },
  { path: '/api/v1/contacts', methods: ['GET', 'POST'], description: 'Contact management' },
  { path: '/api/v1/opportunities', methods: ['GET', 'POST'], description: 'Opportunity pipeline' },
  { path: '/api/v1/signals', methods: ['GET'], description: 'AI signal intelligence' },
  { path: '/api/v1/recommendations', methods: ['GET'], description: 'AI recommendations' },
  { path: '/api/v1/pipeline', methods: ['GET'], description: 'Pipeline data' },
  { path: '/api/v1/dashboard', methods: ['GET'], description: 'Dashboard statistics' },
  { path: '/api/v1/scores', methods: ['GET', 'POST'], description: 'Company scoring' },
  { path: '/api/v1/notifications', methods: ['GET'], description: 'User notifications' },
  { path: '/api/v1/data-health', methods: ['GET'], description: 'Data quality metrics' },
]

export async function GET() {
  return NextResponse.json({
    version: '1.0.0',
    status: 'stable',
    released: '2025-01-15',
    deprecated: false,
    sunset: null,
    endpoints: V1_ENDPOINTS,
  })
}
