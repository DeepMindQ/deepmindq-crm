import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/knowledge/engine
   
   Knowledge Engine endpoints:
   - stats: Get knowledge base statistics
   - coverage: Analyze knowledge coverage gaps
   - test: Test a search query with detailed scoring
   ═══════════════════════════════════════════════════ */

const DEMO_CAPABILITIES = [
  { id: 'demo-1', title: 'AI & Machine Learning', category: 'service_line', serviceLine: 'AI & Machine Learning', targetIndustries: 'Financial Services, Healthcare, Manufacturing, Technology, Retail', targetRoles: 'CTO, VP of Engineering, Head of AI, Data Science Director', problems: 'Manual processes, data silos, inaccurate predictions', isActive: true },
  { id: 'demo-2', title: 'Cloud Engineering', category: 'service_line', serviceLine: 'Cloud Engineering', targetIndustries: 'Financial Services, Healthcare, Technology, Media, Government', targetRoles: 'CTO, VP of Engineering, Cloud Architect, DevOps Director', problems: 'Legacy infrastructure, high cloud costs, vendor lock-in', isActive: true },
  { id: 'demo-3', title: 'Data Engineering', category: 'service_line', serviceLine: 'Data Engineering', targetIndustries: 'Financial Services, Healthcare, Retail, Technology, Energy', targetRoles: 'CDO, Head of Data, VP of Analytics, Data Engineering Lead', problems: 'Data fragmentation, poor data quality, slow reporting', isActive: true },
  { id: 'demo-4', title: 'Digital Transformation', category: 'service_line', serviceLine: 'Digital Transformation', targetIndustries: 'Manufacturing, Healthcare, Financial Services, Retail, Government', targetRoles: 'CEO, CIO, COO, Chief Digital Officer', problems: 'Outdated systems, manual workflows, digital skills gap', isActive: true },
  { id: 'demo-5', title: 'Cybersecurity', category: 'service_line', serviceLine: 'Cybersecurity', targetIndustries: 'Financial Services, Healthcare, Government, Technology', targetRoles: 'CISO, CTO, VP of Security, Compliance Officer', problems: 'Security breaches, compliance gaps, legacy vulnerabilities', isActive: true },
  { id: 'demo-6', title: 'FS AI Document Automation', category: 'case_study', serviceLine: 'AI & Machine Learning', targetIndustries: 'Financial Services', targetRoles: 'CTO, COO, VP of Operations', problems: 'Document processing, compliance overhead, manual data entry', isActive: true },
  { id: 'demo-7', title: 'Healthcare Cloud Migration', category: 'case_study', serviceLine: 'Cloud Engineering', targetIndustries: 'Healthcare', targetRoles: 'CTO, VP of Engineering, Head of Infrastructure', problems: 'Legacy monolith, frequent downtime, HIPAA compliance', isActive: true },
  { id: 'demo-8', title: 'Retail Data Platform', category: 'case_study', serviceLine: 'Data Engineering', targetIndustries: 'Retail', targetRoles: 'CDO, Head of Data, VP of Analytics', problems: 'Fragmented data, slow insights, poor personalization', isActive: true },
  { id: 'demo-9', title: '150+ Enterprise ML Deployments', category: 'proof_point', serviceLine: 'AI & Machine Learning', targetIndustries: 'Financial Services, Healthcare, Manufacturing, Technology, Retail', targetRoles: 'CTO, VP of Engineering, Head of AI', problems: '', isActive: true },
  { id: 'demo-10', title: 'Zero Breach Security Record', category: 'proof_point', serviceLine: 'Cybersecurity', targetIndustries: 'Financial Services, Healthcare, Government, Technology', targetRoles: 'CISO, CTO, VP of Security', problems: '', isActive: true },
  { id: 'demo-11', title: 'Budget Constraint Objection', category: 'objection_response', serviceLine: '', targetIndustries: '', targetRoles: '', problems: 'Budget constraints, cost concerns, ROI uncertainty', isActive: true },
  { id: 'demo-12', title: 'Schedule a Discovery Call', category: 'cta', serviceLine: '', targetIndustries: '', targetRoles: '', problems: '', isActive: true },
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'stats';

    let capabilities = DEMO_CAPABILITIES;
    try {
      const dbCaps = await db.capabilityAsset.findMany({ where: { isActive: true } });
      if (dbCaps.length > 0) {
        capabilities = dbCaps.map((c: any) => ({
          id: c.id, title: c.title, category: c.category,
          serviceLine: c.serviceLine || '', targetIndustries: c.targetIndustries || '',
          targetRoles: c.targetRoles || '', problems: c.problems || '', isActive: c.isActive,
        }));
      }
    } catch { /* use demo */ }

    if (action === 'coverage') return analyzeCoverage(capabilities, body);
    if (action === 'coverage_v2') return analyzeCoverageV2(capabilities, body);
    if (action === 'test') return testSearch(body);
    return getStats(capabilities);
  } catch (error) {
    console.error('Knowledge engine error:', error);
    return NextResponse.json({ error: 'Knowledge engine failed' }, { status: 500 });
  }
}

