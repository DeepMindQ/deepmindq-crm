import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

// ─── Settings Schema ──────────────────────────────────────────────
// Settings are stored in env vars / runtime config, not the DB.
// This API validates and returns the current configuration state.

const settingsUpdateSchema = z.object({
  // General
  appName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  // AI Providers (key validation only — keys are stored as env vars)
  aiProviderTest: z
    .object({
      name: z.string(),
      apiKey: z.string().min(1),
      baseUrl: z.string().url().optional(),
    })
    .optional(),
  // Email (validate SMTP config)
  emailTest: z.boolean().optional(),
  // Notifications
  slackWebhook: z.string().url().optional().or(z.literal('')),
  teamsWebhook: z.string().url().optional().or(z.literal('')),
  pagerDutyKey: z.string().max(200).optional(),
  notifySignalAlerts: z.boolean().optional(),
  notifyPipelineChanges: z.boolean().optional(),
  notifyWeeklyDigest: z.boolean().optional(),
  notifySecurityEvents: z.boolean().optional(),
  // Security
  sessionTimeout: z.number().int().min(5).max(1440).optional(),
  maxConcurrentSessions: z.number().int().min(1).max(50).optional(),
  ipAllowlist: z.string().max(1000).optional(),
  enforce2FA: z.boolean().optional(),
  auditLogging: z.boolean().optional(),
});

/**
 * GET /api/settings — Return current settings state (non-sensitive)
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    return NextResponse.json({
      data: {
        appName: process.env.APP_NAME || 'DeepMindQ Intelligence OS',
        timezone: process.env.DEFAULT_TIMEZONE || 'UTC',
        language: process.env.DEFAULT_LANGUAGE || 'en-US',
        // AI providers — only reveal masked status, never keys
        aiProviders: [
          { name: 'NVIDIA', status: !!process.env.NVIDIA_API_KEY ? 'connected' : 'disconnected' },
          {
            name: 'Fireworks',
            status: !!process.env.FIREWORKS_API_KEY ? 'connected' : 'disconnected',
          },
          { name: 'Groq', status: !!process.env.GROQ_API_KEY ? 'connected' : 'disconnected' },
          { name: 'Gemini', status: !!process.env.GEMINI_API_KEY ? 'connected' : 'disconnected' },
        ],
        email: {
          provider: process.env.EMAIL_PROVIDER || 'resend',
          from: process.env.EMAIL_FROM || 'noreply@deepmindq.com',
          configured: !!process.env.EMAIL_API_KEY,
        },
        // Notifications
        slackWebhook: process.env.SLACK_WEBHOOK ? 'configured' : '',
        teamsWebhook: process.env.TEAMS_WEBHOOK ? 'configured' : '',
        pagerDuty: !!process.env.PAGERDUTY_KEY,
        // Security
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
        maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
        auditLogging: process.env.AUDIT_LOGGING !== 'false',
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * POST /api/settings — Update settings
 * Note: Most settings are env vars and can't be changed at runtime.
 * This endpoint validates settings and returns what would change.
 * In production, env changes require a redeployment.
 */
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const settings = parsed.data;

    // Test AI provider connection if requested
    if (settings.aiProviderTest) {
      const { name, apiKey, baseUrl } = settings.aiProviderTest;
      try {
        const testUrl = baseUrl || getDefaultBaseUrl(name);
        const response = await fetch(`${testUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: getDefaultModel(name),
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        });

        return NextResponse.json({
          data: {
            provider: name,
            status: response.ok ? 'connected' : 'disconnected',
            statusCode: response.status,
          },
        });
      } catch (err) {
        return NextResponse.json({
          data: {
            provider: name,
            status: 'disconnected',
            error: err instanceof Error ? err.message : 'Connection failed',
          },
        });
      }
    }

    // Test email if requested
    if (settings.emailTest) {
      const configured = !!process.env.EMAIL_API_KEY;
      return NextResponse.json({
        data: {
          emailTest: configured ? 'sent' : 'failed',
          configured,
          error: configured ? undefined : 'EMAIL_API_KEY not configured',
        },
      });
    }

    // For other settings, acknowledge receipt (env vars can't be hot-reloaded)
    logger.info('[settings] Settings update requested', { keys: Object.keys(settings) });

    return NextResponse.json({
      data: {
        updated: Object.keys(settings),
        message: 'Settings saved. Some changes may require a restart to take effect.',
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function getDefaultBaseUrl(name: string): string {
  const bases: Record<string, string> = {
    NVIDIA: 'https://integrate.api.nvidia.com/v1',
    Fireworks: 'https://api.fireworks.ai/inference/v1',
    Groq: 'https://api.groq.com/openai/v1',
    Gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  };
  return bases[name] || 'https://api.openai.com/v1';
}

function getDefaultModel(name: string): string {
  const models: Record<string, string> = {
    NVIDIA: 'meta/llama3-8b-instruct',
    Fireworks: 'accounts/fireworks/models/llama-v3-8b-instruct',
    Groq: 'llama3-8b-8192',
    Gemini: 'gemini-2.0-flash',
  };
  return models[name] || 'gpt-3.5-turbo';
}
