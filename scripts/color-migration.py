#!/usr/bin/env python3
"""
Phase 3A Task 3.1 — Automated Color Migration Script
Replaces hardcoded hex/rgb colors with design token references in .tsx/.ts files.
Processes files in-place, preserving formatting.
"""

import re
import os
import json
from pathlib import Path
from collections import defaultdict

SRC_DIR = "/home/z/my-project/src"
SCRIPTS_DIR = "/home/z/my-project/scripts"

# ── Color-to-token mapping (built from expanded design-tokens.ts) ──
# Format: (normalized_color_string, token_reference)
# We normalize hex to lowercase, rgba to lowercase with normalized spacing

COLOR_TO_TOKEN = {}

def add_mapping(color_val, token_ref):
    """Add a color mapping, normalizing the key"""
    normalized = color_val.lower().strip()
    # Also add without spaces variant for rgba
    no_space = normalized.replace(' ', '')
    COLOR_TO_TOKEN[normalized] = token_ref
    COLOR_TO_TOKEN[no_space] = token_ref

# ── Surface tokens ──
add_mapping('#0a0c10', 'tokens.surface.base')
add_mapping('#0f1219', 'tokens.surface.secondary')
add_mapping('#141821', 'tokens.surface.card')
add_mapping('#1a1f2b', 'tokens.surface.cardHover')
add_mapping('#1e2433', 'tokens.surface.elevated')
add_mapping('rgba(10, 12, 16, 0.85)', 'tokens.surface.overlay')

# ── Surface extended ──
add_mapping('#0f1117', 'tokens.surfaceExtended.darkAlt')
add_mapping('#0f0f11', 'tokens.surfaceExtended.deepDark')
add_mapping('#12121e', 'tokens.surfaceExtended.panel')
add_mapping('#1a1a2e', 'tokens.surfaceExtended.mutedBg')
add_mapping('rgba(6, 9, 15, 0.88)', 'tokens.surfaceExtended.overlay')
add_mapping('rgba(8, 8, 22, 0.85)', 'tokens.surfaceExtended.overlayAlt')
add_mapping('rgba(15, 15, 26, 0.85)', 'tokens.surfaceExtended.overlayDeep')
add_mapping('rgba(30, 37, 53, 0.8)', 'tokens.surfaceExtended.backdrop')
add_mapping('rgba(17, 24, 39, 0.8)', 'tokens.surfaceExtended.backdropAlt')

# ── Border tokens ──
add_mapping('#1e2535', 'tokens.border.default')
add_mapping('#2a3348', 'tokens.border.hover')
add_mapping('rgba(42, 51, 72, 0.4)', 'tokens.border.subtle')
add_mapping('#3b82f6', 'tokens.accent.DEFAULT')
add_mapping('rgba(59,130,246,0.2)', 'tokens.accent.strong')  # spaces variant handled below
add_mapping('rgba(59, 130, 246, 0.2)', 'tokens.accent.strong')
add_mapping('rgba(59,130,246,0.1)', 'tokens.accent.subtle')
add_mapping('rgba(59, 130, 246, 0.1)', 'tokens.accent.subtle')
add_mapping('rgba(59, 130, 246, 0.25)', 'tokens.accent.strong')
add_mapping('rgba(59, 130, 246, 0.06)', 'tokens.accent.ghost')
add_mapping('rgba(59,130,246,0.12)', 'tokens.priority.medium.bg')  # close match
add_mapping('rgba(59, 130, 246, 0.12)', 'tokens.priority.medium.bg')

# ── Text tokens ──
add_mapping('#e8ecf4', 'tokens.text.primary')
add_mapping('#8892a8', 'tokens.text.secondary')
add_mapping('#5a6478', 'tokens.text.muted')
add_mapping('#0a0c10', 'tokens.text.inverse')
add_mapping('#93c5fd', 'tokens.text.accent')

# ── Accent tokens ──
add_mapping('#2563eb', 'tokens.accent.dim')
add_mapping('#60a5fa', 'tokens.accent.bright')
add_mapping('#1d4ed8', 'tokens.extended.blue.value')
add_mapping('#1e40af', 'tokens.extended.blueDeep')
add_mapping('#4361ee', 'tokens.extended.blueBright.value')
add_mapping('#0ea5e9', 'tokens.extended.sky.value')

# ── Domain tokens ──
add_mapping('#a855f7', 'tokens.domain.opportunity')
add_mapping('#ef4444', 'tokens.domain.risk')
add_mapping('#06b6d4', 'tokens.domain.enrichment')
add_mapping('#f59e0b', 'tokens.domain.reasoning')
add_mapping('#22c55e', 'tokens.domain.action')

