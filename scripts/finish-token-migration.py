#!/usr/bin/env python3
"""
finish-token-migration.py

Replaces ALL remaining hardcoded hex colors and rgba() values in screen files
with CSS custom properties (var(--dmq-*)).  Also adds any missing CSS variables
to globals.css so every colour literal has an exact token match.

Usage:
    python scripts/finish-token-migration.py
"""

import re, os, glob, json
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
SCREENS_DIR = PROJECT / "src" / "components" / "screens"
GLOBALS_CSS = PROJECT / "src" / "app" / "globals.css"

# ────────────────────────────────────────────────────────────────
# 1.  NORMALISE an rgba() string → canonical key for lookup
# ────────────────────────────────────────────────────────────────
def normalize_rgba(raw: str) -> str:
    """rgba(212, 175, 55, 0.15) → rgba(212,175,55,0.15)"""
    m = re.match(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)', raw)
    if not m:
        return raw
    r, g, b, a = m.groups()
    # normalise alpha: strip leading zeros, keep at most 4 decimal places
    a_float = float(a)
    # use at most 2 decimal places for nice key
    a_norm = f"{a_float:.2f}".rstrip('0').rstrip('.')
    # but keep it as a number, not percentage
    return f"rgba({r},{g},{b},{a_norm})"

# ────────────────────────────────────────────────────────────────
# 2.  COMPREHENSIVE LOOKUP TABLE
#     Maps normalised colour values → CSS var name
# ────────────────────────────────────────────────────────────────

