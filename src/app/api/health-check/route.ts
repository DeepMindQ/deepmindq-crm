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
    const BATCH_SIZE = 5;

    // Process contacts in parallel batches of 5
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (contact) => {
          const email = contact.email!;
          const result = await validateEmail(email);
          const mxOk = result.mxOk ?? false;

          if (result.status === "valid") return { contact, result, mxOk, countType: "valid" as const };
          if (result.status === "risky") return { contact, result, mxOk, countType: "risky" as const };
          return { contact, result, mxOk, countType: "invalid" as const };
        })
      );

      // Write all results in a single transaction per batch
      await db.$transaction([
        ...results.flatMap(({ contact, result, mxOk }) => [
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
        ]),
      ]);

      for (const r of results) {
        if (r.countType === "valid") validCount++;
        else if (r.countType === "risky") riskyCount++;
        else invalidCount++;
      }
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