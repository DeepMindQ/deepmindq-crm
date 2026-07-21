import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { checkSyntax, checkDisposable, checkRoleBased, checkFreeProvider, scoreEmail } from '@/lib/email-verify';
import { logAction } from '@/lib/audit';
import { calculateLeadScore } from '@/lib/lead-scoring';

function sha256(str: string): string {
  return 'sha256:' + createHash('sha256').update(str).digest('hex');
}

function normalize(s: string | undefined | null): string {
  if (!s) return '';
  return s.trim().toLowerCase();
}

function normalizeTitle(s: string | undefined | null): string {
  if (!s) return '';
  return s.trim();
}

// Sanitize sizeRange to valid buckets (#27)
const VALID_SIZE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1,000', '1,001-5,000', '5,001-10,000', '10,001+'];
function sanitizeSizeRange(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (VALID_SIZE_RANGES.includes(trimmed)) return trimmed;
  const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return undefined;
  if (num <= 10) return '1-10';
  if (num <= 50) return '11-50';
  if (num <= 200) return '51-200';
  if (num <= 500) return '201-500';
  if (num <= 1000) return '501-1,000';
  if (num <= 5000) return '1,001-5,000';
  if (num <= 10000) return '5,001-10,000';
  return '10,001+';
}

// Map common column headers to internal fields
function guessMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const low = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/^(name|fullname|contactname|personname)$/.test(low)) map[h] = 'name';
    else if (/^(email|emailaddress|email_address|mailto)$/.test(low)) map[h] = 'email';
    else if (/^(company|companyname|organization|org|account|firm)$/.test(low)) map[h] = 'company';
    else if (/^(title|jobtitle|job_title|role|position|designation)$/.test(low)) map[h] = 'title';
    else if (/^(phone|telephone|tel|mobile|phonenumber)$/.test(low)) map[h] = 'phone';
    else if (/^(linkedin|linkedinurl|linkedin_url|li)$/.test(low)) map[h] = 'linkedin';
    else if (/^(location|city|country|address)$/.test(low)) map[h] = 'location';
    else if (/^(industry|sector|vertical)$/.test(low)) map[h] = 'industry';
    else if (/^(size|employees|count|staff|headcount|company_size|noofemployees)$/.test(low)) map[h] = 'size';
    else if (/^(website|url|web|site)$/.test(low)) map[h] = 'website';
    else if (/^(domain)$/.test(low)) map[h] = 'domain';
  }
  return map;
}

// Simple fuzzy score for company name matching
function companyMatchScore(a: string, b: string): number {
  if (a === b) return 100;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 95;
  if (na.includes(nb) || nb.includes(na)) return 70;
  const wordsA = na.split(/[\s,.-]+/).filter(Boolean);
  const wordsB = nb.split(/[\s,.-]+/).filter(Boolean);
  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
  if (overlap.length > 0) return Math.round((overlap.length / Math.max(wordsA.length, wordsB.length)) * 60);
  return 0;
}

/* In-memory progress tracker for chunked processing */
const batchProgress = new Map<string, {
  status: string;
  processedRows: number;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  startedAt: number;
  cancelled: boolean;
  consentSource?: string;
  source?: string;
  consentIp?: string;
  newContactIds: string[];
}>();

const CHUNK_SIZE = 100;
const LARGE_FILE_THRESHOLD = 500;