function getStats(capabilities: any[]) {
  const byCategory: Record<string, number> = {};
  const byServiceLine: Record<string, number> = {};
  const allIndustries = new Set<string>();
  const allRoles = new Set<string>();
  const allProblems = new Set<string>();

  capabilities.forEach(c => {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    if (c.serviceLine) byServiceLine[c.serviceLine] = (byServiceLine[c.serviceLine] || 0) + 1;
    if (c.targetIndustries) c.targetIndustries.split(',').map(s => s.trim()).filter(Boolean).forEach(ind => allIndustries.add(ind));
    if (c.targetRoles) c.targetRoles.split(',').map(s => s.trim()).filter(Boolean).forEach(role => allRoles.add(role));
    if (c.problems) c.problems.split(',').map(s => s.trim()).filter(Boolean).forEach(p => allProblems.add(p));
  });

  return NextResponse.json({
    engine: 'DeepMindQ Knowledge Engine v2.0',
    totalAssets: capabilities.length,
    categories: { count: Object.keys(byCategory).length, breakdown: byCategory },
    serviceLines: { count: Object.keys(byServiceLine).length, breakdown: byServiceLine },
    industriesCovered: allIndustries.size,
    industryList: Array.from(allIndustries).sort(),
    rolesCovered: allRoles.size,
    roleList: Array.from(allRoles).sort(),
    problemsCovered: allProblems.size,
    problemList: Array.from(allProblems).sort(),
    searchCapabilities: {
      modes: ['keyword', 'semantic', 'hybrid'],
      defaultMode: 'hybrid',
      boostFields: ['title', 'summary', 'content', 'targetIndustries', 'targetRoles', 'problems', 'evidence'],
      filters: ['industry', 'role', 'category', 'serviceLine', 'companySize', 'problems', 'minRelevanceScore'],
    },
    emailIntegration: {
      knowledgeRetrieval: true,
      contextInjection: true,
      relevanceScoring: true,
      sourceAttribution: true,
      maxKnowledgeContext: 8,
    },
  });
}

function analyzeCoverage(capabilities: any[], body: any) {
  const industryCoverage: Record<string, { total: number; byCategory: Record<string, number> }> = {};
  const roleCoverage: Record<string, { total: number; serviceLines: string[] }> = {};

  capabilities.forEach(cap => {
    if (cap.targetIndustries) {
      cap.targetIndustries.split(',').map(s => s.trim()).filter(Boolean).forEach(ind => {
        if (!industryCoverage[ind]) industryCoverage[ind] = { total: 0, byCategory: {} };
        industryCoverage[ind].total++;
        industryCoverage[ind].byCategory[cap.category] = (industryCoverage[ind].byCategory[cap.category] || 0) + 1;
      });
    }
    if (cap.targetRoles) {
      cap.targetRoles.split(',').map(s => s.trim()).filter(Boolean).forEach(role => {
        if (!roleCoverage[role]) roleCoverage[role] = { total: 0, serviceLines: [] };
        roleCoverage[role].total++;
        if (cap.serviceLine && !roleCoverage[role].serviceLines.includes(cap.serviceLine)) {
          roleCoverage[role].serviceLines.push(cap.serviceLine);
        }
      });
    }
  });

  const maxI = Math.max(1, ...Object.values(industryCoverage).map(v => v.total));
  const maxR = Math.max(1, ...Object.values(roleCoverage).map(v => v.total));

  const industryGaps = Object.entries(industryCoverage)
    .map(([industry, data]) => ({
      industry, coverage: data.total,
      coveragePct: Math.round((data.total / maxI) * 100),
      byCategory: data.byCategory, isGap: data.total <= 2,
    }))
    .sort((a, b) => a.coverage - b.coverage);

  const roleGaps = Object.entries(roleCoverage)
    .map(([role, data]) => ({
      role, coverage: data.total,
      coveragePct: Math.round((data.total / maxR) * 100),
      serviceLines: data.serviceLines, isGap: data.total <= 2,
    }))
    .sort((a, b) => a.coverage - b.coverage);

  // Service line completeness
  const slCompleteness: Record<string, { hasServiceLine: boolean; hasCaseStudy: boolean; hasProofPoint: boolean; hasObjection: boolean; hasCTA: boolean; score: number }> = {};
  new Set(capabilities.filter(c => c.serviceLine).map(c => c.serviceLine)).forEach(sl => {
    const items = capabilities.filter(c => c.serviceLine === sl);
    slCompleteness[sl] = {
      hasServiceLine: items.some(c => c.category === 'service_line'),
      hasCaseStudy: items.some(c => c.category === 'case_study'),
      hasProofPoint: items.some(c => c.category === 'proof_point'),
      hasObjection: items.some(c => c.category === 'objection_response'),
      hasCTA: items.some(c => c.category === 'cta'),
      score: 0,
    };
    const sc = slCompleteness[sl];
    if (sc.hasServiceLine) sc.score += 30;
    if (sc.hasCaseStudy) sc.score += 25;
    if (sc.hasProofPoint) sc.score += 20;
    if (sc.hasObjection) sc.score += 15;
    if (sc.hasCTA) sc.score += 10;
  });

  const recommendations: string[] = [];
  const gapIndustries = industryGaps.filter(g => g.isGap);
  const gapRoles = roleGaps.filter(g => g.isGap);

  if (gapIndustries.length > 0) recommendations.push(`Add case studies for underserved industries: ${gapIndustries.map(g => g.industry).join(', ')}`);
  if (gapRoles.length > 0) recommendations.push(`Create content targeting underserved roles: ${gapRoles.map(g => g.role).join(', ')}`);
  Object.entries(slCompleteness).forEach(([sl, data]) => {
    const missing: string[] = [];
    if (!data.hasCaseStudy) missing.push('case study');
    if (!data.hasProofPoint) missing.push('proof point');
    if (!data.hasObjection) missing.push('objection response');
    if (missing.length > 0) recommendations.push(`${sl}: Add ${missing.join(', ')} (completeness: ${data.score}%)`);
  });

  return NextResponse.json({
    industryCoverage: industryGaps,
    roleCoverage: roleGaps,
    serviceLineCompleteness: slCompleteness,
    recommendations,
    overallScore: Math.round(
      Object.values(slCompleteness).reduce((sum, sl) => sum + sl.score, 0) / Math.max(1, Object.keys(slCompleteness).length)
    ),
  });
}

