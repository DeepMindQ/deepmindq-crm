/**
 * DeepMindQ — Demo Data Preparation Script
 * 
 * Loads 10 representative enterprise companies and enriches them
 * through the full intelligence pipeline for Phase 2 UI development.
 * 
 * Uses real API endpoints (DEMO_MODE=true bypasses auth).
 */

const BASE = 'http://localhost:3000';

// ─── 10 Representative Enterprise Companies ─────────────────────────
const DEMO_COMPANIES = [
  {
    rawName: 'Acme Financial Services',
    domain: 'acmefinancial.com',
    website: 'https://acmefinancial.com',
    industry: 'Financial Services',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United States',
    description: 'Leading global financial services firm offering banking, investment, and insurance products across 40+ countries.',
  },
  {
    rawName: 'NovaTech Industries',
    domain: 'novatech.io',
    website: 'https://novatech.io',
    industry: 'Technology',
    sizeRange: 'Mid-Market (500-5,000)',
    country: 'United States',
    description: 'Cloud-native SaaS company providing AI-powered DevOps and infrastructure monitoring solutions for enterprise customers.',
  },
  {
    rawName: 'Meridian Healthcare Group',
    domain: 'meridianhealth.com',
    website: 'https://meridianhealth.com',
    industry: 'Healthcare',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United Kingdom',
    description: 'Integrated healthcare system operating 15 hospitals and 200+ clinics with a focus on digital health transformation.',
  },
  {
    rawName: 'Atlas Manufacturing Corp',
    domain: 'atlasmfg.com',
    website: 'https://atlasmfg.com',
    industry: 'Manufacturing',
    sizeRange: 'Enterprise (5,000-10,000)',
    country: 'Germany',
    description: 'Global precision manufacturing company specializing in automotive and aerospace components with 25 factories across Europe and Asia.',
  },
  {
    rawName: 'Pinnacle Retail Holdings',
    domain: 'pinnacleretail.com',
    website: 'https://pinnacleretail.com',
    industry: 'Retail',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United States',
    description: 'Omnichannel retail giant operating 800+ stores and a rapidly growing e-commerce platform serving 50M+ customers.',
  },
  {
    rawName: 'Sentinel Cyber Defense',
    domain: 'sentinelcyber.io',
    website: 'https://sentinelcyber.io',
    industry: 'Information Technology',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'Israel',
    description: 'AI-driven cybersecurity platform providing threat detection, incident response, and compliance automation for Fortune 500 companies.',
  },
  {
    rawName: 'Greenfield Energy Solutions',
    domain: 'greenfieldenergy.com',
    website: 'https://greenfieldenergy.com',
    industry: 'Energy',
    sizeRange: 'Mid-Market (500-5,000)',
    country: 'Denmark',
    description: 'Renewable energy company developing smart grid technology and wind farm management software for utility providers.',
  },
  {
    rawName: 'Quantum Dynamics Research',
    domain: 'quantumdynamics.org',
    website: 'https://quantumdynamics.org',
    industry: 'Technology',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'United States',
    description: 'Quantum computing research company developing next-generation encryption and optimization solutions for government and enterprise clients.',
  },
  {
    raw_name: 'StratosCloud Systems',
    domain: 'stratoscloud.com',
    website: 'https://stratoscloud.com',
    industry: 'Technology',
    sizeRange: 'Enterprise (5,000-10,000)',
    country: 'Singapore',
    description: 'Multi-cloud orchestration platform helping enterprises manage hybrid cloud infrastructure across AWS, Azure, and GCP.',
  },
  {
    rawName: 'Vanguard Consulting Group',
    domain: 'vanguardconsulting.com',
    website: 'https://vanguardconsulting.com',
    industry: 'Consulting',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'United States',
    description: 'Management and technology consulting firm specializing in digital transformation for financial services and healthcare sectors.',
  },
];

interface CompanyResponse {
  id: string;
  rawName: string;
  domain?: string;
}

async function createCompany(data: Record<string, string>): Promise<CompanyResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json;
    }
    const err = await res.json().catch(() => ({}));
    console.log(`  ⚠️ Create failed for ${data.rawName}: ${JSON.stringify(err).slice(0, 100)}`);
    return null;
  } catch (e) {
    console.log(`  ⚠️ Error creating ${data.rawName}: ${e}`);
    return null;
  }
}

async function enrichCompany(companyId: string, companyName: string): Promise<boolean> {
  try {
    console.log(`  🔍 Enriching ${companyName} (this takes ~30s with web search + AI analysis)...`);
    const res = await fetch(`${BASE}/api/intelligence/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) {
      const json = await res.json();
      const signals = json.signals?.length || 0;
      const evidence = json.evidence?.length || 0;
      const matches = json.capabilityMatches?.length || 0;
      console.log(`  ✅ Enriched: ${signals} signals, ${evidence} evidence, ${matches} capability matches`);
      return true;
    }
    const err = await res.json().catch(() => ({}));
    console.log(`  ⚠️ Enrichment failed: ${JSON.stringify(err).slice(0, 150)}`);
    return false;
  } catch (e) {
    console.log(`  ⚠️ Enrichment error: ${e}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DeepMindQ — Demo Data Preparation');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Step 1: Check API health
  console.log('Step 0: Checking API health...');
  try {
    const health = await fetch(`${BASE}/api/health`);
    if (!health.ok) throw new Error('API not healthy');
    const h = await health.json();
    console.log(`  ✅ API healthy (DB: ${h.db}, Tavily: ${h.providers?.tavily})`);
  } catch (e) {
    console.log(`  ❌ API not healthy: ${e}. Is the dev server running?`);
    process.exit(1);
  }
  console.log();

  // Step 2: Check existing capabilities
  console.log('Step 1: Checking existing capabilities...');
  try {
    const caps = await fetch(`${BASE}/api/capabilities`);
    const capData = await caps.json();
    console.log(`  ✅ ${capData.length} capabilities loaded (9 core domains covered)`);
  } catch {
    console.log('  ⚠️ Could not fetch capabilities');
  }
  console.log();

  // Step 3: Create companies
  console.log('Step 2: Creating 10 representative enterprise companies...');
  const created: Array<{ id: string; name: string }> = [];
  
  for (const company of DEMO_COMPANIES) {
    // Fix the typo in the 9th company
    const data = { ...company };
    if ('raw_name' in data) {
      data.rawName = (data as any).raw_name;
      delete (data as any).raw_name;
    }
    
    const result = await createCompany(data);
    if (result?.id) {
      created.push({ id: result.id, name: data.rawName });
      console.log(`  ✅ Created: ${data.rawName} (${result.id})`);
    } else {
      console.log(`  ❌ Failed: ${data.rawName}`);
    }
  }
  console.log(`\n  Created ${created.length}/${DEMO_COMPANIES.length} companies`);
  console.log();

  // Step 4: Enrich companies (sequentially to avoid rate limits)
  console.log('Step 3: Running enrichment pipeline on all companies...');
  console.log('  (Each enrichment takes ~30s: web search + AI signal extraction + matching)');
  console.log();

  let enriched = 0;
  for (const company of created) {
    const success = await enrichCompany(company.id, company.name);
    if (success) enriched++;
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Summary: ${created.length} companies created, ${enriched} enriched`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
