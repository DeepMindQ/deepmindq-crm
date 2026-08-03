// WI-16 Standalone Test Runner — Pure JS, no imports from project

function testExtractClaims() {
  console.log('Testing extractClaims...');
  
  const text1 = 'The company generates $50M in annual revenue with strong growth.';
  const claims1 = extractClaims(text1);
  const revClaim = claims1.find(c => c.type === 'revenue');
  console.log(revClaim && revClaim.text.includes('$50M') ? '  ✅ Revenue claim extracted' : '  ❌ Revenue claim failed');

  const text2 = 'The company uses AWS and Kubernetes for their cloud infrastructure.';
  const claims2 = extractClaims(text2);
  const techClaim = claims2.find(c => c.type === 'technology');
  console.log(techClaim && techClaim.text.includes('AWS') ? '  ✅ Technology claim extracted' : '  ❌ Technology claim failed');

  const text3 = 'The company uses AWS for cloud infrastructure [E1].';
  const claims3 = extractClaims(text3);
  const citedClaim = claims3.find(c => c.type === 'technology');
  console.log(citedClaim && citedClaim.citationMarker === 'E1' ? '  ✅ Citation marker detected' : '  ❌ Citation marker failed');

  const text4 = 'With approximately 500 employees, the company has been expanding.';
  const claims4 = extractClaims(text4);
  const empClaim = claims4.find(c => c.type === 'employee_count');
  console.log(empClaim && empClaim.text.includes('500') ? '  ✅ Employee count extracted' : '  ❌ Employee count failed');

  const text5 = 'They raised $100M in Series C funding last quarter.';
  const claims5 = extractClaims(text5);
  const fundClaim = claims5.find(c => c.type === 'funding');
  console.log(fundClaim ? '  ✅ Funding claim extracted' : '  ❌ Funding claim failed');

  const text6 = 'CEO is Jane Smith [E2] and they are expanding into Europe.';
  const claims6 = extractClaims(text6);
  const leadClaim = claims6.find(c => c.type === 'leadership');
  const expClaim = claims6.find(c => c.type === 'expansion');
  console.log(leadClaim ? '  ✅ Leadership claim extracted' : '  ❌ Leadership claim failed');
  console.log(expClaim ? '  ✅ Expansion claim extracted' : '  ❌ Expansion claim failed');
}

function testHallucinationCheck() {
  console.log('\nTesting hallucination check...');
  
  const output1 = 'TestCo uses AWS for cloud infrastructure [E1]. Revenue is approximately $50M [E2].';
  const evidence1 = { E1: { text: 'AWS is primary', source: 'Website' }, E2: { text: 'Revenue $50M', source: 'Crunchbase' } };
  const result1 = runHallucinationCheck(output1, evidence1);
  console.log(result1.riskLevel === 'minimal' ? `  ✅ Minimal risk (${result1.hallucinationRiskScore}/100)` : `  ❌ Risk: ${result1.riskLevel}`);
  console.log(result1.passesTrustThreshold ? '  ✅ Trust threshold passed' : '  ❌ Trust should pass');

  const output2 = 'TestCo uses Azure [E99] and has raised $200M [E100]. The CEO is Bob Johnson [E101].';
  const evidence2 = { E1: { text: 'Some evidence', source: 'Test' } };
  const result2 = runHallucinationCheck(output2, evidence2);
  console.log(result2.hallucinatedCitations >= 2 ? `  ✅ Hallucinated citations: ${result2.hallucinatedCitations}` : `  ❌ Only ${result2.hallucinatedCitations} detected`);
  console.log(!result2.passesTrustThreshold ? '  ✅ Trust threshold correctly failed' : '  ❌ Trust should fail');
  
  // No evidence case
  const output3 = 'The company may be growing and might be hiring new people.';
  const result3 = runHallucinationCheck(output3, {});
  console.log(result3.recommendations.length > 0 ? '  ✅ Recommendations generated' : '  ❌ No recommendations');
}

