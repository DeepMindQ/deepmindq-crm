import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const cards = await db.companyResearchCard.findMany({
    include: { company: true },
  });
  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const body = await req.json();
  const card = await db.companyResearchCard.create({
    data: {
      companyId: body.companyId,
      businessOverview: body.businessOverview,
      currentTechLandscape: body.currentTechLandscape,
      potentialChallenges: body.potentialChallenges,
      possibleOpportunities: body.possibleOpportunities,
      relevantServices: body.relevantServices,
      keyDecisionMakers: body.keyDecisionMakers,
      confidenceScore: body.confidenceScore || 75,
    },
  });
  return NextResponse.json(card);
}