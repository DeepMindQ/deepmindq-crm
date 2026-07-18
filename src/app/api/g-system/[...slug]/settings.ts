import { NextResponse } from 'next/server';
import { getAIConfig, updateAIConfig, testProviderConnection } from '@/lib/ai-config';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface SettingsObject {
  mailbox: {
    fromName: string;
    fromEmail: string;
    replyTo: string;
    signature: string;
  };
  workingHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
    daysActive: string[];
  };
  emailVerification: {
    autoVerifyOnImport: boolean;
    rejectInvalidOnImport: boolean;
    syntaxCheckEnabled: boolean;
    disposableCheckEnabled: boolean;
    roleBasedCheckEnabled: boolean;
    freeProviderCheckEnabled: boolean;
    minHealthScore: number;
  };
  leadScoring: {
    enabled: boolean;
    executiveBonus: number;
    managerBonus: number;
    validEmailBonus: number;
    companyBonus: number;
    titleBonus: number;
    maxScore: number;
  };
  suppressionRules: {
    autoSuppressBounces: boolean;
    autoSuppressUnsubscribes: boolean;
    autoSuppressNegativeReplies: boolean;
    suppressFreeProviders: boolean;
    suppressDisposableDomains: boolean;
    suppressRoleBasedEmails: boolean;
  };
}

/* ═══════════════════════════════════════════════════
   Default / demo settings
   ═══════════════════════════════════════════════════ */
const DEFAULT_SETTINGS: SettingsObject = {
  mailbox: {
    fromName: 'Ravi Shanker',
    fromEmail: 'ravi.shanker@deepmindq.com',
    replyTo: 'ravi.shanker@deepmindq.com',
    signature:
      'Best regards,\nRavi Shanker\nEnterprise Sales Leader\nDeepMindQ',
  },
  workingHours: {
    enabled: true,
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'America/New_York',
    daysActive: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  emailVerification: {
    autoVerifyOnImport: true,
    rejectInvalidOnImport: false,
    syntaxCheckEnabled: true,
    disposableCheckEnabled: true,
    roleBasedCheckEnabled: true,
    freeProviderCheckEnabled: true,
    minHealthScore: 40,
  },
  leadScoring: {
    enabled: true,
    executiveBonus: 25,
    managerBonus: 15,
    validEmailBonus: 10,
    companyBonus: 5,
    titleBonus: 5,
    maxScore: 100,
  },
  suppressionRules: {
    autoSuppressBounces: true,
    autoSuppressUnsubscribes: true,
    autoSuppressNegativeReplies: false,
    suppressFreeProviders: false,
    suppressDisposableDomains: true,
    suppressRoleBasedEmails: false,
  },
};

const APP_SETTINGS_KEY = 'app_settings';

/* ═══════════════════════════════════════════════════
   Deep-merge helper
   ═══════════════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════
   Load/save settings from DB
   ═══════════════════════════════════════════════════ */
async function loadSettings(): Promise<SettingsObject> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: APP_SETTINGS_KEY },
    });
    if (setting?.value) {
      return deepMerge(DEFAULT_SETTINGS, JSON.parse(setting.value));
    }
  } catch {
    // DB not available yet
  }
  return DEFAULT_SETTINGS;
}

async function saveSettings(settings: SettingsObject): Promise<void> {
  try {
    await db.systemSetting.upsert({
      where: { key: APP_SETTINGS_KEY },
      update: { value: JSON.stringify(settings) },
      create: { key: APP_SETTINGS_KEY, value: JSON.stringify(settings) },
    });
  } catch {
    console.warn('[settings] Failed to persist to DB');
  }
}

/* ═══════════════════════════════════════════════════
   GET /api/settings — return current settings
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    const [settings, aiProviders] = await Promise.all([
      loadSettings(),
      getAIConfig(),
    ]);
    return NextResponse.json({ settings, aiProviders });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ settings: DEFAULT_SETTINGS, _demo: true });
  }
}

/* ═══════════════════════════════════════════════════
   PUT /api/settings — update settings
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    // Handle AI provider updates separately
    if (body.aiProviders) {
      const updatedAI = await updateAIConfig(body.aiProviders);
      const { aiProviders: _ai, ...restBody } = body;
      if (Object.keys(restBody).length > 0) {
        const currentSettings = await loadSettings();
        const merged = deepMerge(currentSettings, restBody) as SettingsObject;
        await saveSettings(merged);
        return NextResponse.json({
          success: true,
          settings: merged,
          aiProviders: updatedAI,
        });
      }
      return NextResponse.json({
        success: true,
        settings: await loadSettings(),
        aiProviders: updatedAI,
      });
    }

    // Deep merge the incoming partial settings
    const currentSettings = await loadSettings();
    const merged = deepMerge(currentSettings, body) as SettingsObject;
    await saveSettings(merged);

    return NextResponse.json({
      success: true,
      settings: merged,
    });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/settings/test-provider — test a single
   AI provider connection
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { providerId } = body;

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    const result = await testProviderConnection(providerId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Provider test error:', error);
    return NextResponse.json(
      { success: false, message: 'Test failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}