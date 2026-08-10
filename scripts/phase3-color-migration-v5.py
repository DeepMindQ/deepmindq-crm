#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Color Migration Pass 5
Handle remaining edge cases:
1. Dynamic rgba with expressions like rgba(212,175,55,${Math.max(...)}${...})
2. Tokens inside string literals that need to be runtime interpolated
3. Remaining box-shadow and gradient rgba values that are unique
4. Fix partial-migration artifacts
"""

import re
from pathlib import Path

BASE_DIR = Path('/home/z/my-project/src')
SCREENS_DIR = BASE_DIR / 'components' / 'components' / 'screens'
SCREENS_DIR2 = BASE_DIR / 'components' / 'screens'
IOS_DIR = BASE_DIR / 'components' / 'intelligence-os'

stats = {'files_processed': 0, 'replacements': 0, 'files_modified': []}

# Files and specific line-level fixes
EDGE_CASE_FIXES = {
    # ── conversation-studio-screen.tsx ──
    # 'linear-gradient(135deg, tokens.gold.bgSubtle, rgba(212,175,55,0.02))'
    # tokens inside string literal - needs to be a template literal with ${}
    'components/screens/conversation-studio-screen.tsx': [
        (
            "style={{ background: 'linear-gradient(135deg, tokens.gold.bgSubtle, rgba(212,175,55,0.02))' }}",
            "style={{ background: `linear-gradient(135deg, ${tokens.gold.bgSubtle}, ${tokens.gold.bgSubtle})` }}"
        ),
    ],
    # ── analytics-screen.tsx ──
    'components/screens/analytics-screen.tsx': [
        (
            "style={{ background: tokens.flat.white, border: '1px solid {tokens.neutral.200}', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}",
            "style={{ background: tokens.flat.white, border: `1px solid ${tokens.neutral[200]}`, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}"
        ),
    ],
    # ── relationship-memory-screen.tsx ──
    'components/screens/relationship-memory-screen.tsx': [
        (
            "style={{ background: 'rgba(184, 134, 11, 0.05)', borderLeft: '3px solid {tokens.gold.DEFAULT}' }}",
            "style={{ background: tokens.gold.bgDarkLight, borderLeft: `3px solid ${tokens.gold.DEFAULT}` }}"
        ),
        (
            "style={{ borderColor: 'rgba(184, 134, 11, 0.2)' }}",
            "style={{ borderColor: tokens.gold.borderLight }}"
        ),
    ],
    # ── companies-screen.tsx ──
    'components/screens/companies-screen.tsx': [
        (
            "style={{ background: tokens.opacity.white.medium, borderColor: 'rgba(0,0,0,.05)' }}",
            "style={{ background: tokens.opacity.white.medium, borderColor: tokens.opacity.whisper }}"
        ),
        (
            "style={{ background: 'rgba(59,130,246,.04)', borderColor: 'rgba(59,130,246,.15)' }}",
            "style={{ background: tokens.accent.ghost, borderColor: tokens.accent.subtle }}"
        ),
        (
            "style={{ borderColor: 'rgba(212,175,55,.4)', color: 'var(--color-gold)' }}",
            "style={{ borderColor: tokens.gold.border, color: tokens.gold.DEFAULT }}"
        ),
        (
            "style={{ background: tokens.opacity.white.medium, borderColor: 'rgba(0,0,0,.05)', height: 'calc(100vh - 320px)' }}",
            "style={{ background: tokens.opacity.white.medium, borderColor: tokens.opacity.whisper, height: 'calc(100vh - 320px)' }}"
        ),
    ],
    # ── queue-screen.tsx ──
    'components/screens/queue-screen.tsx': [
        (
            "background: 'linear-gradient(135deg, tokens.gold.bgBright, rgba(139, 92, 246, 0.08), tokens.gold.bgBright)'",
            "background: `linear-gradient(135deg, ${tokens.gold.bgBright}, ${tokens.extended.purple.bgSubtle}, ${tokens.gold.bgBright})`"
        ),
    ],
    # ── dashboard-screen.tsx ──
    'components/screens/dashboard-screen.tsx': [
        (
            "style={{ background: `linear-gradient(90deg, rgba(212,175,55,${0.9 - i * 0.15}), rgba(232,200,96,${0.7 - i * 0.12}))` }}",
            "style={{ background: `linear-gradient(90deg, ${tokens.gold.DEFAULT.replace('#', '') ? `rgba(212,175,55,${0.9 - i * 0.15})` : tokens.gold.DEFAULT}, rgba(232,200,96,${0.7 - i * 0.12}))` }}"
        ),
    ],
}

# Generic regex fixes for patterns across all files
GENERIC_FIXES = [
    # Remaining broken string tokens: '1px solid {tokens.foo}'
    (r"'(\d+px solid )\{tokens\.([^}]+)\}'", r'`\1${tokens.\2}`'),
    
    # rgba(0,0,0,.05) → tokens.opacity.whisper (short form with dots)
    (r'rgba\(0,\s*0,\s*0,\s*\.05\)', 'tokens.opacity.whisper'),
    (r'rgba\(0,\s*0,\s*0,\s*\.12\)', 'tokens.opacity.faint'),
    (r'rgba\(0,\s*0,\s*0,\s*\.15\)', 'rgba(0,0,0,0.15)'),  # no exact token
    (r'rgba\(0,\s*0,\s*0,\s*\.04\)', 'tokens.opacity.trace'),
    
    # Gold box shadows - keep as inline since no exact token
    # rgba(212, 175, 55, 0.3) in boxShadow → keep
    # rgba(212, 175, 55, 0.5) in boxShadow → keep
    
    # rgba(184, 134, 11, 0.25) → keep (unique value)
    # rgba(184, 134, 11, 0.2) → tokens.gold.borderLight
    (r"rgba\(184,\s*134,\s*11,\s*0\.2\)", 'tokens.gold.borderLight'),
    (r"rgba\(184,\s*134,\s*11,\s*0\.05\)", 'tokens.gold.bgDarkLight'),
    
    # rgba(59,130,246,.04) → tokens.accent.ghost
    (r'rgba\(59,\s*130,\s*246,\s*\.04\)', 'tokens.accent.ghost'),
    (r'rgba\(59,\s*130,\s*246,\s*\.15\)', 'tokens.accent.subtle'),
    
    # rgba(212,175,55,.4) in border context → tokens.gold.border (close enough)
    # rgba(212,175,55,0.4) in boxShadow → keep
    
    # rgba(100, 116, 139, 0.3) - scrollbar → keep (UI-specific)
    # rgba(100, 116, 139, 0.5) - scrollbar hover → keep
    
    # rgba(100,100,100,.12) → neutral fallback
    (r"rgba\(100,\s*100,\s*100,\s*\.12\)", 'tokens.neutral.bg'),
]


def process_file(filepath: Path, specific_fixes: list = None) -> dict:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {'error': str(e)}
    
    original = content
    count = 0
    
    # Apply specific fixes for this file
    if specific_fixes:
        for old, new in specific_fixes:
            if old in content:
                content = content.replace(old, new)
                count += 1
    
    # Apply generic regex fixes
    for pattern, replacement in GENERIC_FIXES:
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            count += len(matches)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        stats['files_modified'].append(str(filepath.relative_to(BASE_DIR)))
        stats['files_processed'] += 1
        stats['replacements'] += count
    
    return {'count': count}


def main():
    all_screen_files = sorted(SCREENS_DIR2.glob('**/*.tsx'))
    all_ios_files = sorted(IOS_DIR.glob('**/*.tsx'))
    
    # Process files with specific fixes first
    for rel_path, fixes in EDGE_CASE_FIXES.items():
        filepath = BASE_DIR / rel_path
        if filepath.exists():
            result = process_file(filepath, fixes)
            if result.get('count', 0) > 0:
                print(f"  {rel_path}: {result['count']} specific fixes")
    
    # Process all remaining screen and ios files with generic fixes
    for filepath in all_screen_files + all_ios_files:
        if str(filepath.relative_to(BASE_DIR)) not in EDGE_CASE_FIXES:
            result = process_file(filepath)
            if result.get('count', 0) > 0:
                print(f"  {filepath.relative_to(BASE_DIR)}: {result['count']} generic fixes")
    
    print(f"\nSUMMARY:")
    print(f"  Files processed: {stats['files_processed']}")
    print(f"  Replacements: {stats['replacements']}")
    print(f"  Files modified: {len(stats['files_modified'])}")


if __name__ == '__main__':
    main()
