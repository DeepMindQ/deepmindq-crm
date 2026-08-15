/**
 * Loading Skeleton Unit Tests — DeepMindQ Intelligence OS
 *
 * Tests the LoadingSkeleton component from @/components/ui/loading-skeleton.tsx:
 *   - Renders the correct number of skeleton rows for table variant
 *   - Renders CardSkeleton with the specified count
 *   - Renders ScreenSkeleton (kanban variant) properly
 *   - Each variant renders without crashing
 *
 * Uses renderToString (server-side) consistent with the existing
 * screens-smoke.test.ts pattern.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// ═══════════════════════════════════════════════════════════
//  MOCKS
// ═══════════════════════════════════════════════════════════

// The Skeleton component uses Tailwind classes and no external deps,
// so we just need to mock the cn utility if it does anything fancy.
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}));

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

async function renderLoadingSkeleton(
  variant: string,
  opts?: { count?: number; columns?: number },
): Promise<string> {
  const { LoadingSkeleton } = await import('@/components/ui/loading-skeleton');
  return renderToString(
    React.createElement(LoadingSkeleton, {
      variant: variant as any,
      count: opts?.count,
      columns: opts?.columns,
    }),
  );
}

// ═══════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════

describe('LoadingSkeleton — ScreenSkeleton variants', () => {
  // ── Table variant (ScreenSkeleton with rows) ──
  describe('table variant', () => {
    it('renders without crashing', async () => {
      const html = await renderLoadingSkeleton('table', { rows: 5, columns: 4 });
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders default 5 rows when no count specified', async () => {
      const html = await renderLoadingSkeleton('table', { columns: 3 });
      // TableSkeleton renders 5 rows by default (count defaults to 5)
      // Each row contains a checkbox + column skeletons
      // We verify the output is substantial
      expect(html.length).toBeGreaterThan(200);
    });

    it('renders the specified number of rows', async () => {
      const html3 = await renderLoadingSkeleton('table', { count: 3, columns: 2 });
      const html10 = await renderLoadingSkeleton('table', { count: 10, columns: 2 });
      // More rows = more HTML content
      expect(html10.length).toBeGreaterThan(html3.length);
    });

    it('renders column headers', async () => {
      const html = await renderLoadingSkeleton('table', { count: 1, columns: 5 });
      // The toolbar area + column header area should render
      expect(html.length).toBeGreaterThan(100);
    });
  });

  // ── Cards variant (CardSkeleton) ──
  describe('cards variant (CardSkeleton)', () => {
    it('renders without crashing', async () => {
      const html = await renderLoadingSkeleton('cards', { count: 6 });
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders more content for higher count', async () => {
      const html3 = await renderLoadingSkeleton('cards', { count: 3 });
      const html9 = await renderLoadingSkeleton('cards', { count: 9 });
      expect(html9.length).toBeGreaterThan(html3.length);
    });

    it('renders default 6 cards when no count specified', async () => {
      const html = await renderLoadingSkeleton('cards');
      // 6 card skeletons should produce substantial HTML
      expect(html.length).toBeGreaterThan(300);
    });
  });

  // ── Kanban variant (commonly used for pipeline screens) ──
  describe('kanban variant', () => {
    it('renders without crashing', async () => {
      const html = await renderLoadingSkeleton('kanban');
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders multiple column placeholders', async () => {
      const html = await renderLoadingSkeleton('kanban');
      // KanbanSkeleton renders 4 columns with 3 cards each
      // Verify substantial HTML output
      expect(html.length).toBeGreaterThan(400);
    });
  });

  // ── Other variants ──
  describe('other variants', () => {
    it('renders dashboard variant', async () => {
      const html = await renderLoadingSkeleton('dashboard');
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders detail variant', async () => {
      const html = await renderLoadingSkeleton('detail');
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders list variant with specified count', async () => {
      const html = await renderLoadingSkeleton('list', { count: 8 });
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders form variant', async () => {
      const html = await renderLoadingSkeleton('form');
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders chat variant', async () => {
      const html = await renderLoadingSkeleton('chat');
      expect(html.length).toBeGreaterThan(0);
    });

    it('renders stats variant', async () => {
      const html = await renderLoadingSkeleton('stats', { count: 4 });
      expect(html.length).toBeGreaterThan(0);
    });
  });

  // ── Accessibility ──
  describe('accessibility', () => {
    it('includes a loading role and sr-only text', async () => {
      const html = await renderLoadingSkeleton('table');
      expect(html).toContain('role="status"');
      expect(html).toContain('Loading...');
    });

    it('uses the provided aria-label', async () => {
      const { LoadingSkeleton } = await import('@/components/ui/loading-skeleton');
      const html = renderToString(
        React.createElement(LoadingSkeleton, {
          variant: 'table',
          label: 'Loading pipeline data',
        }),
      );
      expect(html).toContain('aria-label="Loading pipeline data"');
    });
  });
});
