#!/usr/bin/env python3
"""
Phase 3A Task 3.1 — Third pass: Handle complex contexts.
- linear-gradient strings
- Template literals with backtick strings
- 3-char hex (#fff, #000)
- Remaining edge cases
"""

import re
import os

SRC_DIR = "/home/z/my-project/src"

# Simple color-to-token map for direct replacements in complex contexts
SIMPLE_MAP = {
    '#d4af37': 'tokens.gold.DEFAULT',
    '#e8c860': 'tokens.gold.light',
    '#b8860b': 'tokens.gold.dark',
    '#9a8340': 'tokens.gold.deep',
    '#2563eb': 'tokens.accent.dim',
    '#1d4ed8': 'tokens.extended.blue.value',
    '#a1a1aa': 'tokens.flat.borderGray',
    '#e2e8f0': 'tokens.neutral.200',
    '#9333ea': 'tokens.extended.purpleDeep.value',
    '#0284c7': 'tokens.extended.sky.value',
    '#0f1117': 'tokens.surfaceExtended.darkAlt',
    '#3b82f6': 'tokens.accent.DEFAULT',
    '#fff': 'tokens.flat.white',
    '#fffdf5': 'tokens.flat.warmBg',
    '#fffbeb': 'tokens.flat.warmBgAlt',
    '#7f1d1d': 'tokens.extended.redDark',
    '#b8960c': 'tokens.gold.dark',
    '#b8941f': 'tokens.gold.dark',
    '#acc': 'tokens.flat.lightGray',
    '#e5e7eb': 'tokens.neutral.200',
    '#000': 'tokens.flat.black',
    '#ffffff': 'tokens.flat.white',
}


def should_skip_line(line):
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
        return True
    if 'import' in line and ('from' in line or "'" in line or '"' in line):
        return True
    if 'tokens.' in line and '{tokens.' not in line:
        return True
    return False


def process_file(filepath):
    """Process file and return replacement count"""
    with open(filepath, 'r', errors='replace') as f:
        content = f.read()
    
    original = content
    count = 0
    
    for hex_color, token_ref in SIMPLE_MAP.items():
        # Handle in regular strings (single and double quotes)
        # But preserve the string context
        for variant in [hex_color, hex_color.upper()]:
            # In style strings with linear-gradient or other CSS functions
            content = content.replace(f"'{variant}'", f"'{{{token_ref}}}'")
            content = content.replace(f'"{variant}"', f'"{{{token_ref}}}"')
    
    new_content = content
    if new_content != original:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return len(original) - len(new_content) > 0
    
    return 0


def main():
    modified = 0
    replacements = 0
    
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')) and not fname.endswith(('.test.ts', '.test.tsx', '.config.ts')):
                if 'design-tokens.ts' in fname:
                    continue
                fpath = os.path.join(root, fname)
                with open(fpath, 'r', errors='replace') as f:
                    content = f.read()
                
                # Only process files that still have uppercase hex
                has_upper = bool(re.search(r'#[0-9A-F]{3,8}', content))
                has_short = bool(re.search(r'#[0-9a-fA-F]{3}(?![0-9a-fA-F])', content))
                
                if has_upper or has_short:
                    if process_file(fpath):
                        modified += 1
                        replacements += 1
    
    print(f"=== Pass 3 Complete ===")
    print(f"Files modified: {modified}")


if __name__ == '__main__':
    main()
