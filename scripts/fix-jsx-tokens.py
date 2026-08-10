#!/usr/bin/env python3
"""Fix JSX attributes that use tokens.X without curly braces.
Pattern: attr=tokens.foo → attr={tokens.foo}
But be careful with attr={tokens.foo} which is already correct.
"""

import re
from pathlib import Path

BASE = Path('/home/z/my-project/src')
count = 0

for f in sorted(BASE.rglob('*.tsx')):
    try:
        content = f.read_text()
    except:
        continue
    
    # Pattern: whitespace + attribute name + =tokens. (missing curly braces)
    # e.g., accent=tokens.domain.enrichment → accent={tokens.domain.enrichment}
    # But NOT: attr={tokens.foo} (already correct)
    # Match: attr=tokens.something followed by space, /, >, or end
    
    pattern = r'(\s)(\w+)=tokens\.([a-zA-Z][\w.\[\]\'"]*?)([\s/>])'
    
    def fix_jsx(m):
        global count
        count += 1
        return f'{m.group(1)}{m.group(2)}={{tokens.{m.group(3)}}}{m.group(4)}'
    
    new_content = re.sub(pattern, fix_jsx, content)
    
    if new_content != content:
        f.write_text(new_content)

print(f"Fixed {count} JSX attributes missing curly braces")
