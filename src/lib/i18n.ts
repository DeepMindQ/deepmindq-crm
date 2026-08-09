/* ═══════════════════════════════════════════════════
   DeepMindQ — Internationalization (i18n) Core

   Lightweight in-memory translation system.
   Load locale files, resolve keys with parameter interpolation,
   and format dates/numbers via Intl APIs.
   ═══════════════════════════════════════════════════ */

import en from './locales/en';

type TranslationMap = Record<string, string>;
type LocaleBundle = TranslationMap;

// ── Registry ──
const localeRegistry = new Map<string, LocaleBundle>();
localeRegistry.set('en-US', en);

let currentLocale: string = 'en-US';

// ── Public API ──

/**
 * Look up a translation key and interpolate parameters.
 * Falls back to the key itself if no translation is found.
 *
 * @example
 *   t('common.save')                           // "Save"
 *   t('greeting', { name: 'Alice' })           // "Hello, Alice!"
 */
export function t(key: string, params?: Record<string, string>): string {
  const bundle = localeRegistry.get(currentLocale);
  const raw = bundle?.[key] ?? localeRegistry.get('en-US')?.[key] ?? key;
  if (!params) return raw;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    raw,
  );
}

/**
 * Change the active locale. Returns true if the locale was found.
 */
export function setLocale(locale: string): boolean {
  if (localeRegistry.has(locale)) {
    currentLocale = locale;
    return true;
  }
  return false;
}

/** Get the currently active locale string. */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Register a new locale bundle at runtime.
 */
export function registerLocale(locale: string, bundle: LocaleBundle): void {
  localeRegistry.set(locale, bundle);
}

/** List all registered locale codes. */
export function getAvailableLocales(): string[] {
  return Array.from(localeRegistry.keys());
}

// ── Date Formatting ──

export interface DateFormatOptions {
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

/**
 * Format a date string or Date object using Intl.DateTimeFormat.
 */
export function formatDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions & DateFormatOptions = {},
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(currentLocale, opts).format(date);
}

/**
 * Format a date with relative time (e.g. "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' });

  if (absSec < 60) return rtf.format(-Math.sign(diffSec) * absSec, 'second');
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return rtf.format(-Math.sign(diffSec) * absMin, 'minute');
  const absHr = Math.round(absMin / 60);
  if (absHr < 24) return rtf.format(-Math.sign(diffSec) * absHr, 'hour');
  const absDay = Math.round(absHr / 24);
  if (absDay < 30) return rtf.format(-Math.sign(diffSec) * absDay, 'day');
  const absMonth = Math.round(absDay / 30);
  if (absMonth < 12) return rtf.format(-Math.sign(diffSec) * absMonth, 'month');
  const absYear = Math.round(absMonth / 12);
  return rtf.format(-Math.sign(diffSec) * absYear, 'year');
}

// ── Number Formatting ──

/**
 * Format a number using Intl.NumberFormat.
 */
export function formatNumber(
  value: number,
  opts: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(currentLocale, opts).format(value);
}

/**
 * Format a number as currency.
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  opts: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(currentLocale, { style: 'currency', currency, ...opts }).format(value);
}

/**
 * Format a number as a compact percentage (e.g. "85.2%").
 */
export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(currentLocale, {
    style: 'percent',
    maximumFractionDigits,
  }).format(value / 100);
}