export async function GET() {
  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Batches error:', error);
    return NextResponse.json({ error: 'Failed to load batches' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   Process a single chunk of rows (shared logic)
   ═══════════════════════════════════════════════════ */
async function processChunk(
  rows: Record<string, unknown>[],
  reverseMap: Record<string, string>,
  batchId: string,
  companyIdCache: Map<string, string>,
  existingCompanies: any[],
  progress: NonNullable<ReturnType<typeof batchProgress.get>>
): Promise<{ accepted: number; duplicates: number; invalid: number; newContactIds: string[] }> {
  let accepted = 0;
  let duplicates = 0;
  let invalid = 0;
  const newContactIds: string[] = [];

  for (const row of rows) {
    if (progress.cancelled) break;

    const rawName = String(row[reverseMap['name'] || ''] || '').trim();
    const rawEmail = String(row[reverseMap['email'] || ''] || '').trim();
    const rawCompany = String(row[reverseMap['company'] || ''] || '').trim();
    const rawTitle = String(row[reverseMap['title'] || ''] || '').trim();
    const rawPhone = String(row[reverseMap['phone'] || ''] || '').trim();
    const rawLinkedin = String(row[reverseMap['linkedin'] || ''] || '').trim();
    const rawLocation = String(row[reverseMap['location'] || ''] || '').trim();
    const rawIndustry = String(row[reverseMap['industry'] || ''] || '').trim();
    const rawSize = String(row[reverseMap['size'] || ''] || '').trim();

    if (!rawName && !rawEmail) { invalid++; continue; }
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) { invalid++; continue; }

    if (rawEmail) {
      const existingEmail = await db.contact.findFirst({ where: { email: rawEmail } });
      if (existingEmail) { duplicates++; continue; }
    }

    let companyId: string | undefined;
    const normalizedName = normalize(rawCompany);

    if (normalizedName) {
      const cached = companyIdCache.get(normalizedName);
      if (cached) {
        companyId = cached;
      } else {
        let bestMatch = '';
        let bestScore = 0;
        for (const ec of existingCompanies) {
          const score = companyMatchScore(ec.rawName, rawCompany);
          if (score > bestScore) { bestScore = score; bestMatch = ec.id; }
        }
        if (bestScore >= 70 && bestMatch) {
          companyId = bestMatch;
          companyIdCache.set(normalizedName!, companyId);
        } else {
          const newCompany = await db.company.create({
            data: {
              rawName: rawCompany, normalizedName,
              domain: rawEmail ? rawEmail.split('@')[1] : undefined,
              industry: rawIndustry || undefined,
              sizeRange: sanitizeSizeRange(rawSize),
              location: rawLocation || undefined,
            },
          });
          companyId = newCompany.id;
          companyIdCache.set(normalizedName!, companyId!);
          existingCompanies.push(newCompany);
        }
      }
    } else {
      const placeholderName = rawEmail ? rawEmail.split('@')[1] || 'Unknown' : 'Unknown';
      const phNorm = normalize(placeholderName);
      const cached = companyIdCache.get(phNorm);
      if (cached) { companyId = cached; }
      else {
        const newCompany = await db.company.create({
          data: { rawName: placeholderName, normalizedName: phNorm, domain: rawEmail ? rawEmail.split('@')[1] : undefined },
        });
        companyId = newCompany.id;
        companyIdCache.set(phNorm!, companyId!);
        existingCompanies.push(newCompany);
      }
    }

    const titleLower = rawTitle.toLowerCase();
    let roleBucket = 'other';
    if (/^(ceo|cto|cfo|coo|cmo|cpo|ciso|vp|svp|evp|president|director|head|chief)/.test(titleLower)) roleBucket = 'executive';
    else if (/^(manager|lead|principal|senior|staff|sr\.|sr )/.test(titleLower)) roleBucket = 'manager';
    else if (/^(engineer|developer|architect|scientist|analyst|programmer|devops|sre|data)/.test(titleLower)) roleBucket = 'technical';

    const emailResult = rawEmail ? scoreEmail(rawEmail) : { health: 'unknown', score: 0, issues: [] };

    // L-02: Use advanced lead scoring model
    const leadScoreResult = calculateLeadScore({
      title: rawTitle,
      role: roleBucket,
      emailHealth: emailResult.health,
      emailHealthScore: emailResult.score,
      linkedinUrl: rawLinkedin,
      phone: rawPhone,
      location: rawLocation,
      company: {
        industry: rawIndustry,
        sizeRange: undefined,
        researchCard: null,
      },
    });
    const leadScore = leadScoreResult.total;

    const contact = await db.contact.create({
      data: {
        rawName: rawName || 'Unknown',
        normalizedName: normalize(rawName) || 'unknown',
        email: rawEmail || undefined,
        title: rawTitle || undefined,
        role: roleBucket,
        phone: rawPhone || undefined,
        linkedinUrl: rawLinkedin || undefined,
        location: rawLocation || undefined,
        companyId,
        batchId: batchId,
        status: 'imported',
        emailHealth: emailResult.health,
        emailHealthScore: emailResult.score,
        leadScore,
        consentStatus: 'unknown',
        consentSource: progress.consentSource,
        consentDate: new Date(),
        consentIp: progress.consentIp,
        source: progress.source,
      },
    });
    newContactIds.push(contact.id);
    accepted++;
  }

  return { accepted, duplicates, invalid, newContactIds };
}

/* ═══════════════════════════════════════════════════
   POST /api/batches — Upload & import
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const consentSource = (formData.get('consentSource') as string) || 'manual_upload';
    const source = (formData.get('source') as string) || 'manual';
    const consentIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    // L-08: Accept custom mapping override
    const customMappingStr = formData.get('mapping') as string | null;
    let customMapping: Record<string, string> | null = null;
    if (customMappingStr) {
      try { customMapping = JSON.parse(customMappingStr); } catch { /* ignore invalid custom mapping JSON */ }
    }

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB allowed.` },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      return NextResponse.json({ error: 'Failed to parse file.' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    // L-08: Use custom mapping if provided, otherwise auto-detect
    const mapping = customMapping || guessMapping(headers);
    const hasName = Object.values(mapping).includes('name');
    const hasEmail = Object.values(mapping).includes('email');

    if (!hasName && !hasEmail) {
      return NextResponse.json({
        error: 'Could not find "Name" or "Email" columns.',
        detectedHeaders: headers,
      }, { status: 400 });
    }

    const reverseMap: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      reverseMap[field] = header;
    }

    const fileHash = sha256(file.name + file.size + Date.now().toString());
    const batch = await db.importBatch.create({
      data: {
        fileName: file.name,
        fileHash,
        totalRows: rows.length,
        status: 'processing',
        mappingProfile: JSON.stringify(mapping),
      },
    });

    await logAction('batch_created', 'ImportBatch', batch.id, { fileName: file.name, totalRows: rows.length, consentSource, source });

    // For small files, process synchronously
    if (rows.length <= LARGE_FILE_THRESHOLD) {
      const companyCache = new Map<string, string>();
      const existingCompanies = await db.company.findMany();
      for (const c of existingCompanies) {
        companyCache.set(normalize(c.rawName), c.id);
        if (c.domain) companyCache.set(normalize(c.domain), c.id);
      }

      const progressData = {
        status: 'processing' as string,
        processedRows: 0,
        totalRows: rows.length,
        acceptedRows: 0,
        duplicateRows: 0,
        invalidRows: 0,
        startedAt: Date.now(),
        cancelled: false,
        consentSource,
        source,
        consentIp,
        newContactIds: [] as string[],
      };

      const result = await processChunk(rows, reverseMap, batch.id, companyCache, existingCompanies, progressData);

      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          acceptedRows: result.accepted,
          duplicateRows: result.duplicates,
          invalidRows: result.invalid,
          questionableRows: rows.length - result.accepted - result.duplicates - result.invalid,
          status: 'completed',
        },
      });

      await logAction('batch_completed', 'ImportBatch', batch.id, {
        acceptedRows: result.accepted,
        duplicateRows: result.duplicates,
        invalidRows: result.invalid,
      });

      // Auto-add new contacts to verification queue
      if (result.newContactIds.length > 0) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/verify-queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactIds: result.newContactIds }),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json({
        success: true,
        batch: {
          id: batch.id,
          fileName: batch.fileName,
          totalRows: batch.totalRows,
          acceptedRows: result.accepted,
          duplicateRows: result.duplicates,
          invalidRows: result.invalid,
          status: 'completed',
        },
      });
    }

    // Large file: start background chunked processing
    const progressData = {
      status: 'processing' as string,
      processedRows: 0,
      totalRows: rows.length,
      acceptedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      startedAt: Date.now(),
      cancelled: false,
      consentSource,
      source,
      consentIp,
      newContactIds: [] as string[],
    };
    batchProgress.set(batch.id, progressData);

    // Fire-and-forget background processing
    (async () => {
      try {
        const companyCache = new Map<string, string>();
        const existingCompanies = await db.company.findMany();
        for (const c of existingCompanies) {
          companyCache.set(normalize(c.rawName), c.id);
          if (c.domain) companyCache.set(normalize(c.domain), c.id);
        }

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          if (progressData.cancelled) {
            progressData.status = 'cancelled';
            await db.importBatch.update({
              where: { id: batch.id },
              data: {
                acceptedRows: progressData.acceptedRows,
                duplicateRows: progressData.duplicateRows,
                invalidRows: progressData.invalidRows,
                status: 'cancelled',
              },
            });
            await logAction('batch_cancelled', 'ImportBatch', batch.id, { processedRows: progressData.processedRows });
            break;
          }

          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const result = await processChunk(chunk, reverseMap, batch.id, companyCache, existingCompanies, progressData);

          progressData.processedRows = Math.min(i + CHUNK_SIZE, rows.length);
          progressData.acceptedRows += result.accepted;
          progressData.duplicateRows += result.duplicates;
          progressData.invalidRows += result.invalid;
          progressData.newContactIds.push(...result.newContactIds);

          await db.importBatch.update({
            where: { id: batch.id },
            data: {
              acceptedRows: progressData.acceptedRows,
              duplicateRows: progressData.duplicateRows,
              invalidRows: progressData.invalidRows,
            },
          });
        }

        if (progressData.status !== 'cancelled') {
          progressData.status = 'completed';
          await db.importBatch.update({
            where: { id: batch.id },
            data: {
              questionableRows: rows.length - progressData.acceptedRows - progressData.duplicateRows - progressData.invalidRows,
              status: 'completed',
            },
          });
          await logAction('batch_completed', 'ImportBatch', batch.id, {
            acceptedRows: progressData.acceptedRows,
            duplicateRows: progressData.duplicateRows,
            invalidRows: progressData.invalidRows,
          });

          // Auto-add to verification queue
          if (progressData.newContactIds.length > 0) {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/verify-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: progressData.newContactIds }),
              });
            } catch { /* non-critical */ }
          }
        }
      } catch (err) {
        progressData.status = 'failed';
        await db.importBatch.update({
          where: { id: batch.id },
          data: { status: 'failed' },
        });
        console.error('Chunked processing error:', err);
        await logAction('batch_failed', 'ImportBatch', batch.id, { error: String(err) });
      } finally {
        // Keep progress in memory for a while, then clean up
        setTimeout(() => { batchProgress.delete(batch.id); }, 30 * 60 * 1000);
      }
    })();

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        totalRows: batch.totalRows,
        acceptedRows: 0,
        duplicateRows: 0,
        invalidRows: 0,
        status: 'processing',
        largeFile: true,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   Cancel a batch (used by progress UI)
   Exposed as a helper for the progress endpoint
   ═══════════════════════════════════════════════════ */
export function cancelBatch(batchId: string) {
  const p = batchProgress.get(batchId);
  if (p) p.cancelled = true;
}

/* Export for progress endpoint */
export { batchProgress, CHUNK_SIZE };