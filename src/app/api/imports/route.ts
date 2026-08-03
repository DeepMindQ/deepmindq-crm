import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from "@/lib/apiHelpers";
import crypto from "crypto";
import * as XLSX from 'xlsx-js-style';
import { validateEmail, validationToContactFields } from "@/lib/email-validator";
import { matchCompany, extractCorporateDomain } from "@/lib/company-matcher";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Normalise a company or contact name for deduplication.
 *  Trim whitespace, collapse multiple spaces, lowercase. */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// File parsing: CSV and XLSX → unified { columns, dataRows, previewRows }
// ---------------------------------------------------------------------------

interface ParsedFile {
  columns: string[];
  dataRows: string[][];
  previewRows: string[][];
}

/** Parse an XLSX/XLS buffer into the same format as CSV parsing. */
function parseXLSX(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("XLSX file contains no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (rows), where each cell is a string
  const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,     // get formatted strings, not raw values
    defval: "",    // default empty string for missing cells
  });

  if (!rawData || rawData.length < 2) {
    throw new Error("XLSX file must have a header row and at least one data row.");
  }

  const allRows: string[][] = rawData.map((row) =>
    row.map((cell) => String(cell ?? "").trim())
  );

  const columns = allRows[0];
  const dataRows = allRows.slice(1);

  const previewRows: string[][] = [];
  const maxPreview = Math.min(5, dataRows.length);
  for (let i = 0; i < maxPreview; i++) {
    previewRows.push(dataRows[i]);
  }

  return { columns, dataRows, previewRows };
}

/** Parse a CSV buffer into columns, dataRows, previewRows. */
function parseCSV(buffer: Buffer): ParsedFile {
  const content = buffer.toString("utf-8");
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one data row.");
  }

  const columns = parseCSVLine(lines[0]);
  const dataRows = lines.slice(1).map((l) => parseCSVLine(l));

  const previewRows: string[][] = [];
  const maxPreview = Math.min(5, dataRows.length);
  for (let i = 0; i < maxPreview; i++) {
    previewRows.push(dataRows[i]);
  }

  return { columns, dataRows, previewRows };
}

// ---------------------------------------------------------------------------
// GET – list import batches
// ---------------------------------------------------------------------------

export async function GET() {
  // Auth gate: authenticated users only for import batches
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return apiSuccess(batches);
  } catch {
    return apiError("Failed to fetch import batches");
  }
}

// ---------------------------------------------------------------------------
// POST – stage a CSV file (FormData) OR execute an import (JSON)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Auth gate: authenticated users only for imports
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const contentType = request.headers.get("content-type") ?? "";

    // JSON body → execute action
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (body.action === "execute") {
        return executeImport(body);
      }

      return apiError("Unknown action. Use action: 'execute'.", 400);
    }

    // FormData body → staging / preview
    return stageImport(request);
  } catch {
    return apiError("Failed to process import file");
  }
}

