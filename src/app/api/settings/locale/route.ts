/* ═══════════════════════════════════════════════════
   GET /api/settings/locale  — return current locale
   PUT /api/settings/locale  — set locale (persisted in SystemSetting)
   ═══════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { setLocale as setI18nLocale, getLocale as getI18nLocale, getAvailableLocales } from '@/lib/i18n';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

const LOCALE_DB_KEY = 'user_locale';
const DEFAULT_LOCALE = 'en-US';

/** Load persisted locale from SystemSetting. */
async function loadPersistedLocale(): Promise<string> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: LOCALE_DB_KEY } });
    return row?.value ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Persist locale preference. */
async function persistLocale(locale: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: LOCALE_DB_KEY },
    create: { key: LOCALE_DB_KEY, value: locale },
    update: { value: locale },
  });
}

/* ── GET ── */
export async function GET() {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const currentLocale = getI18nLocale();
  const available = getAvailableLocales();

  // Try to restore from DB and apply
  const persisted = await loadPersistedLocale();
  if (persisted !== currentLocale) {
    setI18nLocale(persisted);
  }

  return NextResponse.json({
    locale: persisted,
    available,
  });
}

/* ── PUT ── */
export async function PUT(request: Request) {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json() as { locale?: string };
    const { locale } = body;

    if (!locale || typeof locale !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "locale" field' },
        { status: 400 },
      );
    }

    const ok = setI18nLocale(locale);
    if (!ok) {
      return NextResponse.json(
        { error: `Locale "${locale}" is not registered. Available: ${getAvailableLocales().join(', ')}` },
        { status: 422 },
      );
    }

    await persistLocale(locale);
    logger.info('Locale updated', { locale });

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    logger.error('Locale PUT error:', { error });
    return NextResponse.json({ error: 'Failed to update locale' }, { status: 500 });
  }
}
