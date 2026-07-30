/**
 * Knowledge API — Single Document
 *
 * GET    /api/knowledge/{id}  — Get a capability asset
 * DELETE /api/knowledge/{id}  — Delete a capability asset
 *
 * Standardized response: { success, data, meta: { endpoint, durationMs } }
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET – single capability asset
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const started = Date.now();
  try {
    const { id } = await params;

    const asset = await db.capabilityAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return Response.json(
        { success: false, data: null, error: "Not found", meta: { endpoint: 'knowledge:detail', durationMs: Date.now() - started } },
        { status: 404 },
      );
    }

    return Response.json({
      success: true,
      data: asset,
      meta: { endpoint: 'knowledge:detail', durationMs: Date.now() - started },
    });
  } catch (err) {
    logger.error("[knowledge/detail] failed", { error: err });
    return Response.json(
      { success: false, data: null, error: "Failed to fetch document", meta: { endpoint: 'knowledge:detail', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE – remove capability asset
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const started = Date.now();
  try {
    const { id } = await params;

    const asset = await db.capabilityAsset.findUnique({ where: { id } });
    if (!asset) {
      return Response.json(
        { success: false, data: null, error: "Not found", meta: { endpoint: 'knowledge:delete', durationMs: Date.now() - started } },
        { status: 404 },
      );
    }

    await db.capabilityAsset.delete({ where: { id } });

    return Response.json({
      success: true,
      data: { success: true },
      meta: { endpoint: 'knowledge:delete', durationMs: Date.now() - started },
    });
  } catch (err) {
    logger.error("[knowledge/delete] failed", { error: err });
    return Response.json(
      { success: false, data: null, error: "Failed to delete document", meta: { endpoint: 'knowledge:delete', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}