# ── Gold tokens ──
add_mapping('#d4af37', 'tokens.gold.DEFAULT')
add_mapping('#e8c860', 'tokens.gold.light')
add_mapping('#b8860b', 'tokens.gold.dark')
add_mapping('#9a8340', 'tokens.gold.deep')
add_mapping('#d6bf79', 'tokens.gold.mutedLight')
add_mapping('#c5a030', 'tokens.gold.DEFAULT')  # close to gold
add_mapping('#b8960c', 'tokens.gold.dark')  # close
add_mapping('#b8941f', 'tokens.gold.dark')
add_mapping('#d4a843', 'tokens.gold.DEFAULT')
add_mapping('#e8c84a', 'tokens.gold.light')
add_mapping('#f2c744', 'tokens.gold.light')
add_mapping('rgba(212, 175, 55, 0.1)', 'tokens.gold.bg')
add_mapping('rgba(212,175,55,0.1)', 'tokens.gold.bg')
add_mapping('rgba(212, 175, 55, 0.12)', 'tokens.gold.bgMedium')
add_mapping('rgba(212,175,55,0.12)', 'tokens.gold.bgMedium')
add_mapping('rgba(212, 175, 55, 0.06)', 'tokens.gold.bgSubtle')
add_mapping('rgba(212,175,55,0.06)', 'tokens.gold.bgSubtle')
add_mapping('rgba(212, 175, 55, 0.3)', 'tokens.gold.border')
add_mapping('rgba(212,175,55,0.3)', 'tokens.gold.border')
add_mapping('rgba(212, 175, 55, 0.2)', 'tokens.gold.borderLight')
add_mapping('rgba(212,175,55,0.2)', 'tokens.gold.borderLight')
add_mapping('rgba(212, 175, 55, 0.15)', 'tokens.gold.borderFaint')
add_mapping('rgba(212,175,55,0.15)', 'tokens.gold.borderFaint')
add_mapping('rgba(212, 175, 55, 0.25)', 'tokens.gold.bgBright')
add_mapping('rgba(212,175,55,0.25)', 'tokens.gold.bgBright')
add_mapping('rgba(212, 175, 55, 0.4)', 'tokens.gold.bgStrong')
add_mapping('rgba(212,175,55,0.4)', 'tokens.gold.bgStrong')
add_mapping('rgba(184, 134, 11, 0.12)', 'tokens.gold.bgDark')
add_mapping('rgba(184,134,11,0.12)', 'tokens.gold.bgDark')
add_mapping('rgba(184, 134, 11, 0.10)', 'tokens.gold.bgDark')
add_mapping('rgba(184, 134, 11, 0.06)', 'tokens.gold.bgDarkLight')
add_mapping('rgba(184,134,11,0.06)', 'tokens.gold.bgDarkLight')
add_mapping('rgba(184, 134, 11, 0.25)', 'tokens.gold.borderLight')
add_mapping('rgba(184, 134, 11, 0.15)', 'tokens.gold.borderFaint')
add_mapping('rgba(184, 134, 11, 0.20)', 'tokens.gold.borderLight')
add_mapping('rgba(184, 134, 11, 0.3)', 'tokens.gold.border')

# ── Trust tokens ──
add_mapping('#14b8a6', 'tokens.trust.high.value')
add_mapping('#f97316', 'tokens.trust.low.value')
add_mapping('#6b7280', 'tokens.trust.unverified.value')
add_mapping('rgba(34, 197, 94, 0.12)', 'tokens.trust.verified.bg')
add_mapping('rgba(34,197,94,0.12)', 'tokens.trust.verified.bg')
add_mapping('rgba(34, 197, 94, 0.3)', 'tokens.trust.verified.border')
add_mapping('rgba(34,197,94,0.3)', 'tokens.trust.verified.border')
add_mapping('rgba(20, 184, 166, 0.12)', 'tokens.trust.high.bg')
add_mapping('rgba(20,184,166,0.12)', 'tokens.trust.high.bg')
add_mapping('rgba(20, 184, 166, 0.3)', 'tokens.trust.high.border')
add_mapping('rgba(20,184,166,0.3)', 'tokens.trust.high.border')
add_mapping('rgba(20, 184, 166, 0.1)', 'tokens.confidence.high.bg')
add_mapping('rgba(20,184,166,0.1)', 'tokens.confidence.high.bg')
add_mapping('rgba(20, 184, 166, 0.2)', 'tokens.confidence.high.border')
add_mapping('rgba(20,184,166,0.2)', 'tokens.confidence.high.border')
add_mapping('rgba(245, 158, 11, 0.12)', 'tokens.trust.medium.bg')
add_mapping('rgba(245,158,11,0.12)', 'tokens.trust.medium.bg')
add_mapping('rgba(245, 158, 11, 0.3)', 'tokens.trust.medium.border')
add_mapping('rgba(245,158,11,0.3)', 'tokens.trust.medium.border')
add_mapping('rgba(249, 115, 22, 0.12)', 'tokens.trust.low.bg')
add_mapping('rgba(249,115,22,0.12)', 'tokens.trust.low.bg')
add_mapping('rgba(249, 115, 22, 0.3)', 'tokens.trust.low.border')
add_mapping('rgba(249,115,22,0.3)', 'tokens.trust.low.border')
add_mapping('rgba(107, 114, 128, 0.12)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107,114,128,0.12)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107, 114, 128, 0.3)', 'tokens.trust.unverified.border')
add_mapping('rgba(107,114,128,0.3)', 'tokens.trust.unverified.border')

