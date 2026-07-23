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
      db.companyTimelineEvent.deleteMany(),
      db.contactNote.deleteMany(),
      db.emailEvent.deleteMany(),
      db.draft.deleteMany(),
      db.companyNote.deleteMany(),
      db.companyResearchCard.deleteMany(),
      db.opportunityRecommendation.deleteMany(),
      db.capabilityAsset.deleteMany(),
      db.evidence.deleteMany(),
      db.companySignal.deleteMany(),
      db.sendQueue.deleteMany(),
      db.reply.deleteMany(),
      db.bounce.deleteMany(),
      db.suppression.deleteMany(),
      db.emailEvent.deleteMany(),
      db.sequenceEnrollment.deleteMany(),
      db.sequenceStep.deleteMany(),
      db.emailSequence.deleteMany(),
      db.draft.deleteMany(),
      // Custom fields
      db.dataUpload.deleteMany(),
      db.uploadRow.deleteMany(),
      // Contact → Company
      db.contact.deleteMany(),
      db.company.deleteMany(),
      db.importBatch.deleteMany(),
      // Intelligence layer
      db.companyIntelligenceHealth.deleteMany(),
      db.intelligenceConflict.deleteMany(),
      db.signalValidation.deleteMany(),
      db.intelligenceValidation.deleteMany(),
      db.signalCapabilityMatch.deleteMany(),
      db.pursuit.deleteMany(),
      db.recommendationFeedback.deleteMany(),
      db.knowledgeEntry.deleteMany(),
      db.intelligenceObject.deleteMany(),
      db.intelligenceAssociation.deleteMany(),
      db.companyAlias.deleteMany(),
      db.humanIntelligenceInbox.deleteMany(),
      db.intelligenceTimeline.deleteMany(),
      db.intelligenceAlert.deleteMany(),
      db.accountBrief.deleteMany(),
      db.opportunitySignal.deleteMany(),
      db.accountScore.deleteMany(),
    ]);

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to reset database");
  }
}