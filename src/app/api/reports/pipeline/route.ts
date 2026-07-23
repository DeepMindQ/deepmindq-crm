// @ts-nocheck
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

const STAGE_ORDER = ["researching", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_LABELS: Record<string, string> = {
  researching: "Researching",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

function parseDateParam(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));

    const whereClause: Record<string, unknown> = { status: { not: "archived" } };
    if (from) whereClause.createdAt = { ...(whereClause.createdAt as Record<string, unknown> ?? {}), gte: from };
    if (to) {
      const toEnd = new Date(to);
      toEnd.setDate(toEnd.getDate() + 1);
      whereClause.createdAt = { ...(whereClause.createdAt as Record<string, unknown> ?? {}), lt: toEnd };
    }

    // Fetch all non-archived opportunities with company name
    const opportunities = await db.opportunityRecommendation.findMany({
      where: whereClause,
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Group by status
    const byStatus = new Map<string, typeof opportunities>();
    for (const opp of opportunities) {
      const list = byStatus.get(opp.status) ?? [];
      list.push(opp);
      byStatus.set(opp.status, list);
    }

    // Calculate stage metrics
    const stages = STAGE_ORDER.map((stage) => {
      const opps = byStatus.get(stage) ?? [];
      const count = opps.length;

      // Avg days in stage (updatedAt - createdAt)
      let totalDays = 0;
      for (const opp of opps) {
        const created = new Date(opp.createdAt).getTime();
        const updated = new Date(opp.updatedAt).getTime();
        totalDays += Math.max(0, (updated - created) / (1000 * 60 * 60 * 24));
      }
      const avgDaysInStage = count > 0 ? Math.round((totalDays / count) * 10) / 10 : 0;

      // Conversion rate: % that moved to next stage
      // We look at what stage each opp is now vs. what it could have been
      // Simple approach: for active stages, conversion = (count in next active stage) / count in this stage
      let conversionRate = 0;
      const stageIdx = STAGE_ORDER.indexOf(stage);
      if (stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 2) {
        // Compare to next non-terminal stage
        const nextStage = STAGE_ORDER[stageIdx + 1];
        const nextCount = (byStatus.get(nextStage) ?? []).length;
        if (count > 0) conversionRate = Math.round((nextCount / (count + nextCount)) * 100);
      }

      return {
        stage: STAGE_LABELS[stage] ?? stage,
        count,
        value: count, // No amount field on Opportunity schema
        avgDaysInStage,
        conversionRate,
      };
    });

    // Total pipeline value (all active deals)
    const activeStages = STAGE_ORDER.slice(0, 4); // researching through negotiation
    let totalPipelineValue = 0;
    for (const s of activeStages) {
      totalPipelineValue += (byStatus.get(s) ?? []).length;
    }

    // Weighted pipeline value (probability-weighted)
    const stageProbability: Record<string, number> = {
      researching: 0.1,
      qualified: 0.25,
      proposal: 0.5,
      negotiation: 0.75,
    };
    let weightedPipelineValue = 0;
    for (const [stage, prob] of Object.entries(stageProbability)) {
      weightedPipelineValue += (byStatus.get(stage) ?? []).length * prob;
    }
    weightedPipelineValue = Math.round(weightedPipelineValue * 100) / 100;

    // Stage velocity: avg days across all active stages
    let totalActiveDays = 0;
    let totalActiveOpps = 0;
    for (const s of activeStages) {
      const opps = byStatus.get(s) ?? [];
      for (const opp of opps) {
        const created = new Date(opp.createdAt).getTime();
        const updated = new Date(opp.updatedAt).getTime();
        totalActiveDays += (updated - created) / (1000 * 60 * 60 * 24);
        totalActiveOpps++;
      }
    }
    const stageVelocity = totalActiveOpps > 0 ? Math.round((totalActiveDays / totalActiveOpps) * 10) / 10 : 0;

    // Win rate
    const won = (byStatus.get("won") ?? []).length;
    const lost = (byStatus.get("lost") ?? []).length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    // Avg deal size (deal count, since no amount field)
    const allDealCount = opportunities.length;
    const avgDealSize = allDealCount > 0 ? 1 : 0;

    // Deal count by month
    const monthMap = new Map<string, number>();
    for (const opp of opportunities) {
      const d = new Date(opp.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
    const dealCountByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    return apiSuccess({
      stages,
      totalPipelineValue,
      weightedPipelineValue,
      stageVelocity,
      winRate,
      avgDealSize,
      dealCountByMonth,
    });
  } catch (error) {
    console.error("Failed to generate pipeline report:", error);
    return apiError("Failed to generate pipeline report", 500);
  }
}