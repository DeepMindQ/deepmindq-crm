import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

function parseDateParam(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));

    // Default to last 30 days if no params
    const now = new Date();
    const defaultFrom = from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const defaultTo = to ?? now;

    const dateFilter = { gte: defaultFrom, lt: new Date(defaultTo.getTime() + 24 * 60 * 60 * 1000) };

    const whereClause: { createdAt: typeof dateFilter } = {
      createdAt: dateFilter,
    };

    // Fetch all timeline entries in range
    const timelineEntries = await db.timelineEntry.findMany({
      where: whereClause,
      select: { action: true, createdAt: true },
    });

    // Total activities
    const totalActivities = timelineEntries.length;

    // By type
    const typeMap = new Map<string, number>();
    for (const entry of timelineEntries) {
      typeMap.set(entry.action, (typeMap.get(entry.action) ?? 0) + 1);
    }
    const byType = Array.from(typeMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // By day (last 30 days)
    const dayMap = new Map<string, number>();
    const last30Days: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = getDayKey(d);
      dayMap.set(key, 0);
      last30Days.push({ date: key, count: 0 });
    }
    for (const entry of timelineEntries) {
      const key = getDayKey(new Date(entry.createdAt));
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }
    }
    for (const item of last30Days) {
      item.count = dayMap.get(item.date) ?? 0;
    }

    // Specific counts
    const emailsGenerated = timelineEntries.filter(
      (e) => e.action === "email_generated"
    ).length;
    const researchGenerated = timelineEntries.filter(
      (e) => e.action === "research_generated"
    ).length;
    const notesCreated = timelineEntries.filter(
      (e) => e.action === "note_added"
    ).length;

    // Emails sent (drafts with sent/approved status)
    const emailsSent = await db.draft.count({
      where: {
        status: { in: ["sent", "approved"] },
        createdAt: whereClause.createdAt,
      },
    });

    // Health checks run
    const healthChecksRun = await db.emailHealthCheck.count({
      where: { checkedAt: whereClause.createdAt as Record<string, Date> },
    });

    // Activity heatmap (hour x day of week)
    const heatmap = Array.from({ length: 24 * 7 }, (_, idx) => {
      const hour = idx % 24;
      const day = Math.floor(idx / 24);
      return { hour, day, count: 0 };
    });
    for (const entry of timelineEntries) {
      const d = new Date(entry.createdAt);
      const day = d.getDay(); // 0=Sun, 6=Sat
      const hour = d.getHours();
      const idx = day * 24 + hour;
      if (idx >= 0 && idx < heatmap.length) {
        heatmap[idx].count++;
      }
    }

    // Top users from audit logs (fallback to system user)
    const auditLogs = await db.auditLog.findMany({
      where: whereClause,
      select: { userId: true, user: { select: { name: true } } },
    });

    const userMap = new Map<string, { name: string; activities: number }>();
    for (const log of auditLogs) {
      const existing = userMap.get(log.userId);
      const name = log.user?.name ?? "System";
      if (existing) {
        existing.activities++;
      } else {
        userMap.set(log.userId, { name, activities: 1 });
      }
    }
    const topUsers = Array.from(userMap.entries())
      .map(([, v]) => v)
      .sort((a, b) => b.activities - a.activities)
      .slice(0, 10);

    // Fallback: if no audit logs, create placeholder
    if (topUsers.length === 0) {
      topUsers.push({ name: "System", activities: totalActivities });
    }

    return apiSuccess({
      totalActivities,
      byType,
      byDay: last30Days,
      emailsGenerated,
      emailsSent,
      researchGenerated,
      healthChecksRun,
      notesCreated,
      activityHeatmap: heatmap,
      topUsers,
    });
  } catch (error) {
    console.error("Failed to generate activity report:", error);
    return apiError("Failed to generate activity report", 500);
  }
}