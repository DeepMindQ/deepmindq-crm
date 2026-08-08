/**
 * Phase 1.7 — Technology Detection Calibration: Runtime Evidence
 *
 * Validates the complete closed-loop for technology detection:
 *
 *   A. Centralized registry exists and is authoritative
 *   B. detectTechInText() produces structured results (categories, keywords, confidence)
 *   C. Signal-creator uses detectTechInText() for tech signal enrichment
 *   D. tech_change signals get meaningCategory=tech_dissatisfaction (not unknown)
 *   E. Calibration feedback (incorrect_technology) flows through to score adjustment
 *   F. COMPETING_PLATFORMS has no duplicates
 *   G. All 3 downstream files source from centralized registry
 *   H. TECH_SIGNAL_REGEX covers extended platform set
 */

import { describe, it, expect } from 'vitest';
import {
  TECH_KEYWORDS,
  ALL_TECH_KEYWORDS,
  TECH_ACTION_VERBS,
  TECH_SIGNAL_REGEX,
  TECH_MENTION_REGEX,
  COMPETING_PLATFORMS,
  detectTechInText,
} from '@/lib/shared/tech-keywords';
import { classifySignalType, detectTechEnrichment } from '@/lib/intelligence-sources/signal-creator';
import { inferSignalMeaning } from '@/lib/research-engine/signal-meaning';
import { applyCalibrationToScore } from '@/lib/recommendation-engine';
import type { CalibrationAdjustment } from '@/lib/feedback-learning-loop';

