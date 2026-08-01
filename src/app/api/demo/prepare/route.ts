/**
 * POST /api/demo/prepare
 * Creates 10 representative enterprise companies for demo.
 * GET /api/demo/prepare — Check demo readiness status.
 */
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';

const DEMO_COMPANIES = [
  { rawName: 'Acme Financial Services', domain: 'acmefinancial.com', website: 'https://acmefinancial.com', industry: 'Financial Services', sizeRange: 'Enterprise (10,000+)', country: 'United States', description: 'Leading global financial services firm offering banking, investment, and insurance products across 40+ countries. Recently announced a $500M digital transformation initiative focused on AI and cloud modernization.' },
  { rawName: 'NovaTech Industries', domain: 'novatech.io', website: 'https://novatech.io', industry: 'Technology', sizeRange: 'Mid-Market (500-5,000)', country: 'United States', description: 'Cloud-native SaaS company providing AI-powered DevOps and infrastructure monitoring solutions for enterprise customers. Raised $200M Series D in 2024 and is expanding into European and APAC markets.' },
  { rawName: 'Meridian Healthcare Group', domain: 'meridianhealth.com', website: 'https://meridianhealth.com', industry: 'Healthcare', sizeRange: 'Enterprise (10,000+)', country: 'United Kingdom', description: 'Integrated healthcare system operating 15 hospitals and 200+ clinics with a focus on digital health transformation. Their CIO announced a comprehensive Azure migration strategy and AI-powered patient analytics initiative.' },
  { rawName: 'Atlas Manufacturing Corp', domain: 'atlasmfg.com', website: 'https://atlasmfg.com', industry: 'Manufacturing', sizeRange: 'Enterprise (5,000-10,000)', country: 'Germany', description: 'Global precision manufacturing company specializing in automotive and aerospace components with 25 factories across Europe and Asia. Implementing Industry 4.0 with predictive maintenance and IoT integration.' },
  { rawName: 'Pinnacle Retail Holdings', domain: 'pinnacleretail.com', website: 'https://pinnacleretail.com', industry: 'Retail', sizeRange: 'Enterprise (10,000+)', country: 'United States', description: 'Omnichannel retail giant operating 800+ stores and a rapidly growing e-commerce platform serving 50M+ customers. Currently undertaking a massive cloud migration and AI personalization initiative.' },
  { rawName: 'Sentinel Cyber Defense', domain: 'sentinelcyber.io', website: 'https://sentinelcyber.io', industry: 'Information Technology', sizeRange: 'Mid-Market (1,000-5,000)', country: 'Israel', description: 'AI-driven cybersecurity platform providing threat detection, incident response, and compliance automation for Fortune 500 companies. Expanding rapidly with new CISO hires and product line extensions.' },
  { rawName: 'Greenfield Energy Solutions', domain: 'greenfieldenergy.com', website: 'https://greenfieldenergy.com', industry: 'Energy', sizeRange: 'Mid-Market (500-5,000)', country: 'Denmark', description: 'Renewable energy company developing smart grid technology and wind farm management software for utility providers. Recently secured $300M in government contracts for smart city infrastructure projects.' },
  { rawName: 'Quantum Dynamics Research', domain: 'quantumdynamics.org', website: 'https://quantumdynamics.org', industry: 'Technology', sizeRange: 'Mid-Market (1,000-5,000)', country: 'United States', description: 'Quantum computing research company developing next-generation encryption and optimization solutions for government and enterprise clients. Recently hired VP of Engineering from Google and opened a new R&D center.' },
  { rawName: 'StratosCloud Systems', domain: 'stratoscloud.com', website: 'https://stratoscloud.com', industry: 'Technology', sizeRange: 'Enterprise (5,000-10,000)', country: 'Singapore', description: 'Multi-cloud orchestration platform helping enterprises manage hybrid cloud infrastructure across AWS, Azure, and GCP. Their CTO published an Azure-first strategy and is hiring cloud architects aggressively.' },
  { rawName: 'Vanguard Consulting Group', domain: 'vanguardconsulting.com', website: 'https://vanguardconsulting.com', industry: 'Consulting', sizeRange: 'Mid-Market (1,000-5,000)', country: 'United States', description: 'Management and technology consulting firm specializing in digital transformation for financial services and healthcare sectors. Expanding their AI practice and recently won a $50M federal digital modernization contract.' },
];

export async function POST() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startTime = Date.now();
  const results: Array<{ name: string; companyId: string; status: string; error?: string }> = [];

  try {
    for (const c of DEMO_COMPANIES) {
      try {
        const existing = await db.company.findFirst({ where: { domain: c.domain } });
        if (existing) {
          results.push({ name: c.rawName, companyId: existing.id, status: 'already_exists' });
          continue;
        }
        const company = await db.company.create({
          data: {
            rawName: c.rawName,
            normalizedName: c.rawName.toLowerCase(),
            domain: c.domain,
            website: c.website,
            industry: c.industry,
            sizeRange: c.sizeRange,
            country: c.country,
            internalSummary: c.description,
            tags: '[]',
            status: 'prospect',
            lifecycleStage: 'discovery',
            source: 'demo',
          },
        });
        results.push({ name: c.rawName, companyId: company.id, status: 'created' });
      } catch (err) {
        results.push({ name: c.rawName, companyId: '', status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      duration: `${Date.now() - startTime}ms`,
      results,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const capabilities = await db.capabilityAsset.count();
  const companies = await db.company.count({ where: { source: 'demo' } });
  const signals = await db.companySignal.count();
  const matches = await db.signalCapabilityMatch.count();
  return NextResponse.json({ capabilities, demoCompanies: companies, signals, matches, readyForUI: companies > 0 });
}
