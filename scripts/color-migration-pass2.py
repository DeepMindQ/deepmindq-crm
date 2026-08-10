#!/usr/bin/env python3
"""
Phase 3A Task 3.1 — Second pass: Uppercase hex colors and inline style objects.
Handles colors that appear as uppercase hex (#D4AF37) and in className strings.
"""

import re
import os
import json

SRC_DIR = "/home/z/my-project/src"

# Uppercase hex → lowercase → token mapping
UPPER_HEX_MAP = {
    '#d4af37': 'tokens.gold.DEFAULT',
    '#e8c860': 'tokens.gold.light',
    '#b8860b': 'tokens.gold.dark',
    '#9a8340': 'tokens.gold.deep',
    '#d6bf79': 'tokens.gold.mutedLight',
    '#6b7280': 'tokens.trust.unverified.value',
    '#fbbf24': 'tokens.extended.amber.value',
    '#f87171': 'tokens.extended.rose.value',
    '#2563eb': 'tokens.accent.dim',
    '#1d4ed8': 'tokens.extended.blue.value',
    '#3b82f6': 'tokens.accent.DEFAULT',
    '#ef4444': 'tokens.domain.risk',
    '#f59e0b': 'tokens.domain.reasoning',
    '#10b981': 'tokens.extended.emerald.value',
    '#a855f7': 'tokens.domain.opportunity',
    '#a1a1aa': 'tokens.flat.borderGray',
    '#34d399': 'tokens.extended.emerald.value',  # close match
    '#dc2626': 'tokens.extended.red.value',
    '#9ca3af': 'tokens.neutral.400',
    '#8892a8': 'tokens.text.secondary',
    '#e8ecf4': 'tokens.text.primary',
    '#1e2535': 'tokens.border.default',
    '#22c55e': 'tokens.domain.action',
    '#14b8a6': 'tokens.trust.high.value',
    '#06b6d4': 'tokens.domain.enrichment',
    '#8b5cf6': 'tokens.extended.purple.value',
    '#7c3aed': 'tokens.extended.purpleDeep.value',
    '#6366f1': 'tokens.extended.indigo.value',
    '#0ea5e9': 'tokens.extended.sky.value',
    '#d97706': 'tokens.extended.amberDeep',
    '#991b1b': 'tokens.extended.redDark',
    '#f97316': 'tokens.trust.low.value',
    '#ea580c': 'tokens.extended.orange',
    '#16a34a': 'tokens.extended.greenDeep',
    '#ec4899': 'tokens.extended.pink',
    '#ca8a04': 'tokens.extended.yellowDeep',
    '#84cc16': 'tokens.extended.lime.value',
    '#a78bfa': 'tokens.extended.violet.value',
    '#71717a': 'tokens.flat.zinc',
    '#4b5563': 'tokens.neutral.600',
    '#374151': 'tokens.neutral.700',
    '#111827': 'tokens.neutral.900',
    '#f3f4f6': 'tokens.neutral.100',
    '#e5e7eb': 'tokens.neutral.200',
    '#5a6478': 'tokens.text.muted',
    '#60a5fa': 'tokens.accent.bright',
    '#1e40af': 'tokens.extended.blueDeep',
    '#4361ee': 'tokens.extended.blueBright.value',
    '#eab308': 'tokens.extended.amber.value',  # close
    '#c084fc': 'tokens.extended.violet.value',
    '#65a30d': 'tokens.extended.limeDark',
    '#a3e635': 'tokens.extended.limeBright',
    '#ffffff': 'tokens.flat.white',
    '#000000': 'tokens.flat.black',
    '#f9fafb': 'tokens.neutral.50',
    '#1f2937': 'tokens.neutral.800',
    '#818cf8': 'tokens.flat.skyBlue',
    '#bfdbfe': 'tokens.flat.lightBlue',
    '#0891b2': 'tokens.extended.cyanDark',
    '#22d3ee': 'tokens.extended.cyan.value',
    '#52525b': 'tokens.flat.zincDark',
    '#94a3b8': 'tokens.neutral.400',
    '#b8860b': 'tokens.gold.dark',
    '#b8941f': 'tokens.gold.dark',
    '#d4a843': 'tokens.gold.DEFAULT',
    '#b8962e': 'tokens.gold.dark',
    '#e8c84a': 'tokens.gold.light',
    '#f2c744': 'tokens.gold.light',
    '#c5a030': 'tokens.gold.DEFAULT',
    '#ef444440': 'tokens.domain.risk',  # with alpha hex suffix
    '#f59e0b15': 'tokens.domain.reasoning',  # with alpha hex suffix
    '#05966915': 'tokens.extended.emeraldDeep.value',
}


def should_skip_line(line):
    """Skip lines that should not be modified"""
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
        return True
    if 'import' in line and ('from' in line or "'" in line or '"' in line):
        return True
    return False


def replace_uppercase_hex(line):
    """Replace uppercase hex colors with token references"""
    hex_pattern = re.compile(r'#[0-9a-fA-F]{3,8}\b')
    
    for match in hex_pattern.findall(line):
        lower = match.lower()
        # Check 8-char hex with alpha suffix
        if len(lower) == 9:
            lower = lower[:7]
        if lower in UPPER_HEX_MAP:
            token = UPPER_HEX_MAP[lower]
            # Replace in string contexts
            line = line.replace(f"'{match}'", f"'{{{token}}}'")
            line = line.replace(f'"{match}"', f'"{{{token}}}"')
    
    return line


def main():
    stats = {'files_modified': 0, 'replacements': 0, 'files': []}
    
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')) and not fname.endswith(('.test.ts', '.test.tsx', '.config.ts')):
                if 'design-tokens.ts' in fname:
                    continue
                fpath = os.path.join(root, fname)
                
                with open(fpath, 'r', errors='replace') as f:
                    content = f.read()
                
                original = content
                lines = content.split('\n')
                new_lines = []
                file_count = 0
                
                for line in lines:
                    if should_skip_line(line):
                        new_lines.append(line)
                        continue
                    
                    new_line = replace_uppercase_hex(line)
                    if new_line != line:
                        file_count += 1
                    new_lines.append(new_line)
                
                new_content = '\n'.join(new_lines)
                if new_content != original:
                    with open(fpath, 'w') as f:
                        f.write(new_content)
                    stats['files_modified'] += 1
                    stats['replacements'] += file_count
                    stats['files'].append(os.path.relpath(fpath, SRC_DIR))
    
    print(f"=== Uppercase Migration Complete ===")
    print(f"Files modified: {stats['files_modified']}")
    print(f"Replacements:  {stats['replacements']}")
    
    if stats['files']:
        print(f"\nModified:")
        for f in stats['files']:
            print(f"  {f}")


if __name__ == '__main__':
    main()
