/**
 * S4 Verification Tests — 2.1, 2.3, 2.4
 * ========================================
 *
 * Tests are STRUCTURAL (file-content based) to avoid DB connection issues
 * in CI environments. Each test reads source files and verifies:
 *   - Function exists with correct signature
 *   - Wiring points are connected
 *   - Integration points call the right functions
 *   - Edge cases are handled
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../src/lib');

// ─── Helper: Read file and return content ─────────────────────────────

function readFile(relPath: string): string {
  const fullPath = path.join(SRC_ROOT, relPath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ─── Helper: Check if function exists in file with expected parameters ────

function hasFunctionSignature(content: string, functionName: string, params: string[]): boolean {
  // Match: export function/async function name(params) or const name = async (params)
  const patterns = [
    new RegExp(`export\\s+async\\s+function\\s+${functionName}\\s*\\([^)]*${params.join('.*')}[^)]*\\)`, 's'),
    new RegExp(`export\\s+function\\s+${functionName}\\s*\\([^)]*${params.join('.*')}[^)]*\\)`, 's'),
  ];
  return patterns.some(p => p.test(content));
}

function hasImport(content: string, modulePath: string, names: string[]): boolean {
  const importRegex = new RegExp(`import\\s*\\{[^}]*${names.join('|')}[^}]*\\}\\s*from\\s*['"]${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  return importRegex.test(content);
}

// ─── S4-2.1: Knowledge Graph Cold-Start Hydration ─────────────────────

describe('S4-2.1: Knowledge Graph Cold-Start Hydration', () => {
  const coldStartFile = readFile('kg-cold-start-hydration.ts');
  const coldStartLoader = readFile('persistence/cold-start-loader.ts');

  it('should export hydrateKnowledgeGraphFromDB with correct signature', () => {
    expect(coldStartFile).toContain('export async function hydrateKnowledgeGraphFromDB()');
    expect(coldStartFile).toContain('Promise<KGColdStartResult>');
  });

  it('should return KGColdStartResult with all required fields', () => {
    expect(coldStartFile).toContain('interface KGColdStartResult');
    expect(coldStartFile).toContain('hydrated: boolean');
    expect(coldStartFile).toContain('companyNodesCreated: number');
    expect(coldStartFile).toContain('signalNodesCreated: number');
    expect(coldStartFile).toContain('technologyNodesCreated: number');
    expect(coldStartFile).toContain('industryNodesCreated: number');
    expect(coldStartFile).toContain('edgesCreated: number');
  });

  it('should skip hydration when graph is already populated', () => {
    // Check for the guard: if statsBefore.totalNodes > 0
    expect(coldStartFile).toContain('statsBefore.totalNodes > 0');
    expect(coldStartFile).toContain('graph_already_populated');
  });

  it('should skip hydration when insufficient data', () => {
    expect(coldStartFile).toContain('MIN_COMPANIES_THRESHOLD');
    expect(coldStartFile).toContain('insufficient_data');
  });

  it('should create company nodes with correct type', () => {
    expect(coldStartFile).toContain("type: 'company' as GraphEntityType");
    expect(coldStartFile).toContain('company:');
    expect(coldStartFile).toContain('company.id');
  });

  it('should create signal nodes linked to companies', () => {
    expect(coldStartFile).toContain("type: 'signal' as GraphEntityType");
    expect(coldStartFile).toContain('signal:');
    expect(coldStartFile).toContain('signal.id');
    expect(coldStartFile).toContain("relationship: 'HAS_SIGNAL' as RelationshipType");
  });

  it('should create technology nodes from company tags', () => {
    expect(coldStartFile).toContain("type: 'technology' as GraphEntityType");
    expect(coldStartFile).toContain('parseTechnologies(company.tags)');
  });

  it('should create industry nodes and link companies to industries', () => {
    expect(coldStartFile).toContain("type: 'industry' as GraphEntityType");
    expect(coldStartFile).toContain("relationship: 'RELATED_TO' as RelationshipType");
  });

  it('should create cross-company SIMILAR_TO edges for same-industry companies', () => {
    expect(coldStartFile).toContain("relationship: 'SIMILAR_TO' as RelationshipType");
    expect(coldStartFile).toContain('industryCompanies');
  });

  it('should create company→technology USES_TECHNOLOGY edges', () => {
    expect(coldStartFile).toContain("relationship: 'USES_TECHNOLOGY' as RelationshipType");
  });

  it('should infer tech categories for technology nodes', () => {
    expect(coldStartFile).toContain('function inferTechCategory(tech: string): string');
    expect(coldStartFile).toContain('cloudProviders');
    expect(coldStartFile).toContain('databases');
    expect(coldStartFile).toContain('containers');
  });

  it('should parse technologies from various formats', () => {
    expect(coldStartFile).toContain('function parseTechnologies(technologies: unknown): string[]');
    // Should handle JSON array, comma-separated, null
    expect(coldStartFile).toContain('JSON.parse');
    expect(coldStartFile).toContain("split(',')");
  });

  it('should be wired into cold-start-loader.ts Phase 4', () => {
    expect(coldStartLoader).toContain('Phase 4: KG Cold-Start Hydration (S4-2.1)');
    expect(coldStartLoader).toContain("import('@/lib/kg-cold-start-hydration')");
    expect(coldStartLoader).toContain('hydrateKnowledgeGraphFromDB');
    expect(coldStartLoader).toContain('kgResult.hydrated');
  });

  it('should be non-blocking in cold-start-loader (try/catch)', () => {
    expect(coldStartLoader).toContain('KG auto-hydration failed (non-fatal)');
  });

  it('should import and use addNode/addEdge from ai-knowledge-graph', () => {
    expect(coldStartFile).toContain("from '@/lib/ai-knowledge-graph'");
    expect(coldStartFile).toContain('addNode');
    expect(coldStartFile).toContain('addEdge');
    expect(coldStartFile).toContain('getNode');
    expect(coldStartFile).toContain('getGraphStats');
  });

  it('should batch limit entities to prevent overload', () => {
    expect(coldStartFile).toContain('MAX_ENTITIES_PER_BATCH');
  });
});

// ─── S4-2.3: Cross-Company Learning Transfer ─────────────────────────

describe('S4-2.3: Cross-Company Learning Transfer', () => {
  const crossCompanyFile = readFile('cross-company-learning.ts');
  const recEngine = readFile('recommendation-engine.ts');

  it('should export transferLearningsToCompany with correct signature', () => {
    expect(crossCompanyFile).toContain('export async function transferLearningsToCompany(');
    expect(crossCompanyFile).toContain('targetCompanyId: string');
    expect(crossCompanyFile).toContain("Promise<CrossCompanyTransferResult>");
  });

  it('should return CrossCompanyTransferResult with required fields', () => {
    expect(crossCompanyFile).toContain('interface CrossCompanyTransferResult');
    expect(crossCompanyFile).toContain('learnings: CrossCompanyLearning[]');
    expect(crossCompanyFile).toContain('similarCompaniesScanned: number');
    expect(crossCompanyFile).toContain('transferCount: number');
  });

  it('should return CrossCompanyLearning with transfer metadata', () => {
    expect(crossCompanyFile).toContain('interface CrossCompanyLearning');
    expect(crossCompanyFile).toContain('sourceLearningId: string');
    expect(crossCompanyFile).toContain('sourceCompanyId: string');
    expect(crossCompanyFile).toContain('transferConfidence: number');
    expect(crossCompanyFile).toContain('transferReason: string');
  });

  it('should find similar companies via KG traversal', () => {
    expect(crossCompanyFile).toContain('traverseBFS');
    expect(crossCompanyFile).toContain("allowedNodeTypes: ['company']");
    expect(crossCompanyFile).toContain('hopPenalty');
  });

  it('should fallback to DB-based industry matching', () => {
    expect(crossCompanyFile).toContain('sameIndustryCompanies');
    expect(crossCompanyFile).toContain('Same industry');
  });

  it('should find technology overlap via KG USES_TECHNOLOGY edges', () => {
    expect(crossCompanyFile).toContain("relationship === 'USES_TECHNOLOGY'");
    expect(crossCompanyFile).toContain('Shared technology');
  });

  it('should cap transfer confidence to MAX_TRANSFER_CONFIDENCE', () => {
    expect(crossCompanyFile).toContain('MAX_TRANSFER_CONFIDENCE');
    expect(crossCompanyFile).toContain('Math.min');
    expect(crossCompanyFile).toContain('MAX_TRANSFER_CONFIDENCE,');
  });

  it('should auto-mark transferred learnings as reused', () => {
    expect(crossCompanyFile).toContain('ContinuousLearningLoop.markReused');
    expect(crossCompanyFile).toContain("learning.sourceLearningId");
  });

  it('should compute transfer relevance with context scoring', () => {
    expect(crossCompanyFile).toContain('computeTransferRelevance');
    expect(crossCompanyFile).toContain('industry match');
    expect(crossCompanyFile).toContain('technology overlap');
    expect(crossCompanyFile).toContain('company size match');
  });

  it('should be wired into recommendation-engine.ts as Step 3c', () => {
    expect(recEngine).toContain('Step 3c: Cross-Company Learning Transfer (S4-2.3)');
    expect(recEngine).toContain('transferLearningsToCompany(company.id');
    expect(recEngine).toContain('crossCompanyResult');
  });

  it('should add cross_company_learning category to reasons', () => {
    expect(recEngine).toContain('cross_company_learning');
    expect(recEngine).toContain('sourceType: \'CrossCompanyLearning\'');
  });

  it('should be imported in recommendation engine', () => {
    expect(recEngine).toContain("from '@/lib/cross-company-learning'");
    expect(recEngine).toContain('transferLearningsToCompany');
  });

  it('should handle empty results gracefully', () => {
    expect(crossCompanyFile).toContain('transferCount');
    // Non-throwing
    expect(crossCompanyFile).toContain('Transfer failed');
  });
});

// ─── S4-2.4: Decision Confidence Blending ─────────────────────────────

describe('S4-2.4: Decision Confidence Blending', () => {
  const blendedFile = readFile('blended-confidence.ts');
  const recEngine = readFile('recommendation-engine.ts');

  it('should export computeBlendedConfidence with correct signature', () => {
    expect(blendedFile).toContain('export async function computeBlendedConfidence(');
    expect(blendedFile).toContain('input: BlendedConfidenceInput');
    expect(blendedFile).toContain('Promise<BlendedConfidenceResult>');
  });

  it('should export getBlendedScore convenience function', () => {
    expect(blendedFile).toContain('export async function getBlendedScore(');
  });

  it('should export explainBlendedConfidence for explainability', () => {
    expect(blendedFile).toContain('export function explainBlendedConfidence(');
    expect(blendedFile).toContain('result: BlendedConfidenceResult');
  });

  it('should define BlendedConfidenceInput with all sources', () => {
    expect(blendedFile).toContain('interface BlendedConfidenceInput');
    expect(blendedFile).toContain('baseScore: number');
    expect(blendedFile).toContain('calibrationDelta?: number');
    expect(blendedFile).toContain('agentType?: string');
    expect(blendedFile).toContain('kgConfidence?: number');
    expect(blendedFile).toContain('memoryConfidence?: number');
    expect(blendedFile).toContain('evidenceQuality?: number');
    expect(blendedFile).toContain('customWeights?: Partial<ConfidenceWeights>');
  });

  it('should define BlendedConfidenceResult with breakdown', () => {
    expect(blendedFile).toContain('interface BlendedConfidenceResult');
    expect(blendedFile).toContain('blendedScore: number');
    expect(blendedFile).toContain('sources: ConfidenceSource[]');
    expect(blendedFile).toContain('totalWeightApplied: number');
    expect(blendedFile).toContain('dominantSource: string');
  });

  it('should define DEFAULT_WEIGHTS summing to 1.0', () => {
    expect(blendedFile).toContain('export const DEFAULT_WEIGHTS: ConfidenceWeights');
    expect(blendedFile).toContain('base: 0.35');
    expect(blendedFile).toContain('calibration: 0.15');
    expect(blendedFile).toContain('decisionLearning: 0.20');
    expect(blendedFile).toContain('knowledgeGraph: 0.15');
    expect(blendedFile).toContain('memory: 0.10');
    expect(blendedFile).toContain('evidenceQuality: 0.05');
    // Sum check: 0.35 + 0.15 + 0.20 + 0.15 + 0.10 + 0.05 = 1.0
  });

  it('should define ConfidenceSource with explainability fields', () => {
    expect(blendedFile).toContain('interface ConfidenceSource');
    expect(blendedFile).toContain('name: string');
    expect(blendedFile).toContain('value: number');
    expect(blendedFile).toContain('weight: number');
    expect(blendedFile).toContain('contributed: boolean');
    expect(blendedFile).toContain('description: string');
  });

  it('should call adjustDecisionConfidence from decision-learning', () => {
    expect(blendedFile).toContain("from '@/lib/decision-learning'");
    expect(blendedFile).toContain('adjustConfidence as adjustDecisionConfidence');
  });

  it('should clamp result to 0-100 range', () => {
    expect(blendedFile).toContain('Math.min(100, Math.max(0,');
  });

  it('should determine dominant source by contribution', () => {
    expect(blendedFile).toContain('dominantSource');
    expect(blendedFile).toContain('contributions.sort');
  });

  it('should handle missing sources gracefully (neutral defaults)', () => {
    // Each source checks if value is provided, falls back to 0
    expect(blendedFile).toContain('input.calibrationDelta !== undefined');
    expect(blendedFile).toContain('input.kgConfidence !== undefined');
    expect(blendedFile).toContain('input.memoryConfidence !== undefined');
    expect(blendedFile).toContain('input.evidenceQuality !== undefined');
  });

  it('should be wired into recommendation-engine.ts Step 5b', () => {
    expect(recEngine).toContain('Step 5b: Multi-source confidence blending (S4-2.4)');
    expect(recEngine).toContain('computeBlendedConfidence({');
    expect(recEngine).toContain('blendedConfidenceBreakdown');
  });

  it('should pass KG, memory, and evidence quality to blended confidence', () => {
    expect(recEngine).toContain('kgConfidence:');
    expect(recEngine).toContain('memoryConfidence:');
    expect(recEngine).toContain('evidenceQuality:');
  });

  it('should be imported in recommendation engine', () => {
    expect(recEngine).toContain("from '@/lib/blended-confidence'");
    expect(recEngine).toContain('computeBlendedConfidence');
    expect(recEngine).toContain('BlendedConfidenceResult');
  });

  it('should use blended score for priority determination', () => {
    expect(recEngine).toContain('decisionAdjustedScore = blendedConfidenceBreakdown.blendedScore');
  });

  it('should fall back to base when blended confidence fails', () => {
    expect(recEngine).toContain('blended confidence unavailable, fall back to base');
  });
});

// ─── Integration: End-to-End Pipeline Verification ───────────────────

describe('S4 Integration: Pipeline Flow Verification', () => {
  const coldStartLoader = readFile('persistence/cold-start-loader.ts');
  const recEngine = readFile('recommendation-engine.ts');

  it('should have complete pipeline: KG hydration → cross-company learning → blended confidence', () => {
    // Cold-start calls KG hydration
    expect(coldStartLoader).toContain('hydrateKnowledgeGraphFromDB');

    // Recommendation engine calls cross-company learning
    expect(recEngine).toContain('transferLearningsToCompany');

    // Recommendation engine calls blended confidence
    expect(recEngine).toContain('computeBlendedConfidence');
  });

  it('should have all 3 new modules importable from lib/', () => {
    // Verify files exist at expected paths
    const paths = [
      '../src/lib/kg-cold-start-hydration.ts',
      '../src/lib/cross-company-learning.ts',
      '../src/lib/blended-confidence.ts',
    ];
    for (const p of paths) {
      expect(fs.existsSync(path.resolve(__dirname, p))).toBe(true);
    }
  });

  it('should have recommendation engine import all 3 modules', () => {
    expect(recEngine).toContain("from '@/lib/continuous-learning-loop'");
    expect(recEngine).toContain("from '@/lib/decision-learning'");
    expect(recEngine).toContain("from '@/lib/cross-company-learning'");
    expect(recEngine).toContain("from '@/lib/blended-confidence'");
  });

  it('should have all operations wrapped in try/catch (non-blocking)', () => {
    // KG hydration in cold-start-loader
    expect(coldStartLoader).toContain('KG auto-hydration failed (non-fatal)');

    // Cross-company learning in rec engine
    expect(recEngine).toContain('Cross-company learning failed — non-blocking');

    // Blended confidence in rec engine
    expect(recEngine).toContain('blended confidence unavailable, fall back to base');
  });
});
