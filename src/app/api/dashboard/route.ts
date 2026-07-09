import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalCompanies,
      totalContacts,
      healthyEmails,
      riskyEmails,
      invalidEmails,
      archivedContacts,
      newThisWeek,
      draftsGenerated,
      recentActivity,
    ] = await Promise.all([
      db.company.count({
        where: { status: { not: "archived" } },
      }),
      db.contact.count({
        where: { archivedAt: null },
      }),
      db.contact.count({
        where: { emailHealth: "valid", archivedAt: null },
      }),
      db.contact.count({
        where: { emailHealth: "risky", archivedAt: null },
      }),
      db.contact.count({
        where: { emailHealth: "invalid", archivedAt: null },
      }),
      db.contact.count({
        where: { archivedAt: { not: null } },
      }),
      db.company.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      db.draft.count(),
      db.timelineEntry.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
        },
      }),
    ]);

    const stats = {
      totalCompanies,
      totalContacts,
      healthyEmails,
      riskyEmails,
      invalidEmails,
      archivedContacts,
      newThisWeek,
      draftsGenerated,
      recentActivity,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}