import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET – single capability asset
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const asset = await db.capabilityAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return apiError("Not found", 404);
    }

    return apiSuccess(asset);
  } catch {
    return apiError("Failed to fetch document");
  }
}

// ---------------------------------------------------------------------------
// DELETE – remove capability asset
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const asset = await db.capabilityAsset.findUnique({ where: { id } });
    if (!asset) {
      return apiError("Not found", 404);
    }

    await db.capabilityAsset.delete({ where: { id } });

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to delete document");
  }
}