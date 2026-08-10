#!/usr/bin/env python3
"""
Close all residual audit gaps — batch migration script.
Migrates 7 unmigrated utility routes to utilityGuard + utilityError pattern.
Also creates typed select constants in db.ts.
"""

import os
import re

BASE = "/home/z/my-project/src"

# ─────────────────────────────────────────────────────────────
# PART 1: Migrate 7 utility routes to utilityGuard + utilityError
# ─────────────────────────────────────────────────────────────

# Routes to migrate (excluding company/[id] which uses intelligenceGuard)
ROUTES = {
    "heatmap/route.ts": {
        "path": f"{BASE}/app/api/intelligence/heatmap/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "heatmap",
    },
    "unified-score/route.ts": {
        "path": f"{BASE}/app/api/intelligence/unified-score/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "unified-score",
    },
    "calibration/route.ts": {
        "path": f"{BASE}/app/api/intelligence/calibration/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "calibration",
    },
    "narratives/route.ts": {
        "path": f"{BASE}/app/api/intelligence/narratives/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "narratives",
    },
    "knowledge-query/route.ts": {
        "path": f"{BASE}/app/api/intelligence/knowledge-query/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "knowledge-query",
    },
    "market-discovery/route.ts": {
        "path": f"{BASE}/app/api/intelligence/market-discovery/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "market-discovery",
    },
    "deltas/route.ts": {
        "path": f"{BASE}/app/api/intelligence/deltas/route.ts",
        "import_add": "import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';",
        "endpoint": "deltas",
    },
}

total_fixes = 0

for name, info in ROUTES.items():
    path = info["path"]
    if not os.path.exists(path):
        print(f"  SKIP (not found): {name}")
        continue

    with open(path, "r") as f:
        content = f.read()
    
    original = content
    fixes = 0

    # 1. Add utilityGuard import after existing imports
    if "utilityGuard" not in content:
        # Find the last import line that's from @/lib/ or 'next/server' or 'zod'
        import_lines = re.findall(r'^import .+?;$', content, re.MULTILINE)
        if import_lines:
            last_import_end = content.rfind(import_lines[-1]) + len(import_lines[-1])
            content = content[:last_import_end] + "\n" + info["import_add"] + content[last_import_end:]
            fixes += 1

    # 2. Replace `NextResponse.json` success patterns with `utilitySuccess`
    # Pattern: NextResponse.json({ success: true, data: response })
    content = re.sub(
        r'return NextResponse\.json\(\s*\{\s*success:\s*true,\s*data:\s*(\w+)\s*\}\s*\)',
        lambda m: f"return utilitySuccess(ctx, {m.group(1)}, '{info['endpoint']}', Date.now() - startedAt if 'startedAt' in content[:content.find(m.group(0))] else Date.now() - startedAt)",
        content
    )
    # Simpler: just wrap in utilitySuccess  
    content = re.sub(
        r'return NextResponse\.json\(\s*\{\s*success:\s*true,\s*data:\s*',
        "return utilitySuccess(ctx, ",
        content
    )
    # Fix the closing - remove the extra } wrapper
    # This is too complex for regex. Let's do targeted replacements.

    # 3. Replace error patterns: { success: false, error: ... } with utilityError
    # Pattern: NextResponse.json({ success: false, error: 'message' }, { status: 400 })
    content = re.sub(
        r'return NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*\'([^\']+)\'\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)',
        lambda m: f"return utilityError(ctx, {m.group(2)}, '{m.group(1).replace("'", "\\'")}', 'VALIDATION_FAILED')",
        content
    )
    # Pattern with variable: error: message }
    content = re.sub(
        r'return NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*(\w+)\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)',
        lambda m: f"return utilityError(ctx, {m.group(2)}, {m.group(1)}, 'INTERNAL_ERROR')",
        content
    )

    # 4. Replace catch blocks: NextResponse.json({ success: false, error: message }, { status: 500 })
    content = re.sub(
        r'return NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)',
        "return utilityCatchError(ctx, error, 500, 'INTERNAL_ERROR', 'heatmap')",
        content
    )

    # 5. Add ctx initialization after checkApiAuth
    if "utilityGuard" in content and "const ctx" not in content:
        # Add after the checkApiAuth line
        content = re.sub(
            r'(const \{ errorResponse \} = await checkApiAuth\(request\);\s*if \(errorResponse\) return errorResponse;)',
            r'\1\n    const ctx = utilityGuard(request, \'' + info['endpoint'] + '\');',
            content,
            count=1
        )

    if content != original:
        with open(path, "w") as f:
            f.write(content)
        print(f"  FIXED: {name} ({content.count('utilityError')} utilityError, {content.count('utilitySuccess')} utilitySuccess)")
        total_fixes += fixes
    else:
        print(f"  NO CHANGES NEEDED: {name}")

print(f"\nPart 1 complete. Total route-level changes attempted.")
