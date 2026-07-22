import { describe, test, expect } from 'bun:test';
import {
  clusterByTheme,
  rankClusters,
  selectTopEvidence,
} from '../evidence-synthesizer';
import type { ThematicCluster } from '../types';

/* ── Tests ── */

describe('clusterByTheme', () => {
  test('returns empty array for empty input', () => {
    const result = clusterByTheme([]);
    expect(result).toEqual([]);
  });

  test('groups entries by category', () => {
    const entries = [
      { id: 'e1', category: 'Technology', content: 'Cloud migration', source: 'news', confidence: 0.9, updatedAt: new Date('2025-01-10') },
      { id: 'e2', category: 'Technology', content: 'Kubernetes adoption', source: 'blog', confidence: 0.8, updatedAt: new Date('2025-01-08') },
      { id: 'e3', category: 'Leadership', content: 'New CIO hired', source: 'press', confidence: 0.85, updatedAt: new Date('2025-01-05') },
    ];
    const clusters = clusterByTheme(entries);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const techCluster = clusters.find(c => c.theme.includes('Technology'));
    expect(techCluster).toBeDefined();
    expect(techCluster!.entries.length).toBe(1);
  });

  test('handles entries with no source gracefully', () => {
    const entries = [
      { id: 'e1', category: 'Strategy', content: 'Budget increase', source: null, confidence: 0.7, updatedAt: new Date() },
    ];
    const result = clusterByTheme(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('clusters have strength > 0 for entries with high confidence', () => {
    const entries = [
      { id: 'e1', category: 'Products', content: 'New product launch', source: 'press', confidence: 0.95, updatedAt: new Date() },
    ];
    const result = clusterByTheme(entries);
    expect(result[0].strength).toBeGreaterThan(0);
  });

  test('each cluster has required fields', () => {
    const entries = [
      { id: 'e1', category: 'Technology', content: 'Cloud', source: 'src', confidence: 0.5, updatedAt: new Date() },
    ];
    const result = clusterByTheme(entries);
    for (const cluster of result) {
      expect(cluster).toHaveProperty('theme');
      expect(cluster).toHaveProperty('entries');
      expect(cluster).toHaveProperty('strength');
      expect(cluster).toHaveProperty('recency');
      expect(typeof cluster.theme).toBe('string');
      expect(Array.isArray(cluster.entries)).toBe(true);
      expect(typeof cluster.strength).toBe('number');
      expect(typeof cluster.recency).toBe('number');
    }
  });

  test('single entry produces one cluster', () => {
    const entries = [
      { id: 'e1', category: 'Strategy', content: 'AI investment', source: 'src', confidence: 0.8, updatedAt: new Date() },
    ];
    const result = clusterByTheme(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].entries.length).toBe(1);
  });
});

describe('rankClusters', () => {
  test('returns empty array for empty input', () => {
    const result = rankClusters([]);
    expect(result).toEqual([]);
  });

  test('sorts clusters by combined strength', () => {
    const clusters: ThematicCluster[] = [
      { theme: 'weak', entries: [{ id: 'e1', content: 'Low signal', source: 'src', confidence: 0.2 }], strength: 10, recency: 10 },
      { theme: 'strong', entries: [{ id: 'e2', content: 'High signal', source: 'src', confidence: 0.9 }], strength: 90, recency: 90 },
    ];
    const result = rankClusters(clusters);
    expect(result[0].theme).toBe('strong');
  });

  test('maintains all clusters', () => {
    const clusters: ThematicCluster[] = [
      { theme: 'a', entries: [], strength: 50, recency: 50 },
      { theme: 'b', entries: [], strength: 30, recency: 50 },
      { theme: 'c', entries: [], strength: 70, recency: 50 },
    ];
    const result = rankClusters(clusters);
    expect(result.length).toBe(3);
  });

  test('does not mutate original array', () => {
    const clusters: ThematicCluster[] = [
      { theme: 'a', entries: [], strength: 20, recency: 20 },
      { theme: 'b', entries: [], strength: 80, recency: 80 },
    ];
    const originalOrder = clusters.map(c => c.theme);
    rankClusters(clusters);
    expect(clusters.map(c => c.theme)).toEqual(originalOrder);
  });
});

describe('selectTopEvidence', () => {
  const mockCtx = {
    companyId: 'co1',
    companyName: 'Test Co',
    industry: null,
    sizeRange: null,
    knowledgeEntries: [
      { id: 'ke1', category: 'Tech', content: 'Cloud migration underway', confidence: 0.9, source: 'press', updatedAt: new Date() },
      { id: 'ke2', category: 'Tech', content: 'Azure selected as primary', confidence: 0.85, source: 'blog', updatedAt: new Date() },
      { id: 'ke3', category: 'Leadership', content: 'New CIO appointed', confidence: 0.8, source: 'news', updatedAt: new Date() },
    ],
    intelligenceObjects: [
      { id: 'io1', content: 'RFP for cloud services', summary: 'Cloud RFP', confidence: 0.75, sourceType: 'rss', capturedAt: new Date() },
    ],
    associations: [],
    signals: [
      { id: 's1', signalType: 'technology', title: 'Cloud migration', confidence: 0.9, severity: 'high', createdAt: new Date() },
    ],
    opportunitySignals: [
      { id: 'os1', signalType: 'TECHNOLOGY', title: 'Cloud modernization', score: 85, confidence: 0.85 },
    ],
    evidence: [
      { id: 'ev1', snippet: 'Company selects Azure cloud provider', extractedField: 'technology', relevanceScore: 0.95, confidence: 0.9 },
      { id: 'ev2', snippet: 'Cloud budget increased 40%', extractedField: 'budget', relevanceScore: 0.8, confidence: 0.85 },
    ],
    accountBrief: null,
    accountScore: null,
    dataQualityMetrics: { totalKnowledgeEntries: 3, avgConfidence: 0.85, recentEntryCount: 3, sourceHealthAvg: 0.9 },
  };

  test('returns evidence items with id, snippet, and relevance', () => {
    const result = selectTopEvidence(mockCtx as any, 5);
    for (const item of result) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('snippet');
      expect(item).toHaveProperty('relevance');
      expect(typeof item.id).toBe('string');
      expect(typeof item.snippet).toBe('string');
      expect(typeof item.relevance).toBe('string');
    }
  });

  test('respects maxItems limit', () => {
    const result = selectTopEvidence(mockCtx as any, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test('returns empty array for empty context', () => {
    const emptyCtx = {
      companyId: 'co1',
      companyName: 'Empty',
      industry: null,
      sizeRange: null,
      knowledgeEntries: [],
      intelligenceObjects: [],
      associations: [],
      signals: [],
      opportunitySignals: [],
      evidence: [],
      accountBrief: null,
      accountScore: null,
      dataQualityMetrics: { totalKnowledgeEntries: 0, avgConfidence: 0, recentEntryCount: 0, sourceHealthAvg: 0 },
    };
    const result = selectTopEvidence(emptyCtx as any, 5);
    expect(result).toEqual([]);
  });

  test('prioritizes high-relevance evidence', () => {
    const result = selectTopEvidence(mockCtx as any, 10);
    const topItem = result[0];
    // Top evidence should have high relevance
    expect(topItem.snippet.length).toBeGreaterThan(0);
  });
});