/* ═══════════════════════════════════════════════════
   C-13: Enhanced Coverage Analysis v2
   Knowledge Health scoring with per-industry, per-role,
   service-line completeness, overall health, and gaps
   ═══════════════════════════════════════════════════ */
function analyzeCoverageV2(capabilities: any[], _body: any) {
  // Reference lists for gap detection
  const REFERENCE_INDUSTRIES = [
    'Financial Services', 'Healthcare', 'Technology', 'Manufacturing',
    'Retail', 'Energy', 'Media', 'Government', 'Education', 'Telecommunications',
  ];
  const REFERENCE_ROLES = [
    'CTO', 'CIO', 'CEO', 'COO', 'CFO', 'VP of Engineering',
    'Head of AI', 'Head of Data', 'VP of Analytics',
    'Cloud Architect', 'Head of Infrastructure', 'Chief Digital Officer',
    'CISO', 'VP of Security', 'Data Science Director',
  ];

  // Collect all industries and roles from assets
  const industryMap: Record<string, number> = {};
  const roleMap: Record<string, number> = {};
  const slAssets: Record<string, any[]> = {};

  capabilities.forEach(cap => {
    // Industries
    if (cap.targetIndustries) {
      cap.targetIndustries.split(',').map(s => s.trim()).filter(Boolean).forEach(ind => {
        industryMap[ind] = (industryMap[ind] || 0) + 1;
      });
    }
    // Roles
    if (cap.targetRoles) {
      cap.targetRoles.split(',').map(s => s.trim()).filter(Boolean).forEach(role => {
        roleMap[role] = (roleMap[role] || 0) + 1;
      });
    }
    // Group by service line
    if (cap.serviceLine) {
      if (!slAssets[cap.serviceLine]) slAssets[cap.serviceLine] = [];
      slAssets[cap.serviceLine].push(cap);
    }
  });

  // Per-industry coverage score
  const maxIndustryAssets = Math.max(1, ...Object.values(industryMap));
  const industryScores = REFERENCE_INDUSTRIES.map(ind => {
    const count = industryMap[ind] || 0;
    return {
      name: ind,
      count,
      hasAssets: count > 0,
      score: Math.min(100, Math.round((count / maxIndustryAssets) * 100)),
      coveragePct: count > 0 ? 100 : 0,
    };
  });

  const industriesWithAssets = industryScores.filter(i => i.hasAssets).length;
  const industryCoverageScore = Math.round((industriesWithAssets / REFERENCE_INDUSTRIES.length) * 100);

  // Per-role coverage score
  const maxRoleAssets = Math.max(1, ...Object.values(roleMap));
  const roleScores = REFERENCE_ROLES.map(role => {
    const count = roleMap[role] || 0;
    return {
      name: role,
      count,
      hasAssets: count > 0,
      score: Math.min(100, Math.round((count / maxRoleAssets) * 100)),
      coveragePct: count > 0 ? 100 : 0,
    };
  });

  const rolesWithAssets = roleScores.filter(r => r.hasAssets).length;
  const roleCoverageScore = Math.round((rolesWithAssets / REFERENCE_ROLES.length) * 100);

  // Service line completeness
  const slCompleteness = Object.entries(slAssets).map(([sl, items]) => {
    const categories = new Set(items.map(c => c.category));
    const hasSL = categories.has('service_line');
    const hasCS = categories.has('case_study');
    const hasPP = categories.has('proof_point');
    const hasOR = categories.has('objection_response');
    const hasCTA = categories.has('cta');
    const score = (hasSL ? 30 : 0) + (hasCS ? 25 : 0) + (hasPP ? 20 : 0) + (hasOR ? 15 : 0) + (hasCTA ? 10 : 0);
    return { name: sl, count: items.length, hasSL, hasCS, hasPP, hasOR, hasCTA, score };
  });

  const avgSLScore = slCompleteness.length > 0
    ? Math.round(slCompleteness.reduce((sum, sl) => sum + sl.score, 0) / slCompleteness.length)
    : 0;

  // Gap list: industries/roles with 0 assets
  const industryGaps = industryScores.filter(i => !i.hasAssets).map(i => i.name);
  const roleGaps = roleScores.filter(r => !r.hasAssets).map(r => r.name);

  // Overall health: weighted average
  const overallHealthScore = Math.round(
    (industryCoverageScore * 0.25) +
    (roleCoverageScore * 0.2) +
    (avgSLScore * 0.35) +
    Math.min(100, capabilities.length * 5) * 0.2  // volume bonus (max at 20 assets)
  );

  // Health label
  let healthLabel = 'Critical';
  let healthColor = '#EF4444';
  if (overallHealthScore >= 80) { healthLabel = 'Excellent'; healthColor = '#10B981'; }
  else if (overallHealthScore >= 60) { healthLabel = 'Good'; healthColor = '#34D399'; }
  else if (overallHealthScore >= 40) { healthLabel = 'Needs Improvement'; healthColor = '#FBBF24'; }
  else if (overallHealthScore >= 20) { healthLabel = 'Poor'; healthColor = '#F97316'; }

  return NextResponse.json({
    overallHealthScore,
    healthLabel,
    healthColor,
    dimensions: {
      industryCoverage: { score: industryCoverageScore, label: 'Industry Coverage', detail: `${industriesWithAssets}/${REFERENCE_INDUSTRIES.length} industries` },
      roleCoverage: { score: roleCoverageScore, label: 'Role Coverage', detail: `${rolesWithAssets}/${REFERENCE_ROLES.length} roles` },
      serviceLineCompleteness: { score: avgSLScore, label: 'Service Line Depth', detail: `${slCompleteness.length} service lines` },
      assetVolume: { score: Math.min(100, capabilities.length * 5), label: 'Asset Volume', detail: `${capabilities.length} total assets` },
    },
    industries: industryScores,
    roles: roleScores,
    serviceLines: slCompleteness,
    gaps: {
      industries: industryGaps,
      roles: roleGaps,
      totalGaps: industryGaps.length + roleGaps.length,
    },
    totalAssets: capabilities.length,
  });
}

