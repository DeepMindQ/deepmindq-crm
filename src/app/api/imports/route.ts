import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

// ---------------------------------------------------------------------------
// GET – list import batches
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(batches);
  } catch (error) {
    console.error("Failed to fetch import batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch import batches" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST – stage a CSV file (FormData) OR execute an import (JSON)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // Determine request type by Content-Type
    // -----------------------------------------------------------------------
    const contentType = request.headers.get("content-type") ?? "";

    // JSON body → execute action
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (body.action === "execute") {
        return executeImport(body);
      }

      return NextResponse.json(
        { error: "Unknown action. Use action: 'execute'." },
        { status: 400 },
      );
    }

    // FormData body → staging / preview (existing behaviour)
    return stageImport(request);
  } catch (error) {
    console.error("Failed to process import:", error);
    return NextResponse.json(
      { error: "Failed to process import file" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Stage: upload CSV → parse headers + preview → create ImportBatch
// ---------------------------------------------------------------------------

async function stageImport(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return NextResponse.json(
      {
        error:
          "Excel format is not supported yet. Please upload a CSV file instead.",
      },
      { status: 400 },
    );
  }

  if (!fileName.endsWith(".csv")) {
    return NextResponse.json(
      { error: "Unsupported file format. Please upload a CSV file." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = buffer.toString("utf-8");
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return NextResponse.json(
      {
        error: "CSV file must have a header row and at least one data row.",
      },
      { status: 400 },
    );
  }

  const columns = parseCSVLine(lines[0]);
  const dataRows = lines.slice(1);

  const previewRows: string[][] = [];
  const maxPreview = Math.min(5, dataRows.length);
  for (let i = 0; i < maxPreview; i++) {
    previewRows.push(parseCSVLine(dataRows[i]));
  }

  // Generate a simple hash for the file
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];
    hash = ((hash << 5) - hash + char) | 0;
  }
  const fileHash = Math.abs(hash).toString(16).padStart(8, "0");

  // Check for duplicate upload
  const existing = await db.importBatch.findUnique({ where: { fileHash } });
  if (existing) {
    return NextResponse.json(
      { error: "This file has already been imported." },
      { status: 409 },
    );
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

  return NextResponse.json(
    {
      id: batch.id,
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      columns,
      previewRows,
    },
    { status: 201 },
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
    return NextResponse.json(
      { error: "batchId, mapping, and rows are required." },
      { status: 400 },
    );
  }

  // Verify the batch exists
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json(
      { error: "Import batch not found." },
      { status: 404 },
    );
  }

  // Helper: safely extract a value from a row by mapped column index
  const val = (row: string[], field: string): string | undefined => {
    const idx = mapping[field];
    if (idx === undefined || idx === null) return undefined;
    return row[idx]?.trim() || undefined;
  };

  let accepted = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    // Every row must at least have a company name
    const companyName = val(row, "companyName");
    const contactName = val(row, "contactName");

    if (!companyName || !contactName) {
      invalid++;
      continue;
    }

    // Find or create company (dedup by name)
    let company = await db.company.findFirst({
      where: { name: companyName },
    });

    if (!company) {
      company = await db.company.create({
        data: { name: companyName },
      });
    }

    // Check for duplicate contact within the same company
    const email = val(row, "email");
    const existingContact = await db.contact.findFirst({
      where: {
        companyId: company.id,
        name: contactName,
        ...(email ? { email } : {}),
      },
    });

    if (existingContact) {
      duplicates++;
      continue;
    }

    await db.contact.create({
      data: {
        companyId: company.id,
        name: contactName,
        email: email || null,
        jobTitle: val(row, "jobTitle") || null,
        phone: val(row, "phone") || null,
        location: val(row, "location") || null,
      },
    });

    accepted++;
  }

  // Update the batch with final counts
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      acceptedRows: accepted,
      duplicateRows: duplicates,
      invalidRows: invalid,
      status: "completed",
    },
  });

  // Create a timeline entry for the import
  await db.timelineEntry.create({
    data: {
      action: "Import Completed",
      details: `Imported ${accepted} contacts (${duplicates} duplicates skipped, ${invalid} invalid rows) from "${batch.fileName}".`,
    },
  });

  return NextResponse.json({
    success: true,
    accepted,
    duplicates,
    invalid,
  });
}