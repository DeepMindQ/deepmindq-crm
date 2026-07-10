import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE() {
  try {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reset database:", error);
    return NextResponse.json(
      { error: "Failed to reset database" },
      { status: 500 }
    );
  }
}