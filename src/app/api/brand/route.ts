import { NextResponse } from 'next/server';
import { tokens } from '@/lib/design-tokens';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Public brand config endpoint — no auth required.
   Reads the brand section from the SystemSetting table.
   ═══════════════════════════════════════════════════ */

const DEFAULT_BRAND = {
  name: 'DeepMindQ',
  logoUrl: '',
  primaryColor: tokens.gold.mutedLight,
  secondaryColor: '#73b4c9',
} as const;

export type BrandConfig = typeof DEFAULT_BRAND;

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * GET /api/brand — returns the public brand configuration.
 * No authentication required. 60s cache-control header.
 */
export async function GET() {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: 'app_settings' },
    });

    let brand = { ...DEFAULT_BRAND };
    if (row) {
      const stored = JSON.parse(row.value || '{}');
      if (stored.brand && typeof stored.brand === 'object') {
        brand = { ...DEFAULT_BRAND, ...stored.brand } as BrandConfig;
      }
    }

    return NextResponse.json(brand, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch {
    // DB unavailable — return defaults
    return NextResponse.json({ ...DEFAULT_BRAND }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  }
}