def build_lookup() -> dict[str, str]:
    """Build hex → var and rgba → var lookup from globals.css + extras."""
    lookup = {}

    # --- Hex lookups (from existing --dmq-* tokens) ---
    hex_map = {
        '#0a0c10': '--dmq-surface-base',
        '#0f1219': '--dmq-surface-secondary',
        '#0f1117': '--dmq-surface-dark-alt',
        '#0f0f11': '--dmq-surface-deep-dark',
        '#141821': '--dmq-surface-card',
        '#1a1f2b': '--dmq-surface-card-hover',
        '#1e2433': '--dmq-surface-elevated',
        '#1a1a2e': '--dmq-surface-muted-bg',
        '#12121e': '--dmq-surface-panel',
        '#1e2535': '--dmq-border-default',
        '#2a3348': '--dmq-border-hover',
        '#a1a1aa': '--dmq-border-gray',
        '#e8ecf4': '--dmq-text-primary',
        '#8892a8': '--dmq-text-secondary',
        '#5a6478': '--dmq-text-muted',
        '#93c5fd': '--dmq-text-accent',
        '#3b82f6': '--dmq-accent-blue',
        '#2563eb': '--dmq-accent-dim',
        '#60a5fa': '--dmq-accent-bright',
        '#ef4444': '--dmq-domain-risk',
        '#a855f7': '--dmq-domain-opportunity',
        '#06b6d4': '--dmq-domain-enrichment',
        '#f59e0b': '--dmq-domain-reasoning',
        '#22c55e': '--dmq-domain-action',
        '#d4af37': '--dmq-gold',
        '#e8c860': '--dmq-gold-light',
        '#b8860b': '--dmq-gold-dark',
        '#9a8340': '--dmq-gold-deep',
        '#d6bf79': '--dmq-gold-muted',
        '#8b5cf6': '--dmq-purple',
        '#7c3aed': '--dmq-purple-deep',
        '#c084fc': '--dmq-purple-light',
        '#a78bfa': '--dmq-violet',
        '#6366f1': '--dmq-indigo',
        '#0ea5e9': '--dmq-sky',
        '#22d3ee': '--dmq-cyan',
        '#0891b2': '--dmq-cyan-dark',
        '#fbbf24': '--dmq-amber',
        '#d97706': '--dmq-amber-deep',
        '#f87171': '--dmq-rose',
        '#dc2626': '--dmq-red',
        '#991b1b': '--dmq-red-dark',
        '#10b981': '--dmq-emerald',
        '#34d399': '--dmq-emerald-light',
        '#059669': '--dmq-emerald-deep',
        '#16a34a': '--dmq-green-deep',
        '#84cc16': '--dmq-lime',
        '#a3e635': '--dmq-lime-bright',
        '#65a30d': '--dmq-lime-dark',
        '#ea580c': '--dmq-orange',
        '#f97316': '--dmq-orange-light',
        '#ec4899': '--dmq-pink',
        '#14b8a6': '--dmq-trust-high',
        '#6b7280': '--dmq-trust-unverified',
        '#1d4ed8': '--dmq-blue',
        '#1e40af': '--dmq-blue-deep',
        '#4361ee': '--dmq-blue-bright',
        '#818cf8': '--dmq-sky-blue',
        '#000000': '--dmq-black',
        '#ffffff': '--dmq-white',
        '#f8f9fa': '--dmq-off-white',
        '#f0f0f5': '--dmq-warm-white',
        '#e4e4e7': '--dmq-cool-gray',
        '#a0a0b8': '--dmq-slate',
        '#6b6b80': '--dmq-muted-gray',
        '#666666': '--dmq-dim-gray',
        '#999999': '--dmq-medium-gray',
        '#cccccc': '--dmq-light-gray',
        '#71717a': '--dmq-zinc',
        '#52525b': '--dmq-zinc-dark',
        '#bfdbfe': '--dmq-light-blue',
        '#eff6ff': '--dmq-soft-blue',
        '#fef2f2': '--dmq-light-red',
        '#ecfdf5': '--dmq-light-green',
        '#fef3c7': '--dmq-light-amber',
        '#f8fafc': '--dmq-cool-bg',
        '#fffdf5': '--dmq-warm-bg',
        '#fffbeb': '--dmq-warm-bg-alt',
        '#f9fafb': '--dmq-neutral-50',
        '#f3f4f6': '--dmq-neutral-100',
        '#e5e7eb': '--dmq-neutral-200',
        '#d1d5db': '--dmq-neutral-300',
        '#9ca3af': '--dmq-neutral-400',
        '#4b5563': '--dmq-neutral-600',
        '#374151': '--dmq-neutral-700',
        '#1f2937': '--dmq-neutral-800',
        '#111827': '--dmq-neutral-900',
        '#ca8a04': '--dmq-yellow-deep',
    }
    # Add case-insensitive
    for h, v in list(hex_map.items()):
        lookup[h] = v
        lookup[h.upper()] = v
        lookup[h.lower()] = v

    # --- RGBA lookups ---
    rgba_map = {
        # Gold rgba(212,175,55,...)
        'rgba(212,175,55,0.01)': '--dmq-gold-bg-ghost',
        'rgba(212,175,55,0.02)': '--dmq-gold-bg-trace',
        'rgba(212,175,55,0.03)': '--dmq-gold-bg-whisper',
        'rgba(212,175,55,0.04)': '--dmq-gold-bg-hint',
        'rgba(212,175,55,0.05)': '--dmq-gold-bg-dust',
        'rgba(212,175,55,0.06)': '--dmq-gold-bg-subtle',
        'rgba(212,175,55,0.08)': '--dmq-gold-bg-micro',
        'rgba(212,175,55,0.1)': '--dmq-gold-bg',
        'rgba(212,175,55,0.12)': '--dmq-gold-bg-medium',
        'rgba(212,175,55,0.15)': '--dmq-gold-border-faint',
        'rgba(212,175,55,0.2)': '--dmq-gold-border-light',
        'rgba(212,175,55,0.25)': '--dmq-gold-bg-bright',
        'rgba(212,175,55,0.3)': '--dmq-gold-border',
        'rgba(212,175,55,0.35)': '--dmq-gold-glow',
        'rgba(212,175,55,0.4)': '--dmq-gold-bg-strong',
        'rgba(212,175,55,0.5)': '--dmq-gold-bg-half',
        'rgba(212,175,55,0.7)': '--dmq-gold-bg-rich',
        # Gold Dark rgba(184,134,11,...)
        'rgba(184,134,11,0.03)': '--dmq-gold-dark-bg-ghost',
        'rgba(184,134,11,0.05)': '--dmq-gold-dark-bg-subtle',
        'rgba(184,134,11,0.06)': '--dmq-gold-dark-bg-light',
        'rgba(184,134,11,0.1)': '--dmq-gold-dark-bg',
        'rgba(184,134,11,0.12)': '--dmq-gold-bg-dark',
        'rgba(184,134,11,0.15)': '--dmq-gold-dark-bg-faint',
        'rgba(184,134,11,0.2)': '--dmq-gold-dark-bg-border',
        'rgba(184,134,11,0.25)': '--dmq-gold-dark-bg-medium',
        'rgba(184,134,11,0.3)': '--dmq-gold-dark-bg-strong',
        # Blue accent rgba(59,130,246,...)
        'rgba(59,130,246,0.04)': '--dmq-accent-ghost',
        'rgba(59,130,246,0.05)': '--dmq-accent-bg-dust',
        'rgba(59,130,246,0.06)': '--dmq-accent-bg-micro',
        'rgba(59,130,246,0.08)': '--dmq-accent-bg-hint',
        'rgba(59,130,246,0.1)': '--dmq-accent-subtle',
        'rgba(59,130,246,0.12)': '--dmq-accent-bg-medium',
        'rgba(59,130,246,0.15)': '--dmq-accent-bg-faint',
        'rgba(59,130,246,0.2)': '--dmq-accent-bg-border',
        'rgba(59,130,246,0.25)': '--dmq-accent-strong',
        'rgba(59,130,246,0.3)': '--dmq-accent-border-strong',
        # Red/risk rgba(239,68,68,...)
        'rgba(239,68,68,0.08)': '--dmq-risk-bg-ghost',
        'rgba(239,68,68,0.1)': '--dmq-risk-red-low',
        'rgba(239,68,68,0.12)': '--dmq-risk-bg-medium',
        'rgba(239,68,68,0.15)': '--dmq-risk-bg-faint',
        'rgba(239,68,68,0.2)': '--dmq-risk-bg-border',
        'rgba(239,68,68,0.25)': '--dmq-risk-red-med',
        'rgba(239,68,68,0.3)': '--dmq-risk-bg-strong',
        'rgba(239,68,68,0.5)': '--dmq-risk-red-high',
        # Green/emerald rgba(16,185,129,...)
        'rgba(16,185,129,0.05)': '--dmq-emerald-bg-ghost',
        'rgba(16,185,129,0.08)': '--dmq-emerald-bg-hint',
        'rgba(16,185,129,0.1)': '--dmq-emerald-bg',
        'rgba(16,185,129,0.12)': '--dmq-emerald-bg-medium',
        'rgba(16,185,129,0.2)': '--dmq-emerald-bg-border',
        'rgba(16,185,129,0.4)': '--dmq-emerald-bg-strong',
        'rgba(16,185,129,0.5)': '--dmq-emerald-bg-half',
        # Success/action green rgba(34,197,94,...)
        'rgba(34,197,94,0.08)': '--dmq-action-bg-ghost',
        'rgba(34,197,94,0.1)': '--dmq-success-green-low',
        'rgba(34,197,94,0.12)': '--dmq-trust-verified-bg',
        'rgba(34,197,94,0.25)': '--dmq-success-green-med',
        'rgba(34,197,94,0.3)': '--dmq-trust-verified-border',
        'rgba(34,197,94,0.5)': '--dmq-success-green-high',
        # Amber/reasoning rgba(245,158,11,...)
        'rgba(245,158,11,0.08)': '--dmq-reasoning-bg-ghost',
        'rgba(245,158,11,0.1)': '--dmq-warning-amber-low',
        'rgba(245,158,11,0.12)': '--dmq-reasoning-bg-medium',
        'rgba(245,158,11,0.15)': '--dmq-reasoning-bg-faint',
        'rgba(245,158,11,0.2)': '--dmq-reasoning-bg-border',
        'rgba(245,158,11,0.25)': '--dmq-warning-amber-med',
        'rgba(245,158,11,0.3)': '--dmq-trust-medium-border',
        # Purple rgba(168,85,247,...) - opportunity
        'rgba(168,85,247,0.08)': '--dmq-opportunity-bg-ghost',
        'rgba(168,85,247,0.1)': '--dmq-opportunity-purple-low',
        'rgba(168,85,247,0.12)': '--dmq-opportunity-bg-medium',
        'rgba(168,85,247,0.15)': '--dmq-opportunity-bg-faint',
        'rgba(168,85,247,0.2)': '--dmq-opportunity-bg-border',
        'rgba(168,85,247,0.25)': '--dmq-opportunity-purple-med',
        'rgba(168,85,247,0.3)': '--dmq-opportunity-bg-strong',
        # Purple rgba(139,92,246,...) - accent purple
        'rgba(139,92,246,0.06)': '--dmq-purple-bg-subtle',
        'rgba(139,92,246,0.08)': '--dmq-purple-bg-ghost',
        'rgba(139,92,246,0.1)': '--dmq-purple-bg',
        'rgba(139,92,246,0.12)': '--dmq-purple-bg-medium',
        'rgba(139,92,246,0.15)': '--dmq-purple-bg-faint',
        'rgba(139,92,246,0.2)': '--dmq-purple-border',
        # Purple deep rgba(124,58,237,...)
        'rgba(124,58,237,0.1)': '--dmq-purple-deep-bg',
        'rgba(124,58,237,0.2)': '--dmq-purple-deep-border',
        # Violet rgba(167,139,250,...)
        'rgba(167,139,250,0.1)': '--dmq-violet-bg',
        # Indigo rgba(99,102,241,...)
        'rgba(99,102,241,0.06)': '--dmq-indigo-bg-subtle',
        'rgba(99,102,241,0.08)': '--dmq-indigo-bg-ghost',
        'rgba(99,102,241,0.1)': '--dmq-indigo-bg',
        # Cyan/enrichment rgba(6,182,212,...)
        'rgba(6,182,212,0.1)': '--dmq-enrichment-cyan-low',
        'rgba(6,182,212,0.4)': '--dmq-enrichment-cyan-high',
        # Sky rgba(14,165,233,...)
        'rgba(14,165,233,0.1)': '--dmq-sky-bg',
        'rgba(14,165,233,0.2)': '--dmq-sky-border',
        # Blue rgba(37,99,235,...) - lighter blue
        'rgba(37,99,235,0.04)': '--dmq-blue-bright-bg',
        'rgba(37,99,235,0.12)': '--dmq-blue-bright-bg-alt',
        'rgba(37,99,235,0.3)': '--dmq-blue-bright-border-alt',
        # Blue rgba(29,78,216,...)
        'rgba(29,78,216,0.1)': '--dmq-blue-bg',
        'rgba(29,78,216,0.2)': '--dmq-blue-border',
        # Neutral rgba(161,161,170,...)
        'rgba(161,161,170,0.12)': '--dmq-neutral-bg',
        'rgba(161,161,170,0.2)': '--dmq-neutral-border',
        # Gray rgba(107,114,128,...)
        'rgba(107,114,128,0.1)': '--dmq-unverified-bg',
        'rgba(107,114,128,0.12)': '--dmq-unverified-bg-alt',
        'rgba(107,114,128,0.3)': '--dmq-unverified-border',
        'rgba(107,114,128,0.5)': '--dmq-unverified-border-strong',
        # Neutral gray rgba(113,113,122,...)
        'rgba(113,113,122,0.1)': '--dmq-zinc-bg',
        'rgba(113,113,122,0.12)': '--dmq-zinc-bg-medium',
        # Misc gray rgba(100,100,100,...)
        'rgba(100,100,100,0.12)': '--dmq-gray-bg',
        # Slate rgba(100,116,139,...)
        'rgba(100,116,139,0.3)': '--dmq-slate-thumb',
        'rgba(100,116,139,0.5)': '--dmq-slate-thumb-hover',
        # Black/neutral overlay rgba(0,0,0,...)
        'rgba(0,0,0,0.015)': '--dmq-black-ghost',
        'rgba(0,0,0,0.02)': '--dmq-black-trace',
        'rgba(0,0,0,0.03)': '--dmq-black-shadow',
        'rgba(0,0,0,0.04)': '--dmq-black-whisper',
        'rgba(0,0,0,0.05)': '--dmq-black-hint',
        'rgba(0,0,0,0.06)': '--dmq-black-micro',
        'rgba(0,0,0,0.08)': '--dmq-black-faint',
        'rgba(0,0,0,0.1)': '--dmq-black-subtle',
        'rgba(0,0,0,0.12)': '--dmq-black-bg',
        'rgba(0,0,0,0.15)': '--dmq-black-faint-plus',
        'rgba(0,0,0,0.3)': '--dmq-black-medium',
        'rgba(0,0,0,0.5)': '--dmq-black-half',
        'rgba(0,0,0,0.7)': '--dmq-black-strong',
        'rgba(0,0,0,0.85)': '--dmq-black-heavy',
        'rgba(0,0,0,0.88)': '--dmq-black-overlay',
        # White rgba(255,255,255,...)
        'rgba(255,255,255,0.02)': '--dmq-white-trace',
        'rgba(255,255,255,0.03)': '--dmq-white-shadow',
        'rgba(255,255,255,0.04)': '--dmq-white-ghost',
        'rgba(255,255,255,0.05)': '--dmq-white-whisper',
        'rgba(255,255,255,0.06)': '--dmq-white-micro',
        'rgba(255,255,255,0.08)': '--dmq-white-faint',
        'rgba(255,255,255,0.1)': '--dmq-white-subtle',
        'rgba(255,255,255,0.12)': '--dmq-white-muted',
        'rgba(255,255,255,0.2)': '--dmq-white-light',
        'rgba(255,255,255,0.5)': '--dmq-white-medium',
        'rgba(255,255,255,0.85)': '--dmq-white-card',
        'rgba(255,255,255,0.92)': '--dmq-white-heavy',
        'rgba(255,255,255,0.97)': '--dmq-white-strong',
        # Surface overlays
        'rgba(6,9,15,0.88)': '--dmq-surface-extended-overlay',
        'rgba(8,8,22,0.85)': '--dmq-surface-extended-overlay-alt',
        'rgba(30,37,53,0.8)': '--dmq-surface-extended-backdrop',
        'rgba(17,24,39,0.8)': '--dmq-surface-extended-backdrop-alt',
        # Gold light rgba(232,200,96,...)
        'rgba(232,200,96,0.6)': '--dmq-gold-light-bg-medium',
        'rgba(232,200,96,0.7)': '--dmq-gold-light-bg-strong',
        # Emerald deep rgba(5,150,105,...)
        'rgba(5,150,105,0.5)': '--dmq-emerald-deep-bg-strong',
        # Blue accent glow
        'rgba(59,130,246,0.15)': '--dmq-accent-glow',
        'rgba(59,130,246,0.25)': '--dmq-accent-glow-strong',
    }
    lookup.update(rgba_map)
    return lookup

