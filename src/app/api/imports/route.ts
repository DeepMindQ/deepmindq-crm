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

  // C10: Cap rows at 1000 (will increase to 10,000 after chunk processing)
  if (rows.length > 1000) {
    return apiError("Maximum 1000 rows per import", 400);
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

  // Batch lookup — collect all unique company raw names for dedup
  const companyRawNames = new Set<string>();
  for (const row of rows) {
    const companyName = val(row, "companyName");
    if (companyName) companyRawNames.add(companyName);
  }

  // Look up existing companies by BOTH rawName AND normalizedName
  // to catch cases where same company was imported with different casing
  const normalizedLookupNames: string[] = [];
  for (const n of companyRawNames) {
    normalizedLookupNames.push(n);          // exact rawName
    normalizedLookupNames.push(normalizeName(n)); // normalizedName
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

  // Build lookup maps: rawName→id and normalizedName→id
  const companyByRawName = new Map<string, string>();
  const companyByNormalizedName = new Map<string, string>();
  for (const c of existingCompanies) {
    companyByRawName.set(c.rawName, c.id);
    companyByNormalizedName.set(c.normalizedName, c.id);
  }

  let accepted = 0;
  let duplicates = 0;
  let invalid = 0;

  const affectedCompanies = new Map<string, { id: string; name: string; contactsAdded: number; wasCreated: boolean }>();

  // Wrap entire import loop in a transaction for atomicity
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      const companyName = val(row, "companyName");
      const contactName = val(row, "contactName");

      if (!companyName || !contactName) {
        invalid++;
        continue;
      }

      // Look up company by rawName first, then normalizedName
      let companyId = companyByRawName.get(companyName);
      if (!companyId) {
        companyId = companyByNormalizedName.get(normalizeName(companyName));
      }

      let wasCreated = false;

      if (!companyId) {
        const created = await tx.company.create({
          data: {
            rawName: companyName,
            normalizedName: normalizeName(companyName),
          },
        });
        companyId = created.id;
        wasCreated = true;
        // Update maps for subsequent rows
        companyByRawName.set(companyName, companyId);
        companyByNormalizedName.set(normalizeName(companyName), companyId);
      }

      // Check for duplicate contact within the same company
      const email = val(row, "email");
      const contactNormalizedName = normalizeName(contactName);

      const existingContact = await tx.contact.findFirst({
        where: {
          companyId,
          normalizedName: contactNormalizedName,
          ...(email ? { email } : {}),
        },
      });

      if (existingContact) {
        duplicates++;
        continue;
      }

      await tx.contact.create({
        data: {
          companyId,
          batchId,
          rawName: contactName,
          normalizedName: contactNormalizedName,
          email: email || `unknown-${crypto.randomUUID().slice(0, 8)}@import.temp`,
          jobTitle: val(row, "jobTitle") || null,
          phone: val(row, "phone") || null,
          location: val(row, "location") || null,
        },
      });

      accepted++;

      const existing = affectedCompanies.get(companyId);
      if (existing) {
        existing.contactsAdded++;
      } else {
        affectedCompanies.set(companyId, { id: companyId, name: companyName, contactsAdded: 1, wasCreated });
      }
    }

    // Update the batch with final counts inside the same transaction
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        acceptedRows: accepted,
        duplicateRows: duplicates,
        invalidRows: invalid,
        status: "completed",
      },
    });

    // Create timeline events per affected company
    if (affectedCompanies.size > 0) {
      await tx.companyTimelineEvent.createMany({
        data: Array.from(affectedCompanies.values()).map((c) => ({
          companyId: c.id,
          eventType: "contact_added",
          title: c.wasCreated
            ? `Company "${c.name}" imported with ${c.contactsAdded} contact(s)`
            : `${c.contactsAdded} contact(s) added to "${c.name}"`,
          description: `CSV import "${batch.fileName}" — ${c.contactsAdded} contact(s) processed.`,
          metadata: JSON.stringify({ batchId, fileName: batch.fileName, contactsAdded: c.contactsAdded, wasCreated: c.wasCreated }),
        })),
      });
    }
  });

  return apiSuccess({
    success: true,
    accepted,
    duplicates,
    invalid,
    totalProcessed: accepted + duplicates + invalid,
  });
}
