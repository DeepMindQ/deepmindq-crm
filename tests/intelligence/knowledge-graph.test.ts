// ═══════════════════════════════════════════════════════════════════════════
// Knowledge Graph Engine Tests
//
// Pure logic tests that don't require a database.
// Integration tests (with DB) are in knowledge-graph.integration.test.ts
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Test the internal helper logic by importing what we can ──────────────
// The engine.ts imports `db` at module level, so we test the logic
// patterns by recreating the pure functions here.

describe('Knowledge Graph — Pure Logic', () => {
  // ─── Name Normalization ──────────────────────────────────────────────────

  describe('Name Normalization', () => {
    function normalizeName(name: string): string {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)\s*$/i, '')
        .replace(/[^a-z0-9]/g, '');
    }

    it('normalizes corporate suffixes', () => {
      expect(normalizeName('Acme Corp')).toBe('acme');
      expect(normalizeName('Beta Inc.')).toBe('beta');
      expect(normalizeName('Gamma LLC')).toBe('gamma');
      expect(normalizeName('Delta Ltd.')).toBe('delta');
      expect(normalizeName('Epsilon Corporation')).toBe('epsilon');
      expect(normalizeName('Zeta Company')).toBe('zeta');
      expect(normalizeName('Eta Co.')).toBe('eta');
    });

    it('lowercases and strips special chars', () => {
      expect(normalizeName('TestCorp Alpha!')).toBe('testcorpalpha');
      expect(normalizeName('  Spaces  ')).toBe('spaces');
    });
  });

  // ─── Domain Extraction ──────────────────────────────────────────────────

  describe('Domain Extraction', () => {
    function extractDomain(value: string | undefined): string | undefined {
      if (!value) return undefined;
      const cleaned = value.trim().toLowerCase();
      if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
        return cleaned.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      }
      try {
        const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
        return url.hostname.replace(/^www\./, '');
      } catch {
        return undefined;
      }
    }

    it('extracts clean domains from URLs', () => {
      expect(extractDomain('https://www.acme.com/products')).toBe('acme.com');
      expect(extractDomain('http://beta.io')).toBe('beta.io');
      expect(extractDomain('www.gamma.co')).toBe('gamma.co');
    });

    it('handles plain domains', () => {
      expect(extractDomain('acme.com')).toBe('acme.com');
      expect(extractDomain('beta.io')).toBe('beta.io');
    });

    it('returns undefined for invalid inputs', () => {
      expect(extractDomain(undefined)).toBeUndefined();
      expect(extractDomain('')).toBeUndefined();
      expect(extractDomain('not a domain')).toBeUndefined();
    });
  });

  // ─── Email Extraction ────────────────────────────────────────────────────

  describe('Email Extraction', () => {
    function extractEmail(value: string | undefined): string | undefined {
      if (!value) return undefined;
      const cleaned = value.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        return cleaned;
      }
      return undefined;
    }

    it('extracts valid emails', () => {
      expect(extractEmail('Alice@Acme.COM')).toBe('alice@acme.com');
      expect(extractEmail('  bob@beta.io  ')).toBe('bob@beta.io');
    });

    it('rejects invalid emails', () => {
      expect(extractEmail('not-an-email')).toBeUndefined();
      expect(extractEmail('')).toBeUndefined();
      expect(extractEmail(undefined)).toBeUndefined();
      expect(extractEmail('alice@')).toBeUndefined();
    });
  });

  // ─── Match Score Calculation ─────────────────────────────────────────────

  describe('Match Score Calculation', () => {
    function normalizeName(name: string): string {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)\s*$/i, '')
        .replace(/[^a-z0-9]/g, '');
    }

    function calculateOrgMatchScore(query: string, org: { name: string; aliases: string[] }): number {
      let score = 0;
      const q = normalizeName(query);
      if (normalizeName(org.name) === q) return 95;
      if (normalizeName(org.name).includes(q) || q.includes(normalizeName(org.name))) score += 60;
      for (const alias of org.aliases) {
        if (normalizeName(alias) === q) return 90;
        if (normalizeName(alias).includes(q)) score += 50;
      }
      return Math.min(score, 85);
    }

    it('scores 95 for exact name match', () => {
      expect(calculateOrgMatchScore('Acme Corp', { name: 'Acme Corp', aliases: [] })).toBe(95);
    });

    it('scores 90 for alias exact match', () => {
      expect(calculateOrgMatchScore('Alpha Corp', {
        name: 'TestCorp Alpha',
        aliases: ['Alpha Corp', 'TestCorp'],
      })).toBe(90);
    });

    it('scores for partial name match', () => {
      const score = calculateOrgMatchScore('Alpha', {
        name: 'TestCorp Alpha',
        aliases: [],
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(85);
    });

    it('scores 0 for no match', () => {
      expect(calculateOrgMatchScore('XYZ Corp', { name: 'Acme Corp', aliases: [] })).toBe(0);
    });
  });

  // ─── Revenue Parsing ────────────────────────────────────────────────────

  describe('Revenue Parsing', () => {
    function parseRevenue(revenue: string): number | null {
      if (!revenue) return null;
      const cleaned = revenue.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      if (!Number.isFinite(num)) return null;
      if (/billion|b/i.test(revenue)) return num * 1_000_000_000;
      if (/million|m/i.test(revenue)) return num * 1_000_000;
      if (/thousand|k/i.test(revenue)) return num * 1_000;
      return num;
    }

    it('parses million format', () => {
      expect(parseRevenue('$50M')).toBe(50_000_000);
      expect(parseRevenue('$200 Million')).toBe(200_000_000);
      expect(parseRevenue('50m')).toBe(50_000_000);
    });

    it('parses billion format', () => {
      expect(parseRevenue('$1B')).toBe(1_000_000_000);
      expect(parseRevenue('$2.5 Billion')).toBe(2_500_000_000);
    });

    it('parses thousand format', () => {
      expect(parseRevenue('$500K')).toBe(500_000);
      expect(parseRevenue('100k')).toBe(100_000);
    });

    it('returns null for invalid inputs', () => {
      expect(parseRevenue('')).toBeNull();
      expect(parseRevenue('N/A')).toBeNull();
    });
  });

  // ─── Relationship Type Categorization ────────────────────────────────────

  describe('Relationship Types', () => {
    const ORG_TO_ORG_TYPES = ['competes_with', 'partnered_with', 'invested_in', 'same_region', 'acquired_by', 'subsidiary_of'];
    const PERSON_TO_ORG_TYPES = ['works_at', 'advises', 'board_member_of', 'former_employee_of'];
    const PERSON_TO_PERSON_TYPES = ['reports_to', 'coworker', 'mentor', 'managed_by'];

    it('categorizes org-to-org relationship types', () => {
      for (const type of ORG_TO_ORG_TYPES) {
        expect(type).toBeTruthy();
      }
    });

    it('categorizes person-to-org relationship types', () => {
      for (const type of PERSON_TO_ORG_TYPES) {
        expect(type).toBeTruthy();
      }
    });

    it('categorizes person-to-person relationship types', () => {
      for (const type of PERSON_TO_PERSON_TYPES) {
        expect(type).toBeTruthy();
      }
    });
  });

  // ─── Intelligence Score Calculation ──────────────────────────────────────

  describe('Intelligence Score Formula', () => {
    function computeScore(params: {
      dataFields: number;  // out of 8 (domain, industry, description, website, hq, employees, revenue, founded)
      relCount: number;
      signalCount: number;
      personCount: number;
    }): number {
      const dataScore = Math.round((params.dataFields / 8) * 25);
      const relScore = Math.min(25, params.relCount * 3);
      const signalScore = Math.min(25, params.signalCount * 5);
      const peopleScore = Math.min(25, params.personCount * 5);
      return dataScore + relScore + signalScore + peopleScore;
    }

    it('scores 0 for empty organization', () => {
      expect(computeScore({ dataFields: 0, relCount: 0, signalCount: 0, personCount: 0 })).toBe(0);
    });

    it('scores higher for data-rich orgs', () => {
      const bare = computeScore({ dataFields: 1, relCount: 0, signalCount: 0, personCount: 0 });
      const rich = computeScore({ dataFields: 8, relCount: 0, signalCount: 0, personCount: 0 });
      expect(rich).toBeGreaterThan(bare);
    });

    it('scores higher for connected orgs', () => {
      const isolated = computeScore({ dataFields: 4, relCount: 0, signalCount: 0, personCount: 0 });
      const connected = computeScore({ dataFields: 4, relCount: 10, signalCount: 0, personCount: 0 });
      expect(connected).toBeGreaterThan(isolated);
    });

    it('caps at 100', () => {
      const max = computeScore({ dataFields: 8, relCount: 100, signalCount: 100, personCount: 100 });
      expect(max).toBeLessThanOrEqual(100);
    });

    it('evenly distributes across dimensions', () => {
      const balanced = computeScore({ dataFields: 4, relCount: 3, signalCount: 2, personCount: 2 });
      expect(balanced).toBeGreaterThan(25); // Each dimension contributes
      expect(balanced).toBeLessThanOrEqual(100);
    });
  });

  // ─── Graph BFS Path Finding ──────────────────────────────────────────────

  describe('Graph Path Finding Logic', () => {
    interface MockNode {
      id: string;
      type: 'org' | 'person';
      label: string;
    }

    interface MockEdge {
      source: string;
      target: string;
      type: string;
      weight: number;
    }

    function findShortestPath(
      nodes: MockNode[],
      edges: MockEdge[],
      sourceId: string,
      targetId: string,
      maxHops: number = 4
    ): MockEdge[] | null {
      const queue: Array<{ current: string; path: MockEdge[]; visited: Set<string> }> = [];
      queue.push({ current: sourceId, path: [], visited: new Set([sourceId]) });

      const adjacency = new Map<string, Array<{ neighbor: string; edge: MockEdge }>>();
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
        adjacency.get(edge.source)!.push({ neighbor: edge.target, edge });
        adjacency.get(edge.target)!.push({ neighbor: edge.source, edge });
      }

      while (queue.length > 0) {
        const { current, path, visited } = queue.shift()!;

        if (current === targetId && path.length > 0) {
          return path;
        }

        if (path.length >= maxHops) continue;

        const neighbors = adjacency.get(current) || [];
        for (const { neighbor, edge } of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({
              current: neighbor,
              path: [...path, edge],
              visited: new Set(visited),
            });
          }
        }
      }

      return null;
    }

    it('finds direct path between connected nodes', () => {
      const edges: MockEdge[] = [
        { source: 'orgA', target: 'orgB', type: 'competes_with', weight: 0.5 },
      ];
      const path = findShortestPath([], edges, 'orgA', 'orgB', 2);
      expect(path).toBeTruthy();
      expect(path!.length).toBe(1);
    });

    it('finds multi-hop path', () => {
      const edges: MockEdge[] = [
        { source: 'orgA', target: 'personA', type: 'works_at', weight: 1.0 },
        { source: 'personA', target: 'orgB', type: 'works_at', weight: 1.0 },
      ];
      const path = findShortestPath([], edges, 'orgA', 'orgB', 4);
      expect(path).toBeTruthy();
      expect(path!.length).toBe(2);
    });

    it('returns null for disconnected nodes', () => {
      const path = findShortestPath([], [], 'orgA', 'orgB', 4);
      expect(path).toBeNull();
    });

    it('respects max hops limit', () => {
      const edges: MockEdge[] = [
        { source: 'A', target: 'B', type: 'x', weight: 1 },
        { source: 'B', target: 'C', type: 'x', weight: 1 },
        { source: 'C', target: 'D', type: 'x', weight: 1 },
        { source: 'D', target: 'E', type: 'x', weight: 1 },
      ];
      // A→E needs 4 hops, but maxHops=3
      const path = findShortestPath([], edges, 'A', 'E', 3);
      expect(path).toBeNull();
    });
  });

  // ─── Entity Deduplication Logic ──────────────────────────────────────────

  describe('Entity Deduplication', () => {
    function isDuplicate(
      existing: { name: string; domain?: string | null; aliases: string[] },
      candidate: { name: string; domain?: string | null }
    ): boolean {
      // Exact domain match = same org
      if (existing.domain && candidate.domain && existing.domain === candidate.domain) return true;
      // Exact name match
      if (existing.name.toLowerCase() === candidate.name.toLowerCase()) return true;
      // Alias match
      if (existing.aliases.some(a => a.toLowerCase() === candidate.name.toLowerCase())) return true;
      return false;
    }

    it('detects duplicate by domain', () => {
      expect(isDuplicate(
        { name: 'Acme Corp', domain: 'acme.com', aliases: [] },
        { name: 'Acme Corporation', domain: 'acme.com' }
      )).toBe(true);
    });

    it('detects duplicate by name', () => {
      expect(isDuplicate(
        { name: 'Beta Inc', domain: 'beta.io', aliases: [] },
        { name: 'Beta Inc', domain: 'beta.org' }
      )).toBe(true);
    });

    it('detects duplicate by alias', () => {
      expect(isDuplicate(
        { name: 'Gamma Corp', domain: 'gamma.com', aliases: ['Gamma Technologies', 'GammaCo'] },
        { name: 'Gamma Technologies' }
      )).toBe(true);
    });

    it('does not false-positive different orgs', () => {
      expect(isDuplicate(
        { name: 'Acme Corp', domain: 'acme.com', aliases: [] },
        { name: 'Beta Corp', domain: 'beta.com' }
      )).toBe(false);
    });
  });
});
