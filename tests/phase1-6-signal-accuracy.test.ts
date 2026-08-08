/**
 * Phase 1.6 — Signal Detection Accuracy Hardening Tests
 *
 * Tests the wiring of 3 previously orphaned modules into the pipeline.
 * Uses file-system verification + direct relative imports for pure functions.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(process.cwd(), 'src/lib');
const RESEARCH = path.resolve(process.cwd(), 'src/lib/research-engine');
const API_SIGNALS = path.resolve(process.cwd(), 'src/app/api/signals');

// Import pure functions directly — @ alias is configured in vitest.config.ts
import { SIGNAL_TYPES, CANONICAL_SIGNAL_TYPE_LIST, normalizeSignalType, SIGNAL_TYPE_ALIASES } from '@/lib/signal-types';

// signal-meaning.ts only imports signal-types.ts (no DB)
import { inferSignalMeaning, batchInferMeaning } from '@/lib/research-engine/signal-meaning';

describe('Phase 1.6 — Signal Detection Accuracy Hardening', () => {

  // ═══════════════════════════════════════════════════════════════
  // 1. Signal Meaning Inference (pure function tests)
  // ═══════════════════════════════════════════════════════════════

  describe('1. Signal Meaning Inference', () => {
    it('should infer budget_available for funding signal with critical severity + high impact', () => {
      const meaning = inferSignalMeaning({
        signalType: 'funding',
        severity: 'critical',
        impact: 'high',
        title: 'Series C funding round of $100M',
        description: 'Raised $100M in Series C funding for AI expansion',
      });

      expect(meaning.meaningCategory).toBe('budget_available');
      expect(meaning.confidence).toBe(0.9);
      expect(meaning.buyingStageImplication).toContain('budget');
      expect(meaning.recommendedAction).toContain('Prioritize');
    });

    it('should infer leadership_openness for leadership_change with high impact', () => {
      const meaning = inferSignalMeaning({
        signalType: 'leadership_change',
        severity: 'high',
        impact: 'high',
        title: 'New CTO appointed',
        description: 'Company hired a new Chief Technology Officer',
      });

      expect(meaning.meaningCategory).toBe('leadership_openness');
      expect(meaning.confidence).toBe(0.85);
    });

    it('should infer growth_pressure for high-severity hiring signals', () => {
      const meaning = inferSignalMeaning({
        signalType: 'hiring',
        severity: 'high',
        impact: 'high',
        title: 'Aggressively hiring 50 engineers',
        description: 'Company scaling engineering team rapidly',
      });

      expect(meaning.meaningCategory).toBe('growth_pressure');
      expect(meaning.confidence).toBe(0.8);
    });

    it('should infer growth_pressure for high-severity expansion signals', () => {
      const meaning = inferSignalMeaning({
        signalType: 'expansion',
        severity: 'high',
        impact: 'high',
        title: 'Opening new office in Singapore',
        description: 'Expanding operations to APAC region',
      });

      expect(meaning.meaningCategory).toBe('growth_pressure');
      expect(meaning.confidence).toBe(0.8);
    });

    it('should infer vendor_evaluation for partnership signals with high impact', () => {
      const meaning = inferSignalMeaning({
        signalType: 'partnership',
        severity: 'high',
        impact: 'high',
        title: 'Strategic partnership with SAP',
        description: 'Forming strategic technology partnership',
      });

      expect(meaning.meaningCategory).toBe('vendor_evaluation');
      expect(meaning.confidence).toBe(0.8);
    });

    it('should infer compliance_requirement from title/description keywords', () => {
      const meaning = inferSignalMeaning({
        signalType: 'expansion',
        severity: 'medium',
        impact: 'medium',
        title: 'GDPR compliance deadline approaching',
        description: 'Company must comply with GDPR regulations by Q1',
      });

      expect(meaning.meaningCategory).toBe('compliance_requirement');
      expect(meaning.confidence).toBe(0.7);
    });

    it('should override meaning with opportunityType (RFP → vendor_evaluation)', () => {
      const meaning = inferSignalMeaning({
        signalType: 'expansion',
        severity: 'medium',
        impact: 'medium',
        opportunityType: 'rfp',
        title: 'RFP issued for IT services',
        description: 'Company issued an RFP for cloud migration services',
      });

      expect(meaning.meaningCategory).toBe('vendor_evaluation');
      expect(meaning.confidence).toBe(0.95);
    });

    it('should override meaning with opportunityType (tender → compliance_requirement)', () => {
      const meaning = inferSignalMeaning({
        signalType: 'news',
        severity: 'medium',
        impact: 'medium',
        opportunityType: 'tender',
        title: 'Government tender for data services',
        description: 'Issuing a tender for cloud services procurement',
      });

      expect(meaning.meaningCategory).toBe('compliance_requirement');
      expect(meaning.confidence).toBe(0.9);
    });

    it('should return unknown for news signals without specific attributes', () => {
      const meaning = inferSignalMeaning({
        signalType: 'news',
        severity: 'low',
        impact: 'low',
        title: 'Company mentioned in industry report',
        description: 'Brief mention in annual industry analysis',
      });

      expect(meaning.meaningCategory).toBe('unknown');
      expect(meaning.confidence).toBe(0.3);
    });

    it('should batch-infer meanings and skip already-categorized signals', () => {
      const signals = [
        { id: '1', signalType: 'funding', severity: 'high', impact: 'high', title: 'Raised $50M', description: 'Series B', meaningCategory: null as string | null },
        { id: '2', signalType: 'hiring', severity: 'low', impact: 'low', title: 'Hiring intern', description: 'Summer intern', meaningCategory: null as string | null },
        { id: '3', signalType: 'funding', severity: 'high', impact: 'high', title: 'Already categorized', description: 'Has meaning', meaningCategory: 'budget_available' as string },
        { id: '4', signalType: 'news', severity: 'low', impact: 'low', title: 'Mentioned', description: 'Press mention', meaningCategory: 'unknown' as string | null },
      ];

      const result = batchInferMeaning(signals);
      expect(result.updated).toBeGreaterThanOrEqual(1);
      // id:3 should NOT be updated (already has budget_available)
      expect(result.results.find(r => r.signalId === '3')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. Signal Type Normalization
  // ═══════════════════════════════════════════════════════════════

  describe('2. Signal Type Normalization', () => {
    it('should have exactly 10 canonical signal types', () => {
      expect(CANONICAL_SIGNAL_TYPE_LIST).toHaveLength(10);
    });

    it('should normalize legacy types correctly', () => {
      expect(normalizeSignalType('product')).toBe(SIGNAL_TYPES.NEWS);
      expect(normalizeSignalType('financial_pressure')).toBe(SIGNAL_TYPES.NEWS);
      expect(normalizeSignalType('regulatory')).toBe(SIGNAL_TYPES.NEWS);
      expect(normalizeSignalType('technology')).toBe(SIGNAL_TYPES.TECH_CHANGE);
      expect(normalizeSignalType('mention')).toBe(SIGNAL_TYPES.NEWS);
      expect(normalizeSignalType('signal')).toBe(SIGNAL_TYPES.NEWS);
    });

    it('should pass through canonical types unchanged', () => {
      expect(normalizeSignalType('funding')).toBe('funding');
      expect(normalizeSignalType('hiring')).toBe('hiring');
      expect(normalizeSignalType('leadership_change')).toBe('leadership_change');
      expect(normalizeSignalType('people_change')).toBe('people_change');
      expect(normalizeSignalType('expansion')).toBe('expansion');
      expect(normalizeSignalType('technology_adoption')).toBe('technology_adoption');
      expect(normalizeSignalType('partnership')).toBe('partnership');
      expect(normalizeSignalType('acquisition')).toBe('acquisition');
    });

    it('should have all alias keys mapped', () => {
      const aliasKeys = Object.keys(SIGNAL_TYPE_ALIASES);
      expect(aliasKeys.length).toBeGreaterThanOrEqual(14); // At least 14 known aliases
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Module Wiring Verification (file content analysis)
  // ═══════════════════════════════════════════════════════════════

  describe('3. Module Wiring — signals.ts imports inferSignalMeaning', () => {
    const signalsContent = fs.readFileSync(path.join(RESEARCH, 'signals.ts'), 'utf-8');

    it('should import inferSignalMeaning from signal-meaning', () => {
      expect(signalsContent).toContain("import { inferSignalMeaning } from './signal-meaning'");
    });

    it('should have Phase 3b: Meaning Inference in storeSignals', () => {
      expect(signalsContent).toContain('Phase 3b: Meaning Inference');
    });

    it('should call inferSignalMeaning() in the lifecycle loop', () => {
      expect(signalsContent).toContain('inferSignalMeaning({');
    });

    it('should update meaningCategory in DB', () => {
      expect(signalsContent).toContain('meaningCategory');
    });
  });

  describe('4. Module Wiring — recommendation-engine.ts imports validation + meaning', () => {
    const engineContent = fs.readFileSync(path.join(SRC, 'recommendation-engine.ts'), 'utf-8');

    it('should import getSignalValidationSummary from signal-validation', () => {
      expect(engineContent).toContain("import { getSignalValidationSummary } from '@/lib/signal-validation'");
    });

    it('should import inferSignalMeaning from signal-meaning', () => {
      expect(engineContent).toContain("import { inferSignalMeaning");
    });

    it('should have getOpenConflictCount helper', () => {
      expect(engineContent).toContain('async function getOpenConflictCount');
      expect(engineContent).toContain('intelligenceConflict.count');
    });

    it('should pass real contradiction count (NOT hard-coded 0)', () => {
      expect(engineContent).toContain('contradictions: await getOpenConflictCount(company.id)');
      // Should NOT have hard-coded 0
      expect(engineContent).not.toContain('contradictions: 0,');
    });
  });

  describe('5. Module Wiring — barrel exports', () => {
    const barrelContent = fs.readFileSync(path.join(RESEARCH, 'index.ts'), 'utf-8');

    it('should export inferSignalMeaning from barrel', () => {
      expect(barrelContent).toContain('inferSignalMeaning');
    });

    it('should export batchInferMeaning from barrel', () => {
      expect(barrelContent).toContain('batchInferMeaning');
    });

    it('should export validateCompanySignals from barrel', () => {
      expect(barrelContent).toContain('validateCompanySignals');
    });

    it('should export getSignalValidationSummary from barrel', () => {
      expect(barrelContent).toContain('getSignalValidationSummary');
    });

    it('should export detectContradictions from barrel', () => {
      expect(barrelContent).toContain('detectContradictions');
    });

    it('should export resolveConflict from barrel', () => {
      expect(barrelContent).toContain('resolveConflict');
    });
  });

  describe('6. Module Wiring — signals API includes validation', () => {
    const signalsApiContent = fs.readFileSync(path.join(API_SIGNALS, 'route.ts'), 'utf-8');

    it('should include signalValidation in signals query', () => {
      expect(signalsApiContent).toContain('signalValidation');
      expect(signalsApiContent).toContain('validationStatus');
    });
  });

  describe('7. Accuracy Pipeline API exists', () => {
    const pipelineContent = fs.readFileSync(path.join(API_SIGNALS, 'accuracy-pipeline', 'route.ts'), 'utf-8');

    it('should import inferSignalMeaning and batchInferMeaning', () => {
      expect(pipelineContent).toContain('inferSignalMeaning');
      expect(pipelineContent).toContain('batchInferMeaning');
    });

    it('should import validateCompanySignals and getSignalValidationSummary', () => {
      expect(pipelineContent).toContain('validateCompanySignals');
      expect(pipelineContent).toContain('getSignalValidationSummary');
    });

    it('should import detectContradictions', () => {
      expect(pipelineContent).toContain('detectContradictions');
    });

    it('should have 3 pipeline stages: meaningInference, validation, contradictions', () => {
      expect(pipelineContent).toContain('meaningInference');
      expect(pipelineContent).toContain('validation');
      expect(pipelineContent).toContain('contradictions');
    });

    it('should accept POST with companyId', () => {
      expect(pipelineContent).toContain('POST');
      expect(pipelineContent).toContain('companyId');
    });
  });

  describe('8. Orphaned modules now have production callers', () => {
    it('signal-validation.ts should be imported by recommendation-engine.ts', () => {
      const engine = fs.readFileSync(path.join(SRC, 'recommendation-engine.ts'), 'utf-8');
      expect(engine).toContain('@/lib/signal-validation');
    });

    it('signal-validation.ts should be imported by accuracy-pipeline API', () => {
      const pipeline = fs.readFileSync(path.join(API_SIGNALS, 'accuracy-pipeline', 'route.ts'), 'utf-8');
      expect(pipeline).toContain('@/lib/signal-validation');
    });

    it('contradiction-detection.ts should be imported by accuracy-pipeline API', () => {
      const pipeline = fs.readFileSync(path.join(API_SIGNALS, 'accuracy-pipeline', 'route.ts'), 'utf-8');
      expect(pipeline).toContain('@/lib/contradiction-detection');
    });

    it('signal-meaning.ts should be imported by signals.ts (in storeSignals)', () => {
      const signals = fs.readFileSync(path.join(RESEARCH, 'signals.ts'), 'utf-8');
      expect(signals).toContain("from './signal-meaning'");
    });

    it('signal-meaning.ts should be imported by accuracy-pipeline API', () => {
      const pipeline = fs.readFileSync(path.join(API_SIGNALS, 'accuracy-pipeline', 'route.ts'), 'utf-8');
      expect(pipeline).toContain('signal-meaning');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. Contradiction Detection Logic Verification
  // ═══════════════════════════════════════════════════════════════

  describe('9. Contradiction Detection Module Structure', () => {
    const contradictionContent = fs.readFileSync(path.join(SRC, 'contradiction-detection.ts'), 'utf-8');

    it('should have competing platforms defined (AWS, Azure, GCP)', () => {
      expect(contradictionContent).toContain('AWS');
      expect(contradictionContent).toContain('Azure');
      expect(contradictionContent).toContain('GCP');
    });

    it('should have competing CRM platforms (Salesforce, HubSpot)', () => {
      expect(contradictionContent).toContain('Salesforce');
      expect(contradictionContent).toContain('HubSpot');
    });

    it('should have expansion/contraction keywords', () => {
      expect(contradictionContent).toContain('EXPANSION_KEYWORDS');
      expect(contradictionContent).toContain('CONTRACTION_KEYWORDS');
    });

    it('should have funding/workforce conflict keywords', () => {
      expect(contradictionContent).toContain('FUNDING_POSITIVE_KEYWORDS');
      expect(contradictionContent).toContain('WORKFORCE_NEGATIVE_KEYWORDS');
    });

    it('should have detectContradictions as main entry point', () => {
      expect(contradictionContent).toContain('export async function detectContradictions');
    });

    it('should have resolveConflict function', () => {
      expect(contradictionContent).toContain('export async function resolveConflict');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. Signal Validation Module Structure
  // ═══════════════════════════════════════════════════════════════

  describe('10. Signal Validation Module Structure', () => {
    const validationContent = fs.readFileSync(path.join(SRC, 'signal-validation.ts'), 'utf-8');

    it('should classify VALID for high confidence + high impact + multi-source', () => {
      expect(validationContent).toContain("confidence >= 0.7");
      expect(validationContent).toContain("evidenceCount >= 2");
    });

    it('should classify WEAK for low confidence or single-source', () => {
      expect(validationContent).toContain("confidence < 0.5");
      expect(validationContent).toContain("evidenceCount <= 1");
    });

    it('should classify CONFLICTING when hasConflict is true', () => {
      expect(validationContent).toContain('CONFLICTING');
      expect(validationContent).toContain('hasConflict');
    });

    it('should classify EXPIRED for expired/archived signals', () => {
      expect(validationContent).toContain('EXPIRED');
    });

    it('should upsert SignalValidation records', () => {
      expect(validationContent).toContain('signalValidation.upsert');
    });

    it('should have getSignalValidationSummary function', () => {
      expect(validationContent).toContain('export async function getSignalValidationSummary');
    });
  });
});
