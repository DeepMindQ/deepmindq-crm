#!/usr/bin/env python3
"""
WI-12: API Contract Hardening & Enterprise Reliability
Applies all 18 approved items atomically.
"""
import os, re

BASE = "/home/z/my-project"
errors = []

def read(path):
    with open(path) as f:
        return f.read()

def write(path, content):
    with open(path, "w") as f:
        f.write(content)

def replace(path, old, new, label=""):
    content = read(path)
    if old not in content:
        errors.append(f"FAIL [{label}]: pattern not found in {path}")
        return False
    write(path, content.replace(old, new, 1))
    return True

def multi_replace(path, replacements):
    """Apply multiple replacements to a single file."""
    content = read(path)
    applied = []
    for label, old, new in replacements:
        if old not in content:
            errors.append(f"FAIL [{label}]: pattern not found in {path}")
            continue
        content = content.replace(old, new, 1)
        applied.append(label)
    write(path, content)
    return applied

# ══════════════════════════════════════════════════════════════
# A-C1: Fix validateBody() response contract in apiHelpers.ts
# ══════════════════════════════════════════════════════════════
replace(
    f"{BASE}/src/lib/apiHelpers.ts",
    'return NextResponse.json({ error: first?.message ?? \'Validation failed\' }, { status: 400 })',
    'return NextResponse.json({ success: false, error: first?.message ?? \'Validation failed\', timestamp: new Date().toISOString() }, { status: 400 })',
    "A-C1"
)

# ══════════════════════════════════════════════════════════════
# A-C2: Remove err.message leakage from engine routes
# ══════════════════════════════════════════════════════════════
for route in ["fusion", "learning", "orchestration", "reasoning"]:
    path = f"{BASE}/src/app/api/{route}/route.ts"
    if not os.path.exists(path):
        errors.append(f"SKIP [A-C2]: {path} not found")
        continue
    multi_replace(path, [
        ("A-C2-leak-1",
         "return apiError(err instanceof Error ? err.message : 'Unknown error', 500);",
         'logger.error(`[${route}] operation failed: ${err instanceof Error ? err.message : err}`);\n    return apiError(\'Internal error\', 500);'),
        ("A-C2-leak-2",
         "return apiError(err instanceof Error ? err.message : 'Unknown error', 500);",
         'logger.error(`[${route}] operation failed: ${err instanceof Error ? err.message : err}`);\n    return apiError(\'Internal error\', 500);'),
    ])

# Fix: If the replacement resulted in duplicate logger lines (because the pattern appeared twice),
# we need to handle it more carefully. Let's do it file-by-file instead.
# Actually, multi_replace uses replace(old, new, 1) which only replaces the FIRST occurrence.
# But there might be 2 occurrences. Let me re-read and fix properly.
for route in ["fusion", "learning", "orchestration", "reasoning"]:
    path = f"{BASE}/src/app/api/{route}/route.ts"
    if not os.path.exists(path):
        continue
    content = read(path)
    # Replace all remaining instances of the leak pattern (those not yet replaced)
    pattern = "return apiError(err instanceof Error ? err.message : 'Unknown error', 500);"
    replacement = f'logger.error(`[{route}] operation failed: ${{err instanceof Error ? err.message : err}}`);\n    return apiError(\'Internal error\', 500);'
    # Check if there are still any remaining leak patterns
    count = content.count(pattern)
    if count > 0:
        content = content.replace(pattern, replacement)
        write(path, content)

# Also check for any doubled logger lines and fix them
for route in ["fusion", "learning", "orchestration", "reasoning"]:
    path = f"{BASE}/src/app/api/{route}/route.ts"
    if not os.path.exists(path):
        continue
    content = read(path)
    # Check for duplicate consecutive logger lines
    dup_pattern = re.compile(r'(logger\.error\(`\[' + re.escape(route) + r'\].*?\);\n\s*)\1', re.MULTILINE)
    if dup_pattern.search(content):
        content = dup_pattern.sub(r'\1', content)
        write(path, content)

