#!/usr/bin/env python3
"""Add missing tokens import to lib files that use tokens."""

from pathlib import Path

BASE = Path('/home/z/my-project/src/lib')
count = 0

for f in sorted(BASE.rglob('*.ts')):
    try:
        content = f.read_text()
    except:
        continue
    
    if 'tokens.' not in content:
        continue
    if 'import' in content and 'design-tokens' in content:
        continue
    
    lines = content.split('\n')
    inserted = False
    new_lines = []
    for line in lines:
        new_lines.append(line)
        if not inserted and line.startswith('import ') and not line.strip().startswith('//'):
            new_lines.append("import { tokens } from '@/components/intelligence-os/design-tokens';")
            inserted = True
            count += 1
    
    if inserted:
        f.write_text('\n'.join(new_lines))

print(f"Added tokens import to {count} lib files")
