import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiHelpers";
import { sanitizeString } from "@/lib/sanitize";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  // MEDIUM-12: Sanitize all string fields — strip HTML tags
  const raw = String(value);
  const str = typeof value === 'string' ? sanitizeString(raw) : raw;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function buildCompaniesCSV(): Promise<string> {
  const companies = await db.company.findMany({
    where: { status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Name",
    "Domain",
    "Industry",
    "Employee Size",
    "Country",
    "Location",
    "Website",
    "LinkedIn",
    "Status",
    "Intelligence Score",
    "Data Freshness",
    "Created At",
  ].join(",");

  const rows = companies.map((c) =>
    [
      escapeCSV(c.name),
      escapeCSV(c.domain),
      escapeCSV(c.industry),
      escapeCSV(c.employeeSize),
      escapeCSV(c.country),
      escapeCSV(c.location),
      escapeCSV(c.website),
      escapeCSV(c.linkedinUrl),
      escapeCSV(c.status),
      escapeCSV(c.intelligenceScore),
      escapeCSV(c.dataFreshness),
      escapeCSV(c.createdAt.toISOString()),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

async function buildContactsCSV(): Promise<string> {
  const contacts = await db.contact.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true } },
    },
  });

  const header = [
    "Name",
    "Email",
    "Job Title",
    "Role",
    "Company",
    "Phone",
    "Location",
    "Email Health",
    "Health Score",
    "Status",
    "Created At",
  ].join(",");

  const rows = contacts.map((c) =>
    [
      escapeCSV(c.name),
      escapeCSV(c.email),
      escapeCSV(c.jobTitle),
      escapeCSV(c.roleBucket),
      escapeCSV(c.company?.name),
      escapeCSV(c.phone),
      escapeCSV(c.location),
      escapeCSV(c.emailHealth),
      escapeCSV(c.emailHealthScore),
      escapeCSV(c.status),
      escapeCSV(c.createdAt.toISOString()),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // MEDIUM-12: Prefix with UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF";

    if (type === "contacts") {
      const csv = await buildContactsCSV();
      return new Response(BOM + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="contacts.csv"',
        },
      });
    }

    // type === "companies" or default (no type)
    const csv = await buildCompaniesCSV();
    return new Response(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="companies.csv"',
      },
    });
  } catch {
    return apiError("Failed to export data");
  }
}