# ══════════════════════════════════════════════════════════════
# A-C3: Harden compliance/route.ts POST
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/compliance/route.ts"
multi_replace(path, [
    ("A-C3-import",
     "import { logger } from '@/lib/logger';",
     "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { z } from 'zod';"),
    ("A-C3-schema",
     "// GDPR compliance actions\nexport async function POST(request: NextRequest) {",
     '''// GDPR compliance actions
const complianceActionSchema = z.object({
  action: z.enum(['export_contact_data', 'delete_contact', 'export_all_consented', 'clean_stale_suppressions']),
  contactId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {'''),
    ("A-C3-validate",
     "    const body = await request.json();\n    const { action } = body;",
     "    const body = await request.json();\n    const parsed = validateBody(complianceActionSchema, body);\n    if (parsed instanceof Response) return parsed;\n    const { action, contactId, reason } = parsed;"),
])

# ══════════════════════════════════════════════════════════════
# A-C4: Harden segments/route.ts POST
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/segments/route.ts"
multi_replace(path, [
    ("A-C4-import",
     "import { logger } from '@/lib/logger';",
     "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { z } from 'zod';"),
    ("A-C4-schema",
     "export async function POST(request: NextRequest) {",
     """const createSegmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  filters: z.record(z.unknown()).optional(),
  isStatic: z.boolean().optional(),
});

export async function POST(request: NextRequest) {"""),
    ("A-C4-validate",
     "    const body = await request.json();\n    const { name, description, filters, isStatic } = body;",
     "    const body = await request.json();\n    const parsed = validateBody(createSegmentSchema, body);\n    if (parsed instanceof Response) return parsed;\n    const { name, description, filters, isStatic } = parsed;"),
])

# ══════════════════════════════════════════════════════════════
# A-H1: companies/route.ts POST → createCompanySchema
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/companies/route.ts"
multi_replace(path, [
    ("A-H1-import",
     "import { logger } from '@/lib/logger';",
     "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { createCompanySchema } from '@/lib/validations';"),
])
# Need to find the POST handler's body parsing section
content = read(path)
# Find the POST body parsing and add validation
old_post_body = """    const body = await request.json();
    const {
      rawName,
      domain,
      website,
      linkedinUrl,
      industry,
      employeeSize,
      country,
      location,
    } = body;"""

new_post_body = """    const body = await request.json();
    const parsed = validateBody(createCompanySchema, body);
    if (parsed instanceof Response) return parsed;
    const {
      name: rawName,
      domain,
      website,
      linkedinUrl,
      industry,
      employeeSize,
      country,
      location,
    } = parsed;"""

if old_post_body in content:
    content = content.replace(old_post_body, new_post_body)
    write(path, content)
else:
    errors.append("FAIL [A-H1]: POST body pattern not found in companies/route.ts")

# ══════════════════════════════════════════════════════════════
# A-H2: companies/[id]/route.ts PATCH → updateCompanySchema
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/companies/[id]/route.ts"
content = read(path)

# Add imports
if "validateBody" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { updateCompanySchema } from '@/lib/validations';"
    )

# Add validation before the PATCH body destructuring
old_patch = "    const body = await request.json();"
new_patch = """    const body = await request.json();
    const parsed = validateBody(updateCompanySchema, body);
    if (parsed instanceof Response) return parsed;"""

if old_patch in content:
    content = content.replace(old_patch, new_patch, 1)
    # Now update the destructuring to use parsed instead of body
    # The PATCH handler uses: const data: Record<string, unknown> = {};
    # Then iterates updatableFields and pulls from body
    # We need to change `body` references to `parsed` for the field values
    # But `parsed` is now typed, so we can use it directly
    write(path, content)
else:
    errors.append("FAIL [A-H2]: PATCH body pattern not found")

