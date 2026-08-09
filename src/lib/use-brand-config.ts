/* ═══════════════════════════════════════════════════
   useBrandConfig — fetches brand configuration from
   /api/brand with a 60-second client-side cache.

   Falls back to sensible defaults so the UI never
   breaks if the API is unreachable.
   ═══════════════════════════════════════════════════ */
'use client';

import { useState, useEffect, useRef } from 'react';

const DEFAULT_BRAND = {
  name: 'DeepMindQ',
  logoUrl: '',
  primaryColor: '#d6bf79',
  secondaryColor: '#73b4c9',
} as const;

export type BrandConfig = typeof DEFAULT_BRAND;

const CACHE_TTL_MS = 60_000; // 60 seconds
const CACHE_KEY = 'dmq_brand_config';

function readCache(): { data: BrandConfig; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(data: BrandConfig) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage may be full or unavailable
  }
}

export function useBrandConfig(): BrandConfig {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Check client-side cache first
    const cached = readCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setBrand(cached.data);
      return;
    }

    // Fetch from API
    fetch('/api/brand')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BrandConfig | null) => {
        if (data && typeof data === 'object' && data.name) {
          const merged: BrandConfig = { ...DEFAULT_BRAND, ...data };
          setBrand(merged);
          writeCache(merged);
        }
      })
      .catch(() => {
        // Silently fall back to defaults
      });
  }, []);

  return brand;
}
