import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/docs
 *
 * Serves the OpenAPI 3.0 specification as YAML.
 * Cached for 1 hour via Cache-Control header.
 * No authentication required — the spec itself is public documentation.
 */
export async function GET() {
  try {
    const specPath = join(process.cwd(), 'openapi.yaml')
    const spec = readFileSync(specPath, 'utf-8')

    return new NextResponse(spec, {
      status: 200,
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'OpenAPI specification not found' },
      { status: 404 },
    )
  }
}