# ────────────────────────────────────────────────────────────────
# 3.  NEW CSS VARIABLES TO ADD (those not already in globals.css)
# ────────────────────────────────────────────────────────────────
NEW_CSS_VARS = """
  /* ── Extended opacity tokens for screen migration ── */
  --dmq-gold-bg-ghost: rgba(212, 175, 55, 0.01);
  --dmq-gold-bg-trace: rgba(212, 175, 55, 0.02);
  --dmq-gold-bg-whisper: rgba(212, 175, 55, 0.03);
  --dmq-gold-bg-hint: rgba(212, 175, 55, 0.04);
  --dmq-gold-bg-dust: rgba(212, 175, 55, 0.05);
  --dmq-gold-bg-micro: rgba(212, 175, 55, 0.08);
  --dmq-gold-glow: rgba(212, 175, 55, 0.35);
  --dmq-gold-bg-half: rgba(212, 175, 55, 0.5);
  --dmq-gold-bg-rich: rgba(212, 175, 55, 0.7);
  --dmq-gold-dark-bg-ghost: rgba(184, 134, 11, 0.03);
  --dmq-gold-dark-bg-subtle: rgba(184, 134, 11, 0.05);
  --dmq-gold-dark-bg-light: rgba(184, 134, 11, 0.06);
  --dmq-gold-dark-bg: rgba(184, 134, 11, 0.1);
  --dmq-gold-dark-bg-faint: rgba(184, 134, 11, 0.15);
  --dmq-gold-dark-bg-border: rgba(184, 134, 11, 0.2);
  --dmq-gold-dark-bg-medium: rgba(184, 134, 11, 0.25);
  --dmq-gold-dark-bg-strong: rgba(184, 134, 11, 0.3);
  --dmq-gold-light-bg-medium: rgba(232, 200, 96, 0.6);
  --dmq-gold-light-bg-strong: rgba(232, 200, 96, 0.7);

  --dmq-accent-bg-dust: rgba(59, 130, 246, 0.05);
  --dmq-accent-bg-micro: rgba(59, 130, 246, 0.06);
  --dmq-accent-bg-hint: rgba(59, 130, 246, 0.08);
  --dmq-accent-bg-medium: rgba(59, 130, 246, 0.12);
  --dmq-accent-bg-faint: rgba(59, 130, 246, 0.15);
  --dmq-accent-bg-border: rgba(59, 130, 246, 0.2);
  --dmq-accent-border-strong: rgba(59, 130, 246, 0.3);
  --dmq-accent-glow: rgba(59, 130, 246, 0.15);
  --dmq-accent-glow-strong: rgba(59, 130, 246, 0.25);

  --dmq-risk-bg-ghost: rgba(239, 68, 68, 0.08);
  --dmq-risk-bg-medium: rgba(239, 68, 68, 0.12);
  --dmq-risk-bg-faint: rgba(239, 68, 68, 0.15);
  --dmq-risk-bg-border: rgba(239, 68, 68, 0.2);
  --dmq-risk-bg-strong: rgba(239, 68, 68, 0.3);

  --dmq-emerald-bg-ghost: rgba(16, 185, 129, 0.05);
  --dmq-emerald-bg-hint: rgba(16, 185, 129, 0.08);
  --dmq-emerald-bg-border: rgba(16, 185, 129, 0.2);
  --dmq-emerald-bg-strong: rgba(16, 185, 129, 0.4);
  --dmq-emerald-bg-half: rgba(16, 185, 129, 0.5);
  --dmq-emerald-deep-bg-strong: rgba(5, 150, 105, 0.5);

  --dmq-action-bg-ghost: rgba(34, 197, 94, 0.08);

  --dmq-reasoning-bg-ghost: rgba(245, 158, 11, 0.08);
  --dmq-reasoning-bg-medium: rgba(245, 158, 11, 0.12);
  --dmq-reasoning-bg-faint: rgba(245, 158, 11, 0.15);
  --dmq-reasoning-bg-border: rgba(245, 158, 11, 0.2);

  --dmq-opportunity-bg-ghost: rgba(168, 85, 247, 0.08);
  --dmq-opportunity-bg-medium: rgba(168, 85, 247, 0.12);
  --dmq-opportunity-bg-faint: rgba(168, 85, 247, 0.15);
  --dmq-opportunity-bg-border: rgba(168, 85, 247, 0.2);
  --dmq-opportunity-bg-strong: rgba(168, 85, 247, 0.3);

  --dmq-purple-bg-ghost: rgba(139, 92, 246, 0.08);
  --dmq-purple-bg-faint: rgba(139, 92, 246, 0.15);

  --dmq-indigo-bg-ghost: rgba(99, 102, 241, 0.08);

  --dmq-enrichment-cyan-high: rgba(6, 182, 212, 0.4);

  --dmq-blue-bright-bg-alt: rgba(37, 99, 235, 0.12);
  --dmq-blue-bright-border-alt: rgba(37, 99, 235, 0.3);

  --dmq-unverified-bg: rgba(107, 114, 128, 0.1);
  --dmq-unverified-bg-alt: rgba(107, 114, 128, 0.12);
  --dmq-unverified-border-strong: rgba(107, 114, 128, 0.5);

  --dmq-zinc-bg: rgba(113, 113, 122, 0.1);
  --dmq-zinc-bg-medium: rgba(113, 113, 122, 0.12);

  --dmq-gray-bg: rgba(100, 100, 100, 0.12);

  --dmq-slate-thumb: rgba(100, 116, 139, 0.3);
  --dmq-slate-thumb-hover: rgba(100, 116, 139, 0.5);

  /* Black opacity scale */
  --dmq-black-ghost: rgba(0, 0, 0, 0.015);
  --dmq-black-trace: rgba(0, 0, 0, 0.02);
  --dmq-black-shadow: rgba(0, 0, 0, 0.03);
  --dmq-black-whisper: rgba(0, 0, 0, 0.04);
  --dmq-black-hint: rgba(0, 0, 0, 0.05);
  --dmq-black-micro: rgba(0, 0, 0, 0.06);
  --dmq-black-faint: rgba(0, 0, 0, 0.08);
  --dmq-black-subtle: rgba(0, 0, 0, 0.1);
  --dmq-black-bg: rgba(0, 0, 0, 0.12);
  --dmq-black-faint-plus: rgba(0, 0, 0, 0.15);
  --dmq-black-medium: rgba(0, 0, 0, 0.3);
  --dmq-black-half: rgba(0, 0, 0, 0.5);
  --dmq-black-strong: rgba(0, 0, 0, 0.7);
  --dmq-black-heavy: rgba(0, 0, 0, 0.85);
  --dmq-black-overlay: rgba(0, 0, 0, 0.88);

  /* White opacity scale */
  --dmq-white-trace: rgba(255, 255, 255, 0.02);
  --dmq-white-shadow: rgba(255, 255, 255, 0.03);
  --dmq-white-ghost: rgba(255, 255, 255, 0.04);
  --dmq-white-whisper: rgba(255, 255, 255, 0.05);
  --dmq-white-micro: rgba(255, 255, 255, 0.06);
  --dmq-white-faint: rgba(255, 255, 255, 0.08);
  --dmq-white-subtle: rgba(255, 255, 255, 0.1);
  --dmq-white-muted: rgba(255, 255, 255, 0.12);
  --dmq-white-light: rgba(255, 255, 255, 0.2);
  --dmq-white-medium: rgba(255, 255, 255, 0.5);
  --dmq-white-card: rgba(255, 255, 255, 0.85);
  --dmq-white-heavy: rgba(255, 255, 255, 0.92);
  --dmq-white-strong: rgba(255, 255, 255, 0.97);
"""

