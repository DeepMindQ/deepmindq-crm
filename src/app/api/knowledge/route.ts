import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitize, safeInt } from "@/lib/apiHelpers";
import { createKnowledgeDocSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNIPPET_TYPES = ["capability", "case_study", "outcome", "service"] as const;

type SnippetType = (typeof SNIPPET_TYPES)[number];

function classifyChunk(text: string): SnippetType {
  const lower = text.toLowerCase();

  if (
    lower.includes("case study") ||
    lower.includes("results") ||
    lower.includes("achieved")
  ) {
    return "case_study";
  }

  if (
    lower.includes("service") ||
    lower.includes("solution") ||
    lower.includes("offering") ||
    lower.includes("provide")
  ) {
    return "service";
  }

  if (
    lower.includes("capability") ||
    lower.includes("feature") ||
    lower.includes("platform") ||
    lower.includes("technology")
  ) {
    return "capability";
  }

  return "outcome";
}

function extractSnippets(content: string): { title: string; content: string; snippetType: SnippetType }[] {
  const chunks = content
    .split(/\n\n+|\n(?=#{1,6}\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 50);

  const snippets = chunks.map((chunk) => {
    const firstLine = chunk.split(/\n/)[0].trim();
    const title =
      firstLine.length > 0
        ? firstLine.length > 80
          ? firstLine.slice(0, 77) + "..."
          : firstLine.replace(/^#+\s*/, "")
        : "Untitled Snippet";

    return {
      title,
      content: chunk,
      snippetType: classifyChunk(chunk),
    };
  });

  return snippets.slice(0, 5);
}

// ---------------------------------------------------------------------------
// GET – list capability documents, optionally including snippets (paginated)
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get("include");
    const page = Math.max(1, safeInt(searchParams.get("page"), 1));
    const skip = (page - 1) * MAX_PAGE_SIZE;

    const docs = await db.capabilityDocument.findMany({
      take: MAX_PAGE_SIZE,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        ...(include === "snippets"
          ? { snippets: { orderBy: { createdAt: "desc" } } }
          : { _count: { select: { snippets: true } } }),
      },
    });

    if (include === "snippets") {
      const allSnippets = docs.flatMap((d) =>
        (d as any).snippets.map((s: any) => ({
          id: s.id,
          documentId: s.documentId,
          type: s.snippetType,
          title: s.title,
          content: s.content,
          industries: s.industries ? s.industries.split(",").map((i: string) => i.trim()).filter(Boolean) : null,
          outcomes: s.outcomes ? s.outcomes.split(",").map((o: string) => o.trim()).filter(Boolean) : null,
        }))
      );

      const documents = docs.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        fileType: d.docType,
        fileName: d.fileName,
        snippetCount: (d as any).snippets?.length ?? 0,
        createdAt: d.createdAt,
      }));

      return apiSuccess({ documents, snippets: allSnippets });
    }

    const formatted = docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      fileType: d.docType,
      fileName: d.fileName,
      snippetCount: (d as any)._count?.snippets ?? 0,
      createdAt: d.createdAt,
    }));

    return apiSuccess(formatted);
  } catch {
    return apiError("Failed to fetch documents");
  }
}

// ---------------------------------------------------------------------------
// POST – create document & auto-extract snippets
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;

    if (!file) {
      return apiError("No file uploaded", 400);
    }

    // C9: Enforce 10 MB file size limit before reading
    if (file.size > MAX_FILE_SIZE) {
      return apiError("File size exceeds the 10 MB limit", 400);
    }

    // Only accept plain text file formats
    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".txt", ".md"];
    const blockedExtensions = [".pdf", ".docx", ".doc"];

    if (blockedExtensions.some((ext) => fileName.endsWith(ext))) {
      const ext = fileName.split(".").pop()!.toUpperCase();
      return apiError(
        `.${ext} files are not supported. Only .txt and .md files can be uploaded. Use a PDF/DOCX to text converter first.`,
        400,
      );
    }

    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      return apiError("Unsupported file type. Only .txt and .md files are accepted.", 400);
    }

    const rawTitle = (fd.get("title") as string) || file.name?.replace(/\.[^.]+$/, "") || "Untitled";
    const rawDescription = (fd.get("description") as string) || "";
    const rawDocType = (fd.get("docType") as string) || file.name?.split(".").pop()?.toUpperCase() || "TXT";

    // Validate with Zod
    const parsed = validateBody(createKnowledgeDocSchema, {
      title: rawTitle,
      docType: rawDocType.toLowerCase(),
      description: rawDescription,
    });
    if (parsed instanceof Response) {
      return parsed;
    }

    const title = sanitize(parsed.title);
    const description = sanitize(parsed.description ?? "");
    const docType = parsed.docType.toUpperCase();
    const content = await file.text();

    const doc = await db.capabilityDocument.create({
      data: {
        title,
        docType,
        description,
        content,
        fileName: file.name || "unknown.txt",
      },
    });

    const snippetData = extractSnippets(content);

    if (snippetData.length > 0) {
      await db.capabilitySnippet.createMany({
        data: snippetData.map((s) => ({
          documentId: doc.id,
          title: s.title,
          content: s.content,
          snippetType: s.snippetType,
        })),
      });
    }

    const createdDoc = await db.capabilityDocument.findUnique({
      where: { id: doc.id },
      include: { snippets: { orderBy: { createdAt: "desc" } } },
    });

    return apiSuccess(createdDoc, 201);
  } catch {
    return apiError("Failed to create document");
  }
}