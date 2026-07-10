import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const emailHealth = searchParams.get("emailHealth") || "";
    const roleBucket = searchParams.get("roleBucket") || "";
    const companyId = searchParams.get("companyId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20"))
    );

    const where: Record<string, unknown> = {
      archivedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { jobTitle: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (emailHealth) {
      where.emailHealth = emailHealth;
    }
    if (roleBucket) {
      where.roleBucket = roleBucket;
    }
    if (companyId) {
      where.companyId = companyId;
    }

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
        },
      }),
      db.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, jobTitle, roleBucket, linkedinUrl, phone, location, companyId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Contact name is required" },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const contact = await db.contact.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        jobTitle: jobTitle?.trim() || null,
        roleBucket: roleBucket?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
        phone: phone?.trim() || null,
        location: location?.trim() || null,
        companyId,
      },
    });

    await db.timelineEntry.create({
      data: {
        companyId,
        contactId: contact.id,
        action: "contact_created",
        details: `Contact "${contact.name}" was added to "${company.name}"`,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Failed to create contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}