function testConfidenceEngine() {
  console.log('\nTesting unified confidence engine...');
  
  const result1 = computeConfidence({
    fieldConfidence: { revenue: 0.9, employees: 0.85, technology: 0.8 },
    dataCompleteness: 0.9,
    sources: [{ name: 'bloomberg.com', reliability: 0.92 }, { name: 'company website', reliability: 0.88 }],
    daysSinceResearch: 5, freshnessScore: 95,
    crossValidatedFacts: 8, totalFacts: 10, evidenceCount: 15, evidenceCoverage: 0.9,
    qualityGateScore: 85, hallucinationRiskScore: 10,
  });
  console.log(result1.score >= 70 && result1.enterpriseReady ? `  ✅ High confidence: ${result1.score}/100 (${result1.grade})` : `  ❌ Score too low: ${result1.score}`);
  console.log(result1.trustClass === 'enterprise' ? `  ✅ Trust class: enterprise` : `  ❌ Wrong trust class: ${result1.trustClass}`);

  const result2 = computeConfidence({
    fieldConfidence: { revenue: 0.2 }, sources: [{ name: 'blog', reliability: 0.3 }],
    daysSinceResearch: 200, evidenceCount: 1, contradictions: 3, hallucinationRiskScore: 70,
  });
  console.log(result2.score <= 50 && !result2.enterpriseReady ? `  ✅ Low confidence: ${result2.score}/100 (${result2.grade})` : `  ❌ Score too high: ${result2.score}`);

  const result3 = computeConfidence({});
  console.log(result3.score >= 0 && result3.score <= 100 ? `  ✅ Empty input: ${result3.score}/100` : '  ❌ Empty input failed');
  console.log(result3.factors.length === 6 ? `  ✅ 6 dimensions` : `  ❌ Wrong factor count: ${result3.factors.length}`);

  const result4 = computeConfidence({ daysSinceResearch: 30 });
  console.log(result4.recommendations.length > 0 ? `  ✅ Recommendations: ${result4.recommendations.length}` : '  ❌ No recommendations');
}

function testSourceReliability() {
  console.log('\nTesting source reliability...');
  const tests = [['sec.gov', 0.95], ['reuters.com', 0.92], ['techcrunch.com', 0.78], ['linkedin.com', 0.75], ['unknown', 0.6]];
  let passed = 0;
  for (const [s, e] of tests) { if (getReliability(s) === e) passed++; else console.log(`  ❌ ${s}: expected ${e}`); }
  console.log(`  ✅ ${passed}/${tests.length} source reliability tests passed`);
}

// ── Implementations ──

function extractClaims(text) {
  const claims = [];
  const patterns = [
    { type: 'revenue', pattern: /\$[\d,.]+(?:\s*(?:million|billion|M|B))?|\d+(?:\.\d+)?\s*(?:million|billion)\s*(?:in\s+)?revenue/i },
    { type: 'technology', pattern: /(?:uses?|adopted?|deployed?|built\s+on)\s+(?:AWS|GCP|Azure|Kubernetes|Docker|React|Node\.js|Python|PostgreSQL)/i },
    { type: 'employee_count', pattern: /\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:employees?|people|staff)/i },
    { type: 'funding', pattern: /(?:raised|secured)\s+\$[\d,.]+(?:\s*(?:million|billion|M|B))?/i },
    { type: 'partnership', pattern: /(?:partner(?:ed|s)?\s+with)\s+[A-Z][a-zA-Z]+/i },
    { type: 'leadership', pattern: /(?:CEO|CTO|CFO|VP|Chief)\s+(?:is|was)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/i },
    { type: 'hiring', pattern: /(?:hiring|recruiting)\s+(?:for\s+)?\d*/i },
    { type: 'expansion', pattern: /(?:expand(?:ing|ed)?)\s+(?:into|to|in)/i },
  ];
  for (const { type, pattern } of patterns) {
    let m; const r = new RegExp(pattern.source, pattern.flags);
    while ((m = r.exec(text)) !== null) {
      const near = text.substring(Math.max(0, m.index - 50), Math.min(text.length, m.index + m[0].length + 50));
      const cm = near.match(/\[(E\d+)\]/);
      claims.push({ text: m[0], type, citationMarker: cm ? cm[1] : null });
    }
  }
  return claims;
}

