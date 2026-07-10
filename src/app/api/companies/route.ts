import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const industry = searchParams.get("industry") || "";
    const status = searchParams.get("status") || "";
    const country = searchParams.get("country") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20"))
    );

    const where: Record<string, unknown> = {
      status: { not: "archived" },
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { domain: { contains: search } },
        { website: { contains: search } },
      ];
    }
    if (industry) {
      where.industry = industry;
    }
    if (status) {
      where.status = status;
    }
    if (country) {
      where.country = country;
    }

    const [companies, total] = await Promise.all([
      db.company.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { contacts: true } },
          notes: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.company.count({ where }),
    ]);

    const formatted = companies.map((c) => ({
      ...c,
      _count: c._count,
      _latestNote: c.notes[0] || null,
      notes: undefined,
    }));

    return NextResponse.json({
      companies: formatted,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, domain, industry, employeeSize, country, location, website, linkedinUrl } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const company = await db.company.create({
      data: {
        name: name.trim(),
        domain: domain?.trim() || null,
        industry: industry?.trim() || null,
        employeeSize: employeeSize?.trim() || null,
        country: country?.trim() || null,
        location: location?.trim() || null,
        website: website?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
      },
    });

    await db.timelineEntry.create({
      data: {
        companyId: company.id,
        action: "company_created",
        details: `Company "${company.name}" was added to the database`,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Failed to create company:", error);
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}