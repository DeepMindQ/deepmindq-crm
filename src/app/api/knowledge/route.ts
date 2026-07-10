import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyChunk(text: string): string {
  const lower = text.toLowerCase();

  if (
    lower.includes("case study") ||
    lower.includes("results") ||
    lower.includes("outcome") ||
    lower.includes("achieved")
  ) {
    return "Case Study";
  }

  if (
    lower.includes("service") ||
    lower.includes("solution") ||
    lower.includes("offering") ||
    lower.includes("provide")
  ) {
    return "Service";
  }

  if (
    lower.includes("capability") ||
    lower.includes("feature") ||
    lower.includes("platform") ||
    lower.includes("technology")
  ) {
    return "Capability";
  }

  return "Outcome";
}

function extractSnippets(content: string): { title: string; content: string; snippetType: string }[] {
  // Split by double newlines (paragraphs) or lines starting with heading markers
  const chunks = content
    .split(/\n\n+|\n(?=#{1,6}\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 50);

  return chunks.map((chunk) => {
    const firstLine = chunk.split(/\n/)[0].trim();
    const title =
      firstLine.length > 0
        ? firstLine.length > 80
          ? firstLine.slice(0, 77) + "..."
          : firstLine.replace(/^#+\s*/, "") // strip heading markers
        : "Untitled Snippet";

    return {
      title,
      content: chunk,
      snippetType: classifyChunk(chunk),
    };
  });
}

// ---------------------------------------------------------------------------
// GET – list capability documents, optionally including snippets
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get("include");

    const docs = await db.capabilityDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        ...(include === "snippets"
          ? { snippets: { orderBy: { createdAt: "desc" } } }
          : { _count: { select: { snippets: true } } }),
      },
    });

    if (include === "snippets") {
      // Return { documents, snippets } format for the knowledge library screen
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

      return NextResponse.json({ documents, snippets: allSnippets });
    }

    // Default: return array of documents with snippet counts
    const formatted = docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      fileType: d.docType,
      fileName: d.fileName,
      snippetCount: (d as any)._count?.snippets ?? 0,
      createdAt: d.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST – create document & auto-extract snippets
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const title =
      (fd.get("title") as string) ||
      file.name?.replace(/\.[^.]+$/, "") ||
      "Untitled";
    const description = (fd.get("description") as string) || "";
    const content = await file.text();
    const docType = file.name?.split(".").pop()?.toUpperCase() || "TXT";

    const doc = await db.capabilityDocument.create({
      data: {
        title,
        docType,
        description,
        content,
        fileName: file.name || "unknown.txt",
      },
    });

    // Auto-extract snippets from the document content
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

    return NextResponse.json(
      { ...doc, snippetCount: snippetData.length },
      { status: 201 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}