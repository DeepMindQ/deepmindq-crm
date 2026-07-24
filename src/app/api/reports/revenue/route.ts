import { NextRequest } from 'next/server';
import { db } from "@/lib/db";
import { apiError, apiSuccess, safeInt } from "@/lib/apiHelpers";

const STAGE_PROBABILITY: Record<string, number> = {
  researching: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
};

const STAGE_ORDER = ["researching", "qualified", "proposal", "negotiation"];

function getMonthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = safeInt(searchParams.get("months"), 6, 1);
    const cappedMonths = Math.min(months, 24);

    // Fetch active pipeline (non-archived, non-won, non-lost)
    const activeOpps = await db.opportunityRecommendation.findMany({
      where: { status: { in: STAGE_ORDER } },
      include: { company: { select: { rawName: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Current month won deals
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonThisMonth = await db.opportunityRecommendation.count({
      where: { status: "won", createdAt: { gte: currentMonthStart } },
    });

    // Pipeline by stage
    const pipelineByStage = STAGE_ORDER.map((stage) => {
      const opps = activeOpps.filter((o) => o.status === stage);
      return { stage, value: opps.length };
    });

    // Total weighted pipeline value (count-based)
    let totalWeighted = 0;
    for (const opp of activeOpps) {
      totalWeighted += STAGE_PROBABILITY[opp.status] ?? 0;
    }
    totalWeighted = Math.round(totalWeighted * 100) / 100;

    // Current month
    const currentMonth = {
      revenue: wonThisMonth,
      deals: wonThisMonth,
    };

    // Forecast: project based on pipeline
    const forecast: Array<{
      month: string;
      projected: number;
      conservative: number;
      optimistic: number;
    }> = [];

    // Average close rate per month from historical won deals
    const avgMonthlyCloses = Math.max(totalWeighted / 3, totalWeighted * 0.15);

    for (let i = 1; i <= cappedMonths; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = getMonthLabel(futureDate);
      // Decay factor: further months get slightly less from current pipeline
      const decayFactor = 1 - (i - 1) * 0.08;
      const projected = Math.round(Math.max(0, avgMonthlyCloses * decayFactor) * 100) / 100;
      forecast.push({
        month: label,
        projected,
        conservative: Math.round(projected * 0.7 * 100) / 100,
        optimistic: Math.round(projected * 1.3 * 100) / 100,
      });
    }

    // Top deals (highest stage first)
    const stageRank: Record<string, number> = {};
    STAGE_ORDER.forEach((s, i) => (stageRank[s] = i));

    const sortedOpps = [...activeOpps].sort(
      (a, b) => (stageRank[b.status] ?? 99) - (stageRank[a.status] ?? 99)
    );

    const topDeals = sortedOpps.slice(0, 10).map((opp) => ({
      title: (opp as any).title || 'Untitled',
      company: opp.company ? (opp.company as any).rawName || (opp.company as any).normalizedName : 'Unknown',
      value: 1,
      probability: Math.round((STAGE_PROBABILITY[opp.status] ?? 0) * 100),
      stage: opp.status,
    }));

    return apiSuccess({
      currentMonth,
      forecast,
      pipelineByStage,
      topDeals,
    });
  } catch (error) {
    console.error("Failed to generate revenue forecast:", error);
    return apiError("Failed to generate revenue forecast", 500);
  }
}