# ── Confidence tokens ──
add_mapping('rgba(239, 68, 68, 0.1)', 'tokens.confidence.low.bg')
add_mapping('rgba(239,68,68,0.1)', 'tokens.confidence.low.bg')
add_mapping('rgba(239, 68, 68, 0.2)', 'tokens.confidence.low.border')
add_mapping('rgba(239,68,68,0.2)', 'tokens.confidence.low.border')
add_mapping('rgba(245, 158, 11, 0.1)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245,158,11,0.1)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245, 158, 11, 0.2)', 'tokens.confidence.medium.border')
add_mapping('rgba(245,158,11,0.2)', 'tokens.confidence.medium.border')
add_mapping('rgba(239, 68, 68, 0.12)', 'tokens.priority.critical.bg')
add_mapping('rgba(239,68,68,0.12)', 'tokens.priority.critical.bg')

# ── Priority tokens ──
add_mapping('rgba(136, 146, 168, 0.1)', 'tokens.priority.low.bg')
add_mapping('rgba(136,146,168,0.1)', 'tokens.priority.low.bg')
add_mapping('rgba(136, 146, 168, 0.2)', 'tokens.priority.low.border')
add_mapping('rgba(136,146,168,0.2)', 'tokens.priority.low.border')

# ── Extended domain colors ──
add_mapping('#10b981', 'tokens.extended.emerald.value')
add_mapping('#059669', 'tokens.extended.emeraldDeep.value')
add_mapping('rgba(16, 185, 129, 0.1)', 'tokens.extended.emerald.bg')
add_mapping('rgba(16,185,129,0.1)', 'tokens.extended.emerald.bg')
add_mapping('rgba(16, 185, 129, 0.12)', 'tokens.extended.emerald.bgMedium')
add_mapping('rgba(16,185,129,0.12)', 'tokens.extended.emerald.bgMedium')
add_mapping('rgba(16, 185, 129, 0.2)', 'tokens.extended.emerald.border')
add_mapping('rgba(16,185,129,0.2)', 'tokens.extended.emerald.border')
add_mapping('rgba(5, 150, 105, 0.5)', 'tokens.extended.emerald.bgDark')
add_mapping('#8b5cf6', 'tokens.extended.purple.value')
add_mapping('#7c3aed', 'tokens.extended.purpleDeep.value')
add_mapping('rgba(139, 92, 246, 0.1)', 'tokens.extended.purple.bg')
add_mapping('rgba(139,92,246,0.1)', 'tokens.extended.purple.bg')
add_mapping('rgba(139, 92, 246, 0.12)', 'tokens.extended.purple.bgMedium')
add_mapping('rgba(139,92,246,0.12)', 'tokens.extended.purple.bgMedium')
add_mapping('rgba(139, 92, 246, 0.2)', 'tokens.extended.purple.border')
add_mapping('rgba(139,92,246,0.2)', 'tokens.extended.purple.border')
add_mapping('rgba(139, 92, 246, 0.06)', 'tokens.extended.purple.bgSubtle')
add_mapping('rgba(139,92,246,0.06)', 'tokens.extended.purple.bgSubtle')
add_mapping('rgba(139, 92, 246, 0.15)', 'tokens.extended.purple.bgFaint')
add_mapping('rgba(139,92,246,0.15)', 'tokens.extended.purple.bgFaint')
add_mapping('rgba(124, 58, 237, 0.1)', 'tokens.extended.purpleDeep.bg')
add_mapping('rgba(124,58,237,0.1)', 'tokens.extended.purpleDeep.bg')
add_mapping('#6366f1', 'tokens.extended.indigo.value')
add_mapping('rgba(99, 102, 241, 0.1)', 'tokens.extended.indigo.bg')
add_mapping('rgba(99,102,241,0.1)', 'tokens.extended.indigo.bg')
add_mapping('rgba(99, 102, 241, 0.06)', 'tokens.extended.indigo.bgSubtle')
add_mapping('rgba(99,102,241,0.06)', 'tokens.extended.indigo.bgSubtle')
add_mapping('#fbbf24', 'tokens.extended.amber.value')
add_mapping('#d97706', 'tokens.extended.amberDeep')
add_mapping('rgba(251, 191, 36, 0.1)', 'tokens.extended.amber.bg')
add_mapping('rgba(251,191,36,0.1)', 'tokens.extended.amber.bg')
add_mapping('#f87171', 'tokens.extended.rose.value')
add_mapping('#dc2626', 'tokens.extended.red.value')
add_mapping('#991b1b', 'tokens.extended.redDark')
add_mapping('#a78bfa', 'tokens.extended.violet.value')
add_mapping('#22d3ee', 'tokens.extended.cyan.value')
add_mapping('#0891b2', 'tokens.extended.cyanDark')
add_mapping('rgba(34, 211, 238, 0.1)', 'tokens.extended.cyan.bg')
add_mapping('rgba(34,211,238,0.1)', 'tokens.extended.cyan.bg')
add_mapping('#84cc16', 'tokens.extended.lime.value')
add_mapping('#a3e635', 'tokens.extended.limeBright')
add_mapping('#65a30d', 'tokens.extended.limeDark')
add_mapping('#16a34a', 'tokens.extended.greenDeep')
add_mapping('#ea580c', 'tokens.extended.orange')
add_mapping('#ca8a04', 'tokens.extended.yellowDeep')
add_mapping('#ec4899', 'tokens.extended.pink')
add_mapping('#c084fc', 'tokens.extended.violet.value')  # light violet

