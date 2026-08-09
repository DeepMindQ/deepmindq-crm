import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Map v1 paths to existing internal API handlers
const PATH_MAP: Record<string, string> = {
  'companies': '/api/companies',
  'contacts': '/api/contacts',
  'opportunities': '/api/opportunities',
  'signals': '/api/signals',
  'recommendations': '/api/recommendations',
  'pipeline': '/api/pipeline',
  'dashboard': '/api/dashboard',
  'scores': '/api/scoring',
  'notifications': '/api/notifications',
  'data-health': '/api/data-health',
}

async function proxyRequest(
  method: string,
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const path = segments.join('/')
  const basePath = path.split('/')[0]
  const id = path.split('/')[1]

  const targetBase = PATH_MAP[basePath]
  if (!targetBase) {
    return NextResponse.json(
      { error: 'Not found', version: 'v1', path },
      { status: 404 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const internalPath = id ? `${targetBase}/${id}` : targetBase
  const internalUrl = `${baseUrl}${internalPath}${request.nextUrl.search}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Forward authorization header if present
  const authHeader = request.headers.get('authorization')
  if (authHeader) headers['authorization'] = authHeader

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (method !== 'GET' && method !== 'HEAD') {
 try {
   const body = await request.json()
   fetchOptions.body = JSON.stringify(body)
 } catch {
   // No JSON body — that's fine for methods that don't require it
 }
  }

  try {
    const res = await fetch(internalUrl, fetchOptions)
    const data = await res.json()
    // Inject v1 metadata
    return NextResponse.json(
      { _meta: { apiVersion: 'v1.0.0', deprecated: false }, ...data },
      { status: res.status },
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal proxy error', version: 'v1' },
      { status: 502 },
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  return proxyRequest('GET', request, segments)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  return proxyRequest('POST', request, segments)
}
