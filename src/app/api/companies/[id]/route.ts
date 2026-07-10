import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await db.company.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
        researchCard: true,
        opportunities: {
          orderBy: { createdAt: "desc" },
        },
        timeline: {
          orderBy: { createdAt: "desc" },
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const allowedFields = [
      "name",
      "domain",
      "linkedinUrl",
      "website",
      "industry",
      "employeeSize",
      "country",
      "location",
      "status",
      "intelligenceScore",
      "dataFreshness",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const updated = await db.company.update({
      where: { id },
      data,
    });

    await db.timelineEntry.create({
      data: {
        companyId: id,
        action: "company_updated",
        details: `Company "${updated.name}" was updated`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update company:", error);
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const archived = await db.company.update({
      where: { id },
      data: { status: "archived" },
    });

    await db.timelineEntry.create({
      data: {
        companyId: id,
        action: "company_archived",
        details: `Company "${company.name}" was archived`,
      },
    });

    return NextResponse.json(archived);
  } catch (error) {
    console.error("Failed to archive company:", error);
    return NextResponse.json(
      { error: "Failed to archive company" },
      { status: 500 }
    );
  }
}