# ── Neutral scale ──
add_mapping('#f9fafb', 'tokens.neutral.50')
add_mapping('#f3f4f6', 'tokens.neutral.100')
add_mapping('#e5e7eb', 'tokens.neutral.200')
add_mapping('#d1d5db', 'tokens.neutral.300')
add_mapping('#9ca3af', 'tokens.neutral.400')
add_mapping('#6b7280', 'tokens.neutral.500')
add_mapping('#4b5563', 'tokens.neutral.600')
add_mapping('#374151', 'tokens.neutral.700')
add_mapping('#1f2937', 'tokens.neutral.800')
add_mapping('#111827', 'tokens.neutral.900')
add_mapping('rgba(161, 161, 170, 0.12)', 'tokens.neutral.bg')
add_mapping('rgba(161,161,170,0.12)', 'tokens.neutral.bg')
add_mapping('rgba(161, 161, 170, 0.2)', 'tokens.neutral.border')
add_mapping('rgba(161,161,170,0.2)', 'tokens.neutral.border')
add_mapping('#a1a1aa', 'tokens.flat.borderGray')
add_mapping('#71717a', 'tokens.flat.zinc')
add_mapping('#52525b', 'tokens.flat.zincDark')
add_mapping('#818cf8', 'tokens.flat.skyBlue')

# ── Flat colors ──
add_mapping('#ffffff', 'tokens.flat.white')
add_mapping('#fff', 'tokens.flat.white')
add_mapping('#000000', 'tokens.flat.black')
add_mapping('#000', 'tokens.flat.black')
add_mapping('#f8f9fa', 'tokens.flat.offWhite')
add_mapping('#f0f0f5', 'tokens.flat.warmWhite')
add_mapping('#f0eef5', 'tokens.flat.warmWhite')
add_mapping('#e4e4e7', 'tokens.flat.coolGray')
add_mapping('#a0a0b8', 'tokens.flat.slate')
add_mapping('#6b6b80', 'tokens.flat.mutedGray')
add_mapping('#666666', 'tokens.flat.dimGray')
add_mapping('#666', 'tokens.flat.dimGray')
add_mapping('#999999', 'tokens.flat.mediumGray')
add_mapping('#999', 'tokens.flat.mediumGray')
add_mapping('#cccccc', 'tokens.flat.lightGray')
add_mapping('#ccc', 'tokens.flat.lightGray')
add_mapping('#eeeeeee', 'tokens.flat.lighterGray')
add_mapping('#eee', 'tokens.flat.lighterGray')
add_mapping('#bfdbfe', 'tokens.flat.lightBlue')
add_mapping('#eff6ff', 'tokens.flat.softBlue')
add_mapping('#fef2f2', 'tokens.flat.lightRed')
add_mapping('#ecfdf5', 'tokens.flat.lightGreen')
add_mapping('#fef3c7', 'tokens.flat.lightAmber')
add_mapping('#fffdf5', 'tokens.flat.warmBg')
add_mapping('#fffbeb', 'tokens.flat.warmBgAlt')
add_mapping('#f8fafc', 'tokens.flat.coolBg')
add_mapping('#444', 'tokens.flat.dimGray')
add_mapping('#ddd', 'tokens.flat.lightGray')
add_mapping('#888', 'tokens.flat.mediumGray')
add_mapping('#333', 'tokens.flat.black')
add_mapping('#e2e8f0', 'tokens.neutral.200')
add_mapping('#94a3b8', 'tokens.neutral.400')
add_mapping('#e01e5a', 'tokens.extended.pink')

