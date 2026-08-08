/* ═══════════════════════════════════════════════════
   DeepMindQ — useTranslation() React Hook

   Provides reactive access to the i18n system.
   Components re-render when locale changes.
   ═══════════════════════════════════════════════════ */

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { t as _t, setLocale as _setLocale, getLocale } from './i18n';
import { formatDate, formatRelativeTime, formatNumber, formatCurrency, formatPercent } from './i18n';

// ── Tiny event bus so hooks re-render on locale change ──
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notifyAll() { listeners.forEach(l => l()); }

function getSnapshot() { return getLocale(); }

// ── Hook ──

export interface UseTranslationReturn {
  /** Translate a key with optional interpolation params. */
  t: (key: string, params?: Record<string, string>) => string;
  /** Current locale code (e.g. 'en-US'). */
  locale: string;
  /** Change locale. Returns true on success. */
  setLocale: (locale: string) => boolean;
  /** Date formatting bound to current locale. */
  formatDate: typeof formatDate;
  /** Relative time formatting ("3 hours ago"). */
  formatRelativeTime: typeof formatRelativeTime;
  /** Number formatting. */
  formatNumber: typeof formatNumber;
  /** Currency formatting. */
  formatCurrency: typeof formatCurrency;
  /** Percentage formatting. */
  formatPercent: typeof formatPercent;
}

export function useTranslation(): UseTranslationReturn {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLocale = useCallback((newLocale: string) => {
    const ok = _setLocale(newLocale);
    if (ok) notifyAll();
    return ok;
  }, []);

  return {
    t: _t,
    locale,
    setLocale,
    formatDate,
    formatRelativeTime,
    formatNumber,
    formatCurrency,
    formatPercent,
  };
}