# ────────────────────────────────────────────────────────────────
# 4.  PARSE globals.css to find which --dmq-* vars already exist
# ────────────────────────────────────────────────────────────────
def parse_existing_vars(css_text: str) -> set[str]:
    return set(re.findall(r'(--dmq-[\w-]+)\s*:', css_text))

# ────────────────────────────────────────────────────────────────
# 5.  ADD MISSING CSS VARIABLES to globals.css
# ────────────────────────────────────────────────────────────────
def add_missing_vars():
    css_text = GLOBALS_CSS.read_text()
    existing = parse_existing_vars(css_text)
    
    # Parse NEW_CSS_VARS to find which vars need adding
    needed_lines = []
    for line in NEW_CSS_VARS.strip().split('\n'):
        m = re.match(r'\s*(--[\w-]+)\s*:', line)
        if m:
            var_name = m.group(1)
            if var_name not in existing:
                needed_lines.append(line)
    
    if not needed_lines:
        print(f"  All {len(NEW_CSS_VARS.strip().split(chr(10)))} new vars already exist in globals.css")
        return
    
    # Find the closing brace of the --dmq-* bridge :root block (line ~962)
    # Insert before that closing brace
    lines = css_text.split('\n')
    insert_idx = None
    for i, line in enumerate(lines):
        if i > 800 and line.strip() == '}':
            # Check if this is the dmq bridge block closing
            insert_idx = i
            break
    
    if insert_idx is None:
        print("  WARNING: Could not find insertion point in globals.css")
        return
    
    block = '\n  /* ── Extended opacity/color tokens (auto-generated) ── */'
    for line in needed_lines:
        block += '\n  ' + line
    block += ','
    
    lines.insert(insert_idx, block)
    GLOBALS_CSS.write_text('\n'.join(lines))
    print(f"  Added {len(needed_lines)} new CSS variables to globals.css")

