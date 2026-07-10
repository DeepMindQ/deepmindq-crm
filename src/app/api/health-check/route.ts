import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEmail } from "@/lib/email-verification";

// ---------------------------------------------------------------------------
// POST /api/health-check
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactIds, checkAll } = body;

    let contacts;

    if (checkAll) {
      contacts = await db.contact.findMany({
        where: {
          archivedAt: null,
          email: { not: null },
        },
      });
    } else if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      contacts = await db.contact.findMany({
        where: {
          id: { in: contactIds },
          email: { not: null },
        },
      });
    } else {
      return NextResponse.json(
        { error: "Provide contactIds array or set checkAll to true" },
        { status: 400 }
      );
    }

    let validCount = 0;
    let riskyCount = 0;
    let invalidCount = 0;

    for (const contact of contacts) {
      const email = contact.email!;

      // Run comprehensive validation via the shared engine
      const result = await validateEmail(email);

      // Map nullable DNS results to booleans for the DB schema
      const mxOk = result.mxOk ?? false;

      if (result.status === "valid") validCount++;
      else if (result.status === "risky") riskyCount++;
      else invalidCount++;

      await db.$transaction([
        db.contact.update({
          where: { id: contact.id },
          data: {
            emailHealth: result.status,
            emailHealthScore: result.score,
            lastValidatedAt: new Date(),
          },
        }),
        db.emailHealthCheck.create({
          data: {
            contactId: contact.id,
            status: result.status,
            score: result.score,
            actionRecommendation: result.recommendation,
            syntaxOk: result.syntaxOk,
            domainOk: result.domainOk,
            mxOk,
            disposableOk: result.disposableOk,
          },
        }),
        db.timelineEntry.create({
          data: {
            contactId: contact.id,
            companyId: contact.companyId,
            action: "email_health_check",
            details: `Email health check: ${result.status} (score ${result.score}) — ${result.recommendation}`,
          },
        }),
      ]);
    }

    return NextResponse.json({
      checked: contacts.length,
      valid: validCount,
      risky: riskyCount,
      invalid: invalidCount,
    });
  } catch (error) {
    console.error("Failed to run health check:", error);
    return NextResponse.json(
      { error: "Failed to run health check" },
      { status: 500 }
    );
  }
}