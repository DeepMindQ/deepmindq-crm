import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLast7DayKeys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(getDayKey(d));
  }
  return keys;
}

function countsByDayToSparkline(
  groups: { _count: number; dateKey: string }[],
  dayKeys: string[]
): number[] {
  const counts: Record<string, number> = {};
  for (const key of dayKeys) counts[key] = 0;
  for (const g of groups) {
    if (g.dateKey in counts) counts[g.dateKey] = g._count;
  }
  return dayKeys.map((k) => counts[k]);
}

function calcTrend(thisWeek: number, lastWeek: number): number {
  if (lastWeek === 0) return thisWeek > 0 ? 100 : 0;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const dayKeys = getLast7DayKeys();

    const [
      totalCompanies,
      totalContacts,
      healthyEmails,
      riskyEmails,
      invalidEmails,
      archivedContacts,
      newThisWeek,
      draftsGenerated,
      thisWeekDrafts,
      recentActivity,
      pipelineGroups,
      companySparkline,
      contactSparkline,
      healthySparkline,
      invalidSparkline,
      lastWeekCompanies,
      lastWeekContacts,
      lastWeekHealthyChecks,
      lastWeekInvalidChecks,
      lastWeekDrafts,
      tasks,
    ] = await Promise.all([
      // Core counts
      db.company.count({ where: { status: { not: "archived" } } }),
      db.contact.count({ where: { archivedAt: null } }),
      db.contact.count({ where: { emailHealth: "valid", archivedAt: null } }),
      db.contact.count({ where: { emailHealth: "risky", archivedAt: null } }),
      db.contact.count({ where: { emailHealth: "invalid", archivedAt: null } }),
      db.contact.count({ where: { archivedAt: { not: null } } }),
      db.company.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      // MEDIUM-02: Filter draftsGenerated to recent 90 days instead of all-time
      (() => {
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return db.draft.count({ where: { createdAt: { gte: ninetyDaysAgo } } });
      })(),
      db.draft.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // Activity feed
      db.timelineEntry.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
        },
      }),

      // Pipeline — group companies by status (exclude archived)
      db.company.groupBy({
        by: ["status"],
        where: { status: { not: "archived" } },
        _count: { status: true },
      }),

      // Sparklines — H2 fix: use groupBy instead of loading all records
      db.$queryRaw<Array<{ dateKey: string; _count: bigint }>>`
        SELECT
          strftime('%Y-%m-%d', "createdAt") as "dateKey",
          COUNT(*) as "_count"
        FROM "Company"
        WHERE "createdAt" >= ${sevenDaysAgo.toISOString()}
        GROUP BY "dateKey"
      `,
      db.$queryRaw<Array<{ dateKey: string; _count: bigint }>>`
        SELECT
          strftime('%Y-%m-%d', "createdAt") as "dateKey",
          COUNT(*) as "_count"
        FROM "Contact"
        WHERE "createdAt" >= ${sevenDaysAgo.toISOString()} AND "archivedAt" IS NULL
        GROUP BY "dateKey"
      `,
      db.$queryRaw<Array<{ dateKey: string; _count: bigint }>>`
        SELECT
          strftime('%Y-%m-%d', "checkedAt") as "dateKey",
          COUNT(*) as "_count"
        FROM "EmailHealthCheck"
        WHERE "checkedAt" >= ${sevenDaysAgo.toISOString()} AND "status" = 'valid'
        GROUP BY "dateKey"
      `,
      db.$queryRaw<Array<{ dateKey: string; _count: bigint }>>`
        SELECT
          strftime('%Y-%m-%d', "checkedAt") as "dateKey",
          COUNT(*) as "_count"
        FROM "EmailHealthCheck"
        WHERE "checkedAt" >= ${sevenDaysAgo.toISOString()} AND "status" = 'invalid'
        GROUP BY "dateKey"
      `,

      // Last week data for trends
      db.company.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      db.contact.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, archivedAt: null } }),
      db.emailHealthCheck.count({ where: { checkedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, status: "valid" } }),
      db.emailHealthCheck.count({ where: { checkedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, status: "invalid" } }),
      db.draft.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

      // Tasks — opportunities with next action, not won/lost
      db.opportunity.findMany({
        where: { nextAction: { not: null }, status: { notIn: ["won", "lost"] } },
        include: {
          company: { select: { name: true } },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Build pipeline
    const pipelineMap: Record<string, number> = {};
    for (const g of pipelineGroups) {
      pipelineMap[g.status] = g._count.status;
    }
    const pipelineLabels = ["New", "Researching", "Contacted", "Qualified", "Ready", "Won", "Lost"];
    const pipeline = pipelineLabels.map((label) => ({
      label,
      count: pipelineMap[label.toLowerCase()] || 0,
    }));

    // Build sparklines from groupBy results
    const sparklines = {
      companies: countsByDayToSparkline(
        companySparkline.map((r) => ({ dateKey: r.dateKey, _count: Number(r._count) })),
        dayKeys
      ),
      contacts: countsByDayToSparkline(
        contactSparkline.map((r) => ({ dateKey: r.dateKey, _count: Number(r._count) })),
        dayKeys
      ),
      healthy: countsByDayToSparkline(
        healthySparkline.map((r) => ({ dateKey: r.dateKey, _count: Number(r._count) })),
        dayKeys
      ),
      invalid: countsByDayToSparkline(
        invalidSparkline.map((r) => ({ dateKey: r.dateKey, _count: Number(r._count) })),
        dayKeys
      ),
    };

    // Compute this-week totals from sparkline data for trends
    const thisWeekContacts = sparklines.contacts.reduce((a, b) => a + b, 0);
    const thisWeekHealthy = sparklines.healthy.reduce((a, b) => a + b, 0);
    const thisWeekInvalid = sparklines.invalid.reduce((a, b) => a + b, 0);

    // Build trend percentages
    const trends = {
      companies: calcTrend(newThisWeek, lastWeekCompanies),
      contacts: calcTrend(thisWeekContacts, lastWeekContacts),
      healthy: calcTrend(thisWeekHealthy, lastWeekHealthyChecks),
      invalid: calcTrend(thisWeekInvalid, lastWeekInvalidChecks),
      newThisWeek: calcTrend(newThisWeek, lastWeekCompanies),
      drafts: calcTrend(thisWeekDrafts, lastWeekDrafts),
    };

    // Build tasks — resolve targetContact names manually (no relation on schema)
    const contactIds = [...new Set(tasks.map((t) => t.targetContactId).filter(Boolean))] as string[];
    const contactNames: Record<string, string> = {};
    if (contactIds.length > 0) {
      const contacts = await db.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, name: true },
      });
      for (const c of contacts) contactNames[c.id] = c.name;
    }

    const mappedTasks = tasks.map((t) => ({
      id: t.id,
      title: t.nextAction,
      company: t.company.name,
      contact: t.targetContactId ? (contactNames[t.targetContactId] ?? null) : null,
      status: t.status,
      opportunityId: t.id,
    }));

    return apiSuccess({
      totalCompanies,
      totalContacts,
      healthyEmails,
      riskyEmails,
      invalidEmails,
      archivedContacts,
      newThisWeek,
      draftsGenerated,
      recentActivity,
      pipeline,
      sparklines,
      trends,
      tasks: mappedTasks,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return apiError("Failed to fetch dashboard stats", 500);
  }
}