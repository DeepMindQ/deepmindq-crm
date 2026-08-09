/**
 * DeepMindQ Intelligence OS — Unified Automation API Route
 *
 * GET  /api/integrations/automation → list connectors & capabilities
 * POST /api/integrations/automation → execute an action via a connector
 *
 * Designed for Make (Integromat), n8n, and custom HTTP-based integrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// Connector definitions
// ---------------------------------------------------------------------------

interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  inputFields: Array<{ key: string; label: string; required: boolean; type: string }>;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  platform: string[];
  actions: ConnectorAction[];
  baseUrl: string;
}

const CONNECTORS: Connector[] = [
  {
    id: 'deepmindq',
    name: 'DeepMindQ Intelligence',
    description: 'Core platform API for companies, signals, and scores',
    platform: ['make', 'n8n', 'custom'],
    baseUrl: '/api',
    actions: [
      {
        id: 'list.companies',
        name: 'List Companies',
        description: 'Retrieve a paginated list of tracked companies',
        inputFields: [
          { key: 'limit', label: 'Limit', required: false, type: 'number' },
          { key: 'offset', label: 'Offset', required: false, type: 'number' },
        ],
      },
      {
        id: 'get.company',
        name: 'Get Company',
        description: 'Fetch a single company by ID',
        inputFields: [
          { key: 'id', label: 'Company ID', required: true, type: 'string' },
        ],
      },
      {
        id: 'create.company',
        name: 'Create Company',
        description: 'Add a new company to the intelligence database',
        inputFields: [
          { key: 'name', label: 'Name', required: true, type: 'string' },
          { key: 'domain', label: 'Domain', required: false, type: 'string' },
          { key: 'industry', label: 'Industry', required: false, type: 'string' },
        ],
      },
      {
        id: 'get.signals',
        name: 'Get Signals',
        description: 'Retrieve AI signals for a specific company',
        inputFields: [
          { key: 'companyId', label: 'Company ID', required: true, type: 'string' },
          { key: 'limit', label: 'Limit', required: false, type: 'number' },
        ],
      },
      {
        id: 'get.score',
        name: 'Get Intelligence Score',
        description: 'Get the current intelligence score for a company',
        inputFields: [
          { key: 'companyId', label: 'Company ID', required: true, type: 'string' },
        ],
      },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Send notifications via Slack, Teams, or email',
    platform: ['make', 'n8n', 'custom'],
    baseUrl: '/api/integrations',
    actions: [
      {
        id: 'send.slack',
        name: 'Send Slack Notification',
        description: 'Send a message to a Slack channel via webhook',
        inputFields: [
          { key: 'webhookUrl', label: 'Webhook URL', required: true, type: 'string' },
          { key: 'channel', label: 'Channel', required: false, type: 'string' },
          { key: 'title', label: 'Title', required: true, type: 'string' },
          { key: 'message', label: 'Message', required: true, type: 'string' },
          { key: 'level', label: 'Level', required: false, type: 'string' },
        ],
      },
      {
        id: 'send.email',
        name: 'Send Email',
        description: 'Render and queue an email notification',
        inputFields: [
          { key: 'templateId', label: 'Template ID', required: true, type: 'string' },
          { key: 'to', label: 'Recipient Email', required: true, type: 'string' },
          { key: 'vars', label: 'Template Variables (JSON)', required: true, type: 'string' },
        ],
      },
    ],
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    description: 'Export and analyze intelligence data',
    platform: ['make', 'n8n', 'custom'],
    baseUrl: '/api',
    actions: [
      {
        id: 'export.companies',
        name: 'Export Companies',
        description: 'Export company data as CSV or JSON',
        inputFields: [
          { key: 'format', label: 'Format (csv | json)', required: false, type: 'string' },
          { key: 'filters', label: 'Filters (JSON)', required: false, type: 'string' },
        ],
      },
      {
        id: 'analytics.summary',
        name: 'Analytics Summary',
        description: 'Get a summary of intelligence analytics',
        inputFields: [
          { key: 'period', label: 'Period (7d | 30d | 90d)', required: false, type: 'string' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// GET — list connectors & capabilities
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await checkApiAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = CONNECTORS.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    supportedPlatforms: c.platform,
    actions: c.actions.map((a) => ({ id: a.id, name: a.name, description: a.description })),
  }));

  return NextResponse.json({
    version: '1.0.0',
    connectors: summary,
    totalActions: CONNECTORS.reduce((sum, c) => sum + c.actions.length, 0),
  });
}

// ---------------------------------------------------------------------------
// POST — execute an action
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await checkApiAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      connector?: string;
      action?: string;
      params?: Record<string, string | number | boolean | undefined>;
    };

    if (!body.connector || !body.action) {
      return NextResponse.json(
        { error: 'Both "connector" and "action" are required.' },
        { status: 400 },
      );
    }

    const connector = CONNECTORS.find((c) => c.id === body.connector);
    if (!connector) {
      return NextResponse.json(
        {
          error: `Unknown connector: "${body.connector}". Available: ${CONNECTORS.map((c) => c.id).join(', ')}`,
        },
        { status: 400 },
      );
    }

    const action = connector.actions.find((a) => a.id === body.action);
    if (!action) {
      return NextResponse.json(
        {
          error: `Unknown action "${body.action}" for connector "${connector.id}". Available: ${connector.actions.map((a) => a.id).join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Validate required fields
    const params = body.params ?? {};
    for (const field of action.inputFields) {
      if (field.required && params[field.key] === undefined) {
        return NextResponse.json(
          { error: `Missing required parameter: "${field.label}" (${field.key})` },
          { status: 400 },
        );
      }
    }

    // Mock execution — in production this would dispatch to real handlers.
    const mockId = `${connector.id}.${action.id}_${Date.now().toString(36)}`;

    return NextResponse.json({
      success: true,
      connector: connector.id,
      action: action.id,
      executionId: mockId,
      message: `Action "${action.name}" on "${connector.name}" executed successfully (mock).`,
      input: params,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
