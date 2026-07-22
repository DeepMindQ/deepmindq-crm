import { describe, it, expect } from 'vitest';
import { analyzeSignals, type RawSignal, type DetectedSignal } from '../signal-detector';

describe('signal-detector', () => {
  const mockSignals: RawSignal[] = [
    {
      id: 'sig-1',
      signalType: 'tech_change',
      title: 'Company announced cloud migration to AWS and Kubernetes',
      description: 'Major infrastructure overhaul planned for Q1',
      source: 'tech-crunch',
      confidence: 0.85,
      impact: 'high',
      createdAt: new Date(),
    },
    {
      id: 'sig-2',
      signalType: 'hiring',
      title: 'Hiring 50 data engineers for AI initiative',
      description: 'Massive expansion of data team',
      source: 'linkedin',
      confidence: 0.7,
      impact: 'high',
      createdAt: new Date(),
    },
    {
      id: 'sig-3',
      signalType: 'leadership',
      title: 'New CTO appointed from Google',
      description: 'Previous CTO stepped down',
      source: 'press-release',
      confidence: 0.9,
      impact: 'medium',
      createdAt: new Date(),
    },
  ];

  describe('analyzeSignals', () => {
    it('should detect technology signals', () => {
      const results = analyzeSignals('company-1', mockSignals);
      const tech = results.find(r => r.signalType === 'TECHNOLOGY');
      expect(tech).toBeDefined();
      expect(tech!.supportingIntelligenceIds).toContain('sig-1');
    });

    it('should detect growth signals', () => {
      const results = analyzeSignals('company-1', mockSignals);
      const growth = results.find(r => r.signalType === 'GROWTH');
      expect(growth).toBeDefined();
      expect(growth!.supportingIntelligenceIds).toContain('sig-2');
    });

    it('should detect leadership signals', () => {
      const results = analyzeSignals('company-1', mockSignals);
      const leadership = results.find(r => r.signalType === 'LEADERSHIP');
      expect(leadership).toBeDefined();
      expect(leadership!.supportingIntelligenceIds).toContain('sig-3');
    });

    it('should return empty for no signals', () => {
      const results = analyzeSignals('company-1', []);
      expect(results).toHaveLength(0);
    });

    it('should sort by score descending', () => {
      const results = analyzeSignals('company-1', mockSignals);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should set companyId', () => {
      const results = analyzeSignals('test-company', mockSignals);
      for (const r of results) {
        expect(r.companyId).toBe('test-company');
      }
    });

    it('should score between 0 and 100', () => {
      const results = analyzeSignals('company-1', mockSignals);
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });

    it('should handle pain signals', () => {
      const painSignals: RawSignal[] = [{
        id: 'pain-1',
        signalType: 'news',
        title: 'Company struggling with legacy technical debt and security breach',
        description: 'Outdated systems causing downtime',
        source: 'news',
        confidence: 0.8,
        impact: 'high',
        createdAt: new Date(),
      }];
      const results = analyzeSignals('company-1', painSignals);
      const pain = results.find(r => r.signalType === 'PAIN');
      expect(pain).toBeDefined();
    });
  });
});
