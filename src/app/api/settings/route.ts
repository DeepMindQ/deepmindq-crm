import { NextResponse } from 'next/server';
import { tokens } from '@/lib/design-tokens';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface SettingsObject {
  brand: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
  };
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
   Default settings
   ═══════════════════════════════════════════════════ */
const DEFAULT_SETTINGS: SettingsObject = {
  brand: {
    name: 'DeepMindQ',
    logoUrl: '',
    primaryColor: tokens.gold.mutedLight,
    secondaryColor: '#73b4c9',
  },
  mailbox: {
    fromName: 'DeepMindQ',
    fromEmail: 'noreply@deepmindq.com',
    replyTo: 'noreply@deepmindq.com',
    signature:
      'Best regards,\nDeepMindQ',
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
   Database-backed settings via SystemSetting table
   ═══════════════════════════════════════════════════ */
const SETTINGS_DB_KEY = 'app_settings';

/** Load settings from DB, merging with defaults for any missing keys. */
async function loadSettings(): Promise<SettingsObject> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: SETTINGS_DB_KEY },
    });
    if (!row) return DEFAULT_SETTINGS;
    const stored = JSON.parse(row.value || '{}') as Partial<SettingsObject>;
    // Deep-merge stored values over defaults so any new default keys survive
    return deepMerge(DEFAULT_SETTINGS, stored) as SettingsObject;
  } catch (error) {
    logger.error('Failed to load settings from DB, using defaults:', { error });
    return DEFAULT_SETTINGS;
  }
}

/** Persist the full settings object to the DB (upsert). */
async function persistSettings(settings: SettingsObject): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: SETTINGS_DB_KEY },
    create: { key: SETTINGS_DB_KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
}

/* ═══════════════════════════════════════════════════
   Deep-merge helper — merges partial updates into
   the current settings without losing untouched keys
   ═══════════════════════════════════════════════════ */
 
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
  // Auth gate: admin-only for system settings
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    logger.error('Settings GET error:', { error: error });
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   PUT /api/settings — update settings
   Accepts a partial settings object and deep-merges
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  // Auth gate: admin-only for system settings
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    // Deep merge the incoming partial settings over current DB values
    const current = await loadSettings();
    const merged = deepMerge(current, body) as SettingsObject;
    await persistSettings(merged);

    return NextResponse.json({
      success: true,
      settings: merged,
    });
  } catch (error) {
    logger.error('Settings PUT error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}