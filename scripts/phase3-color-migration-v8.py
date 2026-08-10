#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Color Migration Pass 8
Fix remaining broken string-literal tokens in UI components and server files.
"""

import re
from pathlib import Path

BASE_DIR = Path('/home/z/my-project/src')

stats = {'files': 0, 'replacements': 0}

def fix_tokens_in_file(filepath: Path) -> int:
    """Fix broken string-literal token references."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return 0
    
    original = content
    count = 0
    
    # Pattern: '{tokens.foo.bar}' or "{tokens.foo.bar}" → tokens.foo.bar
    for quote in ["'", '"']:
        pattern = rf'{quote}\{{(tokens\.[a-zA-Z.]+)\}}{quote}'
        
        def replace_broken(m):
            nonlocal count
            count += 1
            return m.group(1)
        
        content = re.sub(pattern, replace_broken, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return count


# Fix remaining files with broken tokens
FILES_TO_FIX = [
    # UI components
    'components/shared/enterprise-theme.ts',
    'components/shared/enterprise-components.tsx',
    'components/shared/command-palette.tsx', 
    'components/shared/design-system.tsx',
    'components/shared/ai-chat-sidebar.tsx',
    'components/shared/first-experience-guide.tsx',
    'components/login-page.tsx',
    'components/tier/account-tier-badge.tsx',
    'components/accessibility/accessibility-utils.tsx',
    'components/notifications/notification-icon.ts',
    'components/screens/main-intelligence-dashboard.tsx',
    # Backend/API files  
    'lib/intelligence-api/types.ts',
    'lib/ai-unified-confidence.ts',
    'lib/incident-manager.ts',
    'lib/email-templates.ts',
    'lib/slack-integration.ts',
    'lib/use-brand-config.ts',
    'app/api/ai/relationship-memory/route.ts',
    'app/api/unsubscribe/route.ts',
    'app/api/pipeline/route.ts',
    'app/api/brand/route.ts',
    'app/api/team/performance/route.ts',
    'app/api/settings/route.ts',
    'app/api/intelligence/export/route.ts',
]

def main():
    for rel_path in FILES_TO_FIX:
        filepath = BASE_DIR / rel_path
        if not filepath.exists():
            print(f"  SKIP (not found): {rel_path}")
            continue
        
        count = fix_tokens_in_file(filepath)
        if count > 0:
            stats['files'] += 1
            stats['replacements'] += count
            print(f"  {rel_path}: {count} fixes")
    
    # Also scan for any remaining broken patterns
    all_ts = list(BASE_DIR.rglob('*.ts')) + list(BASE_DIR.rglob('*.tsx'))
    fixed_files = set(FILES_TO_FIX)
    
    for filepath in all_ts:
        rel = str(filepath.relative_to(BASE_DIR))
        if rel in fixed_files:
            continue
        try:
            with open(filepath, 'r') as f:
                content = f.read()
        except Exception:
            continue
        
        if "'{tokens." not in content and '"{tokens.' not in content:
            continue
        
        count = fix_tokens_in_file(filepath)
        if count > 0:
            stats['files'] += 1
            stats['replacements'] += count
            print(f"  {rel}: {count} fixes")
    
    print(f"\nSUMMARY: {stats['files']} files, {stats['replacements']} replacements")


if __name__ == '__main__':
    main()
