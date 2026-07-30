/**
 * Knowledge API — List & Create
 *
 * GET  /api/knowledge      — List capability assets (paginated)
 * POST /api/knowledge      — Upload a document (file upload)
 *
 * Standardized response: { success, data, meta: { endpoint, durationMs } }
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from '@/lib/logger';
import { apiError, apiSuccess, validateBody, sanitize, safeInt } from "@/lib/apiHelpers";
import { createKnowledgeDocSchema } from "@/lib/validations";

const MAX_PAGE_SIZE = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// GET – list capability assets (paginated)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, safeInt(searchParams.get("page"), 1));
    const skip = (page - 1) * MAX_PAGE_SIZE;

    const [assets, total] = await Promise.all([
      db.capabilityAsset.findMany({
        take: MAX_PAGE_SIZE,
        skip,
        orderBy: { createdAt: "desc" },
        where: { isActive: true },
      }),
      db.capabilityAsset.count({ where: { isActive: true } }),
    ]);

    const formatted = assets.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.summary,
      category: a.category,
      serviceLine: a.serviceLine,
      createdAt: a.createdAt,
    }));

    return Response.json({
      success: true,
      data: { documents: formatted, total, page, pageSize: MAX_PAGE_SIZE },
      meta: { endpoint: 'knowledge:list', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error("[knowledge/list] failed", { error });
    return Response.json(
      { success: false, data: null, error: "Failed to fetch documents", meta: { endpoint: 'knowledge:list', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST – create a capability asset from file upload
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;

    if (!file) {
      return Response.json(
        { success: false, data: null, error: "No file uploaded", meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started } },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { success: false, data: null, error: "File size exceeds the 10 MB limit", meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started } },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".txt", ".md"];
    const blockedExtensions = [".pdf", ".docx", ".doc"];

    if (blockedExtensions.some((ext) => fileName.endsWith(ext))) {
      const ext = fileName.split(".").pop()!.toUpperCase();
      return Response.json(
        { success: false, data: null, error: `.${ext} files are not supported. Only .txt and .md files can be uploaded.`, meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started } },
        { status: 400 },
      );
    }

    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      return Response.json(
        { success: false, data: null, error: "Unsupported file type. Only .txt and .md files are accepted.", meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started } },
        { status: 400 },
      );
    }

    const rawTitle = (fd.get("title") as string) || file.name?.replace(/\.[^.]+$/, "") || "Untitled";
    const rawDescription = (fd.get("description") as string) || "";

    const parsed = validateBody(createKnowledgeDocSchema, {
      title: rawTitle,
      docType: "txt",
      description: rawDescription,
    });
    if (parsed instanceof Response) return parsed;

    const title = sanitize(parsed.title);
    const description = sanitize(parsed.description ?? "");
    const content = await file.text();

    const asset = await db.capabilityAsset.create({
      data: {
        title,
        summary: description || content.slice(0, 200),
        category: "service",
        content,
        tags: JSON.stringify(["uploaded", fileName.split(".").pop()]),
      },
    });

    return Response.json({
      success: true,
      data: asset,
      meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started },
    }, { status: 201 });
  } catch (error) {
    logger.error("[knowledge/create] failed", { error });
    return Response.json(
      { success: false, data: null, error: "Failed to create document", meta: { endpoint: 'knowledge:create', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}