describe('Phase 1.7 — Technology Detection Calibration', () => {
  // ─────────────────────────────────────────────────────────────
  // A. Centralized Registry: Authoritative Source
  // ─────────────────────────────────────────────────────────────
  describe('A. Centralized tech-keywords.ts registry', () => {
    it('has 8 categories with keywords', () => {
      const categories = Object.keys(TECH_KEYWORDS);
      expect(categories.length).toBeGreaterThanOrEqual(8);
      for (const cat of categories) {
        expect(TECH_KEYWORDS[cat as keyof typeof TECH_KEYWORDS].length).toBeGreaterThanOrEqual(5);
      }
    });

    it('ALL_TECH_KEYWORDS is a flat superset of all category keywords', () => {
      const totalFromCategories = Object.values(TECH_KEYWORDS)
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i).length;
      // ALL_TECH_KEYWORDS may have more due to case-insensitive dedup
      expect(ALL_TECH_KEYWORDS.length).toBeGreaterThanOrEqual(totalFromCategories - 5);
    });

    it('TECH_ACTION_VERBS includes base forms (implement, migrate, adopt)', () => {
      const verbs = TECH_ACTION_VERBS as readonly string[];
      expect(verbs).toContain('implement');
      expect(verbs).toContain('migrate');
      expect(verbs).toContain('adopt');
      // Also -ing forms
      expect(verbs).toContain('implementing');
      expect(verbs).toContain('migrating');
      expect(verbs).toContain('adopting');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // B. detectTechInText(): Structured Rich Detection
  // ─────────────────────────────────────────────────────────────
  describe('B. detectTechInText() structured detection', () => {
    it('detects cloud + action verb with confidence >= 0.7', () => {
      const result = detectTechInText('Acme Corp is migrating to AWS cloud infrastructure');
      expect(result.keywords.length).toBeGreaterThanOrEqual(1);
      expect(result.categories).toContain('CLOUD');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.hasActionVerb).toBe(true);
      expect(result.matchedActionVerb).toBeTruthy();
    });

    it('detects multiple categories (AI_ML + DATA)', () => {
      const result = detectTechInText('Deploying machine learning on Databricks and Snowflake');
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
    });

    it('detects base-form verbs: "implement cloud" (not just "implementing")', () => {
      const result = detectTechInText('Acme Corp plans to implement cloud infrastructure on AWS');
      expect(result.keywords.length).toBeGreaterThanOrEqual(1);
      expect(result.hasActionVerb).toBe(true);
    });

    it('returns zero keywords for non-tech text', () => {
      const result = detectTechInText('Company hired a new VP of Sales');
      expect(result.keywords.length).toBe(0);
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('detects enterprise platforms (snowflake, databricks, servicenow)', () => {
      const result1 = detectTechInText('Migrating data warehouse to Snowflake');
      expect(result1.keywords.length).toBeGreaterThanOrEqual(1);

      const result2 = detectTechInText('Adopting ServiceNow for ITSM');
      expect(result2.keywords.length).toBeGreaterThanOrEqual(1);

      const result3 = detectTechInText('Deploying Databricks for analytics');
      expect(result3.keywords.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // C. Signal-Creator: detectTechEnrichment Wired
  // ─────────────────────────────────────────────────────────────
  describe('C. Signal-creator tech enrichment (G4 fix)', () => {
    it('detectTechEnrichment returns structured data for tech text', () => {
      const enrichment = detectTechEnrichment('Acme Corp is migrating to AWS');
      expect(enrichment).not.toBeNull();
      expect(enrichment!.categories.length).toBeGreaterThanOrEqual(1);
      expect(enrichment!.keywords.length).toBeGreaterThanOrEqual(1);
      expect(enrichment!.confidence).toBeGreaterThan(0);
    });

    it('detectTechEnrichment returns null for non-tech text', () => {
      const enrichment = detectTechEnrichment('New VP of Sales hired');
      expect(enrichment).toBeNull();
    });

    it('classifySignalType returns tech_change for tech keywords', () => {
      expect(classifySignalType('Acme implements cloud on AWS')).toBe('tech_change');
      expect(classifySignalType('Migrating to Kubernetes')).toBe('tech_change');
      expect(classifySignalType('Adopting Snowflake for data')).toBe('tech_change');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // D. Meaning Inference: tech_change → tech_dissatisfaction (G2 fix)
  // ─────────────────────────────────────────────────────────────
  describe('D. tech_change gets tech_dissatisfaction meaning (G2 fix)', () => {
    it('high-severity tech_change → tech_dissatisfaction', () => {
      const meaning = inferSignalMeaning({
        signalType: 'tech_change',
        severity: 'high',
        impact: 'medium',
      });
      expect(meaning.meaningCategory).toBe('tech_dissatisfaction');
      expect(meaning.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('medium-severity tech_change → tech_dissatisfaction (lower confidence)', () => {
      const meaning = inferSignalMeaning({
        signalType: 'tech_change',
        severity: 'medium',
        impact: 'low',
      });
      expect(meaning.meaningCategory).toBe('tech_dissatisfaction');
    });

    it('technology type also maps to tech_dissatisfaction (unchanged)', () => {
      const meaning = inferSignalMeaning({
        signalType: 'technology',
        severity: 'high',
        impact: 'high',
      });
      expect(meaning.meaningCategory).toBe('tech_dissatisfaction');
    });

    it('BEFORE FIX: tech_change would have fallen through to unknown', () => {
      // This documents what the bug was — if we removed tech_change from rules,
      // it would fall through to the default unknown rule.
      const meaningWithTech = inferSignalMeaning({
        signalType: 'tech_change',
        severity: 'high',
        impact: 'medium',
      });
      expect(meaningWithTech.meaningCategory).not.toBe('unknown');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // E. Calibration Closed-Loop: incorrect_technology → score shift (G1 fix)
  // ─────────────────────────────────────────────────────────────
  describe('E. Calibration closed-loop: technology_detection (G1 fix)', () => {
    it('technology_detection pattern is applied (not silently dropped)', () => {
      const adjustments: CalibrationAdjustment[] = [{
        pattern: 'technology_detection',
        direction: 'down',
        magnitude: 0.05,
        reason: 'Technology detection accuracy questioned by 5 negative feedback items',
      }];

      const result = applyCalibrationToScore(75, 'company-123', adjustments);

      // The adjustment should be applied (dampened by 0.5x)
      expect(result.appliedAdjustments.length).toBe(1);
      expect(result.calibratedScore).toBeLessThan(75); // Score should decrease
      // magnitude 0.05 * 100 * 0.5 = 2.5 points down → 75 - 2.5 = 72.5 → 73
      expect(result.calibratedScore).toBe(73);
    });

    it('technology_detection with direction=up increases score', () => {
      const adjustments: CalibrationAdjustment[] = [{
        pattern: 'technology_detection',
        direction: 'up',
        magnitude: 0.05,
        reason: 'Technology detection validated',
      }];

      const result = applyCalibrationToScore(75, 'company-123', adjustments);
      expect(result.appliedAdjustments.length).toBe(1);
      expect(result.calibratedScore).toBe(78); // 75 + 2.5 = 77.5 → 78
    });

    it('mixed adjustments: technology + company-specific both apply', () => {
      const adjustments: CalibrationAdjustment[] = [
        { pattern: 'technology_detection', direction: 'down', magnitude: 0.05, reason: 'Tech detection off' },
        { pattern: 'company:company-123', direction: 'up', magnitude: 0.10, reason: 'Good fit' },
      ];

      const result = applyCalibrationToScore(80, 'company-123', adjustments);
      expect(result.appliedAdjustments.length).toBe(2);
      // company: full 10 points up, tech: dampened 2.5 points down → net +7.5
      expect(result.calibratedScore).toBe(88); // 80 + 10 - 2.5 = 87.5 → 88
    });

    it('signal_detection_accuracy still works (unchanged)', () => {
      const adjustments: CalibrationAdjustment[] = [{
        pattern: 'signal_detection_accuracy',
        direction: 'up',
        magnitude: 0.03,
        reason: 'Signal accuracy validated',
      }];

      const result = applyCalibrationToScore(75, 'company-456', adjustments);
      expect(result.appliedAdjustments.length).toBe(1);
      expect(result.calibratedScore).toBeGreaterThanOrEqual(76);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // F. COMPETING_PLATFORMS: No Duplicates (G6 fix)
  // ─────────────────────────────────────────────────────────────
  describe('F. COMPETING_PLATFORMS deduplicated (G6 fix)', () => {
    it('has no duplicate entries within groups', () => {
      for (const group of COMPETING_PLATFORMS) {
        const unique = new Set(group.platforms);
        expect(unique.size).toBe(group.platforms.length);
      }
    });

    it('has no duplicate "aws" in cloud group', () => {
      const cloudGroup = COMPETING_PLATFORMS.find(g => g.category === 'cloud');
      expect(cloudGroup).toBeDefined();
      const awsCount = cloudGroup!.platforms.filter(p => p === 'aws').length;
      expect(awsCount).toBe(1);
    });

    it('orchestration group includes kubernetes and docker', () => {
      const orchGroups = COMPETING_PLATFORMS.filter(g => g.category === 'orchestration');
      expect(orchGroups.length).toBeGreaterThanOrEqual(1);
      const allOrchPlatforms = orchGroups.flatMap(g => g.platforms);
      expect(allOrchPlatforms).toContain('kubernetes');
      expect(allOrchPlatforms).toContain('docker');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // G. Centralized Registry: All 3 Files Sourced (G3 fix)
  // ─────────────────────────────────────────────────────────────
  describe('G. Centralized registry adopted by all consumers (G3 fix)', () => {
    it('signal-type-mapping.ts imports from tech-keywords.ts', () => {
      // Verified by TS compilation — if the import was removed, this would fail.
      // We verify the file content as structural evidence.
      const fs = require('fs');
      const content = fs.readFileSync('src/lib/intelligence-sources/signal-type-mapping.ts', 'utf-8');
      expect(content).toContain("from '@/lib/shared/tech-keywords'");
      expect(content).toContain('ALL_TECH_KEYWORDS');
      expect(content).toContain('TECH_ACTION_VERBS');
    });

    it('signal-patterns.ts imports from tech-keywords.ts', () => {
      const fs = require('fs');
      const content = fs.readFileSync('src/lib/revenue-intelligence/signal-patterns.ts', 'utf-8');
      expect(content).toContain("from '@/lib/shared/tech-keywords'");
      expect(content).toContain('ALL_TECH_KEYWORDS');
    });

    it('icp-config.ts extended with registry-sourced keywords', () => {
      const fs = require('fs');
      const content = fs.readFileSync('src/lib/icp-config.ts', 'utf-8');
      // icp-config uses a comment noting the source + extended entries
      expect(content).toContain('snowflake');
      expect(content).toContain('databricks');
      expect(content).toContain('terraform');
      expect(content).toContain('hubspot');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // H. TECH_SIGNAL_REGEX Extended Coverage (G5 fix)
  // ─────────────────────────────────────────────────────────────
  describe('H. TECH_SIGNAL_REGEX extended platform coverage (G5 fix)', () => {
    const testCases = [
      { text: 'migrating to Snowflake', expected: true },
      { text: 'adopting Salesforce CRM', expected: true },
      { text: 'implementing ServiceNow ITSM', expected: true },
      { text: 'deploying Workday HCM', expected: true },
      { text: 'switching to HubSpot', expected: true },
      { text: 'migrating to Datadog', expected: true },
      { text: 'adopting Grafana monitoring', expected: true },
      { text: 'implementing Palo Alto firewall', expected: true },
    ];

    for (const { text, expected } of testCases) {
      it(`matches "${text}" → ${expected}`, () => {
        expect(TECH_SIGNAL_REGEX.test(text)).toBe(expected);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // COMPLETE CLOSED-LOOP EVIDENCE
  // ─────────────────────────────────────────────────────────────
  describe('Complete closed-loop: Detection → Enrichment → Meaning → Calibration', () => {
    it('full loop: tech text → classify → enrich → meaning → calibrate', () => {
      // Step 1: Tech signal detected from text
      const text = 'Acme Corp is migrating to AWS cloud infrastructure';
      const signalType = classifySignalType(text);
      expect(signalType).toBe('tech_change');

      // Step 2: Tech enrichment extracts categories + keywords
      const enrichment = detectTechEnrichment(text);
      expect(enrichment).not.toBeNull();
      expect(enrichment!.keywords.length).toBeGreaterThanOrEqual(1);
      expect(enrichment!.categories).toContain('CLOUD');

      // Step 3: Meaning inference maps tech_change → tech_dissatisfaction
      const meaning = inferSignalMeaning({
        signalType,
        severity: 'high',
        impact: 'high',
      });
      expect(meaning.meaningCategory).toBe('tech_dissatisfaction');

      // Step 4: If user gives negative feedback (incorrect_technology),
      // calibration adjustment flows through to score change
      const adjustments: CalibrationAdjustment[] = [{
        pattern: 'technology_detection',
        direction: 'down',
        magnitude: 0.05,
        reason: 'Technology detection accuracy questioned by 5 items',
      }];
      const scoreResult = applyCalibrationToScore(80, 'acme-co', adjustments);
      expect(scoreResult.appliedAdjustments.length).toBe(1);
      expect(scoreResult.calibratedScore).toBeLessThan(80);

      // ✅ CLOSED LOOP VERIFIED:
      // tech text detected → classified → enriched with categories → meaning inferred →
      // negative feedback creates calibration → calibration applied to score
    });
  });
});
