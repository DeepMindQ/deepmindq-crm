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

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, rawName: true, industry: true } },
        },
      }),
      db.contact.count({ where }),
    ]);

    return apiSuccess({
      contacts,
      total,
      page,
      pageSize,
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

    // Validate email format if provided and non-empty
    if (data.email && data.email.length > 0) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(data.email)) {
        return apiError("Invalid email format", 400);
      }
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: data.companyId } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    // Create a manual import batch for non-batch contact creation
    const batch = await db.importBatch.create({
      data: {
        fileName: 'manual-contact',
        fileHash: 'manual-' + Date.now(),
        totalRows: 1,
        status: 'completed',
      },
    });

    // Sanitize string fields
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
