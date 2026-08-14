/**
 * Intelligence OS Screens — Comprehensive Smoke Tests — DeepMindQ
 *
 * Tests all 8 Intelligence OS screens for:
 *   1. Renders without crashing (renderToString smoke test)
 *   2. Contains key heading/label text
 *   3. Contains expected structural data elements (stat cards, table rows, etc.)
 *
 * Uses renderToString (server-side) consistent with existing
 * intelligence-hub-screen.test.tsx pattern.
 *
 * NOTE: Components that gate content behind a loading state
 * (IntelligenceOperationsCenter, CommandCenter, ActivationWorkspace)
 * render only their loading spinner in SSR because useEffect never fires.
 * Their tests verify the loading UI instead.
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
  fetchApi: vi.fn().mockResolvedValue({ data: null, error: null }),
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

vi.mock('framer-motion', () => {
  const M = (props: Record<string, unknown>) => React.createElement('div', props, props?.children);
  return {
    motion: new Proxy({}, { get: () => M }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    // Hooks used by animated-components.tsx
    useInView: () => true,
    useMotionValue: (_initial: number) => ({
      get: () => 0,
      set: vi.fn(),
    }),
    useTransform: (_value: unknown, _map: unknown) => 0,
    animate: (_from: unknown, _to: unknown, _opts?: unknown) => ({
      stop: vi.fn(),
    }),
  };
});

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: vi.fn(() => ({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: true,
  })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// ═══════════════════════════════════════════════════════════
//  HELPER — dynamically import and render a named export
// ═══════════════════════════════════════════════════════════

type NamedExport = { [key: string]: React.ComponentType<any> };

async function renderNamedExport(modulePath: string, exportName: string): Promise<string> {
  const mod = (await import(modulePath)) as NamedExport;
  const Component = mod[exportName];
  if (typeof Component !== 'function') {
    throw new Error(
      `No export "${exportName}" in ${modulePath}. Exports: ${Object.keys(mod).join(', ')}`,
    );
  }
  return renderToString(React.createElement(Component));
}

// ═══════════════════════════════════════════════════════════
//  1. IntelligenceOperationsCenter
// ═══════════════════════════════════════════════════════════
//  In SSR, loading=true (useEffect never fires), so only the
//  loading spinner is rendered.

describe('IntelligenceOperationsCenter', () => {
  const path = '@/components/intelligence-os/intelligence-operations-center';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'IntelligenceOperationsCenter');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the loading state indicator', async () => {
    const html = await renderNamedExport(path, 'IntelligenceOperationsCenter');
    expect(html).toContain('Loading operations center');
  });

  it('renders the PageTransition wrapper', async () => {
    const html = await renderNamedExport(path, 'IntelligenceOperationsCenter');
    expect(html).toContain('animate-spin');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. CommandCenter
// ═══════════════════════════════════════════════════════════
//  In SSR, loading=true (useEffect never fires), so only the
//  loading spinner is rendered.

describe('CommandCenter', () => {
  const path = '@/components/intelligence-os/command-center';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'CommandCenter');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the loading state indicator', async () => {
    const html = await renderNamedExport(path, 'CommandCenter');
    expect(html).toContain('Loading command center');
  });

  it('renders the PageTransition wrapper', async () => {
    const html = await renderNamedExport(path, 'CommandCenter');
    expect(html).toContain('animate-spin');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. ActivationWorkspace
// ═══════════════════════════════════════════════════════════
//  In SSR, loading=true (useEffect never fires), so only the
//  loading spinner is rendered.

describe('ActivationWorkspace', () => {
  const path = '@/components/intelligence-os/activation-workspace';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'ActivationWorkspace');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the loading state indicator', async () => {
    const html = await renderNamedExport(path, 'ActivationWorkspace');
    expect(html).toContain('Loading activation workspace');
  });

  it('renders the PageTransition wrapper', async () => {
    const html = await renderNamedExport(path, 'ActivationWorkspace');
    expect(html).toContain('animate-spin');
  });
});

// ═══════════════════════════════════════════════════════════
//  4. CompanyWorkspace
// ═══════════════════════════════════════════════════════════
//  This component renders its full UI immediately with fallback
//  data (no loading gate), so all content assertions work in SSR.

describe('CompanyWorkspace', () => {
  const path = '@/components/intelligence-os/company-workspace';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'CompanyWorkspace');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the default company name when API data is null', async () => {
    const html = await renderNamedExport(path, 'CompanyWorkspace');
    // Falls back to "Acme Corporation" when orgData is null (mocked API)
    expect(html).toContain('Acme Corporation');
  });

  it('renders tab navigation', async () => {
    const html = await renderNamedExport(path, 'CompanyWorkspace');
    expect(html).toContain('Overview');
    expect(html).toContain('Signals');
    expect(html).toContain('Contacts');
  });

  it('contains stat card data elements', async () => {
    const html = await renderNamedExport(path, 'CompanyWorkspace');
    expect(html).toContain('Intelligence Score');
    expect(html).toContain('Active Signals');
    expect(html).toContain('Contacts Tracked');
  });

  it('renders the Company Profile section', async () => {
    const html = await renderNamedExport(path, 'CompanyWorkspace');
    expect(html).toContain('Company Profile');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. KnowledgeWorkspace
// ═══════════════════════════════════════════════════════════
//  Renders full UI immediately with default stat values.

describe('KnowledgeWorkspace', () => {
  const path = '@/components/intelligence-os/knowledge-workspace';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the "Knowledge Workspace" heading', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Knowledge Workspace');
  });

  it('renders the subtitle', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Organize findings');
    expect(html).toContain('intelligence briefings');
  });

  it('contains stat card data elements', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Knowledge Articles');
    expect(html).toContain('Briefings Generated');
  });

  it('renders the Knowledge Base browser', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Knowledge Base');
  });

  it('renders the Recent Activity feed', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Recent Activity');
  });

  it('renders the Quick Create bar', async () => {
    const html = await renderNamedExport(path, 'KnowledgeWorkspace');
    expect(html).toContain('Quick Create');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. CapabilityWorkspace
// ═══════════════════════════════════════════════════════════
//  Renders full UI immediately with mock capability data.

describe('CapabilityWorkspace', () => {
  const path = '@/components/intelligence-os/capability-workspace';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the "Capability Workspace" heading', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    expect(html).toContain('Capability Workspace');
  });

  it('renders the subtitle', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    expect(html).toContain('Configure AI engines');
    expect(html).toContain('intelligence capabilities');
  });

  it('contains stat card data elements', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    expect(html).toContain('Active Capabilities');
    expect(html).toContain('Model Accuracy');
  });

  it('renders capability cards with accuracy data', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    // These are names from CAPABILITIES_DATA
    expect(html).toContain('Signal Detection');
    expect(html).toContain('Entity Resolution');
  });

  it('renders the Global Settings button', async () => {
    const html = await renderNamedExport(path, 'CapabilityWorkspace');
    expect(html).toContain('Global Settings');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. IntelligenceBriefing
// ═══════════════════════════════════════════════════════════
//  Renders full UI immediately with mock findings data.

describe('IntelligenceBriefing', () => {
  const path = '@/components/intelligence-os/intelligence-briefing';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the "Intelligence Briefing" heading', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Intelligence Briefing');
  });

  it('renders the subtitle', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('AI-generated intelligence summaries');
  });

  it('renders briefing type tabs', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Daily Digest');
    expect(html).toContain('Weekly Report');
    expect(html).toContain('Executive Summary');
  });

  it('renders the Key Findings section', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Key Findings');
  });

  it('renders the Market Highlights section', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Market Highlights');
  });

  it('renders the Action Items section', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Action Items');
  });

  it('renders the Risk Assessment Matrix', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Risk Assessment Matrix');
  });

  it('renders the Briefing History sidebar', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Briefing History');
  });

  it('renders the Generate New Briefing button', async () => {
    const html = await renderNamedExport(path, 'IntelligenceBriefing');
    expect(html).toContain('Generate New Briefing');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. IntelligenceSearch
// ═══════════════════════════════════════════════════════════
//  The component initializes with query='enterprise AI' and
//  showResults=true, so it renders the results view (not
//  the "Recent Searches" view) in SSR.

describe('IntelligenceSearch', () => {
  const path = '@/components/intelligence-os/intelligence-search';

  it('renders without crashing', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the search input with the initial query', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html).toContain('enterprise AI');
  });

  it('renders the search input placeholder', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html).toContain('Search companies, signals, contacts, knowledge');
  });

  it('renders search category pills', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html).toContain('All');
    expect(html).toContain('Companies');
    expect(html).toContain('Signals');
    expect(html).toContain('Contacts');
    expect(html).toContain('Knowledge');
    expect(html).toContain('Briefings');
  });

  it('renders filter and sort controls in results area', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html).toContain('Filters');
    expect(html).toContain('Sort: Relevance');
  });

  it('renders fallback company results', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    // Fallback company results from FALLBACK_COMPANY_RESULTS
    expect(html).toContain('Anthropic AI');
    expect(html).toContain('Databricks Inc.');
  });

  it('renders the Companies section header', async () => {
    const html = await renderNamedExport(path, 'IntelligenceSearch');
    expect(html).toContain('Companies');
  });
});
