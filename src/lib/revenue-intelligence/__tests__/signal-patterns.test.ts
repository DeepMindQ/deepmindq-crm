import { describe, it, expect } from 'vitest';
import { matchSignalPatterns, getPrimaryCategory, DEFAULT_SIGNAL_PATTERNS, type SignalCategory } from '../signal-patterns';

describe('signal-patterns', () => {
  describe('matchSignalPatterns', () => {
    it('should detect technology keywords', () => {
      const results = matchSignalPatterns('Company announced cloud migration to AWS');
      const tech = results.find(r => r.category === 'TECHNOLOGY');
      expect(tech).toBeDefined();
      expect(tech!.matchedKeywords).toContain('cloud');
      expect(tech!.matchedKeywords).toContain('aws');
      expect(tech!.score).toBeGreaterThan(0);
    });

    it('should detect growth keywords', () => {
      const results = matchSignalPatterns('Series B funding round raised $50M valuation');
      const growth = results.find(r => r.category === 'GROWTH');
      expect(growth).toBeDefined();
      expect(growth!.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('should detect pain keywords', () => {
      const results = matchSignalPatterns('Struggling with legacy technical debt and outdated systems');
      const pain = results.find(r => r.category === 'PAIN');
      expect(pain).toBeDefined();
      expect(pain!.matchedKeywords).toContain('legacy');
      expect(pain!.matchedKeywords).toContain('technical debt');
    });

    it('should detect leadership keywords', () => {
      const results = matchSignalPatterns('New CEO appointed, CTO joined from Google');
      const leadership = results.find(r => r.category === 'LEADERSHIP');
      expect(leadership).toBeDefined();
    });

    it('should detect partnership keywords', () => {
      const results = matchSignalPatterns('Strategic alliance with Microsoft as technology partner');
      const partnership = results.find(r => r.category === 'PARTNERSHIP');
      expect(partnership).toBeDefined();
    });

    it('should return empty for no matches', () => {
      const results = matchSignalPatterns('The weather is nice today and the meeting went well');
      expect(results).toHaveLength(0);
    });

    it('should detect multiple categories', () => {
      const results = matchSignalPatterns('AI-powered cloud migration partnership with AWS, raising Series C funding');
      const categories = results.map(r => r.category);
      expect(categories).toContain('TECHNOLOGY');
      expect(categories).toContain('GROWTH');
      expect(categories).toContain('PARTNERSHIP');
    });

    it('should be case insensitive', () => {
      const results = matchSignalPatterns('CLOUD MIGRATION TO AWS KUBERNETES');
      const tech = results.find(r => r.category === 'TECHNOLOGY');
      expect(tech).toBeDefined();
    });

    it('should sort by score descending', () => {
      const results = matchSignalPatterns('cloud migration CEO appointed series b funding');
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should cap score at 100', () => {
      const text = Array(20).fill('cloud').join(' ');
      const results = matchSignalPatterns(text);
      expect(results[0].score).toBeLessThanOrEqual(100);
    });
  });

  describe('getPrimaryCategory', () => {
    it('should return highest-scoring category', () => {
      const result = getPrimaryCategory('Major cloud migration initiative');
      expect(result).toBeDefined();
      expect(result!.category).toBe('TECHNOLOGY');
    });

    it('should return null for no match', () => {
      const result = getPrimaryCategory('random text with no signals');
      expect(result).toBeNull();
    });
  });

  describe('DEFAULT_SIGNAL_PATTERNS', () => {
    it('should have exactly 5 categories', () => {
      const categories = new Set(DEFAULT_SIGNAL_PATTERNS.map(p => p.category));
      expect(categories.size).toBe(5);
      expect(categories.has('TECHNOLOGY')).toBe(true);
      expect(categories.has('GROWTH')).toBe(true);
      expect(categories.has('PARTNERSHIP')).toBe(true);
      expect(categories.has('PAIN')).toBe(true);
      expect(categories.has('LEADERSHIP')).toBe(true);
    });

    it('should have weight between 0 and 1', () => {
      for (const p of DEFAULT_SIGNAL_PATTERNS) {
        expect(p.weight).toBeGreaterThanOrEqual(0.1);
        expect(p.weight).toBeLessThanOrEqual(1);
      }
    });

    it('should have non-empty keywords', () => {
      for (const p of DEFAULT_SIGNAL_PATTERNS) {
        expect(p.keywords.length).toBeGreaterThan(0);
      }
    });
  });
});
