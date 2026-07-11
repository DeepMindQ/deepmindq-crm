# Task 1-c: Seed Data & APIs Agent — Work Record

## Deliverables

### 1. Seed Script (`scripts/seed-demo.ts`)
- Comprehensive demo data for DeepMindQ CRM
- FK-safe deletion of all 23 models before seeding
- Creates: 1 admin user (bcrypt), 32 companies, 128 contacts, 18 research cards, 35 opportunities, 90 timeline entries, 42 notes, 21 drafts, 35 health checks, 6 knowledge documents (21 snippets), 10 notifications, 1 user preferences

### 2. Notifications API
- `GET /api/notifications` — list with `?unread`, `?type`, `?limit`, `?offset`; returns `{ data, unreadCount }`
- `POST /api/notifications` — create with Zod validation
- `PATCH /api/notifications/[id]` — mark read/unread
- `POST /api/notifications/mark-all-read` — batch mark all as read
- `DELETE /api/notifications/[id]` — delete

### 3. Tasks API
- `GET /api/tasks` — list with `?status`, `?priority`, `?companyId`, `?limit`, `?offset`; includes `companyName`/`contactName` enrichment
- `POST /api/tasks` — create with company/contact validation + timeline entry
- `GET /api/tasks/[id]` — single task with enrichment
- `PATCH /api/tasks/[id]` — update; auto-sets `completedAt` on status→completed; creates timeline on status change
- `DELETE /api/tasks/[id]` — delete with timeline entry

### 4. Validation Schemas (added to `src/lib/validations.ts`)
- `createTaskSchema`, `updateTaskSchema`, `createNotificationSchema`, `markNotificationReadSchema`
- Constants: `TASK_STATUSES`, `TASK_PRIORITIES`, `NOTIFICATION_TYPES`
- Types: `CreateTaskInput`, `UpdateTaskInput`, `CreateNotificationInput`, `MarkNotificationReadInput`

## Key Decisions
- Used dynamic `getDevUserId()` lookup instead of hardcoded ID (actual user IDs are CUIDs, not '1')
- Task model has no Prisma relations to Company/Contact — used manual batched enrichment instead of `include`
- Research card content uses industry-specific template functions instead of a broken template-literal approach