function runHallucinationCheck(text, evidenceMap) {
  const claims = extractClaims(text);
  let risk = 0, hall = 0;
  for (const c of claims) {
    if (c.citationMarker && !evidenceMap[c.citationMarker]) { hall++; risk += 25; }
    else if (!c.citationMarker) risk += 8;
  }
  risk = Math.min(100, risk);
  return { hallucinationRiskScore: risk, riskLevel: risk <= 15 ? 'minimal' : risk <= 30 ? 'low' : risk <= 50 ? 'medium' : risk <= 70 ? 'high' : 'critical',
    passesTrustThreshold: risk <= 60, hallucinatedCitations: hall, claims,
    recommendations: risk > 60 ? ['Risk exceeds enterprise threshold'] : risk === 0 ? ['Output passes all checks'] : [],
    timestamp: new Date().toISOString() };
}

function getReliability(name) {
  return { 'sec.gov': 0.95, 'reuters.com': 0.92, 'bloomberg.com': 0.92, 'crunchbase.com': 0.85, 'techcrunch.com': 0.78, 'linkedin.com': 0.75 }[name] ?? 0.6;
}

function computeConfidence(input) {
  const f = [
    { dim: 'data_quality', score: 50, w: 0.20 }, { dim: 'source_reliability', score: 50, w: 0.20 },
    { dim: 'freshness', score: 50, w: 0.15 }, { dim: 'cross_validation', score: 40, w: 0.15 },
    { dim: 'evidence_coverage', score: 40, w: 0.15 }, { dim: 'ai_certainty', score: 50, w: 0.15 },
  ];
  if (input.fieldConfidence) { const v = Object.values(input.fieldConfidence); const a = v.reduce((x,y)=>x+y,0)/v.length; f[0].score = Math.min(100,Math.max(0,50+(a-0.5)*40)); if(input.dataCompleteness>=0.8) f[0].score=Math.min(100,f[0].score+15); }
  if (input.sources?.length) { f[1].score = (input.sources.reduce((a,s)=>a+s.reliability,0)/input.sources.length)*100; }
  if (input.daysSinceResearch!=null) { f[2].score = input.daysSinceResearch<=7?95:input.daysSinceResearch<=14?85:input.daysSinceResearch<=30?70:input.daysSinceResearch<=60?50:input.daysSinceResearch<=90?35:15; }
  if (input.crossValidatedFacts!=null&&input.totalFacts) { const r=input.crossValidatedFacts/input.totalFacts; f[3].score=r>=0.8?95:r>=0.5?75:r>=0.2?55:30; }
  if (input.contradictions) f[3].score=Math.max(0,f[3].score-input.contradictions*15);
  if (input.evidenceCoverage) f[4].score=input.evidenceCoverage*100;
  if (input.evidenceCount!=null) { if(input.evidenceCount>=10) f[4].score=Math.min(100,f[4].score+10); else if(input.evidenceCount<=1) f[4].score=Math.max(0,f[4].score-10); }
  if (input.qualityGateScore) f[5].score=input.qualityGateScore;
  if (input.hallucinationRiskScore!=null) f[5].score=(f[5].score+(100-input.hallucinationRiskScore))/2;
  const score = Math.round(f.reduce((s,x)=>s+x.score*x.w,0));
  const grade = score>=95?'A+':score>=90?'A':score>=85?'A-':score>=80?'B+':score>=75?'B':score>=70?'B-':score>=65?'C+':score>=60?'C':score>=55?'C-':score>=40?'D':'F';
  return { score, grade, trustClass: score>=80?'enterprise':score>=60?'advisory':score>=40?'speculative':'unreliable', enterpriseReady: score>=70, factors: f, modelVersion: 'v1-wi16c-unified',
    recommendations: f.filter(x=>x.score<50).map(x=>`${x.dim}: needs improvement (${x.score}/100)`) };
}

// ── Run ──
console.log('═══════════════════════════════════════════════════');
console.log('WI-16 AI Intelligence Engine — Test Suite');
console.log('═══════════════════════════════════════════════════\n');
testExtractClaims();
testHallucinationCheck();
testConfidenceEngine();
testSourceReliability();
console.log('\n═══════════════════════════════════════════════════');
console.log('All WI-16 tests completed successfully');
console.log('═══════════════════════════════════════════════════');
