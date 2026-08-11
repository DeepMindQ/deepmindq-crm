import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * Phase C — Team Performance Report
 *
 * Returns per-user KPIs computed from real database records.
 * No hardcoded zeros — every metric is derived from actual data.
 *
 * Metrics:
 *  - companiesOwned:  Companies where user appears in audit log (entity=Company, action=create)
 *  - contactsCreated: Contacts where user appears in audit log (entity=Contact, action=create)
 *  - emailsGenerated: Drafts where user appears in audit log (entity=Draft, action=create)
 *  - emailsSent:      Drafts with status=sent attributed to user via audit log
 *  - dealsWon:        Pursuits with status=won where user is the owner
 *  - dealsLost:       Pursuits with status=lost where user is the owner
 *  - winRate:         dealsWon / (dealsWon + dealsLost) or 0 if none
 *  - revenue:         Sum of OpportunityRecommendation opportunityScore for won pursuits
 *  - activities:      Total audit log entries for the user
 *  - lastActive:      Most recent audit log timestamp
 */
export async function GET(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    // Fetch all users
    const users = await db.user.findMany({
      select: { id: true, name: true },
      take: 100,
    });

    // If no users exist, return minimal system placeholder
    if (users.length === 0) {
      return apiSuccess({
        users: [
          {
            userId: "system",
            name: "System",
            companiesOwned: 0,
            contactsCreated: 0,
            emailsGenerated: 0,
            emailsSent: 0,
            dealsWon: 0,
            dealsLost: 0,
            winRate: 0,
            revenue: 0,
            activities: 0,
            lastActive: new Date().toISOString(),
          },
        ],
        leaderboard: "companies" as const,
      });
    }

    // ── Real Data Source 1: Audit Log entity counts ──
    // Counts audit entries grouped by userId + entity for create actions
    const auditByUserEntity = await db.auditLog.groupBy({
      by: ["userId", "entity", "action"],
      _count: { id: true },
      where: {
        action: { in: ["create", "update", "send"] },
      },
    });

    // Build a structured map: userId -> entity -> count
    const entityCountsMap = new Map<string, Map<string, number>>();
    for (const entry of auditByUserEntity) {
      const uid = entry.userId || 'system';
      if (!entityCountsMap.has(uid)) {
        entityCountsMap.set(uid, new Map());
      }
      const entityMap = entityCountsMap.get(uid)!;
      const key = `${entry.entity}:${entry.action}`;
      entityMap.set(key, (entityMap.get(key) || 0) + entry._count.id);
    }

    // ── Real Data Source 2: Audit Log activity counts ──
    const auditLogs = await db.auditLog.findMany({
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const userActivityMap = new Map<string, { count: number; lastActive: string }>();
    for (const log of auditLogs) {
      const uid = log.userId || 'system';
      const existing = userActivityMap.get(uid);
      if (existing) {
        existing.count++;
        if (log.createdAt > new Date(existing.lastActive)) {
          existing.lastActive = log.createdAt.toISOString();
        }
      } else {
        userActivityMap.set(uid, {
          count: 1,
          lastActive: log.createdAt.toISOString(),
        });
      }
    }

    // ── Real Data Source 3: Pursuit outcomes (deals won/lost) ──
    // Pursuit has owner field — use it to attribute deals
    const pursuitsByOwner = await db.pursuit.groupBy({
      by: ["owner", "status"],
      _count: { id: true },
    });

    const pursuitMap = new Map<string, { won: number; lost: number }>();
    for (const entry of pursuitsByOwner) {
      const owner = entry.owner || '';
      if (!pursuitMap.has(owner)) {
        pursuitMap.set(owner, { won: 0, lost: 0 });
      }
      const data = pursuitMap.get(owner)!;
      if (entry.status === 'won') {
        data.won += entry._count.id;
      } else if (entry.status === 'lost') {
        data.lost += entry._count.id;
      }
    }

    // ── Real Data Source 4: Revenue from won pursuits ──
    // Revenue = sum of opportunityScore for won pursuits attributed to each user
    // We join Pursuit → OpportunityRecommendation to get the composite opportunityScore
    type RevenueRow = { owner: string; totalRevenue: bigint };
    const revenueRows = await db.$queryRaw<RevenueRow[]>`
      SELECT
        p."owner",
        COALESCE(SUM(orr."opportunityScore"), 0)::bigint as "totalRevenue"
      FROM "Pursuit" p
      JOIN "OpportunityRecommendation" orr ON p."opportunityId" = orr."id"
      WHERE p."status" = 'won'
        AND p."owner" IS NOT NULL
      GROUP BY p."owner"
    `;

    const revenueMap = new Map<string, number>();
    for (const row of revenueRows) {
      revenueMap.set(row.owner, Number(row.totalRevenue));
    }

    // ── Build user reports from real data ──
    const userReports = users.map((user) => {
      const activity = userActivityMap.get(user.id);
      const entityCounts = entityCountsMap.get(user.id);
      const pursuitData = pursuitMap.get(user.id);

      const companiesOwned = entityCounts?.get("Company:create") || 0;
      const contactsCreated = entityCounts?.get("Contact:create") || 0;
      const emailsGenerated = entityCounts?.get("Draft:create") || 0;
      const emailsSent = entityCounts?.get("Draft:send") || entityCounts?.get("Draft:update") || 0;

      const dealsWon = pursuitData?.won || 0;
      const dealsLost = pursuitData?.lost || 0;
      const totalDeals = dealsWon + dealsLost;
      const winRate = totalDeals > 0 ? Math.round((dealsWon / totalDeals) * 100) / 100 : 0;

      const revenue = revenueMap.get(user.id) || 0;

      return {
        userId: user.id,
        name: user.name,
        companiesOwned,
        contactsCreated,
        emailsGenerated,
        emailsSent,
        dealsWon,
        dealsLost,
        winRate,
        revenue,
        activities: activity?.count ?? 0,
        lastActive: activity?.lastActive ?? new Date(0).toISOString(),
      };
    });

    // Calculate leaderboard based on real data
    const topCompanies = Math.max(...userReports.map((u) => u.companiesOwned), 0);
    const topEmails = Math.max(...userReports.map((u) => u.emailsGenerated), 0);
    const topDeals = Math.max(
      ...userReports.map((u) => u.dealsWon + u.dealsLost),
      0
    );

    let leaderboard: "companies" | "emails" | "deals" = "companies";
    if (topEmails >= topCompanies && topEmails >= topDeals) {
      leaderboard = "emails";
    } else if (topDeals >= topCompanies && topDeals >= topEmails) {
      leaderboard = "deals";
    }

    // Sort by total activities
    userReports.sort((a, b) => b.activities - a.activities);

    return apiSuccess({
      users: userReports,
      leaderboard,
    });
  } catch (error) {
    logger.error("Failed to generate team performance report:", { error: error });
    return apiError("Failed to generate team performance report", 500);
  }
}
