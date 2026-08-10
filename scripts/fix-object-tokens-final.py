#!/usr/bin/env python3
"""Fix remaining object tokens missing .value suffix — comprehensive search."""

import re
from pathlib import Path

BASE = Path('/home/z/my-project/src')

# All tokens that are objects with .value property (not flat strings)
OBJECT_TOKEN_PATHS = [
    'tokens.extended.orange',
    'tokens.extended.redDark',
    'tokens.extended.greenDeep',
    'tokens.extended.purpleDeep',
    'tokens.extended.blueDeep',
    'tokens.extended.blueBright',
    'tokens.extended.cyanDark',
    'tokens.extended.amberDeep',
    'tokens.extended.limeBright',
    'tokens.extended.yellowDeep',
    'tokens.extended.pink',
    'tokens.extended.lime',
    'tokens.extended.orange',
    'tokens.extended.sky',
    'tokens.extended.indigo',
    'tokens.extended.violet',
]

count = 0

for f in sorted(BASE.rglob('*.tsx')) + sorted(BASE.rglob('*.ts')):
    try:
        content = f.read_text()
    except:
        continue
    
    original = content
    
    for token in OBJECT_TOKEN_PATHS:
        # Match token not followed by .value, .bg, .border, or [
        # This handles the simple case: tokens.extended.orange used where a string is expected
        # But preserves: tokens.extended.orange.bg, tokens.extended.orange.border, etc.
        escaped = re.escape(token)
        pattern = re.compile(r'(?<![.\[\w])' + escaped + r'(?![.\w])')
        
        matches = pattern.findall(content)
        if matches:
            # Only fix if not already part of a .value chain
            new_content = pattern.sub(f'{token}.value', content)
            if new_content != content:
                content = new_content
                count += len(matches)
    
    if content != original:
        f.write_text(content)
        rel = f.relative_to(BASE)
        print(f"  {rel}: fixed {len(pattern.findall(original))} instances")

print(f"\nTotal: fixed {count} token references")
