#!/usr/bin/env python3
"""Fix token references that should use .value suffix.
These are tokens whose value is an object { readonly value: '...' } but are 
used where a string is expected.
"""

import re
from pathlib import Path

BASE = Path('/home/z/my-project/src')

# Map of color values to their correct token paths with .value
VALUE_TO_TOKEN = {
    '#d97706': 'tokens.extended.amberDeep',
    '#ea580c': 'tokens.extended.orangeLight',
    '#16a34a': 'tokens.extended.greenDeep',
    '#65a30d': None,  # not in tokens
    '#991b1b': 'tokens.extended.redDark',
    '#a3e635': 'tokens.extended.limeBright',
    '#ca8a04': 'tokens.extended.yellowDeep',
    '#ec4899': 'tokens.extended.pink',
    '#0891b2': 'tokens.extended.cyanDark',
    '#7c3aed': 'tokens.extended.purpleDeep',
    '#1e40af': 'tokens.extended.blueDeep',
    '#dc2626': None,  # same as domain.risk but check
    '#059669': None,  # same as extended.emeraldDeep
    '#1d4ed8': 'tokens.extended.blue',
}

# Object tokens that need .value suffix when used as strings
OBJECT_TOKENS = [
    'tokens.extended.amberDeep',
    'tokens.extended.orangeLight',
    'tokens.extended.greenDeep',
    'tokens.extended.redDark',
    'tokens.extended.limeBright',
    'tokens.extended.yellowDeep',
    'tokens.extended.pink',
    'tokens.extended.cyanDark',
    'tokens.extended.purpleDeep',
    'tokens.extended.blueDeep',
    'tokens.extended.blueBright',
]

count = 0

for f in sorted(BASE.rglob('*.tsx')) + sorted(BASE.rglob('*.ts')):
    try:
        content = f.read_text()
    except:
        continue
    
    original = content
    
    # Find patterns like: tokens.extended.amberDeep followed by , or end of line
    # but NOT tokens.extended.amberDeep.value (already correct)
    for token in OBJECT_TOKENS:
        # Pattern: token used but NOT followed by .value
        # Match: token followed by , ) ] } > < & | + - * / or end of line
        # But NOT token.value
        
        # Simple approach: find token not followed by .value or [
        pattern = re.compile(r'(?<!\.)\b' + re.escape(token) + r'\b(?!\.value)(?!\.\[)')
        
        # Count matches before
        matches_before = len(pattern.findall(content))
        
        # Replace with token.value
        if matches_before > 0:
            content = pattern.sub(f'{token}.value', content)
            count += matches_before
    
    if content != original:
        f.write_text(content)
        print(f"Fixed {f.relative_to(BASE)}: added .value to tokens")

print(f"\nTotal: fixed {count} token references")