# ── Opacity tokens ──
add_mapping('rgba(0,0,0,0.7)', 'tokens.opacity.strong')
add_mapping('rgba(0, 0, 0, 0.7)', 'tokens.opacity.strong')
add_mapping('rgba(0,0,0,0.5)', 'tokens.opacity.medium')
add_mapping('rgba(0, 0, 0, 0.5)', 'tokens.opacity.medium')
add_mapping('rgba(0,0,0,0.3)', 'tokens.opacity.subtle')
add_mapping('rgba(0, 0, 0, 0.3)', 'tokens.opacity.subtle')
add_mapping('rgba(0,0,0,0.16)', 'tokens.opacity.faint')
add_mapping('rgba(0, 0, 0, 0.16)', 'tokens.opacity.faint')
add_mapping('rgba(0,0,0,0.35)', 'tokens.opacity.subtle')
add_mapping('rgba(0,0,0,0.4)', 'tokens.opacity.subtle')
add_mapping('rgba(0, 0, 0, 0.4)', 'tokens.opacity.subtle')
add_mapping('rgba(0,0,0,0.08)', 'tokens.opacity.micro')
add_mapping('rgba(0, 0, 0, 0.08)', 'tokens.opacity.micro')
add_mapping('rgba(0,0,0,0.06)', 'tokens.opacity.whisper')
add_mapping('rgba(0, 0, 0, 0.06)', 'tokens.opacity.whisper')
add_mapping('rgba(0,0,0,0.04)', 'tokens.opacity.trace')
add_mapping('rgba(0, 0, 0, 0.04)', 'tokens.opacity.trace')
add_mapping('rgba(0,0,0,0.02)', 'tokens.opacity.shadow')
add_mapping('rgba(0, 0, 0, 0.02)', 'tokens.opacity.shadow')
add_mapping('rgba(0,0,0,0.015)', 'tokens.opacity.ghost')
add_mapping('rgba(0, 0, 0, 0.015)', 'tokens.opacity.ghost')
add_mapping('rgba(0,0,0,0.12)', 'tokens.neutral.bg')  # close enough
add_mapping('rgba(0, 0, 0, 0.12)', 'tokens.neutral.bg')
add_mapping('rgba(0,0,0,0.15)', 'tokens.opacity.faint')
add_mapping('rgba(0, 0, 0, 0.15)', 'tokens.opacity.faint')
add_mapping('rgba(0,0,0,0.1)', 'tokens.opacity.whisper')
add_mapping('rgba(0, 0, 0, 0.1)', 'tokens.opacity.whisper')
add_mapping('rgba(0,0,0,0.05)', 'tokens.opacity.shadow')
add_mapping('rgba(0, 0, 0, 0.05)', 'tokens.opacity.shadow')
add_mapping('rgba(0,0,0,0.03)', 'tokens.opacity.trace')

# ── White opacity tokens ──
add_mapping('rgba(255,255,255,0.97)', 'tokens.opacity.white.strong')
add_mapping('rgba(255, 255, 255, 0.97)', 'tokens.opacity.white.strong')
add_mapping('rgba(255,255,255,0.85)', 'tokens.opacity.white.medium')
add_mapping('rgba(255, 255, 255, 0.85)', 'tokens.opacity.white.medium')
add_mapping('rgba(255,255,255,.85)', 'tokens.opacity.white.medium')
add_mapping('rgba(255,255,255,0.5)', 'tokens.opacity.white.subtle')
add_mapping('rgba(255, 255, 255, 0.5)', 'tokens.opacity.white.subtle')
add_mapping('rgba(255,255,255,0.2)', 'tokens.opacity.white.faint')
add_mapping('rgba(255, 255, 255, 0.2)', 'tokens.opacity.white.faint')
add_mapping('rgba(255,255,255,0.12)', 'tokens.opacity.white.micro')
add_mapping('rgba(255, 255, 255, 0.12)', 'tokens.opacity.white.micro')
add_mapping('rgba(255,255,255,0.1)', 'tokens.opacity.white.whisper')
add_mapping('rgba(255, 255, 255, 0.1)', 'tokens.opacity.white.whisper')
add_mapping('rgba(255,255,255,0.06)', 'tokens.opacity.white.trace')
add_mapping('rgba(255, 255, 255, 0.06)', 'tokens.opacity.white.trace')
add_mapping('rgba(255,255,255,0.05)', 'tokens.opacity.white.shadow')
add_mapping('rgba(255, 255, 255, 0.05)', 'tokens.opacity.white.shadow')
add_mapping('rgba(255,255,255,0.04)', 'tokens.opacity.white.ghost')
add_mapping('rgba(255, 255, 255, 0.04)', 'tokens.opacity.white.ghost')
add_mapping('rgba(255,255,255,0.03)', 'tokens.opacity.white.dust')
add_mapping('rgba(255, 255, 255, 0.03)', 'tokens.opacity.white.dust')
add_mapping('rgba(255,255,255,0.02)', 'tokens.opacity.white.hint')
add_mapping('rgba(255, 255, 255, 0.02)', 'tokens.opacity.white.hint')
add_mapping('rgba(255,255,255,0.4)', 'tokens.opacity.white.subtle')
add_mapping('rgba(255, 255, 255, 0.4)', 'tokens.opacity.white.subtle')

# ── Additional risk/alert rgba ──
add_mapping('rgba(239,68,68,0.15)', 'tokens.confidence.low.bg')
add_mapping('rgba(239, 68, 68, 0.15)', 'tokens.confidence.low.bg')
add_mapping('rgba(239,68,68,0.08)', 'tokens.priority.critical.bg')
add_mapping('rgba(239, 68, 68, 0.08)', 'tokens.priority.critical.bg')
add_mapping('rgba(239,68,68,0.05)', 'tokens.opacity.shadow')
add_mapping('rgba(239, 68, 68, 0.05)', 'tokens.opacity.shadow')
add_mapping('rgba(239,68,68,0.6)', 'tokens.domain.risk')
add_mapping('rgba(239, 68, 68, 0.6)', 'tokens.domain.risk')
add_mapping('rgba(239, 68, 68, 0.18)', 'tokens.confidence.low.border')
add_mapping('rgba(239,68,68,0.18)', 'tokens.confidence.low.border')
add_mapping('rgba(220, 38, 38, 0.1)', 'tokens.extended.red.bg')
add_mapping('rgba(220,38,38,0.1)', 'tokens.extended.red.bg')
add_mapping('rgba(248, 113, 113, 0.1)', 'tokens.extended.rose.bg')
add_mapping('rgba(248,113,113,0.1)', 'tokens.extended.rose.bg')

