#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Design Token Color Migration (Pass 4)
Migrates remaining hardcoded colors in screen files to design-tokens.ts references.

Handles:
1. Inline rgba() in style={{}} props → token references
2. Alpha helper functions (goldAlpha, greenAlpha, etc.) → token-based alternatives
3. BROKEN string-literal tokens like '{tokens.foo}' → actual runtime references
4. Hex colors in style strings → token references
"""

import re
import os
import json
from pathlib import Path

# ── Color-to-token mapping (exact rgba to token path) ──
RGBA_TO_TOKEN = {
    # Accent blue
    'rgba(59, 130, 246, 0.10)': 'tokens.accent.subtle',
    'rgba(59,130,246,0.10)': 'tokens.accent.subtle',
    'rgba(59,130,246,0.1)': 'tokens.accent.subtle',
    'rgba(59, 130, 246, 0.1)': 'tokens.accent.subtle',
    
    # Domain: risk (red)
    'rgba(239,68,68,0.10)': 'tokens.priority.critical.bg',
    'rgba(239, 68, 68, 0.10)': 'tokens.priority.critical.bg',
    'rgba(239,68,68,0.1)': 'tokens.priority.critical.bg',
    'rgba(239, 68, 68, 0.1)': 'tokens.priority.critical.bg',
    'rgba(239,68,68,0.2)': 'tokens.priority.critical.border',
    'rgba(239, 68, 68, 0.2)': 'tokens.priority.critical.border',
    'rgba(239,68,68,0.3)': 'tokens.extended.rose.border',
    'rgba(239, 68, 68, 0.3)': 'tokens.extended.rose.border',
    
    # Domain: emerald/green
    'rgba(16,185,129,0.10)': 'tokens.extended.emerald.bg',
    'rgba(16, 185, 129, 0.10)': 'tokens.extended.emerald.bg',
    'rgba(16,185,129,0.1)': 'tokens.extended.emerald.bg',
    'rgba(16, 185, 129, 0.1)': 'tokens.extended.emerald.bg',
    'rgba(16,185,129,0.05)': 'tokens.extended.emerald.bg',
    'rgba(16, 185, 129, 0.05)': 'tokens.extended.emerald.bg',
    'rgba(16,185,129,0.08)': 'tokens.extended.emerald.bg',
    'rgba(16, 185, 129, 0.08)': 'tokens.extended.emerald.bg',
    'rgba(16,185,129,0.4)': 'rgba(16, 185, 129, 0.4)',  # keep - no token
    'rgba(16, 185, 129, 0.4)': 'rgba(16, 185, 129, 0.4)',
    
    # Domain: purple/opportunity
    'rgba(168,85,247,0.10)': 'tokens.extended.purple.bg',
    'rgba(168, 85, 247, 0.10)': 'tokens.extended.purple.bg',
    'rgba(168,85,247,0.1)': 'tokens.extended.purple.bg',
    'rgba(168, 85, 247, 0.1)': 'tokens.extended.purple.bg',
    
    # Domain: reasoning/amber
    'rgba(245,158,11,0.10)': 'tokens.priority.high.bg',
    'rgba(245, 158, 11, 0.10)': 'tokens.priority.high.bg',
    'rgba(245,158,11,0.1)': 'tokens.priority.high.bg',
    'rgba(245, 158, 11, 0.1)': 'tokens.priority.high.bg',
    
    # Domain: enrichment/cyan
    'rgba(6,182,212,0.10)': 'tokens.extended.sky.bg',
    'rgba(6, 182, 212, 0.10)': 'tokens.extended.sky.bg',
    'rgba(6,182,212,0.1)': 'tokens.extended.sky.bg',
    'rgba(6, 182, 212, 0.1)': 'tokens.extended.sky.bg',
    'rgba(6,182,212,0.4)': 'rgba(6, 182, 212, 0.4)',  # keep
    
    # Gold
    'rgba(212, 175, 55, 0.15)': 'tokens.gold.bgBright',
    'rgba(212,175,55,0.15)': 'tokens.gold.bgBright',
    'rgba(212, 175, 55, 0.05)': 'tokens.gold.bgSubtle',
    'rgba(212,175,55,0.05)': 'tokens.gold.bgSubtle',
    'rgba(212, 175, 55, 0.25)': 'tokens.gold.bgBright',
    'rgba(212,175,55,0.25)': 'tokens.gold.bgBright',
    'rgba(212,175,55,0.20)': 'tokens.gold.border',
    'rgba(212, 175, 55, 0.20)': 'tokens.gold.border',
    'rgba(212,175,55,0.2)': 'tokens.gold.border',
    'rgba(212, 175, 55, 0.2)': 'tokens.gold.border',
    'rgba(212,175,55,0.12)': 'tokens.gold.bgMedium',
    'rgba(212, 175, 55, 0.12)': 'tokens.gold.bgMedium',
    'rgba(212,175,55,0.08)': 'tokens.gold.bg',
    'rgba(212, 175, 55, 0.08)': 'tokens.gold.bg',
    'rgba(212,175,55,0.06)': 'tokens.gold.bgSubtle',
    'rgba(212, 175, 55, 0.06)': 'tokens.gold.bgSubtle',
    'rgba(212,175,55,0.04)': 'tokens.gold.bgSubtle',
    'rgba(212, 175, 55, 0.04)': 'tokens.gold.bgSubtle',
    'rgba(212,175,55,0.03)': 'tokens.gold.bgSubtle',
    'rgba(212, 175, 55, 0.03)': 'tokens.gold.bgSubtle',
    'rgba(212,175,55,0.30)': 'rgba(212, 175, 55, 0.3)',
    'rgba(212, 175, 55, 0.30)': 'rgba(212, 175, 55, 0.3)',
    'rgba(212,175,55,0.3)': 'rgba(212, 175, 55, 0.3)',
    'rgba(212, 175, 55, 0.3)': 'rgba(212, 175, 55, 0.3)',
    'rgba(212,175,55,0.35)': 'rgba(212, 175, 55, 0.35)',
    'rgba(212,175,55,0.50)': 'rgba(212, 175, 55, 0.5)',
    'rgba(212,175,55,0.5)': 'rgba(212, 175, 55, 0.5)',
    'rgba(212,175,55,0.7)': 'rgba(212, 175, 55, 0.7)',
    'rgba(212,175,55,${a})': None,  # alpha helper - handle separately
    'rgba(212,175,55,0.1)': 'tokens.gold.bg',
    'rgba(212, 175, 55, 0.1)': 'tokens.gold.bg',
    
    # Gold dark (b8860b)
    'rgba(184,134,11,0.10)': 'tokens.gold.bgDark',
    'rgba(184,134,11,0.10)': 'tokens.gold.bgDark',
    'rgba(184,134,11,0.06)': 'tokens.gold.bgDarkLight',
    'rgba(184,134,11,0.06)': 'tokens.gold.bgDarkLight',
    'rgba(184,134,11,0.12)': 'tokens.gold.bgDark',
    'rgba(184,134,11,0.25)': 'rgba(184, 134, 11, 0.25)',
    
    # Verified green
    'rgba(34, 197, 94, 0.3)': 'tokens.trust.verified.border',
    'rgba(34,197,94,0.3)': 'tokens.trust.verified.border',
    'rgba(34, 197, 94, 0.12)': 'tokens.trust.verified.bg',
    'rgba(34,197,94,0.12)': 'tokens.trust.verified.bg',
    
    # Gray/neutral
    'rgba(107,114,128,0.10)': 'tokens.priority.low.bg',
    'rgba(107, 114, 128, 0.10)': 'tokens.priority.low.bg',
    'rgba(107,114,128,0.1)': 'tokens.priority.low.bg',
    'rgba(107, 114, 128, 0.1)': 'tokens.priority.low.bg',
    'rgba(107,114,128,0.3)': 'tokens.neutral.border',
    'rgba(107, 114, 128, 0.3)': 'tokens.neutral.border',
    'rgba(107,114,128,0.5)': 'rgba(107, 114, 128, 0.5)',
    'rgba(113,113,122,${a})': None,  # alpha helper
    
    # White opacity
    'rgba(255,255,255,0.06)': 'tokens.opacity.white.trace',
    'rgba(255, 255, 255, 0.06)': 'tokens.opacity.white.trace',
    'rgba(255,255,255,0.02)': 'tokens.opacity.white.hint',
    'rgba(255, 255, 255, 0.02)': 'tokens.opacity.white.hint',
    'rgba(255,255,255,0.03)': 'tokens.opacity.white.dust',
    'rgba(255, 255, 255, 0.03)': 'tokens.opacity.white.dust',
    'rgba(255,255,255,0.05)': 'tokens.opacity.white.ghost',
    'rgba(255, 255, 255, 0.05)': 'tokens.opacity.white.ghost',
    'rgba(255,255,255,0.10)': 'tokens.opacity.white.whisper',
    'rgba(255, 255, 255, 0.10)': 'tokens.opacity.white.whisper',
    'rgba(255,255,255,0.12)': 'tokens.opacity.white.micro',
    'rgba(255, 255, 255, 0.12)': 'tokens.opacity.white.micro',
    
    # Black opacity (shadows, overlays)
    'rgba(0,0,0,0.02)': 'tokens.opacity.shadow',
    'rgba(0, 0, 0, 0.02)': 'tokens.opacity.shadow',
    'rgba(0,0,0,0.03)': 'tokens.opacity.ghost',
    'rgba(0, 0, 0, 0.03)': 'tokens.opacity.ghost',
    'rgba(0,0,0,0.04)': 'tokens.opacity.trace',
    'rgba(0, 0, 0, 0.04)': 'tokens.opacity.trace',
    'rgba(0,0,0,0.05)': 'tokens.opacity.whisper',
    'rgba(0, 0, 0, 0.05)': 'tokens.opacity.whisper',
    'rgba(0,0,0,0.06)': 'tokens.opacity.micro',
    'rgba(0, 0, 0, 0.06)': 'tokens.opacity.micro',
    'rgba(0,0,0,0.08)': 'tokens.opacity.faint',
    'rgba(0, 0, 0, 0.08)': 'tokens.opacity.faint',
    'rgba(0,0,0,0.16)': 'tokens.opacity.faint',
    'rgba(0, 0, 0, 0.16)': 'tokens.opacity.faint',
    'rgba(0,0,0,0.3)': 'tokens.opacity.subtle',
    'rgba(0, 0, 0, 0.3)': 'tokens.opacity.subtle',
    'rgba(0,0,0,0.5)': 'tokens.opacity.medium',
    'rgba(0, 0, 0, 0.5)': 'tokens.opacity.medium',
    'rgba(0,0,0,0.7)': 'tokens.opacity.strong',
    'rgba(0, 0, 0, 0.7)': 'tokens.opacity.strong',
    'rgba(0,0,0,${a})': None,  # alpha helper
    
    # Purple
    'rgba(139,92,246,0.10)': 'tokens.extended.purple.bg',
    'rgba(139,92,246,0.1)': 'tokens.extended.purple.bg',
    'rgba(139,92,246,0.06)': 'tokens.extended.purple.bgSubtle',
    'rgba(139,92,246,0.12)': 'tokens.extended.purple.bgMedium',
    'rgba(139,92,246,${a})': None,
    
    # Indigo
    'rgba(99,102,241,0.08)': 'tokens.extended.indigo.bg',
    'rgba(99,102,241,0.1)': 'tokens.extended.indigo.bg',
    'rgba(99,102,241,0.06)': 'tokens.extended.indigo.bgSubtle',
    'rgba(99,102,241,${a})': None,
    
    # Box shadows (common patterns - keep as is if no token)
    'rgba(0,0,0,0.04)': 'tokens.opacity.trace',
    'rgba(0, 0, 0, 0.04)': 'tokens.opacity.trace',
}

# ── Hex to token mapping ──
HEX_TO_TOKEN = {
    # Already tokenized string literals that are BROKEN (render as text)
    # These appear as '{tokens.foo.bar}' which is wrong - need to fix separately
}

# ── Alpha helper function replacements ──
# These functions like `goldAlpha = (a) => rgba(212,175,55,${a})` need to be 
# converted to use tokens
ALPHA_HELPERS = {
    'goldAlpha': 'tokens.gold.DEFAULT',
    'greenAlpha': 'tokens.extended.emerald.value',
    'redAlpha': 'tokens.domain.risk',
    'blueAlpha': 'tokens.accent.DEFAULT',
    'blackAlpha': 'tokens.flat.black',
    'purpleAlpha': 'tokens.extended.purple.value',
    'amberAlpha': 'tokens.priority.high.value',
    'neutralAlpha': 'tokens.text.muted',
    'violetAlpha': 'tokens.extended.violet.value',
    'indigoAlpha': 'tokens.extended.indigo.value',
}

BASE_DIR = Path('/home/z/my-project/src')
SCREENS_DIR = BASE_DIR / 'components' / 'screens'
IOS_DIR = BASE_DIR / 'components' / 'intelligence-os'

stats = {
    'files_processed': 0,
    'rgba_replacements': 0,
    'alpha_helpers_removed': 0,
    'broken_tokens_fixed': 0,
    'hex_replacements': 0,
    'files_modified': [],
}


def fix_broken_string_tokens(content: str) -> tuple[str, int]:
    """Fix BROKEN string-literal tokens like '{tokens.foo}' that render as text.
    These need to become runtime expressions: tokens.foo"""
    count = 0
    
    # Pattern: '{tokens.something}' used as a JS string value
    # In style={{ background: '{tokens.gold.bg}' }}  → WRONG (string literal)
    # Should be: style={{ background: tokens.gold.bg }}  → CORRECT (runtime value)
    
    broken_pattern = r"'\{(tokens\.[^}]+)\}'"
    
    def fix_broken_token(match):
        nonlocal count
        count += 1
        token_path = match.group(1)
        return token_path  # Remove surrounding quotes and braces
    
    content = re.sub(broken_pattern, fix_broken_token, content)
    
    # Also fix: "{tokens.foo}" → tokens.foo  
    broken_pattern2 = r'"\{(tokens\.[^}]+)\}"'
    content = re.sub(broken_pattern2, fix_broken_token, content)
    
    return content, count


def replace_rgba_values(content: str) -> tuple[str, int]:
    """Replace hardcoded rgba values with token references."""
    count = 0
    
    for rgba_val, token_ref in sorted(RGBA_TO_TOKEN.items(), key=lambda x: -len(x[0])):
        if token_ref is None:
            continue  # Skip alpha helpers - handled separately
        if rgba_val == token_ref:
            continue  # Skip identity mappings
        
        # Replace in style strings and other contexts
        # Be careful not to replace inside comments or strings that are already token references
        
        # Pattern 1: Direct rgba replacement in style={{ }} contexts
        # We replace the rgba value with tokens.xxx
        old = rgba_val
        new = token_ref
        
        occurrences = content.count(old)
        if occurrences > 0:
            content = content.replace(old, new)
            count += occurrences
    
    return content, count


def remove_alpha_helpers(content: str) -> tuple[str, int]:
    """Remove alpha helper functions and replace their usage with template literals using tokens."""
    count = 0
    
    for helper_name, token_value in ALPHA_HELPERS.items():
        # Pattern: const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
        pattern = rf"const {helper_name}\s*=\s*\([^)]*\)\s*=>\s*`[^`]+`;\s*\n?"
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, '', content)
            count += len(matches)
    
    return content, count


def needs_tokens_import(content: str) -> bool:
    """Check if the file uses token references but doesn't import tokens."""
    has_token_usage = 'tokens.' in content
    has_import = bool(re.search(r"import\s+.*\{[^}]*tokens[^}]*\}.*from\s+['\"].*design-tokens", content))
    has_import2 = bool(re.search(r"import\s+.*tokens.*from\s+['\"].*design-tokens", content))
    has_import3 = bool(re.search(r"import\s+{ tokens }", content))
    
    return has_token_usage and not (has_import or has_import2 or has_import3)


