import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/capabilities/export
   C-10: Export all capabilities as JSON or CSV
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const capabilities = await db.capabilityAsset.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      const headers = [
        'id', 'title', 'summary', 'category', 'serviceLine',
        'targetIndustries', 'targetRoles', 'problems', 'evidence',
        'content', 'isActive', 'version', 'parentAssetId', 'tags',
        'createdAt', 'updatedAt',
      ];

      const rows = capabilities.map(c => {
        const row: Record<string, string> = {};
        for (const h of headers) {
          const val = (c as any)[h];
          if (val === null || val === undefined) {
            row[h] = '';
          } else if (typeof val === 'boolean') {
            row[h] = val ? 'true' : 'false';
          } else if (val instanceof Date) {
            row[h] = val.toISOString();
          } else {
            row[h] = String(val).replace(/"/g, '""');
          }
        }
        return headers.map(h => `"${row[h]}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="deepmindq-capabilities-${Date.now()}.csv"`,
        },
      });
    }

    // JSON format — with category breakdown
    const byCategory: Record<string, typeof capabilities> = {};
    for (const cap of capabilities) {
      const cat = cap.category || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(cap);
    }

    const exportData = {
      _meta: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        totalAssets: capabilities.length,
        categories: Object.keys(byCategory),
      },
      capabilities,
      byCategory,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="deepmindq-capabilities-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}