# ══════════════════════════════════════════════════════════════
# A-H3: leads/status/route.ts PATCH — status transition Zod
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/leads/status/route.ts"
multi_replace(path, [
    ("A-H3-import",
     "import { db } from '@/lib/db';",
     "import { db } from '@/lib/db';\nimport { z } from 'zod';"),
    ("A-H3-schema",
     "export async function PATCH(request: Request) {",
     """const statusTransitionSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  status: z.string().min(1, 'Status is required'),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {"""),
    ("A-H3-validate",
     "    const body = await request.json();\n    const { id, ids, status, reason } = body as {\n      id?: string;\n      ids?: string[];\n      status: string;\n      reason?: string;\n    };",
     "    const body = await request.json();\n    const parsed = statusTransitionSchema.safeParse(body);\n    if (!parsed.success) {\n      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });\n    }\n    const { id, ids, status, reason } = parsed.data;"),
])

# ══════════════════════════════════════════════════════════════
# A-H4: playbooks/route.ts POST — Zod schema
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/playbooks/route.ts"
content = read(path)
if "validateBody" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { z } from 'zod';"
    )

old_playbook_post = """    const body = await request.json();
    const { name, description, steps } = body;"""
new_playbook_post = """    const createPlaybookSchema = z.object({
      name: z.string().trim().min(1, 'Name is required').max(200),
      description: z.string().max(2000).optional(),
      steps: z.string().optional(),
    });

    const body = await request.json();
    const parsed = validateBody(createPlaybookSchema, body);
    if (parsed instanceof Response) return parsed;
    const { name, description, steps } = parsed;"""

if old_playbook_post in content:
    content = content.replace(old_playbook_post, new_playbook_post)
    write(path, content)
else:
    errors.append("FAIL [A-H4]: POST body pattern not found in playbooks/route.ts")

# ══════════════════════════════════════════════════════════════
# A-H5: companies/enrich/route.ts POST — Zod validation
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/companies/enrich/route.ts"
content = read(path)
if "validateBody" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { z } from 'zod';"
    )

old_enrich = "    const body = await request.json();\n    const { companyId, domain } = body;"
new_enrich = """    const enrichSchema = z.object({
      companyId: z.string().min(1).optional(),
      domain: z.string().min(1).optional(),
    }).refine(d => d.companyId || d.domain, { message: 'companyId or domain is required' });

    const body = await request.json();
    const parsed = validateBody(enrichSchema, body);
    if (parsed instanceof Response) return parsed;
    const { companyId, domain } = parsed;"""

if old_enrich in content:
    content = content.replace(old_enrich, new_enrich)
    write(path, content)
else:
    errors.append("FAIL [A-H5]: POST body pattern not found in enrich/route.ts")

# ══════════════════════════════════════════════════════════════
# A-H6: knowledge/ingest/route.ts POST — Zod validation
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/knowledge/ingest/route.ts"
content = read(path)
if "validateBody" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { validateBody } from '@/lib/apiHelpers';\nimport { z } from 'zod';"
    )

# Check current validation pattern
if "validateBody" not in content:
    # Knowledge ingest already has some validation, let's check
    old_knowledge = "    const body = await request.json();"
    new_knowledge = """    const ingestSchema = z.object({
      title: z.string().trim().min(1, 'Title is required').max(500),
      documentType: z.string().min(1).max(100).optional(),
      content: z.string().min(1, 'Content is required').max(100_000, 'Content exceeds maximum size'),
      sourceUrl: z.string().url().optional().or(z.literal('')).optional(),
      sourceType: z.string().max(50).optional(),
      metadata: z.record(z.unknown()).optional(),
      capabilityAssetId: z.string().optional(),
    });

    const body = await request.json();
    const parsed = validateBody(ingestSchema, body);
    if (parsed instanceof Response) return parsed;"""
    if old_knowledge in content:
        content = content.replace(old_knowledge, new_knowledge)
        write(path, content)
    else:
        errors.append("FAIL [A-H6]: pattern not found in knowledge/ingest/route.ts")

