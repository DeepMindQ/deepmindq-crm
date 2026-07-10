import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function buildCompaniesCSV(): Promise<string> {
  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
    },
  });

  return [
    ["ID", "Name", "Domain", "Industry", "Employee Size", "Country", "Location", "Website", "LinkedIn URL", "Status", "Contacts Count", "Created At"].join(","),
    ...companies.map(
      (c) =>
        [
          escapeCSV(c.id),
          escapeCSV(c.name),
          escapeCSV(c.domain),
          escapeCSV(c.industry),
          escapeCSV(c.employeeSize),
          escapeCSV(c.country),
          escapeCSV(c.location),
          escapeCSV(c.website),
          escapeCSV(c.linkedinUrl),
          escapeCSV(c.status),
          escapeCSV(String(c._count.contacts)),
          escapeCSV(c.createdAt.toISOString()),
        ].join(",")
    ),
  ].join("\n");
}

async function buildContactsCSV(): Promise<string> {
  const contacts = await db.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true } },
    },
  });

  return [
    ["ID", "Name", "Email", "Job Title", "Role Bucket", "Company", "Phone", "Location", "Status", "Email Health", "Created At", "Archived At"].join(","),
    ...contacts.map(
      (c) =>
        [
          escapeCSV(c.id),
          escapeCSV(c.name),
          escapeCSV(c.email),
          escapeCSV(c.jobTitle),
          escapeCSV(c.roleBucket),
          escapeCSV(c.company?.name),
          escapeCSV(c.phone),
          escapeCSV(c.location),
          escapeCSV(c.status),
          escapeCSV(c.emailHealth),
          escapeCSV(c.createdAt.toISOString()),
          escapeCSV(c.archivedAt?.toISOString()),
        ].join(",")
    ),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "companies") {
      const csv = await buildCompaniesCSV();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="companies.csv"',
        },
      });
    }

    if (type === "contacts") {
      const csv = await buildContactsCSV();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="contacts.csv"',
        },
      });
    }

    // Default: return JSON with both CSV strings (backward compat for settings screen)
    const [companiesCSV, contactsCSV] = await Promise.all([
      buildCompaniesCSV(),
      buildContactsCSV(),
    ]);

    return NextResponse.json({
      companies: companiesCSV,
      contacts: contactsCSV,
    });
  } catch (error) {
    console.error("Failed to export data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}