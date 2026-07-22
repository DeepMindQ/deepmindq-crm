import { NextResponse } from 'next/server';

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

/* ═══════════════════════════════════════════════════
   In-memory settings store (survives hot reloads,
   resets on server restart — safe for Vercel)
   ═══════════════════════════════════════════════════ */
let currentSettings: SettingsObject = DEFAULT_SETTINGS;

/* ═══════════════════════════════════════════════════
   Deep-merge helper — merges partial updates into
   the current settings without losing untouched keys
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
   GET /api/settings — return current settings
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    return NextResponse.json({ settings: currentSettings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   PUT /api/settings — update settings
   Accepts a partial settings object and deep-merges
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

    // Deep merge the incoming partial settings
    currentSettings = deepMerge(currentSettings, body) as SettingsObject;

    return NextResponse.json({
      success: true,
      settings: currentSettings,
    });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}