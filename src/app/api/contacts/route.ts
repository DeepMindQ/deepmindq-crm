import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma, ContactStatus, ContactEmailHealth } from "@prisma/client";
import { apiError, apiSuccess, validateBody, sanitizeFields, safeInt } from "@/lib/apiHelpers";
import { parsePaginationParams, buildKeysetWhere, buildPaginationResponse, encodeCursor } from '@/lib/keyset-pagination';
import { createContactSchema } from "@/lib/validations";
import { logger } from '@/lib/logger';
import { checkApiAuth, filterResponseArrayByRole } from '@/lib/api-auth';
import { activateIntelligenceAsync } from '@/lib/intelligence-activation';
import { withApiLogging } from '@/lib/api-logging-middleware';

async function contactsListHandler(request: NextRequest) {
    // ── Authentication + RBAC Guard ──
  const { errorResponse, session } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    let search = searchParams.get("search") || "";
    search = search.replace(/<[^>]*>/g, '').trim();
    const status = searchParams.get("status") || "";
    const emailHealth = searchParams.get("emailHealth") || "";
    const roleBucket = searchParams.get("roleBucket") || "";
    const companyId = searchParams.get("companyId") || "";
    const sortByParam = searchParams.get("sortBy") || "name";
    const sortDir = (searchParams.get("sortDir") || "asc") === "desc" ? "desc" : "asc";
    const page = Math.max(1, safeInt(searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 20)));
    const cursorParam = searchParams.get("cursor") || null;

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
      where.status = status as ContactStatus;
    }
    if (emailHealth) {
      where.emailHealth = emailHealth as ContactEmailHealth;
    }
    if (roleBucket) {
      where.role = roleBucket;
    }
    if (companyId) {
      where.companyId = companyId;
    }

    let orderBy: Prisma.ContactOrderByWithRelationInput;
    let prismaSortField = 'rawName';
    switch (sortByParam) {
      case "score":
        orderBy = { leadScore: sortDir };
        prismaSortField = 'leadScore';
        break;
      case "emailHealth":
        orderBy = { emailHealthScore: sortDir };
        prismaSortField = 'emailHealthScore';
        break;
      case "status":
        orderBy = { status: sortDir };
        prismaSortField = 'status';
        break;
      default:
        orderBy = { rawName: sortDir };
        prismaSortField = 'rawName';
    }

    const cursor = cursorParam;
    const keysetWhere = cursor
      ? buildKeysetWhere({ cursor, sortBy: prismaSortField, sortOrder: sortDir as 'asc' | 'desc', additionalCursorFields: { id: null } })
      : {};

    const skip = cursor ? undefined : (page - 1) * pageSize;
    const takeLimit = cursor ? pageSize + 1 : pageSize;

    const [contacts, total, globalStats] = await Promise.all([
      db.contact.findMany({
        where: { ...where, ...keysetWhere },
        // P5.1: Explicit select to avoid SELECT * and heavy JSON fields
        select: {
          id: true,
          rawName: true,
          email: true,
          title: true,
          role: true,
          linkedinUrl: true,
          status: true,
          emailHealth: true,
          emailHealthScore: true,
          leadScore: true,
          companyId: true,
          createdAt: true,
          company: { select: { id: true, rawName: true, industry: true } },
          _count: { select: { drafts: true } },
        },
        ...(skip !== undefined ? { skip } : {}),
        take: takeLimit,
        orderBy,
      }),
      db.contact.count({ where }),
      db.contact.aggregate({
        _avg: { leadScore: true, emailHealthScore: true },
        _count: { id: true },
      }),
    ]);

    // Keyset: detect hasMore and trim extra item
    const hasMore = cursor ? contacts.length > pageSize : false;
    if (hasMore) contacts.pop();

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

    // ── Field-Level Permission Filtering (5.3) ──
    const filteredContacts = session
      ? filterResponseArrayByRole(contactRows, session, 'Contact')
      : contactRows;

    // Build nextCursor for keyset pagination
    const nextCursor = hasMore && contacts.length > 0
      ? encodeCursor({ [prismaSortField]: (contacts[contacts.length - 1] as any)[prismaSortField], id: contacts[contacts.length - 1].id })
      : null;

    return apiSuccess({
      contacts: filteredContacts,
      total,
      page,
      pageSize,
      nextCursor,
      hasMore,
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
    logger.error("Failed to fetch contacts:", { error: error });
    return apiError("Failed to fetch contacts", 500);
  }
}

async function contactsCreateHandler(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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

    // WI-17A: Activate intelligence for the company with this new contact
    activateIntelligenceAsync({
      companyId: data.companyId,
      trigger: 'contact_manual',
      contactIds: [contact.id],
    });

    return apiSuccess(contact, 201);
  } catch (error) {
    logger.error("Failed to create contact:", { error: error });
    return apiError("Failed to create contact", 500);
  }
}

export const GET = withApiLogging(contactsListHandler, '/api/contacts');
export const POST = withApiLogging(contactsCreateHandler, '/api/contacts');
