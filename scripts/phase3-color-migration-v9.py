#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Color Migration Pass 9
Fix remaining edge cases:
1. tokens.neutral.400 → tokens.neutral[400] (numeric key access)
2. Other remaining string-literal tokens
3. 'rgba(...)' in non-style contexts
"""

import re
from pathlib import Path

BASE_DIR = Path('/home/z/my-project/src')

stats = {'files': 0, 'replacements': 0}

SPECIFIC_FIXES = {
    # Numeric key tokens: tokens.neutral.400 → tokens.neutral['400']
    # In JavaScript, numeric object keys must use bracket notation
    'lib/intelligence-api/types.ts': [
        ("'{tokens.neutral.400}'", "tokens.neutral['400']"),
        ("'{tokens.neutral.400}'", "tokens.neutral['400']"),
    ],
    'lib/ai-unified-confidence.ts': [
        ("'{tokens.neutral.500}'", "tokens.neutral['500']"),
    ],
    'lib/incident-manager.ts': [
        ("'{tokens.neutral.500}'", "tokens.neutral['500']"),
    ],
    'app/api/pipeline/route.ts': [
        ("'{tokens.neutral.400}'", "tokens.neutral['400']"),
        ("'{tokens.neutral.400}'", "tokens.neutral['400']"),
    ],
    'components/shared/enterprise-theme.ts': [
        ("export const textPrimary = '{tokens.neutral.900}'", "export const textPrimary = tokens.neutral['900']"),
        ("export const textMuted = '{tokens.neutral.400}'", "export const textMuted = tokens.neutral['400']"),
    ],
    'components/shared/enterprise-components.tsx': [
        ("{ color: '{tokens.neutral.400}' }", "{ color: tokens.neutral['400'] }"),
    ],
    'components/shared/ai-chat-sidebar.tsx': [
        ("background: '{tokens.neutral.50}'", "background: tokens.neutral['50']"),
        ("'1px solid {tokens.neutral.200}'", "`1px solid ${tokens.neutral['200']}`"),
        ("background: '{tokens.neutral.100}'", "background: tokens.neutral['100']"),
        ("background: '{tokens.neutral.200}'", "background: tokens.neutral['200']"),
    ],
    'components/shared/design-system.tsx': [
        ("'{tokens.neutral.100}'", "tokens.neutral['100']"),
    ],
    'components/shared/command-palette.tsx': [
        ("'{tokens.flat.lightGray}ounts'", "'#accounts'"),  # This was a corrupted value
    ],
    'components/screens/main-intelligence-dashboard.tsx': [
        ("'{tokens.flat.lightGray}ounts'", "'#accounts'"),  # This was a corrupted value
    ],
    'components/tier/account-tier-badge.tsx': [
        ("'{tokens.neutral.500}'", "tokens.neutral['500']"),
    ],
    'components/accessibility/accessibility-utils.tsx': [
        ("'{tokens.neutral.900}'", "tokens.neutral['900']"),
        ("'{tokens.neutral.400}'", "tokens.neutral['400']"),
    ],
    'components/login-page.tsx': [
        ("text: '{tokens.neutral.900}'", "text: tokens.neutral['900']"),
    ],
}

def main():
    for rel_path, fixes in sorted(SPECIFIC_FIXES.items()):
        filepath = BASE_DIR / rel_path
        if not filepath.exists():
            print(f"  SKIP: {rel_path}")
            continue
        
        try:
            with open(filepath, 'r') as f:
                content = f.read()
        except Exception as e:
            print(f"  ERROR: {rel_path}: {e}")
            continue
        
        original = content
        count = 0
        for old, new in fixes:
            if old in content:
                content = content.replace(old, new)
                count += 1
        
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            stats['files'] += 1
            stats['replacements'] += count
            print(f"  {rel_path}: {count} fixes")
    
    print(f"\nSUMMARY: {stats['files']} files, {stats['replacements']} replacements")

if __name__ == '__main__':
    main()
