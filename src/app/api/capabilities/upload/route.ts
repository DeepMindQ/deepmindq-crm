import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   Document Upload → Text Extraction → AI Knowledge Generation
   
   Flow:
   1. Accept file (.txt, .md, .pdf, .docx) up to 5MB
   2. Extract raw text from the document
   3. Auto-generate structured knowledge assets using AI
   4. Save assets to the knowledge base (DB or in-memory fallback)
   5. Return extracted text + generated assets
   ═══════════════════════════════════════════════════ */

/* ── In-memory store for demo/fallback mode ── */
let inMemoryStore: Record<string, unknown>[] = [];

/* ── Text extraction functions ── */

function decodePdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const textParts: string[] = [];
  const content = new TextDecoder('latin1').decode(bytes);

  // Strategy 1: Text between parentheses in Tj operators
  const textObjRegex = /\(([^)]*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = textObjRegex.exec(content)) !== null) {
    const decoded = decodePdfString(match[1]);
    if (decoded.trim()) textParts.push(decoded);
  }

  // Strategy 2: Array-based text in TJ operators
  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(content)) !== null) {
    const innerTexts = match[1];
    const strMatches = innerTexts.matchAll(/\(([^)]*)\)\s*-?\d*\.?\d*/g);
    for (const sm of strMatches) {
      const decoded = decodePdfString(sm[1]);
      if (decoded.trim()) textParts.push(decoded);
    }
  }

  // Strategy 3: Broader search
  if (textParts.length === 0) {
    const broadTjRegex = /\(([^)]{1,200})\)/g;
    while ((match = broadTjRegex.exec(content)) !== null) {
      const decoded = decodePdfString(match[1]);
      if (decoded.trim() && decoded.trim().length > 1) {
        textParts.push(decoded);
      }
    }
  }

  const extracted = textParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!extracted) {
    return `[PDF text extraction limited for "${file.name}". The PDF structure could not be parsed. Please try a .txt or .md file for best results.]`;
  }
  return extracted;
}

async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const textParts: string[] = [];
  const wTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = wTagRegex.exec(content)) !== null) {
    if (m[1].trim()) textParts.push(m[1].trim());
  }

  if (textParts.length > 0) return textParts.join(' ');
  return `[DOCX text extraction limited for "${file.name}". Please try a .txt or .md file for best results.]`;
}

async function extractText(file: File): Promise<string> {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    const buffer = await file.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  } else if (ext === '.pdf') {
    return extractTextFromPdf(file);
  } else if (ext === '.docx') {
    return extractTextFromDocx(file);
  }
  throw new Error('Unsupported file type');
}

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
  // Try using z-ai-web-dev-sdk for AI extraction
  let ZAI: any;
  let aiAvailable = false;
  try {
    ZAI = (await import('z-ai-web-dev-sdk')).default;
    aiAvailable = true;
  } catch {
    // SDK not available, will use rule-based fallback
  }

  if (aiAvailable) {
    try {
      const zai = await ZAI.create();
      const truncatedText = text.length > 6000 ? text.slice(0, 6000) + '\n\n[...truncated...]' : text;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are a knowledge extraction engine. Given a document, extract structured knowledge assets for a B2B technology services company's knowledge base (like an AI/Cloud/Data consulting firm).

Analyze the document and extract one or more knowledge assets. Each asset should be one of these categories:
- "service_line" — A service or capability the company offers (e.g., "AI & Machine Learning", "Cloud Engineering")
- "case_study" — A specific client engagement or success story with measurable results
- "proof_point" — A statistical claim, metric, or evidence of capability (e.g., "150+ enterprise deployments")
- "objection_response" — Common customer objections and how to address them
- "cta" — A call-to-action template for outreach emails

For each asset, provide:
- title: Short descriptive title (5-10 words)
- summary: 1-2 sentence summary
- content: Full relevant text from the document for this asset
- category: One of: service_line, case_study, proof_point, objection_response, cta
- serviceLine: The service line this relates to (e.g., "AI & Machine Learning", "Cloud Engineering", "Data Engineering", "Digital Transformation", "Cybersecurity") or leave empty
- targetIndustries: Comma-separated list of relevant industries (e.g., "Financial Services, Healthcare") or leave empty
- targetRoles: Comma-separated list of target roles (e.g., "CTO, VP Engineering") or leave empty
- problems: Comma-separated list of problems this addresses or leave empty
- evidence: Key metrics, numbers, or proof points or leave empty

Also provide an overallSummary of the entire document.

CRITICAL: Respond with valid JSON only (no markdown fences, no extra text). Format:
{
  "overallSummary": "Brief summary of the entire document",
  "assets": [
    {
      "title": "...",
      "summary": "...",
      "content": "...",
      "category": "service_line",
      "serviceLine": "...",
      "targetIndustries": "...",
      "targetRoles": "...",
      "problems": "...",
      "evidence": "..."
    }
  ]
}

If the document doesn't clearly map to any of these categories, create at least one "service_line" asset with the document's main topic as the service line. Extract as many meaningful assets as you can find (up to 8).`,
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

  // Rule-based fallback: create a single service_line asset from the document
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

/* ── Save asset to DB or in-memory fallback ── */

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
}): Promise<Record<string, unknown>> {
  try {
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
      },
    });
    return saved as Record<string, unknown>;
  } catch (dbError) {
    console.error('DB save failed, using in-memory:', dbError);
    const saved = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...asset,
      isActive: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryStore.unshift(saved);
    return saved;
  }
}

/* ═══════════════════════════════════════════════════
   POST: Upload document → extract text → AI knowledge → save
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const autoGenerate = formData.get('autoGenerate') !== 'false'; // default true
    const category = (formData.get('category') as string) || 'service_line';
    const serviceLine = (formData.get('serviceLine') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedExtensions = ['.txt', '.md', '.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use .txt, .md, .pdf, or .docx' },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum 25MB allowed.' },
        { status: 400 }
      );
    }

    // Step 1: Extract text
    let extractedText = await extractText(file);

    // Clean up extracted text
    extractedText = extractedText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Step 2: If autoGenerate is enabled, use AI to extract knowledge assets
    let generatedAssets: Array<Record<string, unknown>> = [];
    let overallSummary = '';
    let aiExtractionUsed = false;

    if (autoGenerate && extractedText.length > 50) {
      try {
        const aiResult = await extractKnowledgeWithAI(extractedText, file.name);
        generatedAssets = aiResult.assets;
        overallSummary = aiResult.overallSummary;
        aiExtractionUsed = true;

        // Step 3: Save all generated assets to the knowledge base
        const savedAssets: Array<Record<string, unknown>> = [];
        for (const asset of generatedAssets) {
          // Override category/serviceLine if user specified them
          if (category && category !== 'auto') {
            asset.category = category;
          }
          if (serviceLine) {
            asset.serviceLine = serviceLine;
          }
          const saved = await saveAsset(asset as Parameters<typeof saveAsset>[0]);
          savedAssets.push(saved);
        }
        generatedAssets = savedAssets;
      } catch (err) {
        console.error('Knowledge generation failed:', err);
        // Still return the extracted text so user can manually create assets
      }
    }

    return NextResponse.json({
      success: true,
      extractedText,
      fileName: file.name,
      fileSize: file.size,
      wordCount,
      readingTime,
      aiExtractionUsed,
      overallSummary,
      assetsGenerated: generatedAssets.length,
      assets: generatedAssets,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ── GET: List in-memory assets (for demo mode coherence) ── */
export async function GET() {
  return NextResponse.json({ inMemoryCount: inMemoryStore.length });
}