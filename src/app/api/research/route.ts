import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

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
  lastResearchedAt: string;
  nextAction: string;
  confidenceScore: number;
}

async function callOpenAI(systemPrompt: string, apiKey: string, model: string): Promise<ResearchResult | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the company research now." },
      ],
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return parseResearchJson(text);
}

async function callGemini(systemPrompt: string, apiKey: string, model: string): Promise<ResearchResult | null> {
  // C11: Use x-goog-api-key header instead of query param to avoid API key in URL
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent'
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt + "\n\nGenerate the company research now." }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}`);
  }
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseResearchJson(text);
}

async function callGroq(systemPrompt: string, apiKey: string, model: string): Promise<ResearchResult | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the company research now." },
      ],
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq API error ${res.status}`);
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return parseResearchJson(text);
}

// ---------------------------------------------------------------------------
// JSON extraction from LLM output (tolerant of markdown fences)
// ---------------------------------------------------------------------------

function parseResearchJson(raw: string): ResearchResult | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    const obj = JSON.parse(cleaned);
    if (obj.businessOverview) {
      return {
        businessOverview: String(obj.businessOverview),
        currentTechLandscape: String(obj.currentTechLandscape || ""),
        potentialChallenges: obj.potentialChallenges ? String(obj.potentialChallenges) : "",
        possibleOpportunities: obj.possibleOpportunities ? String(obj.possibleOpportunities) : "",
        relevantServices: obj.relevantServices ? String(obj.relevantServices) : "",
        keyDecisionMakers: obj.keyDecisionMakers ? String(obj.keyDecisionMakers) : "",
        lastResearchedAt: obj.lastResearchedAt ? String(obj.lastResearchedAt) : "",
        nextAction: obj.nextAction ? String(obj.nextAction) : "",
        confidenceScore: typeof obj.confidenceScore === "number" ? obj.confidenceScore : 72,
      };
    }
  } catch {
    // fall through
  }

  const match = cleaned.match(/\{[\s\S]*"businessOverview"[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.businessOverview) {
        return {
          businessOverview: String(obj.businessOverview),
          currentTechLandscape: String(obj.currentTechLandscape || ""),
          potentialChallenges: obj.potentialChallenges ? String(obj.potentialChallenges) : "",
          possibleOpportunities: obj.possibleOpportunities ? String(obj.possibleOpportunities) : "",
          relevantServices: obj.relevantServices ? String(obj.relevantServices) : "",
          keyDecisionMakers: obj.keyDecisionMakers ? String(obj.keyDecisionMakers) : "",
          lastResearchedAt: obj.lastResearchedAt ? String(obj.lastResearchedAt) : "",
          nextAction: obj.nextAction ? String(obj.nextAction) : "",
          confidenceScore: typeof obj.confidenceScore === "number" ? obj.confidenceScore : 72,
        };
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Intelligent fallback research template
// ---------------------------------------------------------------------------

function generateFallbackResearch(company: {
  rawName: string;
  industry: string | null;
  domain: string | null;
  sizeRange: string | null;
  country: string | null;
  location: string | null;
}) {
  const n = company.rawName;
  const ind = company.industry || "technology";
  const d = company.domain || "their website";
  const s = company.sizeRange || "50-200";
  const c = company.country || "the US";
  const loc = company.location || c;
  const indLower = ind.toLowerCase();

  const sizeContext = (() => {
    const size = parseInt(s) || 0;
    if (size > 1000) return "As a large enterprise, they likely have complex procurement processes, established vendor relationships, and a multi-layered decision-making hierarchy.";
    if (size > 200) return "As a mid-sized company, they are likely experiencing rapid scaling challenges and are more agile in adopting new solutions.";
    if (size > 0) return "As a growing small-to-mid-size company, they are likely resource-conscious but open to solutions that demonstrate clear ROI.";
    return "Their team size suggests a lean organization focused on efficient growth and pragmatic technology adoption.";
  })();

  const industryInsights: Record<string, { tech: string; challenges: string; opportunities: string }> = {
    software: {
      tech: "Likely using cloud-native architectures (AWS/GCP/Azure), CI/CD pipelines, container orchestration (Kubernetes/Docker), microservices, and modern frontend frameworks. Data stack probably includes Snowflake/BigQuery with analytics tools.",
      challenges: "(1) Engineering talent retention in competitive market. (2) Scaling infrastructure cost-effectively. (3) Managing technical debt while shipping features. (4) Data privacy compliance (GDPR/CCPA). (5) Product-market fit refinement.",
      opportunities: "(1) AI/ML integration for product enhancement. (2) Automated testing and deployment. (3) Developer productivity tools. (4) Data-driven decision making infrastructure. (5) Strategic API partnerships.",
    },
    healthcare: {
      tech: "Likely using HIPAA-compliant cloud infrastructure, EHR/EMR systems (Epic/Cerner), secure data pipelines, and compliance management platforms. Telehealth and patient engagement tools are probably in their stack.",
      challenges: "(1) Regulatory compliance (HIPAA, HITECH). (2) Interoperability between legacy and modern systems. (3) Patient data security. (4) Clinician adoption of new technology. (5) Value-based care transition.",
      opportunities: "(1) AI-powered diagnostics and clinical decision support. (2) Patient engagement automation. (3) Revenue cycle optimization. (4) Population health analytics. (5) Telehealth expansion.",
    },
    finance: {
      tech: "Likely using secure cloud infrastructure with strict compliance controls, real-time data processing, fraud detection systems, and robust API ecosystems. Regulatory reporting tools are essential.",
      challenges: "(1) Evolving regulatory requirements. (2) Cybersecurity threats and fraud prevention. (3) Legacy system modernization. (4) Customer experience digitization. (5) Data governance and privacy.",
      opportunities: "(1) AI-driven risk assessment. (2) Automated compliance monitoring. (3) Open banking API ecosystems. (4) Personalized financial products. (5) Blockchain for secure transactions.",
    },
    manufacturing: {
      tech: "Likely using ERP systems (SAP/Oracle), IoT sensors for production monitoring, supply chain management tools, and quality control systems. Industry 4.0 adoption is likely underway.",
      challenges: "(1) Supply chain disruption resilience. (2) Workforce upskilling for digital tools. (3) Equipment maintenance and downtime. (4) Quality control at scale. (5) Environmental compliance.",
      opportunities: "(1) Predictive maintenance with IoT/AI. (2) Supply chain visibility platforms. (3) Digital twin technology. (4) Automated quality inspection. (5) Energy efficiency optimization.",
    },
    retail: {
      tech: "Likely using e-commerce platforms (Shopify/Magento), POS systems, inventory management, customer data platforms (CDP), and omnichannel engagement tools.",
      challenges: "(1) Omnichannel consistency. (2) Personalization at scale. (3) Inventory optimization. (4) Customer retention in competitive market. (5) Last-mile delivery logistics.",
      opportunities: "(1) AI-powered personalization engines. (2) Demand forecasting automation. (3) Loyalty program optimization. (4) Social commerce integration. (5) Sustainable supply chain practices.",
    },
    education: {
      tech: "Likely using LMS platforms (Canvas/Blackboard), student information systems, video conferencing tools, and content management systems. Data analytics for student outcomes is growing.",
      challenges: "(1) Digital equity and access. (2) Student engagement and retention. (3) Faculty technology adoption. (4) Data privacy (FERPA). (5) Budget constraints for technology.",
      opportunities: "(1) Adaptive learning platforms. (2) AI-powered tutoring systems. (3) Administrative workflow automation. (4) Learning analytics dashboards. (5) Micro-credential and skills-based programs.",
    },
    "real estate": {
      tech: "Likely using CRM systems (Salesforce/HubSpot), property management software, MLS integrations, virtual tour platforms, and digital document signing tools.",
      challenges: "(1) Market volatility and pricing accuracy. (2) Lead qualification efficiency. (3) Client communication across channels. (4) Regulatory compliance across jurisdictions. (5) Competition from iBuyers.",
      opportunities: "(1) AI-powered property valuation. (2) Automated lead nurturing. (3) Virtual and augmented reality tours. (4) Predictive market analytics. (5) Smart property management.",
    },
  };

  const insights = industryInsights[indLower] || industryInsights["software"];

  return {
    businessOverview: `${n} is a ${indLower}-sector company operating primarily in ${loc}. With approximately ${s} employees, the organization has established itself as a notable player in the ${indLower} space. Their digital presence at ${d} reflects an active and growing business. ${sizeContext}`,
    currentTechLandscape: insights.tech,
    potentialChallenges: insights.challenges,
    possibleOpportunities: insights.opportunities,
    relevantServices: `Relevant DeepMindQ services: (1) AI-powered sales intelligence and lead research to identify high-value prospects. (2) Email outreach optimization for personalized ${indLower} sector campaigns. (3) Sales pipeline management and forecasting. (4) Data enrichment services for complete prospect profiles. (5) Strategic consulting for growth in the ${indLower} market.`,
    keyDecisionMakers: `Key decision makers at ${n} (${s} employees, ${indLower}): (1) CEO/Founder for strategic partnership decisions. (2) CTO/VP Engineering for technology solutions. (3) VP Sales/Head of Revenue for sales enablement tools. (4) COO for process optimization and efficiency. (5) CFO for budget allocation and ROI justification.`,
    lastResearchedAt: "No prior interactions recorded. This is a fresh engagement opportunity.",
    nextAction: `Recommended next steps: (1) Identify and validate key contacts at ${n} using LinkedIn and company website. (2) Research recent news, funding rounds, and strategic initiatives. (3) Craft personalized outreach referencing their ${indLower} focus. (4) Prepare industry-specific value proposition. (5) Schedule initial discovery call within 2 weeks.`,
    confidenceScore: 55,
  };
}

// ---------------------------------------------------------------------------
// POST /api/research
//   Body: { companyId } → Generate research (AI or fallback template)
//   Body: { companyId, action: "save", ...fields } → Save manual research data
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, action } = body;

    if (!companyId || typeof companyId !== "string") {
      return apiError("Company ID is required", 400);
    }

    // ── Manual Research Save ──
    if (action === "save") {
      const {
        businessOverview,
        currentTechLandscape,
        potentialChallenges,
        possibleOpportunities,
        relevantServices,
        keyDecisionMakers,
        lastResearchedAt,
        nextAction,
      } = body;

      const company = await db.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return apiError("Company not found", 404);
      }

      const researchCard = await db.companyResearchCard.upsert({
        where: { companyId },
        update: {
          businessOverview: businessOverview ?? undefined,
          techLandscape: currentTechLandscape ?? undefined,
          potentialChallenges: potentialChallenges ?? undefined,
          possibleOpportunities: possibleOpportunities ?? undefined,
          relevantServices: relevantServices ?? undefined,
          keyDecisionMakers: keyDecisionMakers ?? undefined,
        },
        create: {
          companyId,
          businessOverview: businessOverview || null,
          techLandscape: currentTechLandscape || null,
          potentialChallenges: potentialChallenges || null,
          possibleOpportunities: possibleOpportunities || null,
          relevantServices: relevantServices || null,
          keyDecisionMakers: keyDecisionMakers || null,
        },
      });

      await db.companyTimelineEvent.create({
        data: {
          companyId,
          eventType: "research_saved",
          title: `Research card for "${company.rawName}" was manually updated`,
        },
      });

      return apiSuccess(researchCard, 201);
    }

    // ── AI Research Generation (default behavior) ──

    const company = await db.company.findUnique({
      where: { id: companyId },
      include: { contacts: { take: 5, orderBy: { createdAt: "desc" } } },
    });
    if (!company) {
      return apiError("Company not found", 404);
    }

    // 1. Read UserPreferences from DB (singleton)
    const prefs = await db.systemSetting.findFirst();
    let prefsData: Record<string, string> = {};
    if (prefs?.value) {
      try { prefsData = JSON.parse(prefs.value); } catch { /* ignore parse error */ }
    }
    const aiProvider = (prefsData?.aiProvider || "openai").toLowerCase();
    const aiModel = prefsData?.aiModel || "gpt-4o-mini";
    const aiApiKey = prefsData?.aiApiKey;

    // 2. Check for existing research to update/expand
    const existingResearch = await db.companyResearchCard.findUnique({ where: { companyId } });

    // 3. H15: Fix snippet query — get relevant snippets by industry match, or empty/null industries
    const snippets = await db.capabilityAsset.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: company.industry
        ? {
            OR: [
              { targetIndustries: { contains: company.industry } },
              { targetIndustries: '' },
              { targetIndustries: null },
            ],
          }
        : undefined,
    });
    const knowledgeContext =
      snippets.length > 0
        ? `\n\nOur relevant capabilities:\n${snippets.map((s) => `- [${s.title}] ${s.content}`).join("\n")}`
        : "";

    // 4. Build company context
    const contactsContext =
      company.contacts.length > 0
        ? `\nKnown contacts: ${company.contacts.map((c) => `${c.rawName} (${c.title || "Unknown"}, ${c.email || "no email"})`).join("; ")}`
        : "\nNo contacts added yet.";

    const companyContext = `Company: ${company.rawName}
Industry: ${company.industry || "Unknown"}
Domain: ${company.domain || "Unknown"}
Employees: ${company.sizeRange || "Unknown"}
Country: ${company.country || "Unknown"}
Location: ${company.location || "Unknown"}
Website: ${company.website || "Unknown"}
Status: ${company.status}${contactsContext}${knowledgeContext}`;

    // 5. Try LLM call
    let researchData: ResearchResult | null = null;
    let usedLlm = false;

    if (aiApiKey) {
      const systemPrompt = `You are an expert B2B sales intelligence analyst at DeepMindQ, an AI-powered sales intelligence and strategic consulting firm. Generate a comprehensive company research card.

${companyContext}

${existingResearch ? `Previous research (update and expand upon this):\n${JSON.stringify(existingResearch, null, 2)}` : ""}

Generate a JSON object with these fields:
- "businessOverview": 2-3 sentence overview of the company's business, market position, and current trajectory.
- "currentTechLandscape": Analysis of likely technology stack, technical maturity, and digital capabilities.
- "potentialChallenges": Key challenges the company likely faces (3-5 numbered items).
- "possibleOpportunities": Strategic opportunities for DeepMindQ's consulting engagement (3-5 numbered items).
- "relevantServices": Which DeepMindQ services fit this company (3-5 numbered items). DeepMindQ offers: AI-powered sales intelligence, B2B lead research, email outreach optimization, sales pipeline management, data enrichment, and strategic consulting.
- "keyDecisionMakers": Who to target and how to approach them (3-5 numbered items with specific roles).
- "lastResearchedAt": Summary of known interactions (or "No prior interactions recorded. This is a fresh engagement opportunity.").
- "nextAction": Recommended next steps for engagement (3-5 numbered, actionable, specific items).
- "confidenceScore": Number 0-100 indicating research quality and data completeness.

Respond ONLY with the JSON object, no additional text.`;

      try {
        let result: ResearchResult | null = null;

        if (aiProvider === "openai") {
          result = await callOpenAI(systemPrompt, aiApiKey, aiModel);
        } else if (aiProvider === "gemini") {
          result = await callGemini(systemPrompt, aiApiKey, aiModel);
        } else if (aiProvider === "groq") {
          result = await callGroq(systemPrompt, aiApiKey, aiModel);
        }

        if (result) {
          researchData = result;
          usedLlm = true;
        }
      } catch (llmErr: unknown) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
        console.error(`[research/generate] LLM call failed (${aiProvider}): ${msg}`);
        // Fall through to template — H8: don't leak raw error messages
      }
    }

    // 6. Fallback to intelligent template-based research
    if (!usedLlm) {
      const fb = generateFallbackResearch(company);
      researchData = {
        businessOverview: fb.businessOverview,
        currentTechLandscape: fb.currentTechLandscape,
        potentialChallenges: fb.potentialChallenges,
        possibleOpportunities: fb.possibleOpportunities,
        relevantServices: fb.relevantServices,
        keyDecisionMakers: fb.keyDecisionMakers,
        lastResearchedAt: fb.lastResearchedAt,
        nextAction: fb.nextAction,
        confidenceScore: fb.confidenceScore,
      } as ResearchResult;
    }

    // 7. Upsert CompanyResearchCard (companyId is unique key)
    const saved = await db.companyResearchCard.upsert({
      where: { companyId },
      update: {
        businessOverview: researchData!.businessOverview,
        techLandscape: researchData!.currentTechLandscape,
        potentialChallenges: researchData!.potentialChallenges,
        possibleOpportunities: researchData!.possibleOpportunities,
        relevantServices: researchData!.relevantServices,
        keyDecisionMakers: researchData!.keyDecisionMakers,
      },
      create: {
        companyId,
        businessOverview: researchData!.businessOverview,
        techLandscape: researchData!.currentTechLandscape,
        potentialChallenges: researchData!.potentialChallenges,
        possibleOpportunities: researchData!.possibleOpportunities,
        relevantServices: researchData!.relevantServices,
        keyDecisionMakers: researchData!.keyDecisionMakers,
      },
    });

    // 8. Create TimelineEntry
    await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: "research_saved",
        title: usedLlm
          ? `AI research card for "${company.rawName}" generated via ${aiProvider}/${aiModel}`
          : `Template research card for "${company.rawName}" (no AI API key configured or LLM call failed)`,
      },
    });

    // 9. Update company.intelligenceScore and company.dataFreshness
    const newScore = Math.min(99, (company.intelligenceScore || 30) + 25);
    await db.company.update({
      where: { id: companyId },
      data: { intelligenceScore: newScore },
    });

    // 10. Return the research card data
    return apiSuccess({ ...saved, _usedLlm: usedLlm });
  } catch {
    // H8: Don't leak raw error messages
    return apiError("Failed to process research");
  }
}