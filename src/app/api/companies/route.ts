import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitizeFields, safeInt } from "@/lib/apiHelpers";
import { createCompanySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let search = searchParams.get("search") || "";
    search = search.replace(/<[^>]*>/g, '').trim();
    const industry = searchParams.get("industry") || "";
    const status = searchParams.get("status") || "";
    const country = searchParams.get("country") || "";
    const page = Math.max(1, safeInt(searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 20)));

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

    return apiSuccess({
      companies: formatted,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return apiError("Failed to fetch companies", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateBody(createCompanySchema, body);
    if (data instanceof Response) return data;

    const sanitized = sanitizeFields(
      { ...data } as unknown as Record<string, unknown>,
      ["name", "domain", "website", "linkedinUrl"]
    );

    const company = await db.company.create({
      data: {
        name: sanitized.name || data.name,
        domain: sanitized.domain || null,
        industry: data.industry || null,
        employeeSize: data.employeeSize || null,
        country: data.country || null,
        location: data.location || null,
        website: sanitized.website || null,
        linkedinUrl: sanitized.linkedinUrl || null,
      },
    });

    await db.timelineEntry.create({
      data: {
        companyId: company.id,
        action: "company_created",
        details: `Company "${company.name}" was added to the database`,
      },
    });

    return apiSuccess(company, 201);
  } catch (error) {
    console.error("Failed to create company:", error);
    return apiError("Failed to create company", 500);
  }
}