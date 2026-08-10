#!/usr/bin/env python3
"""
Phase 3A Task 3.1 — Pass 3b: Handle uppercase hex in complex string contexts.
Replaces uppercase hex colors inside linear-gradient, template literals, etc.
"""

import re
import os

SRC_DIR = "/home/z/my-project/src"

HEX_TOKEN_MAP = {
    '#D4AF37': 'tokens.gold.DEFAULT',
    '#d4af37': 'tokens.gold.DEFAULT',
    '#E8C860': 'tokens.gold.light',
    '#e8c860': 'tokens.gold.light',
    '#B8860B': 'tokens.gold.dark',
    '#b8860b': 'tokens.gold.dark',
    '#9A8340': 'tokens.gold.deep',
    '#9a8340': 'tokens.gold.deep',
    '#D6BF79': 'tokens.gold.mutedLight',
    '#d6bf79': 'tokens.gold.mutedLight',
    '#2563EB': 'tokens.accent.dim',
    '#2563eb': 'tokens.accent.dim',
    '#1D4ED8': 'tokens.extended.blue.value',
    '#1d4ed8': 'tokens.extended.blue.value',
    '#A1A1AA': 'tokens.flat.borderGray',
    '#a1a1aa': 'tokens.flat.borderGray',
    '#E2E8F0': 'tokens.neutral.200',
    '#e2e8f0': 'tokens.neutral.200',
    '#9333EA': 'tokens.extended.purpleDeep.value',
    '#9333ea': 'tokens.extended.purpleDeep.value',
    '#0284C7': 'tokens.extended.sky.value',
    '#0284c7': 'tokens.extended.sky.value',
    '#0F1117': 'tokens.surfaceExtended.darkAlt',
    '#0f1117': 'tokens.surfaceExtended.darkAlt',
    '#3B82F6': 'tokens.accent.DEFAULT',
    '#FFFDF5': 'tokens.flat.warmBg',
    '#FFFDF5': 'tokens.flat.warmBg',
    '#FFFBEB': 'tokens.flat.warmBgAlt',
    '#FFFBEB': 'tokens.flat.warmBgAlt',
    '#7F1D1D': 'tokens.extended.redDark',
    '#7f1d1d': 'tokens.extended.redDark',
    '#B8960C': 'tokens.gold.dark',
    '#b8960c': 'tokens.gold.dark',
    '#B8941F': 'tokens.gold.dark',
    '#b8941f': 'tokens.gold.dark',
    '#E5E7EB': 'tokens.neutral.200',
    '#e5e7eb': 'tokens.neutral.200',
    '#FFF': 'tokens.flat.white',
    '#fff': 'tokens.flat.white',
    '#000': 'tokens.flat.black',
    '#FFFFFF': 'tokens.flat.white',
    '#ffffff': 'tokens.flat.white',
    '#F59E0B': 'tokens.domain.reasoning',
    '#f59e0b': 'tokens.domain.reasoning',
    '#EF4444': 'tokens.domain.risk',
    '#ef4444': 'tokens.domain.risk',
    '#10B981': 'tokens.extended.emerald.value',
    '#10b981': 'tokens.extended.emerald.value',
    '#A855F7': 'tokens.domain.opportunity',
    '#a855f7': 'tokens.domain.opportunity',
    '#6B7280': 'tokens.trust.unverified.value',
    '#6b7280': 'tokens.trust.unverified.value',
    '#FBBF24': 'tokens.extended.amber.value',
    '#fbbf24': 'tokens.extended.amber.value',
    '#F87171': 'tokens.extended.rose.value',
    '#f87171': 'tokens.extended.rose.value',
    '#34D399': 'tokens.extended.emerald.value',
    '#34d399': 'tokens.extended.emerald.value',
    '#DC2626': 'tokens.extended.red.value',
    '#dc2626': 'tokens.extended.red.value',
    '#9CA3AF': 'tokens.neutral.400',
    '#9ca3af': 'tokens.neutral.400',
    '#8892A8': 'tokens.text.secondary',
    '#8892a8': 'tokens.text.secondary',
    '#E8ECF4': 'tokens.text.primary',
    '#e8ecf4': 'tokens.text.primary',
    '#1E2535': 'tokens.border.default',
    '#1e2535': 'tokens.border.default',
    '#22C55E': 'tokens.domain.action',
    '#22c55e': 'tokens.domain.action',
    '#14B8A6': 'tokens.trust.high.value',
    '#14b8a6': 'tokens.trust.high.value',
    '#06B6D4': 'tokens.domain.enrichment',
    '#06b6d4': 'tokens.domain.enrichment',
    '#8B5CF6': 'tokens.extended.purple.value',
    '#8b5cf6': 'tokens.extended.purple.value',
    '#7C3AED': 'tokens.extended.purpleDeep.value',
    '#7c3aed': 'tokens.extended.purpleDeep.value',
    '#6366F1': 'tokens.extended.indigo.value',
    '#6366f1': 'tokens.extended.indigo.value',
    '#D97706': 'tokens.extended.amberDeep',
    '#d97706': 'tokens.extended.amberDeep',
    '#F97316': 'tokens.trust.low.value',
    '#f97316': 'tokens.trust.low.value',
    '#EA580C': 'tokens.extended.orange',
    '#ea580c': 'tokens.extended.orange',
    '#16A34A': 'tokens.extended.greenDeep',
    '#16a34a': 'tokens.extended.greenDeep',
    '#EC4899': 'tokens.extended.pink',
    '#ec4899': 'tokens.extended.pink',
    '#CA8A04': 'tokens.extended.yellowDeep',
    '#ca8a04': 'tokens.extended.yellowDeep',
    '#84CC16': 'tokens.extended.lime.value',
    '#84cc16': 'tokens.extended.lime.value',
    '#A78BFA': 'tokens.extended.violet.value',
    '#a78bfa': 'tokens.extended.violet.value',
    '#C084FC': 'tokens.extended.violet.value',
    '#c084fc': 'tokens.extended.violet.value',
    '#71717A': 'tokens.flat.zinc',
    '#71717a': 'tokens.flat.zinc',
    '#4B5563': 'tokens.neutral.600',
    '#4b5563': 'tokens.neutral.600',
    '#374151': 'tokens.neutral.700',
    '#374151': 'tokens.neutral.700',
    '#111827': 'tokens.neutral.900',
    '#111827': 'tokens.neutral.900',
    '#F3F4F6': 'tokens.neutral.100',
    '#f3f4f6': 'tokens.neutral.100',
    '#E5E7EB': 'tokens.neutral.200',
    '#5A6478': 'tokens.text.muted',
    '#5a6478': 'tokens.text.muted',
    '#60A5FA': 'tokens.accent.bright',
    '#60a5fa': 'tokens.accent.bright',
    '#1E40AF': 'tokens.extended.blueDeep',
    '#1e40af': 'tokens.extended.blueDeep',
    '#4361EE': 'tokens.extended.blueBright.value',
    '#4361ee': 'tokens.extended.blueBright.value',
    '#ACC': 'tokens.flat.lightGray',
    '#acc': 'tokens.flat.lightGray',
}


