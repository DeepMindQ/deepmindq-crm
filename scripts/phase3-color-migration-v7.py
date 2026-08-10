#!/usr/bin/env python3
"""
Phase 3 - Task 3.1: Color Migration Pass 7
Fix ALL remaining broken string-literal token references.
Pattern: 'tokens.foo.bar' and '{tokens.foo.bar}' used as JS string values
These render as literal text instead of color values.
Must become: tokens.foo.bar (runtime reference)
"""

import re
from pathlib import Path

BASE_DIR = Path('/home/z/my-project/src')

stats = {'files': 0, 'replacements': 0, 'details': []}

def fix_file(filepath: Path) -> int:
    """Fix broken string-literal token references in a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return 0
    
    original = content
    count = 0
    
    # Pattern 1: '{tokens.foo.bar}' → tokens.foo.bar
    # Single-quoted string with braces
    pattern1 = r"'(\{tokens\.[a-zA-Z.]+\})'"
    matches1 = list(re.finditer(pattern1, content))
    for m in reversed(matches1):
        token_path = m.group(1).strip('{}')
        content = content[:m.start()] + token_path + content[m.end():]
        count += 1
    
    # Pattern 2: "{tokens.foo.bar}" → tokens.foo.bar
    # Double-quoted string with braces
    pattern2 = r'"(\{tokens\.[a-zA-Z.]+\})"'
    matches2 = list(re.finditer(pattern2, content))
    for m in reversed(matches2):
        token_path = m.group(1).strip('{}')
        content = content[:m.start()] + token_path + content[m.end():]
        count += 1
    
    # Pattern 3: 'tokens.foo.bar' as a standalone value in style={{}} or object properties
    # This is trickier - need context awareness
    # Match: 'tokens.foo.bar' where it's used as a value (not in a string concat or comparison)
    # Specific cases: style={{ color: 'tokens.text.muted' }} → style={{ color: tokens.text.muted }}
    pattern3 = r"'(tokens\.(?:surface|border|text|accent|domain|trust|confidence|priority|gold|extended|neutral|flat|opacity|surfaceExtended)\.[a-zA-Z]+(?:\.[a-zA-Z]+)?)'"
    
    matches3 = list(re.finditer(pattern3, content))
    for m in reversed(matches3):
        token_path = m.group(1)
        # Don't replace if it's part of a larger string (e.g., template literal, concat)
        start = m.start()
        # Check context: if preceded by + or ` or part of a template literal, skip
        pre = content[max(0, start-5):start]
        if pre.rstrip().endswith('+') or pre.rstrip().endswith('`'):
            continue
        # Check if this is a standalone value (style={{ }}, object property, etc.)
        # Look at what comes after
        end = m.end()
        after = content[end:end+10].lstrip()
        if after and after[0] in ',})]':
            content = content[:m.start()] + token_path + content[m.end():]
            count += 1
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return count


def main():
    # Find all TSX files with broken token references
    all_tsx = list(BASE_DIR.rglob('*.tsx'))
    
    for filepath in sorted(all_tsx):
        # Check if file has broken token patterns
        try:
            with open(filepath, 'r') as f:
                content = f.read()
        except Exception:
            continue
        
        if "'{tokens." not in content and '"{tokens.' not in content and "'tokens." not in content:
            continue
        
        count = fix_file(filepath)
        if count > 0:
            stats['files'] += 1
            stats['replacements'] += count
            rel = filepath.relative_to(BASE_DIR)
            stats['details'].append((str(rel), count))
            print(f"  {rel}: {count} fixes")
    
    print(f"\nSUMMARY: {stats['files']} files, {stats['replacements']} total replacements")


if __name__ == '__main__':
    main()
