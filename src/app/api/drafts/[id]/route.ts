// @ts-nocheck
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitize } from "@/lib/apiHelpers";
import { updateDraftSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = await request.json();

    const parsed = validateBody(updateDraftSchema, raw);
    if (parsed instanceof Response) {
      return parsed;
    }

    // Extract rejectReason from raw body if present (not in schema)
    const { rejectReason } = raw as { rejectReason?: string };

    // Use transaction to prevent race condition (H6)
    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.draft.findUnique({
        where: { id },
        include: { contact: { select: { id: true, name: true, companyId: true } } },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const updateData: Record<string, unknown> = {};

      if (parsed.subject !== undefined) updateData.subject = sanitize(parsed.subject);
      if (parsed.body !== undefined) updateData.body = sanitize(parsed.body);
      if (parsed.cta !== undefined) updateData.cta = parsed.cta ?? null;
      if (parsed.serviceAngle !== undefined) updateData.serviceAngle = parsed.serviceAngle ?? null;
      if (parsed.status !== undefined) updateData.status = parsed.status;
      if (rejectReason !== undefined) updateData.rejectReason = rejectReason ?? null;

      const draft = await tx.draft.update({
        where: { id },
        data: updateData,
        include: { contact: true },
      });

      // Create timeline entry when status changes to 'sent' or 'rejected' from non-sent
      const newStatus = parsed.status;
      if (newStatus && (newStatus === "sent" || newStatus === "rejected") && existing.status !== newStatus) {
        const companyId = draft.contact?.companyId;
        if (companyId) {
          const action = newStatus === "sent" ? "email_sent" : "draft_updated";
          const details =
            newStatus === "sent"
              ? `Draft email "${draft.subject || "(no subject)"}" was sent to ${draft.contact?.name}`
              : `Draft email "${draft.subject || "(no subject)"}" was rejected for ${draft.contact?.name}`;

          await tx.timelineEntry.create({
            data: {
              contactId: draft.contactId,
              companyId,
              action,
              details,
            },
          });
        }
      }

      return draft;
    });

    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return apiError("Draft not found", 404);
    }
    console.error("Failed to update draft:", error);
    return apiError("Failed to update draft", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.draft.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Draft not found", 404);
    }

    await db.draft.delete({ where: { id } });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Failed to delete draft:", error);
    return apiError("Failed to delete draft", 500);
  }
}