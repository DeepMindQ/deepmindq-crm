/**
 * @vitest-environment node
 * Pagination Utilities — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parsePagination,
  parsePaginationFromUrl,
  buildPaginationMeta,
  paginatedResponse,
  legacyParsePagination,
  legacyBuildPaginationMeta,
} from '@/lib/pagination';

describe('pagination', () => {
  // ── parsePagination ──────────────────────────────────────────────

  describe('parsePagination', () => {
    it('returns defaults when no params provided', () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
    });

    it('parses page and limit as numbers', () => {
      const result = parsePagination({ page: 3, limit: 10 });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(20); // (3-1)*10
    });

    it('parses page and limit as strings', () => {
      const result = parsePagination({ page: '2', limit: '5' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.skip).toBe(5); // (2-1)*5
    });

    it('clamps page to minimum of 1', () => {
      const result = parsePagination({ page: 0 });
      expect(result.page).toBe(1);
    });

    it('clamps negative page to 1', () => {
      const result = parsePagination({ page: -5 });
      expect(result.page).toBe(1);
    });

    it('clamps NaN page to 1', () => {
      const result = parsePagination({ page: 'abc' });
      expect(result.page).toBe(1);
    });

    it('clamps limit to maximum of 100', () => {
      const result = parsePagination({ limit: 500 });
      expect(result.limit).toBe(100);
    });

    it('falls back to default when limit is 0 (falsy parseInt)', () => {
      const result = parsePagination({ limit: 0 });
      // parseInt('0') is 0 which is falsy, so falls back to DEFAULT_LIMIT
      expect(result.limit).toBe(20);
    });

    it('handles NaN limit by using default', () => {
      const result = parsePagination({ limit: 'xyz' });
      expect(result.limit).toBe(20);
    });

    it('parses sortBy', () => {
      const result = parsePagination({ sortBy: 'name' });
      expect(result.sortBy).toBe('name');
    });

    it('defaults sortBy to createdAt', () => {
      const result = parsePagination({});
      expect(result.sortBy).toBe('createdAt');
    });

    it('parses sortOrder asc', () => {
      const result = parsePagination({ sortOrder: 'asc' });
      expect(result.sortOrder).toBe('asc');
    });

    it('defaults sortOrder to desc', () => {
      const result = parsePagination({});
      expect(result.sortOrder).toBe('desc');
    });

    it('treats invalid sortOrder as desc', () => {
      const result = parsePagination({ sortOrder: 'invalid' as any });
      expect(result.sortOrder).toBe('desc');
    });

    it('handles undefined sortOrder as desc', () => {
      const result = parsePagination({ sortOrder: undefined });
      expect(result.sortOrder).toBe('desc');
    });

    it('computes skip correctly for page 5, limit 10', () => {
      const result = parsePagination({ page: 5, limit: 10 });
      expect(result.skip).toBe(40);
    });
  });

  // ── parsePaginationFromUrl ───────────────────────────────────────

  describe('parsePaginationFromUrl', () => {
    it('parses query params from URL string', () => {
      const result = parsePaginationFromUrl(
        'http://localhost/api/orgs?page=2&limit=50&sortBy=name&sortOrder=asc',
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('asc');
    });

    it('uses defaults for missing params', () => {
      const result = parsePaginationFromUrl('http://localhost/api/orgs');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('clamps values from URL', () => {
      const result = parsePaginationFromUrl('http://localhost/api/orgs?limit=999');
      expect(result.limit).toBe(100);
    });
  });

  // ── buildPaginationMeta ──────────────────────────────────────────

  describe('buildPaginationMeta', () => {
    it('computes totalPages correctly', () => {
      const meta = buildPaginationMeta(95, 1, 20);
      expect(meta.totalPages).toBe(5);
    });

    it('returns hasNext=false on last page', () => {
      const meta = buildPaginationMeta(95, 5, 20);
      expect(meta.hasNext).toBe(false);
    });

    it('returns hasNext=true when not on last page', () => {
      const meta = buildPaginationMeta(95, 1, 20);
      expect(meta.hasNext).toBe(true);
    });

    it('returns hasPrev=false on first page', () => {
      const meta = buildPaginationMeta(95, 1, 20);
      expect(meta.hasPrev).toBe(false);
    });

    it('returns hasPrev=true on page > 1', () => {
      const meta = buildPaginationMeta(95, 2, 20);
      expect(meta.hasPrev).toBe(true);
    });

    it('ensures totalPages is at least 1', () => {
      const meta = buildPaginationMeta(0, 1, 20);
      expect(meta.totalPages).toBe(1);
    });

    it('handles total=0', () => {
      const meta = buildPaginationMeta(0, 1, 20);
      expect(meta.total).toBe(0);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    it('handles total < limit (single page)', () => {
      const meta = buildPaginationMeta(5, 1, 20);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNext).toBe(false);
    });
  });

  // ── paginatedResponse ────────────────────────────────────────────

  describe('paginatedResponse', () => {
    it('wraps data with pagination metadata', () => {
      const result = paginatedResponse([{ id: 1 }, { id: 2 }], 50, 1, 20);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(50);
    });

    it('works with empty data array', () => {
      const result = paginatedResponse([], 0, 1, 20);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ── legacyParsePagination ────────────────────────────────────────

  describe('legacyParsePagination', () => {
    it('returns page, limit, skip, take', () => {
      const result = legacyParsePagination('http://localhost/api?page=3&limit=10');
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(20);
      expect(result.take).toBe(10); // take === limit
    });

    it('take always equals limit', () => {
      const result = legacyParsePagination('http://localhost/api?page=1&limit=50');
      expect(result.take).toBe(result.limit);
    });
  });

  // ── legacyBuildPaginationMeta ────────────────────────────────────

  describe('legacyBuildPaginationMeta', () => {
    it('builds pagination meta from LegacyPaginationParams', () => {
      const meta = legacyBuildPaginationMeta(100, { page: 2, limit: 10, skip: 10, take: 10 });
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(10);
      expect(meta.total).toBe(100);
      expect(meta.totalPages).toBe(10);
    });
  });
});
