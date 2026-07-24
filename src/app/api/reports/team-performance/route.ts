import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

export async function GET() {
  try {
    // Fetch all users
    const users = await db.user.findMany({
      select: { id: true, name: true },
    });

    // If no users exist, create a system user placeholder
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

    // Get audit logs grouped by user for activity counts
    const auditLogs = await db.auditLog.findMany({
      select: { userId: true, createdAt: true },
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

    // Get task counts by creator — skip if model doesn't exist
    // const tasksByCreator = await db.task.groupBy({
    //   by: ["createdBy"],
    //   _count: { id: true },
    // });
    const taskMap = new Map<string, number>();

    // Build user reports
    const userReports = users.map((user) => {
      const activity = userActivityMap.get(user.id);

      return {
        userId: user.id,
        name: user.name,
        companiesOwned: 0, // No owner field on Company
        contactsCreated: 0, // No createdBy on Contact
        emailsGenerated: 0, // No createdBy on Draft
        emailsSent: 0,
        dealsWon: 0, // No owner on Opportunity
        dealsLost: 0,
        winRate: 0,
        revenue: 0,
        activities: activity?.count ?? 0,
        lastActive: activity?.lastActive ?? new Date(0).toISOString(),
      };
    });

    // Try to enrich from audit logs entity types
    const auditByEntity = await db.auditLog.groupBy({
      by: ["userId", "entity"],
      _count: { id: true },
    });

    for (const entry of auditByEntity) {
      const user = userReports.find((u) => u.userId === entry.userId);
      if (!user) continue;
      const count = entry._count.id;
      switch (entry.entity) {
        case "Company":
          user.companiesOwned += count;
          break;
        case "Contact":
          user.contactsCreated += count;
          break;
        case "Draft":
          user.emailsGenerated += count;
          break;
        case "Opportunity":
          // Split between won/lost from details
          break;
      }
    }

    // Calculate leaderboard
    const topCompanies = Math.max(...userReports.map((u) => u.companiesOwned));
    const topEmails = Math.max(...userReports.map((u) => u.emailsGenerated));
    const topDeals = Math.max(
      ...userReports.map((u) => u.dealsWon + u.dealsLost)
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
    console.error("Failed to generate team performance report:", error);
    return apiError("Failed to generate team performance report", 500);
  }
}