def process_file(filepath):
    with open(filepath, 'r', errors='replace') as f:
        content = f.read()
    
    original = content
    
    # Replace all known hex colors in any string context
    for hex_color, token_ref in sorted(HEX_TOKEN_MAP.items(), key=lambda x: -len(x[0])):
        # Replace in single-quote strings
        content = content.replace(hex_color, f'{{{token_ref}}}')
    
    # But we need to NOT break ${} template expressions
    # The replacement above is safe because hex colors don't contain $
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False


def main():
    modified = 0
    
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')) and not fname.endswith(('.test.ts', '.test.tsx', '.config.ts')):
                if 'design-tokens.ts' in fname:
                    continue
                fpath = os.path.join(root, fname)
                
                with open(fpath, 'r', errors='replace') as f:
                    content = f.read()
                
                # Only process files that still have raw hex colors
                if re.search(r'#[0-9A-F]{3,8}(?![}\w])', content) or re.search(r'#[0-9a-f]{3}(?![0-9a-fA-F])', content):
                    if process_file(fpath):
                        modified += 1
                        print(f"  Modified: {os.path.relpath(fpath, SRC_DIR)}")
    
    print(f"\n=== Pass 3b Complete ===")
    print(f"Files modified: {modified}")


if __name__ == '__main__':
    main()
