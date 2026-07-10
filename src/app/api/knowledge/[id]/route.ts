import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET – single capability document with snippets
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const doc = await db.capabilityDocument.findUnique({
      where: { id },
      include: { snippets: { orderBy: { createdAt: "desc" } } },
    });

    if (!doc) {
      return apiError("Not found", 404);
    }

    return apiSuccess(doc);
  } catch {
    return apiError("Failed to fetch document");
  }
}

// ---------------------------------------------------------------------------
// DELETE – remove document (snippets cascade automatically)
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Confirm the document exists first
    const doc = await db.capabilityDocument.findUnique({ where: { id } });
    if (!doc) {
      return apiError("Not found", 404);
    }

    // Snippets are deleted automatically via onDelete: Cascade
    await db.capabilityDocument.delete({ where: { id } });

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to delete document");
  }
}