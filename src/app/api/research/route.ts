import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      businessOverview,
      currentTechLandscape,
      potentialChallenges,
      possibleOpportunities,
      relevantServices,
      keyDecisionMakers,
      lastInteraction,
      nextAction,
    } = body;

    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const researchCard = await db.companyResearchCard.upsert({
      where: { companyId },
      update: {
        businessOverview: businessOverview ?? undefined,
        currentTechLandscape: currentTechLandscape ?? undefined,
        potentialChallenges: potentialChallenges ?? undefined,
        possibleOpportunities: possibleOpportunities ?? undefined,
        relevantServices: relevantServices ?? undefined,
        keyDecisionMakers: keyDecisionMakers ?? undefined,
        lastInteraction: lastInteraction ?? undefined,
        nextAction: nextAction ?? undefined,
      },
      create: {
        companyId,
        businessOverview: businessOverview || null,
        currentTechLandscape: currentTechLandscape || null,
        potentialChallenges: potentialChallenges || null,
        possibleOpportunities: possibleOpportunities || null,
        relevantServices: relevantServices || null,
        keyDecisionMakers: keyDecisionMakers || null,
        lastInteraction: lastInteraction || null,
        nextAction: nextAction || null,
      },
    });

    await db.timelineEntry.create({
      data: {
        companyId,
        action: "research_updated",
        details: `Research card for "${company.name}" was updated`,
      },
    });

    return NextResponse.json(researchCard, { status: 201 });
  } catch (error) {
    console.error("Failed to save research card:", error);
    return NextResponse.json(
      { error: "Failed to save research card" },
      { status: 500 }
    );
  }
}