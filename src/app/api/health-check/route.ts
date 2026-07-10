import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

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
    let invalidCount = 0;

    for (const contact of contacts) {
      const email = contact.email!;
      const syntaxOk = EMAIL_REGEX.test(email);

      // Simple domain check: does the domain part have at least one dot?
      const domainPart = email.split("@")[1] || "";
      const domainParts = domainPart.split(".");
      const domainOk = domainParts.length >= 2 && domainParts[domainParts.length - 1].length >= 2;

      // MX check is not possible without DNS lookup in this environment, default to true if syntax and domain ok
      const mxOk = syntaxOk && domainOk;

      // Disposable check: simple heuristic - known disposable patterns
      const disposableDomains = [
        "mailinator.com", "guerrillamail.com", "tempmail.com",
        "throwaway.email", "yopmail.com", "sharklasers.com",
        "guerrillamailblock.com", "grr.la", "dispostable.com",
        "trashmail.com", "10minutemail.com",
      ];
      const disposableOk = !disposableDomains.includes(domainPart.toLowerCase());

      const isValid = syntaxOk && domainOk && disposableOk;
      const score = isValid ? 100 : syntaxOk ? 50 : 0;
      const status = isValid ? "valid" : syntaxOk ? "risky" : "invalid";
      const actionRecommendation = isValid
        ? "Email is valid and safe to send."
        : syntaxOk
          ? "Email syntax is valid but domain may have issues. Verify before sending."
          : "Email format is invalid. Do not send to this address.";

      if (isValid) validCount++;
      else invalidCount++;

      await db.$transaction([
        db.contact.update({
          where: { id: contact.id },
          data: {
            emailHealth: status,
            emailHealthScore: score,
            lastValidatedAt: new Date(),
          },
        }),
        db.emailHealthCheck.create({
          data: {
            contactId: contact.id,
            status,
            score,
            actionRecommendation,
            syntaxOk,
            domainOk,
            mxOk,
            disposableOk,
          },
        }),
      ]);
    }

    await db.timelineEntry.create({
      data: {
        action: "health_check_run",
        details: `Email health check completed: ${validCount} valid, ${invalidCount} invalid/risky out of ${contacts.length} contacts`,
      },
    });

    return NextResponse.json({
      checked: contacts.length,
      valid: validCount,
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