import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { computeContentHash } from '@/lib/doc-parsers';
import { CapabilityIntelligenceEngine } from '@/lib/capability-intelligence-engine';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   POST /api/capabilities/import
   C-10: Import capabilities from JSON or CSV
   ═══════════════════════════════════════════════════ */

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

const VALID_CATEGORIES = [
  'service_line', 'solution', 'accelerator', 'case_study', 'proof_point',
  'objection_response', 'cta', 'technology', 'industry_expertise',
  'whitepaper', 'blog', 'sales_deck', 'proposal_template', 'ip_platform',
  'certification', 'delivery_capability', 'messaging',
];

export async function POST(request: Request) {
  // Auth gate: authenticated users only for capability import
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const contentType = request.headers.get('content-type') || '';

    let assets: Array<Record<string, unknown>> = [];
    let source = 'unknown';

    if (contentType.includes('multipart/form-data')) {
      // File upload (JSON or CSV)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = new TextDecoder('utf-8').decode(buffer);

      if (file.name.endsWith('.csv')) {
        assets = parseCSV(text);
        source = 'csv';
      } else {
        const parsed = JSON.parse(text);
        // Support both { capabilities: [...] } and direct array
        assets = Array.isArray(parsed) ? parsed : (parsed.capabilities || parsed.assets || []);
        source = 'json';
      }
    } else {
      // JSON body
      const body = await request.json();
      assets = body.assets || body.capabilities || (Array.isArray(body) ? body : []);
      source = 'json';
    }

    if (!Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: 'No valid assets found in input' }, { status: 400 });
    }

    // Process each asset
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const skippedDetails: Array<{ title: string; reason: string }> = [];
    const errorDetails: Array<{ title: string; reason: string }> = [];

    for (const asset of assets) {
      try {
        const title = String(asset.title || '').trim();
        const summary = String(asset.summary || '').trim();
        const category = String(asset.category || 'service_line').trim();

        if (!title || !summary) {
          skipped++;
          skippedDetails.push({ title: title || 'Untitled', reason: 'Missing title or summary' });
          continue;
        }

        const validCategory = VALID_CATEGORIES.includes(category) ? category : 'service_line';

        // C-06: Check for duplicates by title+category
        const existing = await db.capabilityAsset.findFirst({
          where: { title, category: validCategory },
        });
        if (existing) {
          skipped++;
          skippedDetails.push({ title, reason: `Duplicate of existing asset ${existing.id}` });
          continue;
        }

        const content = String(asset.content || '');
        const hash = content ? computeContentHash(content) : null;

        const createdAsset = await db.capabilityAsset.create({
          data: {
            title,
            summary,
            category: validCategory,
            serviceLine: asset.serviceLine ? String(asset.serviceLine) : null,
            solution: asset.solution ? String(asset.solution) : null,
            accelerator: asset.accelerator ? String(asset.accelerator) : null,
            technology: asset.technology ? String(asset.technology) : null,
            industry: asset.industry ? String(asset.industry) : null,
            businessProblem: asset.businessProblem ? String(asset.businessProblem) : null,
            customerOutcome: asset.customerOutcome ? String(asset.customerOutcome) : null,
            differentiator: asset.differentiator ? String(asset.differentiator) : null,
            targetIndustries: asset.targetIndustries
              ? (typeof asset.targetIndustries === 'string' ? asset.targetIndustries : JSON.stringify(asset.targetIndustries))
              : null,
            targetRoles: asset.targetRoles
              ? (typeof asset.targetRoles === 'string' ? asset.targetRoles : JSON.stringify(asset.targetRoles))
              : null,
            problems: asset.problems ? String(asset.problems) : null,
            evidence: asset.evidence ? String(asset.evidence) : null,
            content: content || null,
            isActive: asset.isActive !== false,
            parentAssetId: asset.parentAssetId ? String(asset.parentAssetId) : null,
            tags: asset.tags ? (typeof asset.tags === 'string' ? asset.tags : JSON.stringify(asset.tags)) : null,
            contentHash: hash,
            version: 1,
          },
        });

        // Auto-embed so imported capabilities enter the vector index
        try {
          await CapabilityIntelligenceEngine.embedExisting(createdAsset.id);
        } catch { /* non-blocking: embedding failure doesn't prevent import */ }

        created++;
      } catch (err) {
        errors++;
        errorDetails.push({
          title: String(asset.title || 'Unknown'),
          reason: err instanceof Error ? err.message : 'Import error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      source,
      total: assets.length,
      created,
      skipped,
      errors,
      skippedDetails: skippedDetails.slice(0, 20),
      errorDetails: errorDetails.slice(0, 20),
    });
  } catch (error) {
    logger.error('Import error:', { error: error });
    return NextResponse.json(
      { error: 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}