# ────────────────────────────────────────────────────────────────
# 6.  SKIP LINES that are comments, imports, or className strings
# ────────────────────────────────────────────────────────────────
def should_skip_line(line: str) -> bool:
    stripped = line.strip()
    # Skip single-line comments
    if stripped.startswith('//'):
        return True
    # Skip import lines
    if stripped.startswith('import '):
        return True
    return False

# ────────────────────────────────────────────────────────────────
# 7.  REPLACEMENT ENGINE
# ────────────────────────────────────────────────────────────────

def replace_in_file(filepath: Path, lookup: dict) -> int:
    """Replace hardcoded colors in a single file. Returns count of replacements."""
    content = filepath.read_text()
    original = content
    replacements = 0
    
    # ── Pattern 1: Hex colors in quoted strings ──
    # Match '#xxx' or '#xxxxxx' in single or double quoted context
    # But NOT inside className strings, import paths, or comments
    # Also NOT inside var() fallbacks (those are fine)
    
    def replace_hex_in_string(m):
        nonlocal replacements
        full = m.group(0)
        quote = m.group(1)  # ' or "
        hex_val = m.group(2)  # the hex value
        prefix = m.group(3)  # anything before the hex in the string
        suffix = m.group(4)  # anything after the hex in the string
        
        # Normalize hex
        hex_norm = hex_val.lower()
        if len(hex_norm) == 3:
            hex_norm = f'#{hex_norm[0]}{hex_norm[0]}{hex_norm[1]}{hex_norm[1]}{hex_norm[2]}{hex_norm[2]}'
        
        # Check if it's in a var() fallback - if so, leave it
        start_of_string = m.start(0)
        before = content[max(0, start_of_string-50):start_of_string]
        if 'var(' in before and ', ' in before[-30:]:
            return full
        
        # Check if this line has className
        line_start = content.rfind('\n', 0, start_of_string) + 1
        line = content[line_start:content.find('\n', start_of_string)]
        if 'className' in line and hex_val in line.split('className')[1]:
            return full
        
        var_name = lookup.get(hex_norm)
        if var_name:
            replacements += 1
            return f'{quote}{prefix}var({var_name}){suffix}{quote}'
        return full
    
    # Match hex in quoted strings: '#...' or "#..."
    # This handles: color: '#ef4444', background: "#0f1117", etc.
    hex_pattern = r"([\x27\x22])([^\x27\x22]*?)(#[0-9a-fA-F]{3,8})([^\x27\x22]*?)\1"
    content = re.sub(hex_pattern, replace_hex_in_string, content)
    
    # ── Pattern 2: Fixed rgba() values ──
    # Match rgba() with numeric values (not containing ${} template expressions)
    def replace_rgba(m):
        nonlocal replacements
        full_match = m.group(0)
        rgba_str = full_match
        
        # Check if dynamic (contains ${)
        if '${' in full_match:
            return full_match
        
        normalized = normalize_rgba(rgba_str)
        var_name = lookup.get(normalized)
        if var_name:
            replacements += 1
            return f"var({var_name})"
        return full_match
    
    # Match rgba() calls (not in comments)
    lines_out = []
    for line in content.split('\n'):
        if should_skip_line(line):
            lines_out.append(line)
            continue
        
        # Replace rgba() values, but NOT in className strings
        if 'className' in line:
            lines_out.append(line)
            continue
        
        # Replace rgba() in style objects, string literals, etc.
        line = re.sub(
            r'rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)',
            replace_rgba,
            line
        )
        lines_out.append(line)
    
    content = '\n'.join(lines_out)
    
    if content != original:
        filepath.write_text(content)
    
    return replacements

