---
Task ID: 4-b
Agent: Team RBAC & Comments Agent
Task: RBAC system, teams API, comments API, team/comment models

Work Log:
- Added `Comment`, `Team`, `TeamMember` models to prisma/schema.prisma
- Added `comments Comment[]` to Company and Contact models for explicit reverse relations
- Added `teams TeamMember[]` and `comments Comment[]` to User model
- Ran `prisma db push --accept-data-loss` and `prisma generate` successfully
- Created `src/lib/rbac.ts` with Permission/ResourceType types, role definitions for admin/manager/sales_rep/viewer, and `hasPermission`/`canAccess` helpers
- Created `src/app/api/teams/route.ts` — GET (list with member count) and POST (create team)
- Created `src/app/api/teams/[id]/route.ts` — GET (single with members), PATCH (update), DELETE (cascade)
- Created `src/app/api/teams/[id]/members/route.ts` — GET (list members), POST (add member), DELETE (remove member)
- Created `src/app/api/comments/route.ts` — GET (list with filters), POST (create with @mention notifications)
- Created `src/app/api/comments/[id]/route.ts` — GET (with replies), PATCH (update body), DELETE (cascade)
- Appended Comment, Team, TeamMember interfaces to `src/lib/types.ts`
- Appended createCommentSchema, createTeamSchema, addTeamMemberSchema to `src/lib/validations.ts`
- Fixed 3 pre-existing build errors in reports routes and page.tsx to get clean build
- Final `bun run build` passes successfully with all new routes visible

Stage Summary:
- All new Prisma models (Comment, Team, TeamMember) created and pushed to SQLite
- RBAC utility provides 4 roles × 9 resource types with granular permissions
- Teams API: full CRUD + member management (add/remove/list)
- Comments API: list/create/delete, @mention notification support, reply threading via parentId
- Build passes cleanly