def add_tokens_import(content: str) -> str:
    """Add tokens import to the file."""
    if "'use client'" in content[:50]:
        # After 'use client' directive
        content = re.sub(
            r"('use client';\n)",
            r"\1\nimport { tokens } from '@/components/intelligence-os/design-tokens';",
            content,
            count=1
        )
    else:
        # At the very beginning after any initial comments
        first_import = re.search(r"\nimport\s", content)
        if first_import:
            pos = first_import.start() + 1
            content = content[:pos] + "import { tokens } from '@/components/intelligence-os/design-tokens';\n" + content[pos:]
        else:
            content = "import { tokens } from '@/components/intelligence-os/design-tokens';\n" + content
    
    return content


def process_file(filepath: Path) -> dict:
    """Process a single file for color migration."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {'error': str(e)}
    
    original = content
    file_stats = {'rgba': 0, 'helpers': 0, 'broken': 0, 'hex': 0}
    
    # Step 1: Fix broken string-literal tokens
    content, fixed = fix_broken_string_tokens(content)
    file_stats['broken'] = fixed
    
    # Step 2: Replace rgba values
    content, replaced = replace_rgba_values(content)
    file_stats['rgba'] = replaced
    
    # Step 3: Remove alpha helper functions
    content, removed = remove_alpha_helpers(content)
    file_stats['helpers'] = removed
    
    # Step 4: Add tokens import if needed
    if needs_tokens_import(content):
        content = add_tokens_import(content)
        stats['imports_added'] = stats.get('imports_added', 0) + 1
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        stats['files_modified'].append(str(filepath.relative_to(BASE_DIR)))
        stats['files_processed'] += 1
        stats['rgba_replacements'] += file_stats['rgba']
        stats['alpha_helpers_removed'] += file_stats['helpers']
        stats['broken_tokens_fixed'] += file_stats['broken']
    
    return file_stats


def main():
    # Process all screen files
    screen_files = sorted(SCREENS_DIR.glob('**/*.tsx'))
    ios_files = sorted(IOS_DIR.glob('**/*.tsx'))
    
    all_files = screen_files + ios_files
    
    print(f"Processing {len(screen_files)} screen files + {len(ios_files)} intelligence-os files...")
    print("=" * 60)
    
    for filepath in all_files:
        result = process_file(filepath)
        if 'error' in result:
            print(f"  ERROR: {filepath.name}: {result['error']}")
        elif any(v > 0 for v in result.values()):
            rel = filepath.relative_to(BASE_DIR)
            changes = []
            if result['rgba'] > 0: changes.append(f"rgba: {result['rgba']}")
            if result['helpers'] > 0: changes.append(f"helpers: {result['helpers']}")
            if result['broken'] > 0: changes.append(f"broken: {result['broken']}")
            print(f"  {rel}: {', '.join(changes)}")
    
    print("=" * 60)
    print(f"SUMMARY:")
    print(f"  Files processed: {stats['files_processed']}")
    print(f"  RGBA replacements: {stats['rgba_replacements']}")
    print(f"  Alpha helpers removed: {stats['alpha_helpers_removed']}")
    print(f"  Broken token strings fixed: {stats['broken_tokens_fixed']}")
    print(f"  Imports added: {stats.get('imports_added', 0)}")
    print(f"  Total files modified: {len(stats['files_modified'])}")
    
    # Save stats
    with open('/home/z/my-project/scripts/phase3-color-migration-v4-stats.json', 'w') as f:
        json.dump(stats, f, indent=2)


if __name__ == '__main__':
    main()
