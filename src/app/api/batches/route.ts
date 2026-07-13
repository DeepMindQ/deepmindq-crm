import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { checkSyntax, checkDisposable, checkRoleBased, checkFreeProvider, scoreEmail } from '@/lib/email-verify';

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
  // Check word overlap
  const wordsA = na.split(/[\s,.-]+/).filter(Boolean);
  const wordsB = nb.split(/[\s,.-]+/).filter(Boolean);
  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
  if (overlap.length > 0) return Math.round((overlap.length / Math.max(wordsA.length, wordsB.length)) * 60);
  return 0;
}

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // File size limit: 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB allowed. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the file
    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      return NextResponse.json({ error: 'Failed to parse file. Make sure it is a valid CSV or Excel file.' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty — no rows found.' }, { status: 400 });
    }

    // Get headers and guess mapping
    const headers = Object.keys(rows[0]);
    const mapping = guessMapping(headers);

    const hasName = Object.values(mapping).includes('name');
    const hasEmail = Object.values(mapping).includes('email');

    if (!hasName && !hasEmail) {
      return NextResponse.json({
        error: 'Could not find "Name" or "Email" columns. Please ensure your file has at least one of these headers.',
        detectedHeaders: headers,
        supportedHeaders: 'Name, Email, Company, Title, Phone, LinkedIn, Location, Industry, Website, Domain',
      }, { status: 400 });
    }

    // Reverse mapping: field -> original header
    const reverseMap: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      reverseMap[field] = header;
    }

    // Create batch record
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

    let accepted = 0;
    let duplicates = 0;
    let invalid = 0;

    // Get all existing companies for dedup
    const existingCompanies = await db.company.findMany();
    const companyCache = new Map<string, string>(); // normalizedName -> id

    for (const company of existingCompanies) {
      companyCache.set(normalize(company.rawName), company.id);
      if (company.domain) companyCache.set(normalize(company.domain), company.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Extract mapped fields using reverse map
      const rawName = String(row[reverseMap['name'] || ''] || '').trim();
      const rawEmail = String(row[reverseMap['email'] || ''] || '').trim();
      const rawCompany = String(row[reverseMap['company'] || ''] || '').trim();
      const rawTitle = String(row[reverseMap['title'] || ''] || '').trim();
      const rawPhone = String(row[reverseMap['phone'] || ''] || '').trim();
      const rawLinkedin = String(row[reverseMap['linkedin'] || ''] || '').trim();
      const rawLocation = String(row[reverseMap['location'] || ''] || '').trim();
      const rawIndustry = String(row[reverseMap['industry'] || ''] || '').trim();

      // Validate: need at least name or email
      if (!rawName && !rawEmail) {
        invalid++;
        continue;
      }

      // Basic email validation
      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        invalid++;
        continue;
      }

      // Check for duplicate email
      if (rawEmail) {
        const existingEmail = await db.contact.findFirst({ where: { email: rawEmail } });
        if (existingEmail) {
          duplicates++;
          continue;
        }
      }

      // Find or create company
      let companyId: string | undefined;
      const normalizedName = normalize(rawCompany);

      if (normalizedName) {
        // Check cache first
        const cached = companyCache.get(normalizedName);
        if (cached) {
          companyId = cached;
        } else {
          // Fuzzy match against existing companies
          let bestMatch = '';
          let bestScore = 0;
          for (const ec of existingCompanies) {
            const score = companyMatchScore(ec.rawName, rawCompany);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = ec.id;
            }
          }
          if (bestScore >= 70 && bestMatch) {
            companyId = bestMatch;
            companyCache.set(normalizedName!, companyId);
          } else {
            // Create new company
            const newCompany = await db.company.create({
              data: {
                rawName: rawCompany,
                normalizedName,
                domain: rawEmail ? rawEmail.split('@')[1] : undefined,
                industry: rawIndustry || undefined,
                location: rawLocation || undefined,
              },
            });
            companyId = newCompany.id;
            companyCache.set(normalizedName!, companyId!);
            existingCompanies.push(newCompany);
          }
        }
      } else {
        // No company name — create placeholder
        const placeholderName = rawEmail ? rawEmail.split('@')[1] || 'Unknown' : 'Unknown';
        const phNorm = normalize(placeholderName);
        const cached = companyCache.get(phNorm);
        if (cached) {
          companyId = cached;
        } else {
          const newCompany = await db.company.create({
            data: {
              rawName: placeholderName,
              normalizedName: phNorm,
              domain: rawEmail ? rawEmail.split('@')[1] : undefined,
            },
          });
          companyId = newCompany.id;
          companyCache.set(phNorm!, companyId!);
          existingCompanies.push(newCompany);
        }
      }

      // Determine role bucket
      const titleLower = rawTitle.toLowerCase();
      let roleBucket = 'other';
      if (/^(ceo|cto|cfo|coo|cmo|cpo|ciso|vp|svp|evp|president|director|head|chief)/.test(titleLower)) {
        roleBucket = 'executive';
      } else if (/^(manager|lead|principal|senior|staff|sr\.|sr )/.test(titleLower)) {
        roleBucket = 'manager';
      } else if (/^(engineer|developer|architect|scientist|analyst|programmer|devops|sre|data)/.test(titleLower)) {
        roleBucket = 'technical';
      }

      // Email health scoring using verification engine
      const emailResult = rawEmail ? scoreEmail(rawEmail) : { health: 'unknown', score: 0, issues: [] };
      const emailHealth = emailResult.health;
      const emailHealthScore = emailResult.score;

      // Simple lead scoring
      let leadScore = 50;
      if (roleBucket === 'executive') leadScore += 25;
      else if (roleBucket === 'manager') leadScore += 15;
      if (emailHealth === 'valid') leadScore += 10;
      if (rawCompany) leadScore += 5;
      if (rawTitle) leadScore += 5;
      leadScore = Math.min(100, leadScore);

      await db.contact.create({
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
          batchId: batch.id,
          status: 'imported',
          emailHealth,
          emailHealthScore,
          leadScore,
          consentStatus: 'unknown',
        },
      });

      accepted++;
    }

    // Update batch with final counts
    await db.importBatch.update({
      where: { id: batch.id },
      data: {
        acceptedRows: accepted,
        duplicateRows: duplicates,
        invalidRows: invalid,
        questionableRows: rows.length - accepted - duplicates - invalid,
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        totalRows: batch.totalRows,
        acceptedRows: accepted,
        duplicateRows: duplicates,
        invalidRows: invalid,
        status: 'completed',
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