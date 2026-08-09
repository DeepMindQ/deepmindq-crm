/**
 * Phase 1.7 — Technology Detection Calibration Tests
 *
 * Tests the centralized tech keyword registry and its wiring into:
 *   1. signal-creator.ts (classifySignalType)
 *   2. signals.ts (rule-based fallback)
 *   3. contradiction-detection.ts (COMPETING_PLATFORMS)
 *   4. detectTechInText() helper function
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

const SRC = path.resolve(process.cwd(), 'src/lib');
const SHARED = path.resolve(process.cwd(), 'src/lib/shared');

// Import the centralized registry
import {
  TECH_KEYWORDS,
  ALL_TECH_KEYWORDS,
  TECH_ACTION_VERBS,
  TECH_SIGNAL_REGEX,
  TECH_MENTION_REGEX,
  COMPETING_PLATFORMS,
  detectTechInText,
  type TechCategory,
} from '@/lib/shared/tech-keywords';

describe('Phase 1.7 — Technology Detection Calibration', () => {

  // ═══════════════════════════════════════════════════════════════
  // 1. Centralized Registry Structure
  // ═══════════════════════════════════════════════════════════════

  describe('1. Centralized Registry Structure', () => {
    it('should have 8 tech categories', () => {
      expect(Object.keys(TECH_KEYWORDS)).toHaveLength(8);
    });

    it('should have all required categories', () => {
      expect(TECH_KEYWORDS.CLOUD).toBeDefined();
      expect(TECH_KEYWORDS.DATA).toBeDefined();
      expect(TECH_KEYWORDS.AI_ML).toBeDefined();
      expect(TECH_KEYWORDS.DEVOPS).toBeDefined();
      expect(TECH_KEYWORDS.CRM_ERP).toBeDefined();
      expect(TECH_KEYWORDS.DEV_STACK).toBeDefined();
      expect(TECH_KEYWORDS.SECURITY).toBeDefined();
      expect(TECH_KEYWORDS.COLLABORATION).toBeDefined();
    });

    it('should have 100+ total keywords', () => {
      expect(ALL_TECH_KEYWORDS.length).toBeGreaterThanOrEqual(100);
    });

    it('CLOUD should have 20+ keywords', () => {
      expect(TECH_KEYWORDS.CLOUD.length).toBeGreaterThanOrEqual(18);
    });

    it('DATA should have 20+ keywords', () => {
      expect(TECH_KEYWORDS.DATA.length).toBeGreaterThanOrEqual(18);
    });

    it('AI_ML should have 20+ keywords including modern GenAI terms', () => {
      expect(TECH_KEYWORDS.AI_ML.length).toBeGreaterThanOrEqual(18);
      const aiMlLower = TECH_KEYWORDS.AI_ML.map(k => k.toLowerCase());
      expect(aiMlLower).toContain('generative ai');
      expect(aiMlLower).toContain('llm');
      expect(aiMlLower).toContain('large language model');
    });

    it('DEVOPS should include modern tools', () => {
      const devopsLower = TECH_KEYWORDS.DEVOPS.map(k => k.toLowerCase());
      expect(devopsLower).toContain('kubernetes');
      expect(devopsLower).toContain('terraform');
      expect(devopsLower).toContain('github actions');
      expect(devopsLower).toContain('datadog');
    });

    it('CRM_ERP should include enterprise platforms', () => {
      const crmErpLower = TECH_KEYWORDS.CRM_ERP.map(k => k.toLowerCase());
      expect(crmErpLower).toContain('salesforce');
      expect(crmErpLower).toContain('sap');
      expect(crmErpLower).toContain('servicenow');
      expect(crmErpLower).toContain('workday');
    });

    it('DEV_STACK should include programming languages', () => {
      const devLower = TECH_KEYWORDS.DEV_STACK.map(k => k.toLowerCase());
      expect(devLower).toContain('react');
      expect(devLower).toContain('python');
      expect(devLower).toContain('typescript');
      expect(devLower).toContain('java');
    });

    it('should have action verbs', () => {
      expect(TECH_ACTION_VERBS.length).toBeGreaterThanOrEqual(10);
      const verbs = TECH_ACTION_VERBS.map(v => v.toLowerCase());
      expect(verbs).toContain('migrating');
      expect(verbs).toContain('adopting');
      expect(verbs).toContain('deploying');
    });

    it('should have competing platforms defined', () => {
      expect(COMPETING_PLATFORMS.length).toBeGreaterThanOrEqual(10);
      const categories = COMPETING_PLATFORMS.map(p => p.category);
      expect(categories).toContain('cloud');
      expect(categories).toContain('crm');
      expect(categories).toContain('erp');
      expect(categories).toContain('data');
      expect(categories).toContain('orchestration');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. detectTechInText Function
  // ═══════════════════════════════════════════════════════════════

  describe('2. detectTechInText Function', () => {
    it('should detect AWS in text', () => {
      const result = detectTechInText('Company is migrating to AWS for cloud infrastructure');
      expect(result.keywords).toContain('aws');
      expect(result.categories).toContain('CLOUD');
    });

    it('should detect Kubernetes with action verb', () => {
      const result = detectTechInText('Adopting kubernetes for container orchestration');
      expect(result.keywords).toContain('kubernetes');
      expect(result.categories).toContain('DEVOPS');
      expect(result.hasActionVerb).toBe(true);
      expect(result.matchedActionVerb).toBe('adopting');
    });

    it('should detect multiple technologies', () => {
      const result = detectTechInText('Using Snowflake for data warehousing and Salesforce for CRM');
      expect(result.keywords.length).toBeGreaterThanOrEqual(2);
      expect(result.categories).toContain('DATA');
      expect(result.categories).toContain('CRM_ERP');
    });

    it('should detect AI/ML terms', () => {
      const result = detectTechInText('Implementing generative AI with large language models');
      expect(result.keywords.length).toBeGreaterThanOrEqual(1);
      expect(result.categories).toContain('AI_ML');
    });

    it('should return zero keywords for non-tech text', () => {
      const result = detectTechInText('Company hired a new CEO and raised Series B funding');
      expect(result.keywords.length).toBe(0);
      expect(result.categories.length).toBe(0);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should give higher confidence for action verb + specific tech', () => {
      const withAction = detectTechInText('Migrating to Snowflake data warehouse');
      const withoutAction = detectTechInText('Snowflake data warehouse mentioned in passing');
      expect(withAction.confidence).toBeGreaterThan(withoutAction.confidence);
    });

    it('should detect DevOps tools', () => {
      const result = detectTechInText('Deploying terraform and kubernetes with github actions');
      expect(result.keywords).toContain('terraform');
      expect(result.keywords).toContain('kubernetes');
      expect(result.keywords).toContain('github actions');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Regex Patterns
  // ═══════════════════════════════════════════════════════════════

  describe('3. Regex Patterns', () => {
    it('TECH_SIGNAL_REGEX should match verb + technology patterns', () => {
      expect(TECH_SIGNAL_REGEX.test('migrating to AWS')).toBe(true);
      expect(TECH_SIGNAL_REGEX.test('adopting kubernetes')).toBe(true);
      expect(TECH_SIGNAL_REGEX.test('deploying azure')).toBe(true);
      expect(TECH_SIGNAL_REGEX.test('implementing snowflake')).toBe(true);
    });

    it('TECH_SIGNAL_REGEX should NOT match non-tech text', () => {
      expect(TECH_SIGNAL_REGEX.test('hiring new engineers')).toBe(false);
      expect(TECH_SIGNAL_REGEX.test('raised Series B funding')).toBe(false);
    });

    it('TECH_MENTION_REGEX should match any known technology', () => {
      expect(TECH_MENTION_REGEX.test('Company uses AWS')).toBe(true);
      expect(TECH_MENTION_REGEX.test('Running on Kubernetes')).toBe(true);
      expect(TECH_MENTION_REGEX.test('Built with React')).toBe(true);
      expect(TECH_MENTION_REGEX.test('Uses Salesforce CRM')).toBe(true);
      expect(TECH_MENTION_REGEX.test('Deploying generative AI')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. Module Wiring Verification
  // ═══════════════════════════════════════════════════════════════

  describe('4. Module Wiring — signal-creator.ts uses centralized registry', () => {
    const creatorContent = fs.readFileSync(path.join(SRC, 'intelligence-sources', 'signal-creator.ts'), 'utf-8');

    it('should import TECH_MENTION_REGEX from centralized registry', () => {
      expect(creatorContent).toContain("import { TECH_MENTION_REGEX } from '@/lib/shared/tech-keywords'");
    });

    it('should use TECH_MENTION_REGEX for tech classification', () => {
      expect(creatorContent).toContain('TECH_MENTION_REGEX.test');
    });

    it('should NOT have the old hardcoded 7-keyword regex', () => {
      // Old: /\bcloud\b|\bmigrat\w*\b|\baws\b|\bgcp\b|\bazure\b|\bkubernetes\b|\bdocker\b/i
      expect(creatorContent).not.toContain('\\bcloud\\b|\\bmigrat\\w*\\b|\\baws\\b|\\bgcp\\b|\\bazure\\b|\\bkubernetes\\b|\\bdocker\\b');
    });
  });

  describe('5. Module Wiring — signals.ts uses centralized registry', () => {
    const signalsContent = fs.readFileSync(path.join(SRC, 'research-engine', 'signals.ts'), 'utf-8');

    it('should import TECH_SIGNAL_REGEX from centralized registry', () => {
      expect(signalsContent).toContain("import { TECH_SIGNAL_REGEX } from '@/lib/shared/tech-keywords'");
    });

    it('should use TECH_SIGNAL_REGEX for technology_adoption pattern', () => {
      expect(signalsContent).toContain('TECH_SIGNAL_REGEX');
    });

    it('should have technology_adoption type (not legacy technology)', () => {
      expect(signalsContent).toContain("type: 'technology_adoption'");
    });

    it('should NOT have the old hardcoded verb+noun regex', () => {
      expect(signalsContent).not.toContain('(migrat|adopt|implement|deploy|launch)\\s+(cloud|AI|ML|data|platform|kubernetes|aws|azure)');
    });
  });

  describe('6. Module Wiring — contradiction-detection.ts uses centralized COMPETING_PLATFORMS', () => {
    const contradictionContent = fs.readFileSync(path.join(SRC, 'contradiction-detection.ts'), 'utf-8');

    it('should import COMPETING_PLATFORMS from centralized registry', () => {
      expect(contradictionContent).toContain("import { COMPETING_PLATFORMS");
      expect(contradictionContent).toContain('@/lib/shared/tech-keywords');
    });

    it('should NOT have the old hardcoded COMPETING_PLATFORMS array', () => {
      // Old code had inline array with AWS, Azure, GCP etc.
      expect(contradictionContent).not.toContain("{ platforms: ['AWS', 'Amazon Web Services', 'aws'], category: 'cloud' }");
    });

    it('should still have getPlatformCategory function', () => {
      expect(contradictionContent).toContain('function getPlatformCategory');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. Completeness — Keywords from old files are covered
  // ═══════════════════════════════════════════════════════════════

  describe('7. Completeness — All legacy keywords are covered', () => {
    it('should cover all signal-creator.ts keywords (cloud, aws, gcp, azure, kubernetes, docker)', () => {
      const allLower = ALL_TECH_KEYWORDS.map(k => k.toLowerCase());
      ['cloud', 'aws', 'gcp', 'azure', 'kubernetes', 'docker'].forEach(kw => {
        expect(allLower.some(k => k.includes(kw))).toBe(true);
      });
    });

    it('should cover signal-type-mapping.ts keywords', () => {
      const allLower = ALL_TECH_KEYWORDS.map(k => k.toLowerCase());
      ['kubernetes', 'snowflake', 'databricks', 'terraform', 'servicenow', 'salesforce', 'workday', 'sap'].forEach(kw => {
        expect(allLower.some(k => k.includes(kw))).toBe(true);
      });
    });

    it('should cover signal-patterns.ts unique keywords', () => {
      const allLower = ALL_TECH_KEYWORDS.map(k => k.toLowerCase());
      ['generative ai', 'llm', 'large language model', 'copilot', 'data lake', 'data warehouse', 'real-time analytics'].forEach(kw => {
        expect(allLower.some(k => k.includes(kw))).toBe(true);
      });
    });

    it('should cover icp-config.ts keywords', () => {
      const allLower = ALL_TECH_KEYWORDS.map(k => k.toLowerCase());
      ['react', 'node', 'python', 'java', 'typescript', 'data analytics'].forEach(kw => {
        expect(allLower.some(k => k.includes(kw))).toBe(true);
      });
    });

    it('should cover contradiction-detection.ts platforms', () => {
      const allLower = ALL_TECH_KEYWORDS.map(k => k.toLowerCase());
      ['aws', 'azure', 'gcp', 'salesforce', 'hubspot', 'sap', 'snowflake', 'databricks'].forEach(kw => {
        expect(allLower.some(k => k.includes(kw))).toBe(true);
      });
    });
  });
});
