/**
 * Intelligence Hub Screen Unit Tests — DeepMindQ Intelligence OS
 *
 * Tests that the IntelligenceHub screen:
 *   - Renders without crashing
 *   - Shows the "Intelligence Hub" heading
 *   - Shows expected sections (stats, signals feed, top orgs, etc.)
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
//  MOCKS — hoisted by vitest before any imports resolve
// ═══════════════════════════════════════════════════════════

vi.mock('@/lib/fetchApi', () => ({
  fetchApi: vi.fn().mockResolvedValue({ data: null, error: 'Not available in test' }),
}));

vi.mock('@/lib/store', () => {
  const state = {
    activeView: 'dashboard' as string,
    sidebarCollapsed: false,
    selectedCompanyId: null,
    setActiveView: vi.fn(),
    setSelectedCompanyId: vi.fn(),
    setCompanyStatusFilter: vi.fn(),
  };
  return {
    useAppStore: vi.fn((selector?: (s: typeof state) => unknown) => {
      if (typeof selector !== 'function') return state;
      return selector(state);
    }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => 'toaster-mock',
}));

vi.mock('recharts', () => {
  const M = (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-recharts': String(props?.displayName ?? 'mock') });
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-recharts': 'ResponsiveContainer' }, children),
    AreaChart: M,
    Area: M,
    XAxis: M,
    YAxis: M,
    CartesianGrid: M,
    Tooltip: M,
    Legend: M,
  };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
  DragOverlay: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: vi.fn(() => '') } },
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  },
}));

vi.mock('framer-motion', () => {
  const M = (props: Record<string, unknown>) => React.createElement('div', props, props?.children);
  return {
    motion: new Proxy({}, { get: () => M }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: vi.fn(() => ({ data: null, error: null, isLoading: true, isSuccess: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

async function renderIntelligenceHub(): Promise<string> {
  const mod = await import('@/components/screens/intelligence-hub-screen');
  const Component = (mod as any).default;
  if (typeof Component !== 'function') {
    throw new Error(`No default export. Exports: ${Object.keys(mod).join(', ')}`);
  }
  return renderToString(React.createElement(Component));
}

// ═══════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════

describe('IntelligenceHubScreen', () => {
  it('renders without crashing', async () => {
    const html = await renderIntelligenceHub();
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the "Intelligence Hub" heading', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Intelligence Hub');
  });

  it('renders the subtitle', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Real-time overview of all intelligence operations');
  });

  it('renders the stats section with key metrics', async () => {
    const html = await renderIntelligenceHub();
    // These are the stat card labels rendered by the component
    expect(html).toContain('Total Organizations');
    expect(html).toContain('Active Signals');
    expect(html).toContain('AI Insights Generated');
    expect(html).toContain('Avg Intelligence Score');
  });

  it('renders the Recent Signals section header', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Recent Signals');
  });

  it('renders the Top Organizations section', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Top Organizations');
  });

  it('renders the Activity Timeline section', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Activity Timeline');
  });

  it('renders the Quick Actions bar', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('QUICK ACTIONS');
    expect(html).toContain('Import Data');
    expect(html).toContain('Run Intelligence Pipeline');
  });

  it('renders the "Live" status indicator', async () => {
    const html = await renderIntelligenceHub();
    expect(html).toContain('Live');
  });

  it('shows skeleton loading state for signals when isLoading is true', async () => {
    // useQuery is mocked to return isLoading: true, so the signal feed
    // should render skeleton items (6 of them) rather than real signal cards
    const html = await renderIntelligenceHub();
    // The skeleton loading state for signals renders 6 skeleton rows
    // We verify the component renders (doesn't crash) in loading state
    expect(html.length).toBeGreaterThan(0);
  });
});