# ────────────────────────────────────────────────────────────────
# 8.  MAIN
# ────────────────────────────────────────────────────────────────
def main():
    print("=== Design Token Migration — Final Pass ===")
    print()
    
    # Step 1: Build lookup table
    print("[1] Building lookup table...")
    lookup = build_lookup()
    print(f"    {len(lookup)} color → var mappings loaded")
    
    # Step 2: Add missing CSS variables
    print("\n[2] Adding missing CSS variables to globals.css...")
    add_missing_vars()
    
    # Step 3: Find and process all .tsx files in screens
    print("\n[3] Scanning screen files...")
    screen_files = sorted(SCREENS_DIR.rglob('*.tsx'))
    print(f"    Found {len(screen_files)} .tsx files")
    
    total_replacements = 0
    files_modified = 0
    
    for fp in screen_files:
        rel = fp.relative_to(PROJECT)
        count = replace_in_file(fp, lookup)
        if count > 0:
            total_replacements += count
            files_modified += 1
            print(f"    {rel}: {count} replacements")
    
    print(f"\n[4] Summary:")
    print(f"    Files modified: {files_modified}/{len(screen_files)}")
    print(f"    Total replacements: {total_replacements}")
    
    # Step 4: Verification
    print(f"\n[5] Verification — counting remaining hardcoded hex values...")
    remaining = 0
    for fp in screen_files:
        content = fp.read_text()
        for i, line in enumerate(content.split('\n'), 1):
            if should_skip_line(line):
                continue
            if 'className' in line:
                continue
            # Find hex patterns not inside var() fallbacks
            hexes = re.findall(r'#[0-9a-fA-F]{3,8}', line)
            for h in hexes:
                # Check it's not in a var() fallback
                h_idx = line.find(h)
                before = line[max(0, h_idx-30):h_idx]
                if 'var(' in before:
                    continue
                remaining += 1
                rel = fp.relative_to(PROJECT)
                print(f"    REMAINING: {rel}:{i}: {h}")
    
    # Also check remaining rgba() not in className/comments/dynamic
    remaining_rgba = 0
    for fp in screen_files:
        content = fp.read_text()
        for i, line in enumerate(content.split('\n'), 1):
            if should_skip_line(line):
                continue
            if 'className' in line:
                continue
            rgba_matches = re.findall(r'rgba\([^)]+\)', line)
            for rm in rgba_matches:
                if '${' in rm:
                    continue  # dynamic alpha, skip
                remaining_rgba += 1
                rel = fp.relative_to(PROJECT)
                print(f"    REMAINING RGBA: {rel}:{i}: {rm}")
    
    print(f"\n    Remaining hex values (non-fallback, non-className): {remaining}")
    print(f"    Remaining fixed rgba values (non-dynamic, non-className): {remaining_rgba}")
    print(f"    Total remaining: {remaining + remaining_rgba}")
    print()
    if remaining + remaining_rgba == 0:
        print("    ✅ All hardcoded colors have been migrated!")
    else:
        print("    ⚠️  Some colors remain — may need manual review")

if __name__ == '__main__':
    main()