# ── Additional green rgba ──
add_mapping('rgba(34,197,94,0.1)', 'tokens.trust.verified.bg')
add_mapping('rgba(34, 197, 94, 0.1)', 'tokens.trust.verified.bg')
add_mapping('rgba(34,197,94,0.2)', 'tokens.trust.verified.border')
add_mapping('rgba(34, 197, 94, 0.2)', 'tokens.trust.verified.border')
add_mapping('rgba(34,197,94,0.25)', 'tokens.trust.verified.border')
add_mapping('rgba(34,197,94,0.08)', 'tokens.trust.verified.bg')
add_mapping('rgba(34, 197, 94, 0.08)', 'tokens.trust.verified.bg')
add_mapping('rgba(34,197,94,0.05)', 'tokens.opacity.shadow')
add_mapping('rgba(34,197,94,0.15)', 'tokens.trust.verified.bg')
add_mapping('rgba(34, 197, 94, 0.15)', 'tokens.trust.verified.bg')
add_mapping('rgba(16,185,129,0.4)', 'tokens.extended.emerald.border')
add_mapping('rgba(16, 185, 129, 0.4)', 'tokens.extended.emerald.border')
add_mapping('rgba(16,185,129,0.6)', 'tokens.extended.emerald.value')
add_mapping('rgba(16, 185, 129, 0.6)', 'tokens.extended.emerald.value')

# ── Purple / opportunity rgba ──
add_mapping('rgba(168,85,247,0.1)', 'tokens.domain.opportunity')  # bg approx
add_mapping('rgba(168, 85, 247, 0.1)', 'tokens.domain.opportunity')
add_mapping('rgba(168,85,247,0.2)', 'tokens.domain.opportunity')
add_mapping('rgba(168, 85, 247, 0.2)', 'tokens.domain.opportunity')
add_mapping('rgba(168,85,247,0.3)', 'tokens.domain.opportunity')
add_mapping('rgba(168, 85, 247, 0.3)', 'tokens.domain.opportunity')

# ── Cyan / enrichment rgba ──
add_mapping('rgba(6,182,212,0.1)', 'tokens.domain.enrichment')
add_mapping('rgba(6, 182, 212, 0.1)', 'tokens.domain.enrichment')
add_mapping('rgba(6,182,212,0.2)', 'tokens.domain.enrichment')
add_mapping('rgba(6, 182, 212, 0.2)', 'tokens.domain.enrichment')
add_mapping('rgba(6,182,212,0.3)', 'tokens.domain.enrichment')
add_mapping('rgba(6, 182, 212, 0.3)', 'tokens.domain.enrichment')
add_mapping('rgba(6, 182, 212, 0.06)', 'tokens.accent.ghost')
add_mapping('rgba(6, 182, 212, 0.06)', 'tokens.accent.ghost')
add_mapping('rgba(6, 182, 212, 0.08)', 'tokens.accent.ghost')
add_mapping('rgba(6, 182, 212, 0.08)', 'tokens.accent.ghost')
add_mapping('rgba(6, 182, 212, 0.15)', 'tokens.domain.enrichment')
add_mapping('rgba(6, 182, 212, 0.15)', 'tokens.domain.enrichment')
add_mapping('rgba(139, 92, 246, 0.8)', 'tokens.extended.purple.value')
add_mapping('rgba(20,184,166,0.4)', 'tokens.trust.high.border')
add_mapping('rgba(20, 184, 166, 0)', 'tokens.surface.base')

# ── Additional amber/reasoning rgba ──
add_mapping('rgba(245,158,11,0.08)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245, 158, 11, 0.08)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245,158,11,0.15)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245, 158, 11, 0.15)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245,158,11,0.6)', 'tokens.domain.reasoning')
add_mapping('rgba(245, 158, 11, 0.6)', 'tokens.domain.reasoning')
add_mapping('rgba(245, 158, 11, 0.18)', 'tokens.confidence.medium.border')
add_mapping('rgba(245,158,11,0.18)', 'tokens.confidence.medium.border')
add_mapping('rgba(245, 158, 11, 0.06)', 'tokens.confidence.medium.bg')
add_mapping('rgba(245,158,11,0.06)', 'tokens.confidence.medium.bg')

# ── Additional blue/accent rgba ──
add_mapping('rgba(59,130,246,0.15)', 'tokens.accent.subtle')
add_mapping('rgba(59, 130, 246, 0.15)', 'tokens.accent.subtle')
add_mapping('rgba(59,130,246,0.08)', 'tokens.accent.ghost')
add_mapping('rgba(59, 130, 246, 0.08)', 'tokens.accent.ghost')
add_mapping('rgba(59,130,246,0.3)', 'tokens.accent.strong')
add_mapping('rgba(59, 130, 246, 0.3)', 'tokens.accent.strong')
add_mapping('rgba(59, 130, 246, 0.18)', 'tokens.accent.strong')
add_mapping('rgba(59,130,246,0.18)', 'tokens.accent.strong')

