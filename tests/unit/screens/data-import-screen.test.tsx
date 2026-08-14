/**
 * Data Import Screen Unit Tests — DeepMindQ Intelligence OS
 *
 * Tests that the DataImport screen:
 *   - Renders without crashing
 *   - Has upload functionality (file input, drag-drop zone, upload button)
 *   - Shows the upload zone with expected text
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
  fetchApi: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('@/lib/store', () => {
  const state = {
    activeView: 'dashboard' as string,
    sidebarCollapsed: false,
    setActiveView: vi.fn(),
    setSelectedCompanyId: vi.fn(),
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
    LineChart: M,
    BarChart: M,
    AreaChart: M,
    Line: M,
    Bar: M,
    Area: M,
    Cell: M,
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
  useQuery: vi.fn(() => ({ data: null, isLoading: true, isSuccess: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('@/components/enterprise/DataTable', () => ({
  DataTable: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'data-table' },
      `DataTable: ${props?.data ? (props.data as unknown[]).length : 0} rows`,
    ),
}));

vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    text: { primary: '#0f172a', secondary: '#64748b', muted: '#94a3b8' },
    border: { default: '#e2e8f0' },
    accent: {
      DEFAULT: '#3b82f6',
      ghost: 'rgba(59,130,246,0.08)',
      hover: '#2563eb',
      subtle: 'rgba(59,130,246,0.04)',
    },
    surface: { primary: '#ffffff', secondary: '#f8fafc' },
    surfaceExtended: '#f1f5f9',
    domain: { value: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    flat: { white: '#ffffff' },
  },
  typography: { fontFamily: 'Inter, system-ui, sans-serif' },
  elevation: { sm: '0 1px 2px rgba(0,0,0,0.05)' },
}));

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

async function renderDataImport(): Promise<string> {
  const mod = await import('@/components/screens/data-import-screen');
  const Component = (mod as any).default;
  if (typeof Component !== 'function') {
    throw new Error(`No default export. Exports: ${Object.keys(mod).join(', ')}`);
  }
  return renderToString(React.createElement(Component));
}

// ═══════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════

describe('DataImportScreen', () => {
  it('renders without crashing', async () => {
    const html = await renderDataImport();
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the "Data Import" heading', async () => {
    const html = await renderDataImport();
    expect(html).toContain('Data Import');
  });

  it('renders the upload zone with drag-and-drop text', async () => {
    const html = await renderDataImport();
    // Note: renderToString HTML-encodes & as &amp;
    expect(html).toContain('Drag &amp; drop files here, or click to browse');
  });

  it('renders accepted file type information', async () => {
    const html = await renderDataImport();
    expect(html).toContain('CSV, XLSX, XLS, and JSON');
  });

  it('renders the "Upload File" button', async () => {
    const html = await renderDataImport();
    expect(html).toContain('Upload File');
  });

  it('renders the "Ingestion History" section', async () => {
    const html = await renderDataImport();
    expect(html).toContain('Ingestion History');
  });

  it('renders stat cards for import metrics', async () => {
    const html = await renderDataImport();
    expect(html).toContain('Total Imports');
    expect(html).toContain('Successful');
    expect(html).toContain('Failed');
    expect(html).toContain('Total Rows Processed');
  });

  it('has a file input element (hidden) for upload functionality', async () => {
    const html = await renderDataImport();
    // The component uses a hidden file input
    expect(html).toContain('type="file"');
  });

  it('renders the DataTable for ingestion history', async () => {
    const html = await renderDataImport();
    // DataTable is mocked to show row count
    expect(html).toContain('data-table');
  });

  it('renders the file size limit info', async () => {
    const html = await renderDataImport();
    expect(html).toContain('50MB');
  });
});
