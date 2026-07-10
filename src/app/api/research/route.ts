import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// LLM provider helpers
// ---------------------------------------------------------------------------

type ResearchResult = {
  businessOverview: string;
  currentTechLandscape: string;
  potentialChallenges: string;
  possibleOpportunities: string;
  relevantServices: string;
  keyDecisionMakers: string;
  lastInteraction: string;
  nextAction: string;
  confidenceScore: number;
} | null;

async function callLLM(systemPrompt: string, apiKey: string, provider: string, model: string): Promise<ResearchResult> {
  let url: string, headers: Record<string, string>, body: string;

  if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    headers = { "Content-Type": "application/json" };
    body = JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt + "\n\nGenerate the company research now." }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
    });
  } else {
    // OpenAI-compatible (openai, groq)
    const baseUrl = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
    url = `${baseUrl}/chat/completions`;
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    body = JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the company research now." },
      ],
      temperature: 0.6,
      max_tokens: 2048,
    });
  }

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider} API error ${res.status}: ${err}`);
  }

  let text: string;
  if (provider === "gemini") {
    const data = await res.json();
    text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else {
    const data = await res.json();
    text = data.choices?.[0]?.message?.content ?? "";
  }
  return parseResearchJson(text);
}

function parseResearchJson(raw: string): ResearchResult {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj.businessOverview) {
      return {
        businessOverview: String(obj.businessOverview),
        currentTechLandscape: String(obj.currentTechLandscape || ""),
        potentialChallenges: obj.potentialChallenges ? String(obj.potentialChallenges) : null,
        possibleOpportunities: obj.possibleOpportunities ? String(obj.possibleOpportunities) : null,
        relevantServices: obj.relevantServices ? String(obj.relevantServices) : null,
        keyDecisionMakers: obj.keyDecisionMakers ? String(obj.keyDecisionMakers) : null,
        lastInteraction: obj.lastInteraction ? String(obj.lastInteraction) : null,
        nextAction: obj.nextAction ? String(obj.nextAction) : null,
        confidenceScore: typeof obj.confidenceScore === "number" ? obj.confidenceScore : 72,
      };
    }
  } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*"businessOverview"[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.businessOverview) {
        return {
          businessOverview: String(obj.businessOverview),
          currentTechLandscape: String(obj.currentTechLandscape || ""),
          potentialChallenges: obj.potentialChallenges ? String(obj.potentialChallenges) : null,
          possibleOpportunities: obj.possibleOpportunities ? String(obj.possibleOpportunities) : null,
          relevantServices: obj.relevantServices ? String(obj.relevantServices) : null,
          keyDecisionMakers: obj.keyDecisionMakers ? String(obj.keyDecisionMakers) : null,
          lastInteraction: obj.lastInteraction ? String(obj.lastInteraction) : null,
          nextAction: obj.nextAction ? String(obj.nextAction) : null,
          confidenceScore: typeof obj.confidenceScore === "number" ? obj.confidenceScore : 72,
        };
      }
    } catch { /* fall through */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fallback research templates
// ---------------------------------------------------------------------------

function generateFallbackResearch(company: { name: string; industry: string | null; domain: string | null; employeeSize: string | null; country: string | null }) {
  const n = company.name, ind = company.industry || "technology", d = company.domain || "their website", s = company.employeeSize || "50-200", c = company.country || "the US";
  return {
    businessOverview: `${n} is a ${ind.toLowerCase()}-sector company operating primarily in ${c}. With approximately ${s} employees, the organization has established itself as a notable player in the ${ind.toLowerCase()} space. Their digital presence through ${d} reflects an active and growing business in a growth phase.`,
    currentTechLandscape: `Based on publicly available information, ${n} likely leverages a modern technology stack common in the ${ind.toLowerCase()} sector — cloud-native infrastructure (AWS/GCP/Azure), containerized deployments, and data-driven tools. Companies of this scale typically use CRM systems (Salesforce/HubSpot), project management, and collaboration platforms.`,
    potentialChallenges: `Key challenges: (1) Scaling technology infrastructure while maintaining reliability. (2) Attracting and retaining skilled talent. (3) Managing data privacy and compliance. (4) Differentiating in the ${ind.toLowerCase()} market. (5) Balancing innovation with operational stability.`,
    possibleOpportunities: `Strategic opportunities: (1) Expanding into adjacent markets. (2) Leveraging AI/ML to enhance offerings. (3) Building strategic partnerships. (4) Investing in automation. (5) Enhancing data analytics capabilities.`,
    relevantServices: `Relevant DeepMindQ services: (1) AI-powered sales intelligence and lead research. (2) Email outreach optimization. (3) Sales pipeline management. (4) Data enrichment services. (5) Strategic consulting for growth.`,
    keyDecisionMakers: `Key decision makers at ${n} (${s}, ${ind.toLowerCase()}): (1) CEO/Founder for strategic decisions. (2) CTO/VP Engineering for technology. (3) VP Sales for sales enablement. (4) COO for process optimization. (5) CFO for budget approval.`,
    lastInteraction: "No prior interactions recorded. This is a fresh engagement opportunity.",
    nextAction: "Next steps: (1) Identify key contacts and decision makers. (2) Validate email addresses. (3) Craft personalized outreach. (4) Schedule follow-up cadence. (5) Prepare tailored capabilities deck.",
    confidenceScore: 55,
  };
}

// ---------------------------------------------------------------------------
// POST /api/research
//   - action: "generate" → AI-powered research generation
//   - no action → save manual research data (original behavior)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, action } = body;

    // ── AI Research Generation ──
    if (action === "generate") {
      if (!companyId || typeof companyId !== "string") {
        return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
      }

      const company = await db.company.findUnique({
        where: { id: companyId },
        include: { contacts: { where: { archivedAt: null }, take: 5, orderBy: { createdAt: "desc" } } },
      });
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }

      const prefs = await db.userPreferences.findFirst();
      const aiProvider = (prefs?.aiProvider || "openai").toLowerCase();
      const aiModel = prefs?.aiModel || "gpt-4o-mini";
      const aiApiKey = prefs?.aiApiKey;

      const existingResearch = await db.companyResearchCard.findUnique({ where: { companyId } });

      const snippets = await db.capabilitySnippet.findMany({
        take: 5, orderBy: { createdAt: "desc" },
        where: company.industry
          ? { OR: [{ industries: { contains: company.industry } }, { industries: { equals: "" } }, { industries: { not: company.industry } }] }
          : {},
      });
      const knowledgeContext = snippets.length > 0
        ? `\n\nOur relevant capabilities:\n${snippets.map((s) => `- [${s.title}] ${s.content}`).join("\n")}`
        : "";

      const contactsContext = company.contacts.length > 0
        ? `\nKnown contacts: ${company.contacts.map((c) => `${c.name} (${c.jobTitle || "Unknown"}, ${c.email || "no email"})`).join("; ")}`
        : "\nNo contacts added yet.";

      const companyContext = `Company: ${company.name}\nIndustry: ${company.industry || "Unknown"}\nDomain: ${company.domain || "Unknown"}\nEmployees: ${company.employeeSize || "Unknown"}\nCountry: ${company.country || "Unknown"}\nLocation: ${company.location || "Unknown"}\nWebsite: ${company.website || "Unknown"}\nStatus: ${company.status}${contactsContext}${knowledgeContext}`;

      let researchData: ResearchResult = null;
      let usedLlm = false;

      if (aiApiKey) {
        const systemPrompt = `You are an expert B2B sales intelligence analyst at DeepMindQ, an AI-powered sales intelligence and strategic consulting firm. Generate a comprehensive company research card.