// ---------------------------------------------------------------------------
// Stage: upload CSV or XLSX → parse headers + preview → create ImportBatch
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function stageImport(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return apiError("No file uploaded", 400);
  }

  // C9: Enforce 10 MB file size limit before reading
  if (file.size > MAX_FILE_SIZE) {
    return apiError("File size exceeds the 10 MB limit", 400);
  }

  const fileName = file.name.toLowerCase();
  const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
  const isCSV = fileName.endsWith(".csv");

  // E-H6 TODO: Add MIME type validation from form data File object (file.type).
  // Current extension check (.csv/.xlsx) is sufficient for the current attack surface
  // since the xlsx library will reject malformed content during parsing.
  // Future enhancement: validate file.type against an allowlist of MIME types
  // (text/csv, text/plain, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
  //  application/vnd.ms-excel) and reject uploads with mismatched MIME types.
  if (!isXLSX && !isCSV) {
    return apiError("Unsupported file format. Please upload a CSV or XLSX file.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse based on format — both produce the same ParsedFile structure
  let parsed: ParsedFile;
  try {
    parsed = isXLSX ? parseXLSX(buffer) : parseCSV(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file.";
    return apiError(message, 400);
  }

  const { columns, dataRows, previewRows } = parsed;

  // H16: Use proper SHA-256 hash for duplicate detection
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  // Check for duplicate upload
  const existing = await db.importBatch.findUnique({ where: { fileHash } });
  if (existing) {
    return apiError("This file has already been imported.", 409);
  }

  const batch = await db.importBatch.create({
    data: {
      fileName: file.name,
      fileHash,
      totalRows: dataRows.length,
      acceptedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      status: "staged",
    },
  });

  return apiSuccess(
    {
      id: batch.id,
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      columns,
      previewRows,
      fileType: isXLSX ? "xlsx" : "csv",
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// Execute: create Company & Contact records from mapped CSV rows
// ---------------------------------------------------------------------------

interface ExecuteBody {
  action: "execute";
  batchId: string;
  mapping: Record<string, number>;
  rows: string[][];
}

async function executeImport(body: ExecuteBody) {
  const { batchId, mapping, rows } = body;

  if (!batchId || !mapping || !Array.isArray(rows)) {
    return apiError("batchId, mapping, and rows are required.", 400);
  }

  // C10: Cap rows at 10000
  if (rows.length > 10000) {
    return apiError("Maximum 10,000 rows per import", 400);
  }

  // Verify the batch exists
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return apiError("Import batch not found.", 404);
  }

  // Mark batch as processing immediately
  await db.importBatch.update({
    where: { id: batchId },
    data: { status: "processing" },
  });

  // Helper: safely extract a value from a row by mapped column index
  const val = (row: string[], field: string): string | undefined => {
    const idx = mapping[field];
    if (idx === undefined || idx === null) return undefined;
    return row[idx]?.trim() || undefined;
  };

  // ── Phase 1: Pre-process all rows in memory ──
  // Build lookup sets for companies and contacts BEFORE touching the DB.
  // This eliminates N+1 queries and keeps the transaction fast.

  const companyRawNames = new Set<string>();
  const contactEmails = new Set<string>(); // emails in this import

  // Track unique contacts within this import (intra-import dedup)
  // Key: "companyNorm:contactNorm" for per-company name dedup
  const intraImportNameDedup = new Map<string, number>();
  // Track emails globally within import (Contact.email is @unique)
  const intraImportEmailDedup = new Set<string>();

  // Parsed records: only valid rows
  interface ParsedRecord {
    companyName: string;
    contactName: string;
    email: string | undefined;
    title: string | undefined;
    phone: string | undefined;
    location: string | undefined;
    website: string | undefined;
    companyNormalizedName: string;
    contactNormalizedName: string;
    emailDomain: string | undefined | null;
  }

  const validRecords: ParsedRecord[] = [];
  let invalid = 0;
  let intraDuplicates = 0;
  let emailRejected = 0; // disposable/invalid emails
  const emailValidationResults = new Map<string, Awaited<ReturnType<typeof validateEmail>>>();

  // ── Email Validation Pass (before dedup) ──
  // Validate all emails first — reject disposable/invalid before processing
  const allEmailsInImport = rows.map(row => val(row, "email")).filter(Boolean) as string[];
  const emailValidationMap = new Map<string, Awaited<ReturnType<typeof validateEmail>>>();

  for (const row of rows) {
    const companyName = val(row, "companyName");
    const contactName = val(row, "contactName");

    if (!companyName || !contactName) {
      invalid++;
      continue;
    }

    const email = val(row, "email");

    // ── EMAIL QUALITY VALIDATION ──
    if (email) {
      // Check cache first
      if (emailValidationMap.has(email)) {
        const cachedResult = emailValidationMap.get(email)!;
        if (!cachedResult.isValid || cachedResult.status === 'disposable') {
          emailRejected++;
          continue; // Skip disposable/invalid emails entirely
        }
      } else {
        // Validate (DNS checks happen here)
        const validationResult = await validateEmail(email);
        emailValidationMap.set(email, validationResult);
        emailValidationResults.set(email, validationResult);

        if (!validationResult.isValid || validationResult.status === 'disposable') {
          emailRejected++;
          continue; // Skip disposable/invalid emails entirely
        }
      }
    }

    const companyNorm = normalizeName(companyName);
    const contactNorm = normalizeName(contactName);

    companyRawNames.add(companyName);
    if (email) contactEmails.add(email);

    // Intra-import dedup check
    if (email && intraImportEmailDedup.has(email)) {
      intraDuplicates++;
      continue;
    }
    const nameKey = `${companyNorm}:${contactNorm}`;
    if (intraImportNameDedup.has(nameKey)) {
      intraDuplicates++;
      continue;
    }

    if (email) intraImportEmailDedup.add(email);
    intraImportNameDedup.set(nameKey, validRecords.length);

    // Extract domain from email for company matching
    const emailDomain = email ? extractCorporateDomain(email) : undefined;

    validRecords.push({
      companyName,
      contactName,
      email,
      title: val(row, "jobTitle") || undefined,
      phone: val(row, "phone") || undefined,
      location: val(row, "location") || undefined,
      website: val(row, "website") || undefined,
      companyNormalizedName: companyNorm,
      contactNormalizedName: contactNorm,
      emailDomain,
    });
  }

  // ── Phase 2: Bulk DB lookups (outside transaction) ──

  // Look up existing companies by rawName AND normalizedName
  const normalizedLookupNames: string[] = [];
  for (const n of companyRawNames) {
    normalizedLookupNames.push(normalizeName(n));
  }

  const existingCompanies = await db.company.findMany({
    where: {
      OR: [
        { rawName: { in: [...companyRawNames] } },
        { normalizedName: { in: normalizedLookupNames } },
      ],
    },
    select: { id: true, rawName: true, normalizedName: true },
  });

  // Build company lookup maps
  const companyByRawName = new Map<string, string>();
  const companyByNormalizedName = new Map<string, string>();
  for (const c of existingCompanies) {
    companyByRawName.set(c.rawName, c.id);
    companyByNormalizedName.set(c.normalizedName, c.id);
  }

  // Bulk lookup existing contacts for all emails in this import
  // Contact.email is globally unique — dedup by email alone
  const emailList = [...contactEmails];
  const existingContacts = emailList.length > 0
    ? await db.contact.findMany({
        where: { email: { in: emailList } },
        select: { id: true, email: true, companyId: true, normalizedName: true },
      })
    : [];

  // Build contact dedup set: global email → true
  // AND per-company: "companyId:normalizedName" → true
  const existingEmailSet = new Set<string>();
  const existingCompanyContactSet = new Set<string>();
  for (const c of existingContacts) {
    existingEmailSet.add(c.email);
    existingCompanyContactSet.add(`${c.companyId}:${c.normalizedName}`);
  }

  // ── Phase 3: Classify records and collect new companies/contacts ──

  const newCompanies: Map<string, { id: string; rawName: string; normalizedName: string; domain: string | null }> = new Map();
  const newContacts: { companyId: string; batchId: string; rawName: string; normalizedName: string; email: string; title: string | null; phone: string | null; location: string | null; emailHealth: string; emailHealthScore: number; isSuppressed: boolean; suppressionReason: string | null }[] = [];
  let duplicates = 0; // cross-import duplicates (already in DB)
  let accepted = 0;

  for (const rec of validRecords) {
    // ── INTELLIGENT COMPANY MATCHING (4-rule engine) ──
    let companyId: string | undefined;
    let matchRule: string | undefined;

    // Rule 1-4: Use the intelligent matching engine
    const matchResult = await matchCompany({
      companyName: rec.companyName,
      email: rec.email,
      website: rec.website || rec.emailDomain ? `https://${rec.emailDomain}` : undefined,
    });

    if (matchResult.matched && matchResult.match) {
 companyId = matchResult.match.companyId;
      matchRule = matchResult.match.matchRule;
    }

    // Fallback: check existing lookup maps (raw name + normalized name)
    if (!companyId) {
      companyId = companyByRawName.get(rec.companyName);
      if (!companyId) {
        companyId = companyByNormalizedName.get(rec.companyNormalizedName);
      }
    }

    let wasCreated = false;

    if (!companyId) {
      companyId = `co_${newCompanies.size}_${Date.now()}`;
      // Extract domain from email for the new company
      const domain = rec.emailDomain || null;
      newCompanies.set(companyId, {
        id: companyId,
        rawName: rec.companyName,
        normalizedName: rec.companyNormalizedName,
        domain,
      });
      wasCreated = true;
      companyByRawName.set(rec.companyName, companyId);
      companyByNormalizedName.set(rec.companyNormalizedName, companyId);
    }

    // Check cross-import duplicate (contact already exists in DB)
    // 1. Global email uniqueness (Contact.email is @unique)
    if (rec.email && existingEmailSet.has(rec.email)) {
      duplicates++;
      continue;
    }
    // 2. Per-company: same normalized name within same company
    const companyContactKey = `${companyId}:${rec.contactNormalizedName}`;
    if (existingCompanyContactSet.has(companyContactKey)) {
      duplicates++;
      continue;
    }

    // ── EMAIL HEALTH from validation results ──
    const emailValidation = rec.email ? emailValidationResults.get(rec.email) : null;
    const emailFields = emailValidation
      ? validationToContactFields(emailValidation)
      : { emailHealth: 'unknown', emailHealthScore: 0, isSuppressed: false, suppressionReason: null };

    newContacts.push({
      companyId,
      batchId,
      rawName: rec.contactName,
      normalizedName: rec.contactNormalizedName,
      email: rec.email || `unknown-${crypto.randomUUID().slice(0, 8)}@import.temp`,
      title: rec.title || null,
      phone: rec.phone || null,
      location: rec.location || null,
      emailHealth: emailFields.emailHealth,
      emailHealthScore: emailFields.emailHealthScore,
      isSuppressed: emailFields.isSuppressed,
      suppressionReason: emailFields.suppressionReason,
    });

    accepted++;
  }

  // ── Phase 4: Transaction — batch insert everything ──
  // The transaction now only does bulk writes, no reads. Fast.
  // For large imports, use extended timeout (Neon serverless default is ~10s).

  const affectedCompanies = new Map<string, { id: string; name: string; contactsAdded: number; wasCreated: boolean }>();

  // Prisma interactive transactions: pass timeout in options (Prisma 6.x)
  const txnOptions = { timeout: 60000 }; // 60s timeout for large imports
  await db.$transaction(async (tx) => {
    // 1. Insert new companies (if any)
    if (newCompanies.size > 0) {
      const companyPayload = [...newCompanies.values()].map((c) => ({
        rawName: c.rawName,
        normalizedName: c.normalizedName,
        domain: c.domain || undefined,
      }));
      // Insert in chunks of 100 to avoid query size limits
      const CHUNK = 100;
      for (let i = 0; i < companyPayload.length; i += CHUNK) {
        const chunk = companyPayload.slice(i, i + CHUNK);
        const created = await tx.company.createMany({ data: chunk });
        // We need the actual IDs — query them back
      }

      // Query back the created companies to get their real IDs
      const createdCompanyNames = [...newCompanies.values()].map(c => c.rawName);
      const realCompanies = await tx.company.findMany({
        where: { rawName: { in: createdCompanyNames } },
        select: { id: true, rawName: true },
      });

      // Build temp→real ID map
      const tempToReal = new Map<string, string>();
      for (const rc of realCompanies) {
        for (const [tempId, nc] of newCompanies) {
          if (nc.rawName === rc.rawName) {
            tempToReal.set(tempId, rc.id);
            break;
          }
        }
      }

      // Update contact companyId references from temp IDs to real IDs
      for (const contact of newContacts) {
        const realId = tempToReal.get(contact.companyId);
        if (realId) contact.companyId = realId;
      }
    }

    // 2. Insert all contacts in bulk
    if (newContacts.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < newContacts.length; i += CHUNK) {
        await tx.contact.createMany({ data: newContacts.slice(i, i + CHUNK) as any });
      }
    }

    // 3. Update batch
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        acceptedRows: accepted,
        duplicateRows: duplicates + intraDuplicates,
        invalidRows: invalid,
        status: "completed",
      },
    });

    // 4. Build affected companies map for timeline
    // Query actual companies to get correct IDs
    const affectedCompanyNames = new Set<string>();
    for (const rec of validRecords) {
      affectedCompanyNames.add(rec.companyName);
    }
    // We need to track company→contacts count from the accepted records
    const companyContactCount = new Map<string, number>();
    for (const contact of newContacts) {
      companyContactCount.set(contact.companyId, (companyContactCount.get(contact.companyId) || 0) + 1);
    }

    // Get real company data for timeline
    const realAffectedIds = [...companyContactCount.keys()];
    const realAffectedCompanies = realAffectedIds.length > 0
      ? await tx.company.findMany({
          where: { id: { in: realAffectedIds } },
          select: { id: true, rawName: true },
        })
      : [];

    const timelineData: { companyId: string; eventType: string; title: string; description: string; metadata: string }[] = [];
    for (const co of realAffectedCompanies) {
      const count = companyContactCount.get(co.id) || 0;
      const wasNew = [...newCompanies.values()].some(nc => nc.rawName === co.rawName);
      affectedCompanies.set(co.id, { id: co.id, name: co.rawName, contactsAdded: count, wasCreated: wasNew });
      timelineData.push({
        companyId: co.id,
        eventType: "contact_added",
        title: wasNew
          ? `Company "${co.rawName}" imported with ${count} contact(s)`
          : `${count} contact(s) added to "${co.rawName}"`,
        description: `CSV import "${batch.fileName}" — ${count} contact(s) processed.`,
        metadata: JSON.stringify({ batchId, fileName: batch.fileName, contactsAdded: count, wasCreated: wasNew }),
      });
    }

    // 5. Insert timeline events in bulk
    if (timelineData.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < timelineData.length; i += CHUNK) {
        await tx.companyTimelineEvent.createMany({ data: timelineData.slice(i, i + CHUNK) });
      }
    }
  }, txnOptions);

  return apiSuccess({
    success: true,
    accepted,
    duplicates: duplicates + intraDuplicates,
    invalid,
    emailRejected,
    emailValidationSummary: {
      valid: [...emailValidationResults.values()].filter(v => v.status === 'valid').length,
      personal: [...emailValidationResults.values()].filter(v => v.status === 'personal').length,
      role: [...emailValidationResults.values()].filter(v => v.status === 'role').length,
      disposable: [...emailValidationResults.values()].filter(v => v.status === 'disposable').length,
      invalidDomain: [...emailValidationResults.values()].filter(v => v.status === 'invalid').length,
    },
    totalProcessed: accepted + duplicates + intraDuplicates + invalid + emailRejected,
  });
}
