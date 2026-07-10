import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20)
    );

    const where = companyId ? { companyId } : {};

    const [opportunities, total] = await Promise.all([
      db.opportunity.findMany({
        where,
        include: { company: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.opportunity.count({ where }),
    ]);

    return NextResponse.json({
      data: opportunities,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch opportunities:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, title, description, targetContactId, status, nextAction } = body;

    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Opportunity title is required" },
        { status: 400 }
      );
    }

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const opportunity = await db.opportunity.create({
      data: {
        companyId,
        title: title.trim(),
        description: description?.trim() || null,
        targetContactId: targetContactId || null,
        status: status?.trim() || "researching",
        nextAction: nextAction?.trim() || null,
      },
      include: { company: true },
    });

    await db.timelineEntry.create({
      data: {
        companyId,
        action: "opportunity_created",
        details: `New opportunity "${opportunity.title}" created for "${company.name}"`,
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error("Failed to create opportunity:", error);
    return NextResponse.json(
      { error: "Failed to create opportunity" },
      { status: 500 }
    );
  }
}