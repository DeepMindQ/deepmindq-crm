#!/usr/bin/env python3
"""Fix misplaced logger imports - move them after the last complete import."""
import re
import os

SRC_DIR = '/home/z/my-project/src'
BROKEN_FILES = [
    'src/app/api/ai/revenue-score/route.ts',
    'src/app/api/companies/[id]/alignment/route.ts',
    'src/app/api/intelligence/sprint2/route.ts',
    'src/components/screens/capability-screen.tsx',
    'src/components/screens/drafts-screen.tsx',
    'src/components/screens/icp-settings-screen.tsx',
    'src/components/screens/queue-screen.tsx',
    'src/components/screens/research-agent-screen.tsx',
    'src/components/screens/strategy-room-screen.tsx',
    'src/lib/intelligence-sources/ai-evidence-engine.ts',
    'src/proxy.ts',
]

for fpath in BROKEN_FILES:
    full = os.path.join(SRC_DIR.replace('/src', ''), fpath)
    if not os.path.exists(full):
        full = os.path.join('/home/z/my-project', fpath)
    
    with open(full, 'r') as f:
        content = f.read()
    
    # Remove the misplaced import line
    lines = content.split('\n')
    cleaned = [l for l in lines if l.strip() != "import { logger } from '@/lib/logger';"]
    content = '\n'.join(cleaned)
    
    # Find the last complete import line and insert after it
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import ') and (stripped.endswith(';') or stripped.endswith("'") or stripped.endswith('"')):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, "import { logger } from '@/lib/logger';")
    
    with open(full, 'w') as f:
        f.write('\n'.join(lines))
    
    print(f"Fixed: {fpath}")
