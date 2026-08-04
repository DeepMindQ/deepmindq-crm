const fs = require('fs')
const path = require('path')

const base = '/home/z/my-project'

// ═══════════════════════════════════════════════════════════════
// Fix 1: inbox-api.test.ts — replace dynamic imports with static
// ═══════════════════════════════════════════════════════════════

let inbox = fs.readFileSync(path.join(base, 'tests/api/inbox-api.test.ts'), 'utf-8')

// Replace all dynamic imports with proper paths
inbox = inbox.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/stats\/route'\)/g,
  "// handler imported statically below\n    const { $1 } = inboxStatsHandlers"
)
inbox = inbox.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/\[id\]\/review\/route'\)/g,
  "// handler imported statically below\n    const { $1 } = reviewHandlers"
)
inbox = inbox.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/\[id\]\/convert\/route'\)/g,
  "// handler imported statically below\n    const { $1 } = convertHandlers"
)
inbox = inbox.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/\[id\]\/dismiss\/route'\)/g,
  "// handler imported statically below\n    const { $1 } = dismissHandlers"
)
inbox = inbox.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/route'\)/g,
  "// handler imported statically below\n    const { $1 } = inboxHandlers"
)

// Add static imports at top
const inboxStaticImports = `
// Static route handler imports
import { GET as inboxStatsGET } from '@/app/api/g-intel-acquisition/inbox/stats/route'
import { GET as inboxGET, POST as inboxPOST } from '@/app/api/g-intel-acquisition/inbox/route'
import { POST as reviewPOST } from '@/app/api/g-intel-acquisition/inbox/[id]/review/route'
import { POST as convertPOST } from '@/app/api/g-intel-acquisition/inbox/[id]/convert/route'
import { POST as dismissPOST } from '@/app/api/g-intel-acquisition/inbox/[id]/dismiss/route'

const inboxStatsHandlers = { GET: inboxStatsGET }
const inboxHandlers = { GET: inboxGET, POST: inboxPOST }
const reviewHandlers = { POST: reviewPOST }
const convertHandlers = { POST: convertPOST }
const dismissHandlers = { POST: dismissPOST }
`

// Insert static imports after the vi.mock block (before the Stats API section)
inbox = inbox.replace(
  "// Stats API\n// ═",
  inboxStaticImports + "\n// Stats API\n// ═"
)

fs.writeFileSync(path.join(base, 'tests/api/inbox-api.test.ts'), inbox)
console.log('Fixed inbox-api.test.ts')

// ═══════════════════════════════════════════════════════════════
// Fix 2: batch-dismiss-api.test.ts — replace dynamic imports
// ═══════════════════════════════════════════════════════════════

let batchDismiss = fs.readFileSync(path.join(base, 'tests/api/batch-dismiss-api.test.ts'), 'utf-8')

batchDismiss = batchDismiss.replace(
  /const \{ POST \} = await import\('\.\.\/route'\)/g,
  "// handler imported statically below\n    const { POST } = batchDismissHandlers"
)

const batchStaticImports = `
// Static route handler import
import { POST as batchDismissPOST } from '@/app/api/g-intel-acquisition/inbox/batch-dismiss/route'

const batchDismissHandlers = { POST: batchDismissPOST }
`

// Insert after vi.mock blocks, before describe
batchDismiss = batchDismiss.replace(
  /describe\('POST \/api\/g-intel-acquisition/,
  batchStaticImports + "\ndescribe('POST /api/g-intel-acquisition"
)

fs.writeFileSync(path.join(base, 'tests/api/batch-dismiss-api.test.ts'), batchDismiss)
console.log('Fixed batch-dismiss-api.test.ts')

// ═══════════════════════════════════════════════════════════════
// Fix 3: data-import-api.test.ts — replace dynamic imports
// ═══════════════════════════════════════════════════════════════

let dataImport = fs.readFileSync(path.join(base, 'tests/api/data-import-api.test.ts'), 'utf-8')

dataImport = dataImport.replace(
  /const \{ GET \} = await import\('\.\.\/\[id\]\/route'\);?/g,
  "// handler imported statically below\n    const { GET } = dataImportIdHandlers;"
)
dataImport = dataImport.replace(
  /const \{ (GET|POST) \} = await import\('\.\.\/route'\);?/g,
  "// handler imported statically below\n    const { $1 } = dataImportHandlers;"
)

const dataImportStaticImports = `
// Static route handler imports
import { GET as dataImportGET, POST as dataImportPOST } from '@/app/api/data-import/route'
import { GET as dataImportIdGET } from '@/app/api/data-import/[id]/route'

const dataImportHandlers = { GET: dataImportGET, POST: dataImportPOST }
const dataImportIdHandlers = { GET: dataImportIdGET }
`

// Insert after vi.mock blocks
dataImport = dataImport.replace(
  /describe\('GET \/api\/data-import/,
  dataImportStaticImports + "\ndescribe('GET /api/data-import"
)

fs.writeFileSync(path.join(base, 'tests/api/data-import-api.test.ts'), dataImport)
console.log('Fixed data-import-api.test.ts')

console.log('Done fixing API test files with broken relative imports.')
