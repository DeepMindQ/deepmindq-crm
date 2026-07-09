import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const companies = await db.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    const companiesCSV = [
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

    const contacts = await db.contact.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
      },
    });

    const contactsCSV = [
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