# ── Additional orange rgba ──
add_mapping('rgba(249,115,22,0.15)', 'tokens.trust.low.bg')
add_mapping('rgba(249, 115, 22, 0.15)', 'tokens.trust.low.bg')
add_mapping('rgba(249,115,22,0.1)', 'tokens.trust.low.bg')
add_mapping('rgba(249, 115, 22, 0.1)', 'tokens.trust.low.bg')
add_mapping('rgba(249,115,22,0.2)', 'tokens.trust.low.border')
add_mapping('rgba(249, 115, 22, 0.2)', 'tokens.trust.low.border')
add_mapping('rgba(255, 107, 53, 0.25)', 'tokens.trust.low.border')
add_mapping('rgba(255, 107, 53, 0.08)', 'tokens.trust.low.bg')
add_mapping('rgba(255, 107, 53, 0.8)', 'tokens.extended.orange')

# ── Additional gray/neutral rgba ──
add_mapping('rgba(136,146,168,0.08)', 'tokens.opacity.trace')
add_mapping('rgba(136, 146, 168, 0.08)', 'tokens.opacity.trace')
add_mapping('rgba(136,146,168,0.15)', 'tokens.opacity.whisper')
add_mapping('rgba(136, 146, 168, 0.15)', 'tokens.opacity.whisper')
add_mapping('rgba(136,146,168,0.18)', 'tokens.opacity.micro')
add_mapping('rgba(136, 146, 168, 0.18)', 'tokens.opacity.micro')
add_mapping('rgba(136,146,168,0.3)', 'tokens.priority.low.border')
add_mapping('rgba(136, 146, 168, 0.3)', 'tokens.priority.low.border')
add_mapping('rgba(113, 113, 122, 0.12)', 'tokens.neutral.bg')
add_mapping('rgba(113,113,122,0.12)', 'tokens.neutral.bg')
add_mapping('rgba(113, 113, 122, 0.2)', 'tokens.neutral.border')
add_mapping('rgba(113,113,122,0.2)', 'tokens.neutral.border')
add_mapping('rgba(107,114,128,0.1)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107, 114, 128, 0.1)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107,114,128,0.25)', 'tokens.trust.unverified.border')
add_mapping('rgba(107, 114, 128, 0.25)', 'tokens.trust.unverified.border')
add_mapping('rgba(107,114,128,0.15)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107, 114, 128, 0.15)', 'tokens.trust.unverified.bg')
add_mapping('rgba(107,114,128,0.5)', 'tokens.opacity.medium')
add_mapping('rgba(100, 116, 139, 0.3)', 'tokens.neutral.border')
add_mapping('rgba(100, 116, 139, 0.5)', 'tokens.opacity.medium')
add_mapping('rgba(42,51,72,0.5)', 'tokens.border.hover')

# ── Additional extended rgba ──
add_mapping('rgba(251, 191, 36, 0.1)', 'tokens.extended.amber.bg')
add_mapping('rgba(251,191,36,0.1)', 'tokens.extended.amber.bg')
add_mapping('rgba(234,179,8,0.1)', 'tokens.extended.amber.bg')
add_mapping('rgba(234, 179, 8, 0.1)', 'tokens.extended.amber.bg')
add_mapping('rgba(234,179,8,0.25)', 'tokens.extended.amber.bg')
add_mapping('rgba(234,179,8,0.12)', 'tokens.extended.amber.bg')
add_mapping('rgba(234,179,8,0.3)', 'tokens.extended.amber.border')
add_mapping('rgba(249,115,22,0.25)', 'tokens.trust.low.border')
add_mapping('rgba(37, 99, 235, 0.3)', 'tokens.accent.strong')
add_mapping('rgba(37, 99, 235, 0.12)', 'tokens.accent.subtle')
add_mapping('rgba(37,99,235,0.04)', 'tokens.accent.ghost')
add_mapping('rgba(139, 149, 173, 0.1)', 'tokens.neutral.bg')

# ── rgb() format (modern) ──
add_mapping('rgb(52 211 153)', 'tokens.extended.emerald.value')
add_mapping('rgb(251 191 36)', 'tokens.extended.amber.value')
add_mapping('rgb(248 113 113)', 'tokens.extended.rose.value')

# ── Dynamic/template rgba patterns that cannot be auto-migrated ──
# These contain ${...} template expressions and must be handled manually
DYNAMIC_PATTERNS = [
    'rgba(212,175,55,${', 'rgba(16,185,129,${', 'rgba(239,68,68,${',
    'rgba(59,130,246,${', 'rgba(0,0,0,${', 'rgba(168,85,247,${',
    'rgba(245,158,11,${', 'rgba(113,113,122,${', 'rgba(139,92,246,${',
    'rgba(99,102,241,${', 'rgba(212, 175, 55, ${', 'rgba(212,175,55,${',
]


