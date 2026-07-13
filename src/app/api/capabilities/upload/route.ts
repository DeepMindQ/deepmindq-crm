import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { extractTextFromBuffer, computeContentHash } from '@/lib/doc-parsers';

/* ═══════════════════════════════════════════════════
   Document Upload → Text Extraction → AI Knowledge Generation
   
   C-04/C-05: Uses pdf-parse + mammoth with regex fallback
   C-06: SHA-256 content hash deduplication
   C-14: Multi-file upload support
   ═══════════════════════════════════════════════════ */

let inMemoryStore: Record<string, unknown>[] = [];

/* ── AI-powered knowledge extraction ── */
async function extractKnowledgeWithAI(text: string, fileName: string): Promise<{
  assets: Array<{
    title: string;
    summary: string;
    content: string;
    category: string;
    serviceLine: string;
    targetIndustries: string;
    targetRoles: string;
    problems: string;
    evidence: string;
  }>;
  overallSummary: string;
}> {
  let ZAI: any;
  let aiAvailable = false;
  try {
    ZAI = (await import('z-ai-web-dev-sdk')).default;
    aiAvailable = true;
  } catch { /* SDK not available */ }

  if (aiAvailable) {
    try {
      const zai = await ZAI.create();
      const truncatedText = text.length > 6000 ? text.slice(0, 6000) + '\n\n[...truncated...]' : text;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are a knowledge extraction engine. Given a document, extract structured knowledge assets for a B2B technology services company's knowledge base.

Analyze the document and extract one or more knowledge assets. Each asset should be one of these categories:
- "service_line" — A service or capability the company offers
- "case_study" — A specific client engagement or success story with measurable results
- "proof_point" — A statistical claim, metric, or evidence of capability
- "objection_response" — Common customer objections and how to address them
- "cta" — A call-to-action template for outreach emails

For each asset, provide:
- title: Short descriptive title (5-10 words)
- summary: 1-2 sentence summary
- content: Full relevant text from the document
- category: One of: service_line, case_study, proof_point, objection_response, cta
- serviceLine: Related service line or leave empty
- targetIndustries: Comma-separated or leave empty
- targetRoles: Comma-separated or leave empty
- problems: Comma-separated or leave empty
- evidence: Key metrics or leave empty
- overallSummary of the document

CRITICAL: Respond with valid JSON only (no markdown fences). Format:
{"overallSummary":"...","assets":[{"title":"...","summary":"...","content":"...","category":"service_line","serviceLine":"...","targetIndustries":"...","targetRoles":"...","problems":"...","evidence":"..."}]}

Extract up to 8 meaningful assets.`,
          },
          {
            role: 'user',
            content: `Extract knowledge assets from this document titled "${fileName}":\n\n${truncatedText}`,
          },
        ],
        thinking: { type: 'disabled' },
      });

      let aiResponse = completion.choices[0]?.message?.content || '';
      aiResponse = aiResponse.trim();
      if (aiResponse.startsWith('```')) {
        aiResponse = aiResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(aiResponse);
      if (parsed.assets && Array.isArray(parsed.assets) && parsed.assets.length > 0) {
        return {
          assets: parsed.assets.map((a: Record<string, unknown>) => ({
            title: String(a.title || 'Untitled'),
            summary: String(a.summary || ''),
            content: String(a.content || ''),
            category: ['service_line', 'case_study', 'proof_point', 'objection_response', 'cta'].includes(String(a.category)) ? String(a.category) : 'service_line',
            serviceLine: String(a.serviceLine || ''),
            targetIndustries: String(a.targetIndustries || ''),
            targetRoles: String(a.targetRoles || ''),
            problems: String(a.problems || ''),
            evidence: String(a.evidence || ''),
          })),
          overallSummary: String(parsed.overallSummary || ''),
        };
      }
    } catch (err) {
      console.error('AI extraction failed, falling back to rule-based:', err);
    }
  }

  // Rule-based fallback
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const summary = sentences.slice(0, 3).join('. ').trim() + (sentences.length > 3 ? '...' : '');

  return {
    overallSummary: summary,
    assets: [{
      title: nameWithoutExt,
      summary: summary.length > 300 ? summary.slice(0, 297) + '...' : summary,
      content: text.length > 3000 ? text.slice(0, 3000) : text,
      category: 'service_line',
      serviceLine: '',
      targetIndustries: '',
      targetRoles: '',
      problems: '',
      evidence: '',
    }],
  };
}

