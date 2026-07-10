import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE() {
  try {
    await db.$transaction([
      db.timelineEntry.deleteMany(),
      db.emailHealthCheck.deleteMany(),
      db.draft.deleteMany(),
      db.contactNote.deleteMany(),
      db.companyNote.deleteMany(),
      db.companyResearchSource.deleteMany(),
      db.companyResearchCard.deleteMany(),
      db.capabilitySnippet.deleteMany(),
      db.capabilityDocument.deleteMany(),
      db.opportunity.deleteMany(),
      db.contact.deleteMany(),
      db.company.deleteMany(),
      db.importBatch.deleteMany(),
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