async function testSearch(body: any) {
  const query = body.query;
  if (!query) return NextResponse.json({ error: 'query is required for test action' }, { status: 400 });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const url = baseUrl ? `${baseUrl}/api/knowledge/search` : 'http://localhost:3000/api/knowledge/search';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query, industry: body.industry, role: body.role,
        companySize: body.companySize, serviceLine: body.serviceLine,
        problems: body.problems, searchMode: body.searchMode || 'hybrid',
        minRelevanceScore: 0, includeContent: true, limit: 10,
      }),
    });
    const data = await res.json();
    return NextResponse.json({
      testQuery: query,
      searchMode: body.searchMode || 'hybrid',
      totalMatches: data.totalMatches,
      results: data.results,
      engineInsight: {
        queryTokens: tokenize(query),
        resultCategories: data.results ? [...new Set(data.results.map((r: any) => r.category))] : [],
        avgRelevanceScore: data.results && data.results.length > 0
          ? Math.round(data.results.reduce((sum: number, r: any) => sum + (r.relevanceScore || 0), 0) / data.results.length)
          : 0,
        topMatchedFields: data.results ? [...new Set(data.results.flatMap((r: any) => r.matchedFields || []))] : [],
      },
    });
  } catch (err) {
    return NextResponse.json({ testQuery: query, error: 'Search test failed', details: String(err) }, { status: 500 });
  }
}