${companyContext}

${existingResearch ? `Previous research (update/expand):\n${JSON.stringify(existingResearch, null, 2)}` : ""}

Generate a JSON object with these fields:
- "businessOverview": 2-3 sentence overview of the company's business and market position.
- "currentTechLandscape": Analysis of likely technology stack and technical maturity.
- "potentialChallenges": Key challenges (3-5 numbered items).
- "possibleOpportunities": Strategic opportunities for DeepMindQ's consulting engagement (3-5 numbered items).
- "relevantServices": Which DeepMindQ services fit this company (3-5 numbered items). DeepMindQ offers: AI-powered sales intelligence, B2B lead research, email outreach optimization, sales pipeline management, data enrichment, and strategic consulting.
- "keyDecisionMakers": Who to target and how to approach them (3-5 numbered items).
- "lastInteraction": Summary of known interactions (or "No prior interactions recorded").
- "nextAction": Recommended next steps for engagement (3-5 numbered, actionable items).
- "confidenceScore": Number 0-100 indicating research quality.

Respond ONLY with the JSON object.`;

        try {
          researchData = await callLLM(systemPrompt, aiApiKey, aiProvider, aiModel);
          if (researchData) usedLlm = true;
        } catch (llmErr: unknown) {
          const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
          console.error(`[research/generate] LLM failed (${aiProvider}): ${msg}`);
        }
      }

      if (!usedLlm) {
        const fb = generateFallbackResearch(company);
        researchData = {
          businessOverview: fb.businessOverview,
          currentTechLandscape: fb.currentTechLandscape,
          potentialChallenges: fb.potentialChallenges,
          possibleOpportunities: fb.possibleOpportunities,
          relevantServices: fb.relevantServices,
          keyDecisionMakers: fb.keyDecisionMakers,
          lastInteraction: fb.lastInteraction,
          nextAction: fb.nextAction,
          confidenceScore: fb.confidenceScore,
        };
      }

      const saved = await db.companyResearchCard.upsert({
        where: { companyId },
        update: {
          businessOverview: researchData!.businessOverview,
          currentTechLandscape: researchData!.currentTechLandscape,
          potentialChallenges: researchData!.potentialChallenges,
          possibleOpportunities: researchData!.possibleOpportunities,
          relevantServices: researchData!.relevantServices,
          keyDecisionMakers: researchData!.keyDecisionMakers,
          lastInteraction: researchData!.lastInteraction,
          nextAction: researchData!.nextAction,
          confidenceScore: researchData!.confidenceScore,
        },
        create: { companyId, ...researchData! },
      });

      await db.timelineEntry.create({
        data: {
          companyId,
          action: "research_generated",
          details: usedLlm
            ? `AI research card for "${company.name}" via ${aiProvider}`
            : `Template research card for "${company.name}" (no AI API key configured)`,
        },
      });

      const newScore = Math.min(99, (company.intelligenceScore || 30) + 25);
      await db.company.update({ where: { id: companyId }, data: { intelligenceScore: newScore, dataFreshness: "fresh" } });

      return NextResponse.json({ ...saved, _usedLlm: usedLlm });
    }

    // ── Manual Research Save (original behavior) ──
    const {
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
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
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
    console.error("Failed to process research:", error);
    return NextResponse.json({ error: "Failed to process research" }, { status: 500 });
  }
}