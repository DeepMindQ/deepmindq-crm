import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId query parameter is required" },
        { status: 400 }
      );
    }

    const opportunities = await db.opportunity.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(opportunities);
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Opportunity ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const allowedFields = ["title", "description", "targetContactId", "status", "nextAction"];
    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field];
      }
    }

    const updated = await db.opportunity.update({
      where: { id },
      data,
    });

    await db.timelineEntry.create({
      data: {
        companyId: existing.companyId,
        action: "opportunity_updated",
        details: `Opportunity "${updated.title}" status changed to "${updated.status}"`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update opportunity:", error);
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 }
    );
  }
}