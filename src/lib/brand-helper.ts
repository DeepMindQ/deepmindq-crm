/**
 * Server-side brand helper for API routes and background workers.
 * Falls back to 'DeepMindQ' if no custom brand is configured.
 */
import { db } from '@/lib/db';

let _cachedBrandName: string | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getBrandName(): Promise<string> {
  const now = Date.now();
  if (_cachedBrandName && now - _cacheTime < CACHE_TTL) {
    return _cachedBrandName;
  }
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'app_settings' },
    });
    if (setting) {
      const parsed = JSON.parse(setting.value || '{}');
      _cachedBrandName = parsed.brand?.name || 'DeepMindQ';
    } else {
      _cachedBrandName = 'DeepMindQ';
    }
  } catch {
    _cachedBrandName = 'DeepMindQ';
  }
  _cacheTime = now;
  return _cachedBrandName!;
}

/** Synchronous version using cache (returns default if cache miss) */
export function getBrandNameSync(): string {
  return _cachedBrandName || 'DeepMindQ';
}
