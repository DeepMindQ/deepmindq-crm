import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess, validateBody, sanitizeFields, safeInt } from "@/lib/apiHelpers";
import { createContactSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let search = searchParams.get("search") || "";
    search = search.replace(/<[^>]*>/g, '').trim();
    const status = searchParams.get("status") || "";
    const emailHealth = searchParams.get("emailHealth") || "";
    const roleBucket = searchParams.get("roleBucket") || "";
    const companyId = searchParams.get("companyId") || "";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortDir = (searchParams.get("sortDir") || "asc") === "desc" ? "desc" : "asc";
    const page = Math.max(1, safeInt(searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 20)));

    const where: Prisma.ContactWhereInput = {};

    if (search) {
      where.OR = [
        { rawName: { contains: search } },
        { email: { contains: search } },
        { title: { contains: search } },
        { normalizedName: { contains: search.toLowerCase() } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (emailHealth) {
      where.emailHealth = emailHealth;
    }
    if (roleBucket) {
      where.role = roleBucket;
    }
    if (companyId) {
      where.companyId = companyId;
    }

    let orderBy: Prisma.ContactOrderByWithRelationInput;
    switch (sortBy) {
      case "score":
        orderBy = { leadScore: sortDir };
        break;
      case "emailHealth":
        orderBy = { emailHealthScore: sortDir };
        break;
      case "status":
        orderBy = { status: sortDir };
        break;
      default:
        orderBy = { rawName: sortDir };
    }

    const [contacts, total, globalStats] = await Promise.all([
      db.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          company: { select: { id: true, rawName: true, industry: true } },
          _count: { select: { drafts: true } },
        },
      }),
      db.contact.count({ where }),
      db.contact.aggregate({
        _avg: { leadScore: true, emailHealthScore: true },
        _count: { id: true },
      }),
    ]);

    const engaged = await db.contact.count({
      where: { ...where, status: { in: ["replied", "queued", "sent"] } },
    });
    const validEmails = await db.contact.count({
      where: { ...where, emailHealth: "valid" },
    });

    const contactRows = contacts.map((c: any) => ({
      id: c.id,
      name: c.rawName,
      email: c.email,
      jobTitle: c.title,
      roleBucket: c.role,
      linkedinUrl: c.linkedinUrl,
      status: c.status,
      emailHealth: c.emailHealth,
      emailHealthScore: c.emailHealthScore,
      leadScore: c.leadScore,
      company: c.company,
      draftCount: c._count?.drafts ?? 0,
      createdAt: c.createdAt,
    }));

    return apiSuccess({
      contacts: contactRows,
      total,
      page,
      pageSize,
      stats: {
        total: globalStats._count.id,
        avgScore: Math.round(globalStats._avg.leadScore ?? 0),
        emailValidPct: globalStats._count.id > 0
          ? Math.round((validEmails / globalStats._count.id) * 100)
          : 0,
        engaged,
      },
    });
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return apiError("Failed to fetch contacts", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateBody(createContactSchema, body);
    if (data instanceof Response) return data;

    if (data.email && data.email.length > 0) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(data.email)) {
        return apiError("Invalid email format", 400);
      }
    }

    const company = await db.company.findUnique({ where: { id: data.companyId } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    const batch = await db.importBatch.create({
      data: {
        fileName: 'manual-contact',
        fileHash: 'manual-' + Date.now(),
        totalRows: 1,
        status: 'completed',
      },
    });

    const sanitized = sanitizeFields(
      { ...data } as unknown as Record<string, unknown>,
      ["name", "email", "jobTitle", "linkedinUrl", "phone", "location"]
    );

    const contact = await db.contact.create({
      data: {
        rawName: sanitized.name || data.name,
        normalizedName: (sanitized.name || data.name || '').toLowerCase(),
        email: sanitized.email || data.email || `no-email-${Date.now()}@import.local`,
        title: sanitized.jobTitle || '',
        linkedinUrl: sanitized.linkedinUrl || '',
        phone: sanitized.phone || '',
        location: sanitized.location || '',
        companyId: data.companyId,
        batchId: batch.id,
      },
    });

    return apiSuccess(contact, 201);
  } catch (error) {
    console.error("Failed to create contact:", error);
    return apiError("Failed to create contact", 500);
  }
}