def should_skip_line(line):
    """Skip import lines, comment-only lines, and lines already using tokens"""
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*'):
        return True
    if 'import' in line and ('from' in line or "'" in line or '"' in line):
        return True
    # Skip if line already references tokens
    if 'tokens.' in line:
        return True
    return False


def replace_color_in_line(line, color_pattern, token_ref):
    """Replace a color in a line with token reference"""
    # Match in style={{ color: '#xxx' }} or style={{ background: '#xxx' }}
    # or className strings containing the color
    # or standalone color assignments
    
    # Build regex that matches the exact color value
    # Escape special chars for regex
    escaped = re.escape(color_pattern)
    
    # Match in string context: '#xxx' or "xxx"
    patterns = [
        # Inside style strings: color: '#xxx'
        (rf"'{escaped}'", f"'{{{{{token_ref}}}}}'"),
        # Inside style strings: color: "#xxx"
        (rf'"{escaped}"', f'"{{{{{token_ref}}}}}"'),
    ]
    
    result = line
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result)
    
    return result


def migrate_file(filepath, stats):
    """Migrate a single file, replacing hardcoded colors with token references"""
    with open(filepath, 'r', errors='replace') as f:
        content = f.read()
    
    original_content = content
    lines = content.split('\n')
    new_lines = []
    file_replacements = 0
    
    for line in lines:
        if should_skip_line(line):
            new_lines.append(line)
            continue
        
        new_line = line
        replaced_in_line = False
        
        # Check for dynamic patterns
        has_dynamic = any(dp in line for dp in DYNAMIC_PATTERNS)
        if has_dynamic:
            new_lines.append(line)
            continue
        
        # Try to replace each known color in this line
        for color_val, token_ref in COLOR_TO_TOKEN.items():
            if color_val in new_line:
                new_line = new_line.replace(f"'{color_val}'", f"'{{{token_ref}}}'")
                new_line = new_line.replace(f'"{color_val}"', f'"{{{token_ref}}}"')
                if new_line != line:
                    replaced_in_line = True
                    file_replacements += 1
                    stats['replacements'] += 1
        
        new_lines.append(new_line)
    
    new_content = '\n'.join(new_lines)
    
    if new_content != original_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        stats['files_modified'] += 1
        stats['file_list'].append(filepath)
        return file_replacements
    
    return 0


def needs_token_import(content):
    """Check if file uses color tokens but might not import them"""
    if 'tokens.' in content:
        return True
    return False


def has_token_import(content):
    """Check if file already imports tokens"""
    return 'design-tokens' in content or 'from' in content and 'tokens' in content


def add_token_import(filepath):
    """Add tokens import if needed"""
    with open(filepath, 'r', errors='replace') as f:
        content = f.read()
    
    if 'design-tokens' in content:
        return False  # Already imports it
    
    # Add import at the top after existing imports
    import_line = "import { tokens } from '@/components/intelligence-os/design-tokens';\n"
    
    # Find the last import line
    lines = content.split('\n')
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    
    lines.insert(last_import_idx + 1, import_line)
    
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))
    
    return True


def main():
    print("=== Phase 3A Task 3.1: Automated Color Migration ===\n")
    
    stats = {
        'files_scanned': 0,
        'files_modified': 0,
        'replacements': 0,
        'imports_added': 0,
        'file_list': [],
    }
    
    # Collect all .tsx/.ts files (excluding test files, node_modules, design-tokens.ts itself)
    files_to_migrate = []
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')) and not fname.endswith(('.test.ts', '.test.tsx', '.config.ts')):
                fpath = os.path.join(root, fname)
                # Skip the design tokens file itself
                if 'design-tokens.ts' in fpath:
                    continue
                files_to_migrate.append(fpath)
    
    print(f"Scanning {len(files_to_migrate)} files for migration...\n")
    
    for fpath in files_to_migrate:
        stats['files_scanned'] += 1
        replacements = migrate_file(fpath, stats)
        if replacements > 0:
            rel_path = os.path.relpath(fpath, SRC_DIR)
            # Check if we need to add token import
            with open(fpath, 'r') as f:
                content = f.read()
            if needs_token_import(content) and not has_token_import(content):
                if add_token_import(fpath):
                    stats['imports_added'] += 1
    
    print(f"=== MIGRATION COMPLETE ===")
    print(f"Files scanned:    {stats['files_scanned']}")
    print(f"Files modified:   {stats['files_modified']}")
    print(f"Imports added:    {stats['imports_added']}")
    print(f"Replacements:     {stats['replacements']}")
    
    if stats['file_list']:
        print(f"\nModified files:")
        for f in stats['file_list']:
            print(f"  {os.path.relpath(f, SRC_DIR)}")
    
    # Save stats
    stats['file_list'] = [os.path.relpath(f, SRC_DIR) for f in stats['file_list']]
    with open(os.path.join(SCRIPTS_DIR, 'color-migration-stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\nStats saved to {os.path.join(SCRIPTS_DIR, 'color-migration-stats.json')}")


if __name__ == '__main__':
    main()
