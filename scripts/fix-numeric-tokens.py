#!/usr/bin/env python3
"""Fix tokens.neutral.NUMBER patterns to use bracket notation tokens.neutral['NUMBER']"""

import re
from pathlib import Path

BASE = Path('/home/z/my-project/src')
count = 0

for f in sorted(BASE.rglob('*.tsx')) + sorted(BASE.rglob('*.ts')):
    try:
        content = f.read_text()
    except:
        continue
    
    # Pattern: tokens.neutral.NUMBER where NUMBER is 50, 100, 200, etc.
    # Also: tokens.something.NUMBER (any numeric property access)
    pattern = r'tokens\.(\w+)\.(\d{2,4})'
    
    def fix_numeric(m):
        global count
        count += 1
        return f"tokens.{m.group(1)}['{m.group(2)}']"
    
    new_content = re.sub(pattern, fix_numeric, content)
    
    if new_content != content:
        f.write_text(new_content)

print(f"Fixed {count} numeric token access patterns")