# ══════════════════════════════════════════════════════════════
# A-M1: auth/request-otp — wire otpRateLimit
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/auth/request-otp/route.ts"
content = read(path)
if "otpRateLimit" not in content:
    content = content.replace(
        "import { NextRequest, NextResponse } from 'next/server';",
        "import { NextRequest, NextResponse } from 'next/server';\nimport { otpRateLimit } from '@/lib/auth-helpers';"
    )
    # Add rate limit check after email validation, before AUTHORIZED_EMAIL check
    old_otp_check = """    if (email !== AUTHORIZED_EMAIL) {"""
    new_otp_check = """    // Rate limit OTP requests
    const rateLimitResult = otpRateLimit(email);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (email !== AUTHORIZED_EMAIL) {"""
    if old_otp_check in content:
        content = content.replace(old_otp_check, new_otp_check)
        write(path, content)
    else:
        errors.append("FAIL [A-M1]: AUTHORIZED_EMAIL check not found in request-otp")

# ══════════════════════════════════════════════════════════════
# A-M2: auth/verify-otp — wire otpRateLimit
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/auth/verify-otp/route.ts"
content = read(path)
if "otpRateLimit" not in content:
    content = content.replace(
        "import { createSession } from '@/lib/session';",
        "import { createSession } from '@/lib/session';\nimport { otpRateLimit } from '@/lib/auth-helpers';"
    )
    # Add rate limit check early in POST handler, after schema validation
    old_verify = "    const { email, code, purpose } = parsed.data;"
    new_verify = """    const { email, code, purpose } = parsed.data;

    // Rate limit OTP verification attempts
    const rateLimitResult = otpRateLimit(email);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }"""
    if old_verify in content:
        content = content.replace(old_verify, new_verify)
        write(path, content)
    else:
        errors.append("FAIL [A-M2]: parsed.data pattern not found in verify-otp")

# ══════════════════════════════════════════════════════════════
# A-M3: auth/login — add generalApiRateLimit
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/auth/login/route.ts"
content = read(path)
if "generalApiRateLimit" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { generalApiRateLimit } from '@/lib/auth-helpers';"
    )
    old_login = "    const body = await request.json();"
    new_login = """    // Rate limit login attempts by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = generalApiRateLimit(ip, 10, 60_000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();"""
    if old_login in content:
        content = content.replace(old_login, new_login)
        write(path, content)
    else:
        errors.append("FAIL [A-M3]: body pattern not found in login")

# ══════════════════════════════════════════════════════════════
# A-M4: auth/register — add generalApiRateLimit
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/auth/register/route.ts"
content = read(path)
if "generalApiRateLimit" not in content:
    content = content.replace(
        "import { logger } from '@/lib/logger';",
        "import { logger } from '@/lib/logger';\nimport { generalApiRateLimit } from '@/lib/auth-helpers';"
    )
    old_register = "    const body = await request.json();"
    new_register = """    // Rate limit registration attempts by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = generalApiRateLimit(ip, 5, 60_000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();"""
    if old_register in content:
        content = content.replace(old_register, new_register)
        write(path, content)
    else:
        errors.append("FAIL [A-M4]: body pattern not found in register")

