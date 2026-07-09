import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Excel format is not supported yet. Please upload a CSV file instead." },
        { status: 400 }
      );
    }

    if (!fileName.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload a CSV file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("utf-8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file must have a header row and at least one data row." },
        { status: 400 }
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
        { status: 409 }
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

    return NextResponse.json({
      id: batch.id,
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      columns,
      previewRows,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to process import:", error);
    return NextResponse.json(
      { error: "Failed to process import file" },
      { status: 500 }
    );
  }
}