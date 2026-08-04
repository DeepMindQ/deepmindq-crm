import { describe, it, expect } from 'vitest';
import { matchSignalPatterns, getPrimaryCategory, DEFAULT_SIGNAL_PATTERNS, type SignalCategory } from '@/lib/revenue-intelligence/signal-patterns';

describe('signal-patterns', () => {
  describe('matchSignalPatterns', () => {
    it('should detect technology keywords', () => {
      const results = matchSignalPatterns('Company announced cloud migration to AWS');
      const tech = results.find(r => r.category === 'TECHNOLOGY');
      expect(tech).toBeDefined();
      // matchedKeywords contains the matched entries from KEYWORD_TO_CATEGORY
      expect(tech!.matchedKeywords.length).toBeGreaterThan(0);
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
      expect(pain!.matchedKeywords.length).toBeGreaterThan(0);
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
      const text = Array(20).fill('cloud migration').join(' ');
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
      expect(categories.has('technology')).toBe(true);
      expect(categories.has('growth')).toBe(true);
      expect(categories.has('partnership')).toBe(true);
      expect(categories.has('pain')).toBe(true);
      expect(categories.has('leadership')).toBe(true);
    });

    it('should have importance between 1 and 10', () => {
      for (const p of DEFAULT_SIGNAL_PATTERNS) {
        expect(p.importance).toBeGreaterThanOrEqual(1);
        expect(p.importance).toBeLessThanOrEqual(10);
      }
    });

    it('should have non-empty keywords', () => {
      for (const p of DEFAULT_SIGNAL_PATTERNS) {
        expect(p.keywords.length).toBeGreaterThan(0);
      }
    });
  });
});
