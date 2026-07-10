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

    const VALID_STATUSES = ["new", "researching", "qualified", "ready", "contacted", "won", "lost", "archived"];

    // Validate status if provided
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate intelligenceScore if provided
    if (body.intelligenceScore !== undefined) {
      if (typeof body.intelligenceScore !== "number" || !Number.isInteger(body.intelligenceScore) || body.intelligenceScore < 0 || body.intelligenceScore > 100) {
        return NextResponse.json(
          { error: "intelligenceScore must be an integer between 0 and 100" },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Trim string fields
        if (typeof body[field] === "string") {
          data[field] = (body[field] as string).trim();
        } else {
          data[field] = body[field];
        }
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