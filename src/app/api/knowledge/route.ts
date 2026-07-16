import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitize, safeInt } from "@/lib/apiHelpers";
import { createKnowledgeDocSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// GET – list capability assets (paginated)
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
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

    return apiSuccess({ documents: formatted, total, page, pageSize: MAX_PAGE_SIZE });
  } catch (error) {
    console.error("Failed to fetch knowledge documents:", error);
    return apiError("Failed to fetch documents");
  }
}

// ---------------------------------------------------------------------------
// POST – create a capability asset from text content
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;

    if (!file) {
      return apiError("No file uploaded", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("File size exceeds the 10 MB limit", 400);
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".txt", ".md"];
    const blockedExtensions = [".pdf", ".docx", ".doc"];

    if (blockedExtensions.some((ext) => fileName.endsWith(ext))) {
      const ext = fileName.split(".").pop()!.toUpperCase();
      return apiError(
        `.${ext} files are not supported. Only .txt and .md files can be uploaded.`,
        400
      );
    }

    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      return apiError("Unsupported file type. Only .txt and .md files are accepted.", 400);
    }

    const rawTitle = (fd.get("title") as string) || file.name?.replace(/\.[^.]+$/, "") || "Untitled";
    const rawDescription = (fd.get("description") as string) || "";

    const parsed = validateBody(createKnowledgeDocSchema, {
      title: rawTitle,
      docType: "txt",
      description: rawDescription,
    });
    if (parsed instanceof Response) {
      return parsed;
    }

    const title = sanitize(parsed.title);
    const description = sanitize(parsed.description ?? "");
    const content = await file.text();

    // Store as a capability asset of type "service"
    const asset = await db.capabilityAsset.create({
      data: {
        title,
        summary: description || content.slice(0, 200),
        category: "service",
        content,
        tags: JSON.stringify(["uploaded", fileName.split(".").pop()]),
      },
    });

    return apiSuccess(asset, 201);
  } catch (error) {
    console.error("Failed to create knowledge document:", error);
    return apiError("Failed to create document");
  }
}