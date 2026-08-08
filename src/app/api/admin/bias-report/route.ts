import { NextResponse } from 'next/server'
import { biasDetector } from '@/lib/bias-detector'

/**
 * GET /api/admin/bias-report
 *
 * Returns a comprehensive bias analysis report for AI scoring.
 * Analyzes score distributions across industries, company sizes, etc.
 * for statistically significant skew.
 */
export async function GET() {
  try {
    const report = await biasDetector.generateBiasReport()
    return NextResponse.json(report)
  } catch (error) {
    console.error('[API /admin/bias-report GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate bias report' },
      { status: 500 }
    )
  }
}