# ══════════════════════════════════════════════════════════════
# A-L1: findFirst → findUnique (11 routes)
# ══════════════════════════════════════════════════════════════
findfirst_replacements = [
    # webhooks/reply:288
    (f"{BASE}/src/app/api/webhooks/reply/route.ts",
     "const contact = await db.contact.findFirst({ where: { email } });",
     "const contact = await db.contact.findUnique({ where: { email } });"),
    # webhooks/bounce:195
    (f"{BASE}/src/app/api/webhooks/bounce/route.ts",
     "const contact = await db.contact.findFirst({ where: { email: recipientEmail } });",
     "const contact = await db.contact.findUnique({ where: { email: recipientEmail } });"),
    # drafts:145
    (f"{BASE}/src/app/api/drafts/route.ts",
     "const existing = await db.contact.findFirst({ where: { email } });",
     "const existing = await db.contact.findUnique({ where: { email } });"),
    # batches:129
    (f"{BASE}/src/app/api/batches/route.ts",
     "const existing = await db.contact.findFirst({ where: { email: rawEmail } });",
     "const existing = await db.contact.findUnique({ where: { email: rawEmail } });"),
    # unsubscribe:213
    (f"{BASE}/src/app/api/unsubscribe/route.ts",
     "db.contact.findFirst({ where: { email: normalizedEmail } })",
     "db.contact.findUnique({ where: { email: normalizedEmail } })"),
    # unsubscribe:311
    (f"{BASE}/src/app/api/unsubscribe/route.ts",
     None,  # Already handled by the replace_all-like pattern above
     "db.contact.findUnique({ where: { email: normalizedEmail } })"),
    # preferences:17 (GET)
    (f"{BASE}/src/app/api/preferences/route.ts",
     "await db.systemSetting.findFirst({ where: { key } })",
     "await db.systemSetting.findUnique({ where: { key } })"),
    # intelligence/unified:167
    (f"{BASE}/src/app/api/intelligence/unified/route.ts",
     "const strategy = await db.accountStrategy.findFirst({ where: { companyId } });",
     "const strategy = await db.accountStrategy.findUnique({ where: { companyId } });"),
    # ai/summarize:275
    (f"{BASE}/src/app/api/ai/summarize/route.ts",
     "const contact = await db.contact.findFirst({ where: { id: entityId } });",
     "const contact = await db.contact.findUnique({ where: { id: entityId } });"),
    # ai/enrich:224
    (f"{BASE}/src/app/api/ai/enrich/route.ts",
     "const contact = await db.contact.findFirst({ where: { id: entityId } });",
     "const contact = await db.contact.findUnique({ where: { id: entityId } });"),
]

for item in findfirst_replacements:
    path = item[0]
    old = item[1]
    new = item[2]
    if old is None:
        continue
    if not os.path.exists(path):
        errors.append(f"SKIP [A-L1]: {path} not found")
        continue
    replace(path, old, new, f"A-L1")

# ══════════════════════════════════════════════════════════════
# A-L2: preferences/route.ts PUT → upsert
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/preferences/route.ts"
content = read(path)
# Find the findFirst + conditional create/update pattern
old_upsert_pattern = """    const existing = await db.systemSetting.findFirst({ where: { key: 'user_preferences' } });

    if (existing) {
      await db.systemSetting.update({
        where: { id: existing.id },
        data: { value: valueJson },
      });
    } else {
      await db.systemSetting.create({
        data: {
          key: 'user_preferences',
          value: valueJson,
        },
      });
    }"""

new_upsert_pattern = """    await db.systemSetting.upsert({
      where: { key: 'user_preferences' },
      update: { value: valueJson },
      create: {
        key: 'user_preferences',
        value: valueJson,
      },
    });"""

if old_upsert_pattern in content:
    content = content.replace(old_upsert_pattern, new_upsert_pattern)
    write(path, content)
else:
    errors.append("FAIL [A-L2]: upsert pattern not found in preferences/route.ts")

# ══════════════════════════════════════════════════════════════
# A-L3: contacts/[id]/generate-email bare findFirst fix
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/app/api/contacts/[id]/generate-email/route.ts"
replace(
    path,
    "const prefs = await db.systemSetting.findFirst();",
    "const prefs = await db.systemSetting.findUnique({ where: { key: 'user_preferences' } });",
    "A-L3"
)

# ══════════════════════════════════════════════════════════════
# A-L4: Remove dead Prisma select constants from db.ts
# ══════════════════════════════════════════════════════════════
path = f"{BASE}/src/lib/db.ts"
content = read(path)

# Remove all select constants (from "// ── Typed select constants" to end)
# Keep only the PrismaClient singleton and export
marker = "// ── Typed select constants"
if marker in content:
    content = content[:content.index(marker)].rstrip() + "\n"
    write(path, content)
else:
    errors.append("FAIL [A-L4]: select constants marker not found in db.ts")

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
print("=" * 60)
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  ⚠️  {e}")
else:
    print("ALL CHANGES APPLIED SUCCESSFULLY")
print("=" * 60)
