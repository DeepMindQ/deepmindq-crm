#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Color Migration Pass 6 - Intelligence OS Components
Fix remaining rgba values in intelligence-os components.
"""

import re
from pathlib import Path

BASE_DIR = Path('/home/z/my-project/src')
IOS_DIR = BASE_DIR / 'components' / 'intelligence-os'

stats = {'files': 0, 'replacements': 0}

# File-specific fixes: (old_str → new_str)
IOS_FIXES = {
    'layers/exploration-layer.tsx': [
        ("'1px solid rgba(139, 92, 246, 0.2)'", '`1px solid ${tokens.extended.purple.border}`'),
    ],
    'account-delta-tracker.tsx': [
        ("bg: 'rgba(139,92,246,0.08)'", 'bg: tokens.extended.purple.bgSubtle'),
    ],
    'molecules/deep-intel-context.tsx': [
        ("const purpleGhost = 'rgba(168, 85, 247, 0.06)'", 'const purpleGhost = tokens.extended.purple.bgFaint'),
    ],
    'molecules/context-account-card.tsx': [
        ("border: '1px solid rgba(59, 130, 246, 0.2)'", 'border: `1px solid ${tokens.accent.subtle}`'),
    ],
    'company-workspace.tsx': [
        ("`1px solid rgba(6,182,212,0.15)`", '`1px solid ${tokens.extended.sky.border}`'),
    ],
    'recommendation-card.tsx': [
        ("'var(--ios-border, rgba(255,255,255,0.1))'", 'tokens.border.subtle'),
    ],
    'intelligence-card.tsx': [
        ("bg: 'rgba(59, 130, 246, 0.08)',      border: 'rgba(59, 130, 246, 0.15)'", 'bg: tokens.accent.ghost,      border: tokens.accent.subtle'),
        ("bg: 'rgba(139, 92, 246, 0.08)',     border: 'rgba(139, 92, 246, 0.15)'", 'bg: tokens.extended.purple.bgSubtle,     border: tokens.extended.purple.border'),
        ("bg: 'rgba(239, 68, 68, 0.08)',      border: 'rgba(239, 68, 68, 0.15)'", 'bg: tokens.priority.critical.bg,      border: tokens.priority.critical.border'),
        ("bg: 'rgba(6, 182, 212, 0.08)',      border: 'rgba(6, 182, 212, 0.15)'", 'bg: tokens.extended.sky.bg,      border: tokens.extended.sky.border'),
        ("bg: 'rgba(245, 158, 11, 0.08)',     border: 'rgba(245, 158, 11, 0.15)'", 'bg: tokens.priority.high.bg,     border: tokens.priority.high.border'),
        ("'tokens.extended.emerald.bg',      border: 'rgba(16, 185, 129, 0.15)'", 'tokens.extended.emerald.bg,      border: tokens.extended.emerald.border'),
    ],
    'intelligence-operations-center.tsx': [
        ("'rgba(239,68,68,0.08)'", 'tokens.priority.critical.bg'),
        ("'rgba(34,197,94,0.08)'", 'tokens.trust.verified.bg'),
        ("'rgba(239,68,68,0.08)'", 'tokens.priority.critical.bg'),
    ],
    'intelligence-narrative.tsx': [
        ("'tokens.accent.subtle',      border: 'rgba(59, 130, 246, 0.2)'", 'tokens.accent.subtle,      border: tokens.accent.subtle'),
        ("bg: 'rgba(139, 92, 246, 0.1)',     border: 'rgba(139, 92, 246, 0.2)'", 'bg: tokens.extended.purple.bg,     border: tokens.extended.purple.border'),
        ("'tokens.extended.sky.bg',       border: 'rgba(6, 182, 212, 0.2)'", 'tokens.extended.sky.bg,       border: tokens.extended.sky.border'),
        ("'tokens.priority.high.bg',      border: 'rgba(245, 158, 11, 0.2)'", 'tokens.priority.high.bg,      border: tokens.priority.high.border'),
        ("'tokens.extended.emerald.bg',      border: 'rgba(16, 185, 129, 0.2)'", 'tokens.extended.emerald.bg,      border: tokens.extended.emerald.border'),
        ("'1px solid rgba(245, 158, 11, 0.12)'", '`1px solid ${tokens.priority.high.border}`'),
    ],
    'atoms/confidence-footer.tsx': [
        ("'1px solid rgba(139, 92, 246, 0.15)'", '`1px solid ${tokens.extended.purple.border}`'),
    ],
    'atoms/signal-pill.tsx': [
        ("bg: 'rgba(139, 92, 246, 0.08)'", 'bg: tokens.extended.purple.bgSubtle'),
    ],
    'atoms/advisor-message-bubble.tsx': [
        ("border: '1px solid rgba(139, 92, 246, 0.15)'", 'border: `1px solid ${tokens.extended.purple.border}`'),
    ],
    'activation-status.tsx': [
        ("'var(--ios-border, rgba(255,255,255,0.1))'", 'tokens.border.subtle'),
        ("'var(--ios-border, rgba(255,255,255,0.1))'", 'tokens.border.subtle'),
        ("'var(--ios-border, rgba(255,255,255,0.1))'", 'tokens.border.subtle'),
    ],
    'molecules/advisor-header.tsx': [
        # Keep animated boxShadow - it's a framer-motion animation keyframe, tokens don't work there
    ],
    'molecules/advisor-input-area.tsx': [
        ("'0 0 0 3px rgba(59, 130, 246, 0.15)'", '`0 0 0 3px ${tokens.accent.subtle}`'),
    ],
    'molecules/human-assistance-dialog.tsx': [
        # Keep boxShadow rgba - it's a heavy shadow with no exact token
    ],
}

def process_file(filepath: Path, fixes: list) -> int:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0
    
    original = content
    count = 0
    
    for old, new in fixes:
        occurrences = content.count(old)
        if occurrences > 0:
            content = content.replace(old, new)
            count += occurrences
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return count


def main():
    for rel_path, fixes in sorted(IOS_FIXES.items()):
        filepath = IOS_DIR / rel_path
        if not filepath.exists():
            print(f"  SKIP (not found): {rel_path}")
            continue
        
        count = process_file(filepath, fixes)
        if count > 0:
            stats['files'] += 1
            stats['replacements'] += count
            print(f"  {rel_path}: {count} replacements")
    
    print(f"\nSUMMARY: {stats['files']} files, {stats['replacements']} replacements")


if __name__ == '__main__':
    main()