/* ── Save asset with dedup check (C-06) ── */
async function saveAsset(asset: {
  title: string;
  summary: string;
  content: string;
  category: string;
  serviceLine: string;
  targetIndustries: string;
  targetRoles: string;
  problems: string;
  evidence: string;
  contentHash?: string;
}): Promise<{ saved: Record<string, unknown>; duplicateOf?: string; merged?: boolean }> {
  const hash = asset.contentHash || computeContentHash(asset.content || asset.summary);

  try {
    // C-06: Check for existing duplicate by contentHash
    const existing = await db.capabilityAsset.findFirst({ where: { contentHash: hash } });
    if (existing) {
      // Merge: combine tags, keep higher version, update content if longer
      const existingTags: string[] = JSON.parse((existing as any).tags || '[]');
      const newContent = asset.content || '';
      const existingContent = (existing as any).content || '';
      const shouldUpdate = newContent.length > existingContent.length;

      const updatedTags = [...new Set(existingTags)]; // keep existing tags

      if (shouldUpdate) {
        await db.capabilityAsset.update({
          where: { id: (existing as any).id },
          data: {
            content: newContent,
            tags: JSON.stringify(updatedTags),
            version: ((existing as any).version || 1) + 1,
          },
        });
      }

      return {
        saved: existing as Record<string, unknown>,
        duplicateOf: (existing as any).id,
        merged: shouldUpdate,
      };
    }

    const saved = await db.capabilityAsset.create({
      data: {
        title: asset.title,
        summary: asset.summary,
        content: asset.content || null,
        category: asset.category,
        serviceLine: asset.serviceLine || null,
        targetIndustries: asset.targetIndustries || null,
        targetRoles: asset.targetRoles || null,
        problems: asset.problems || null,
        evidence: asset.evidence || null,
        isActive: true,
        contentHash: hash,
        version: 1,
      },
    });
    return { saved: saved as Record<string, unknown> };
  } catch (dbError) {
    console.error('DB save failed, using in-memory:', dbError);
    const saved = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...asset,
      isActive: true,
      version: 1,
      contentHash: hash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryStore.unshift(saved);
    return { saved };
  }
}

/* ── Process a single file ── */
async function processFile(file: File, autoGenerate: boolean, category: string, serviceLine: string) {
  const allowedExtensions = ['.txt', '.md', '.pdf', '.docx'];
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { fileName: file.name, error: 'Unsupported file type. Use .txt, .md, .pdf, or .docx' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { fileName: file.name, error: 'File too large. Maximum 25MB.' };
  }

  // Step 1: Extract text using new parsers (C-04/C-05)
  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText: string;
  try {
    extractedText = await extractTextFromBuffer(buffer, file.name);
  } catch (err) {
    return { fileName: file.name, error: `Text extraction failed: ${err instanceof Error ? err.message : 'Unknown'}` };
  }

  extractedText = extractedText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const contentHash = computeContentHash(extractedText);

  // Step 2: AI extraction if enabled
  let generatedAssets: Array<Record<string, unknown>> = [];
  let overallSummary = '';
  let aiExtractionUsed = false;
  let duplicates: Array<{ existingId: string; title: string }> = [];

  if (autoGenerate && extractedText.length > 50) {
    try {
      const aiResult = await extractKnowledgeWithAI(extractedText, file.name);
      generatedAssets = aiResult.assets;
      overallSummary = aiResult.overallSummary;
      aiExtractionUsed = true;

      // Save all generated assets with dedup
      const savedAssets: Array<Record<string, unknown>> = [];
      for (const asset of generatedAssets) {
        if (category && category !== 'auto') asset.category = category;
        if (serviceLine) asset.serviceLine = serviceLine;
        (asset as any).contentHash = contentHash;
        const result = await saveAsset(asset as Parameters<typeof saveAsset>[0]);
        if (result.duplicateOf) {
          duplicates.push({ existingId: result.duplicateOf, title: String(asset.title) });
        }
        savedAssets.push(result.saved);
      }
      generatedAssets = savedAssets;
    } catch (err) {
      console.error('Knowledge generation failed:', err);
    }
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    wordCount,
    readingTime,
    extractedText,
    contentHash,
    aiExtractionUsed,
    overallSummary,
    assetsGenerated: generatedAssets.length,
    assets: generatedAssets,
    duplicates,
    success: true,
  };
}

/* ═══════════════════════════════════════════════════
   POST: Upload document(s) → extract text → AI → save
   C-14: Supports multiple files via FormData
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const autoGenerate = formData.get('autoGenerate') !== 'false';
    const category = (formData.get('category') as string) || 'service_line';
    const serviceLine = (formData.get('serviceLine') as string) || '';

    // C-14: Support multiple files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'file' && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file(s) provided' }, { status: 400 });
    }

    // Process all files in parallel
    const results = await Promise.all(
      files.map(file => processFile(file, autoGenerate, category, serviceLine))
    );

    // For single file, return the same shape as before for backward compatibility
    if (files.length === 1) {
      const r = results[0];
      if (r.error) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      return NextResponse.json(r);
    }

    // Multi-file result
    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      totalAssetsGenerated: results.reduce((sum, r) => sum + ((r as any).assetsGenerated || 0), 0),
      results,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file(s): ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ inMemoryCount: inMemoryStore.length });
}