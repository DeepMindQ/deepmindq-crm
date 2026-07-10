import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// DELETE /api/reset — destructive reset, requires confirmation
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    // C3: Require explicit confirmation in the request body
    let confirm = false;
    try {
      const body = await request.json();
      confirm = body?.confirm === true;
    } catch {
      // No JSON body or invalid JSON
    }

    if (!confirm) {
      return apiError(
        "Confirmation required. Send { \"confirm\": true } in the request body to proceed with the reset.",
        400,
      );
    }

    await db.$transaction([
      // Leaf tables first (no FK deps, or only nullable FK deps)
      db.timelineEntry.deleteMany(),
      db.contactNote.deleteMany(),
      db.emailHealthCheck.deleteMany(),
      db.draft.deleteMany(),
      db.companyNote.deleteMany(),
      db.companyResearchSource.deleteMany(),
      db.companyResearchCard.deleteMany(),
      db.opportunity.deleteMany(),
      // CapabilitySnippet → CapabilityDocument
      db.capabilitySnippet.deleteMany(),
      db.capabilityDocument.deleteMany(),
      // Custom fields (plain string refs, no FK constraints)
      db.customFieldValue.deleteMany(),
      db.customFieldDefinition.deleteMany(),
      // Contact → Company
      db.contact.deleteMany(),
      db.company.deleteMany(),
      // Standalone tables
      db.importBatch.deleteMany(),
      // UserPreferences is intentionally kept
    ]);

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to reset database");
  }
}