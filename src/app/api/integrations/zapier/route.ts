/**
 * DeepMindQ Intelligence OS — Zapier Integration API Route
 *
 * GET  /api/integrations/zapier  → list available trigger events & actions
 * POST /api/integrations/zapier  → execute an action
 *
 * Designed to be Zapier-compatible: triggers return unique `id` fields and
 * sample data so Zapier can auto-map fields.
 */

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Trigger events (things that Zapier can subscribe to)
// ---------------------------------------------------------------------------

const TRIGGER_EVENTS = [
  {
    id: 'signal.detected',
    name: 'New AI Signal Detected',
    description: 'Triggers when a new AI signal is detected for a tracked company',
    sample: {
      id: 'sig_01HXYZ',
      companyName: 'Acme Corp',
      signalName: 'Leadership Change',
      signalType: 'leadership',
      confidence: '87',
      detectedAt: '2025-01-15T09:30:00Z',
    },
  },
  {
    id: 'score.changed',
    name: 'Intelligence Score Changed',
    description: 'Triggers when a company intelligence score changes significantly',
    sample: {
      id: 'sc_01HABC',
      companyName: 'Beta Inc',
      previousScore: '62',
      newScore: '78',
      direction: 'up',
      changedAt: '2025-01-15T10:00:00Z',
    },
  },
  {
    id: 'opportunity.created',
    name: 'New Opportunity Created',
    description: 'Triggers when a new sales opportunity is identified by the system',
    sample: {
      id: 'opp_01HDEF',
      opportunityName: 'Enterprise License Expansion',
      companyName: 'Gamma LLC',
      value: '$120,000',
      stage: 'qualified',
      createdAt: '2025-01-15T11:00:00Z',
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Actions (things Zapier can invoke in our system)
// ---------------------------------------------------------------------------

const AVAILABLE_ACTIONS = [
  {
    id: 'create.company',
    name: 'Create Company',
    description: 'Create a new company in the intelligence database',
    inputFields: [
      { key: 'name', label: 'Company Name', required: true, type: 'string' },
      { key: 'domain', label: 'Website Domain', required: false, type: 'string' },
      { key: 'industry', label: 'Industry', required: false, type: 'string' },
      { key: 'employeeRange', label: 'Employee Range', required: false, type: 'string' },
    ],
  },
  {
    id: 'create.note',
    name: 'Create Note',
    description: 'Add a note to an existing company record',
    inputFields: [
      { key: 'companyId', label: 'Company ID', required: true, type: 'string' },
      { key: 'content', label: 'Note Content', required: true, type: 'string' },
      { key: 'author', label: 'Author Name', required: false, type: 'string' },
    ],
  },
  {
    id: 'update.company',
    name: 'Update Company',
    description: 'Update fields on an existing company record',
    inputFields: [
      { key: 'companyId', label: 'Company ID', required: true, type: 'string' },
      { key: 'name', label: 'Company Name', required: false, type: 'string' },
      { key: 'domain', label: 'Website Domain', required: false, type: 'string' },
      { key: 'industry', label: 'Industry', required: false, type: 'string' },
    ],
  },
  {
    id: 'find.company',
    name: 'Find Company',
    description: 'Look up a company by name or domain',
    inputFields: [
      { key: 'name', label: 'Company Name', required: false, type: 'string' },
      { key: 'domain', label: 'Website Domain', required: false, type: 'string' },
    ],
  },
  {
    id: 'list.companies',
    name: 'List Companies',
    description: 'Retrieve a paginated list of tracked companies',
    inputFields: [
      { key: 'limit', label: 'Limit', required: false, type: 'number' },
      { key: 'offset', label: 'Offset', required: false, type: 'number' },
      { key: 'industry', label: 'Filter by Industry', required: false, type: 'string' },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// GET — list triggers & actions
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    triggers: TRIGGER_EVENTS,
    actions: AVAILABLE_ACTIONS,
  });
}

// ---------------------------------------------------------------------------
// POST — execute an action
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      action: string;
      params?: Record<string, string | number | undefined>;
    };

    if (!body.action) {
      return NextResponse.json({ error: 'Missing "action" field.' }, { status: 400 });
    }

    const actionDef = AVAILABLE_ACTIONS.find((a) => a.id === body.action);
    if (!actionDef) {
      return NextResponse.json(
        { error: `Unknown action: "${body.action}". Available: ${AVAILABLE_ACTIONS.map((a) => a.id).join(', ')}` },
        { status: 400 },
      );
    }

    // Validate required fields
    const params = body.params ?? {};
    for (const field of actionDef.inputFields) {
      if (field.required && !params[field.key]) {
        return NextResponse.json(
          { error: `Missing required field: "${field.label}" (${field.key})` },
          { status: 400 },
        );
      }
    }

    // In a real implementation these would hit the database / ORM layer.
    // For now we return a mock success payload.
    const mockId = `${body.action.slice(0, 4)}_${Date.now().toString(36)}`;

    return NextResponse.json({
      success: true,
      action: body.action,
      id: mockId,
      message: `Action "${actionDef.name}" executed successfully (mock).`,
      input: params,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
