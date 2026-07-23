import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";
import crypto from "crypto";

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
// GET – list import batches
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: "desc" },
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
// Stage: upload CSV → parse headers + preview → create ImportBatch
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

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return apiError(
      "Excel format is not supported yet. Please upload a CSV file instead.",
      400,
    );
  }

  if (!fileName.endsWith(".csv")) {
    return apiError("Unsupported file format. Please upload a CSV file.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = buffer.toString("utf-8");
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return apiError(
      "CSV file must have a header row and at least one data row.",
      400,
    );
  }

  const columns = parseCSVLine(lines[0]);
  const dataRows = lines.slice(1);

  const previewRows: string[][] = [];
  const maxPreview = Math.min(5, dataRows.length);
  for (let i = 0; i < maxPreview; i++) {
    previewRows.push(parseCSVLine(dataRows[i]));
  }

  // H16: Use proper SHA-256 hash instead of weak DJB2 hash
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
    companyNormalizedName: string;
    contactNormalizedName: string;
  }

  const validRecords: ParsedRecord[] = [];
  let invalid = 0;
  let intraDuplicates = 0;

  for (const row of rows) {
    const companyName = val(row, "companyName");
    const contactName = val(row, "contactName");

    if (!companyName || !contactName) {
      invalid++;
      continue;
    }

    const email = val(row, "email");
    const companyNorm = normalizeName(companyName);
    const contactNorm = normalizeName(contactName);

    companyRawNames.add(companyName);
    if (email) contactEmails.add(email);

    // Intra-import dedup check
    // 1. Global email uniqueness
    if (email && intraImportEmailDedup.has(email)) {
      intraDuplicates++;
      continue;
    }
    // 2. Per-company: same normalized contact name
    const nameKey = `${companyNorm}:${contactNorm}`;
    if (intraImportNameDedup.has(nameKey)) {
      intraDuplicates++;
      continue;
    }

    if (email) intraImportEmailDedup.add(email);
    intraImportNameDedup.set(nameKey, validRecords.length);

    validRecords.push({
      companyName,
      contactName,
      email,
      title: val(row, "jobTitle") || undefined,
      phone: val(row, "phone") || undefined,
      location: val(row, "location") || undefined,
      companyNormalizedName: companyNorm,
      contactNormalizedName: contactNorm,
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

  const newCompanies: Map<string, { id: string; rawName: string; normalizedName: string }> = new Map();
  const newContacts: { companyId: string; batchId: string; rawName: string; normalizedName: string; email: string; title: string | null; phone: string | null; location: string | null }[] = [];
  let duplicates = 0; // cross-import duplicates (already in DB)
  let accepted = 0;

  for (const rec of validRecords) {
    // Resolve company ID
    let companyId = companyByRawName.get(rec.companyName);
    if (!companyId) {
      companyId = companyByNormalizedName.get(rec.companyNormalizedName);
    }

    let wasCreated = false;

    if (!companyId) {
      // Create company ID in-memory (will be batch-inserted)
      companyId = `co_${newCompanies.size}_${Date.now()}`;
      newCompanies.set(companyId, {
        id: companyId,
        rawName: rec.companyName,
        normalizedName: rec.companyNormalizedName,
      });
      wasCreated = true;
      // Also update lookup maps for subsequent records
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

    newContacts.push({
      companyId,
      batchId,
      rawName: rec.contactName,
      normalizedName: rec.contactNormalizedName,
      email: rec.email || `unknown-${crypto.randomUUID().slice(0, 8)}@import.temp`,
      title: rec.title || null,
      phone: rec.phone || null,
      location: rec.location || null,
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
        await tx.contact.createMany({ data: newContacts.slice(i, i + CHUNK) });
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
    totalProcessed: accepted + duplicates + intraDuplicates + invalid,
  });
}
