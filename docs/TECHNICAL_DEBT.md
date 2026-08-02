# DeepMindQ — Technical Debt Register

A living inventory of known technical debt, prioritized by impact and effort.
Last updated: WI-14 (Productization)

---

## UI/UX Technical Debt

### 1. Hardcoded Colors
**~1,827 occurrences across 63 remaining screens** (512 hex + 1,013 Tailwind arbitrary + 302 rgba).

- **Phase A** (WI-14): Fixes top 5 worst offenders via design token migration.
- **Phase B** (future): Needed for remaining 63 screens.
- **Effort:** ~16 hours for Phase B
- **Priority:** Medium (visual consistency, not functional)
- **Impact:** Inconsistent theming, harder to rebrand, accessibility issues with low-contrast hardcoded values.

### 2. No Per-Screen Error Boundaries
Only a global `ErrorBoundary` exists. 67 screens rely on the outer wrapper.

- **Effort:** ~8 hours
- **Priority:** Low (global handler works — screens show error UI rather than white-screening)
- **Impact:** When one screen errors, the entire app may unmount instead of isolating to that screen.

### 3. Responsive Design Gaps
Desktop-first design. No tablet/mobile optimization verified.

- **Effort:** ~20 hours (audit + fix)
- **Priority:** Low (enterprise desktop use case)
- **Impact:** Limited usability on tablets or smaller viewports.

---

## Architecture Technical Debt

### 4. Large Screen Components
4 screens exceed 2,000 lines:

| Screen | Lines |
|---|---|
| `company-profile` | 2,450 |
| `knowledge-library` | 2,382 |
| `settings` | 2,308 |
| `capability` | 2,053 |

- **Effort:** ~16 hours (refactor into sub-components)
- **Priority:** Medium (maintainability)
- **Impact:** Harder to review, test, and modify. Higher bug surface area.

### 5. No Query Optimization Strategy
91 Prisma models with 96 relations. No slow query logging or N+1 detection.

- **Effort:** ~4 hours (add query logging, identify hotspots)
- **Priority:** Medium (performance at scale)
- **Impact:** Potential N+1 queries, slow page loads as data grows.

### 6. No Caching Layer
All API calls hit the database directly. No Redis, no in-memory cache for hot paths.

- **Effort:** ~8 hours
- **Priority:** Low (single-customer deployment model reduces need)
- **Impact:** Redundant database queries for frequently accessed data (e.g., settings, nav config).

---

## Deferred from WI-13

### 7. `__Host-` Cookie Prefix
Not implemented (E-H3 deferred). Session cookies don't use `__Host-` prefix.

- **Effort:** ~1 hour
- **Priority:** Low
- **Impact:** Minor security hardening. Current cookies are secure but not explicitly scoped to the host.

### 8. Session Fixation Protection
Not implemented (E-H4 deferred). No session regeneration on privilege elevation.

- **Effort:** ~2 hours
- **Priority:** Low
- **Impact:** Theoretical risk. Mitigated by OTP-based auth (no password sessions to fixate).

### 9. Absolute Session Expiry
Not implemented (E-H5 deferred). Sessions use rolling expiry only.

- **Effort:** ~1 hour
- **Priority:** Low
- **Impact:** Sessions could theoretically be kept alive indefinitely. Low risk for enterprise dedicated deployment.

---

## Scalability Limits

### 10. Single-Server Architecture
No horizontal scaling. No connection pooling for high concurrency.

- **Effort:** Large (architecture change)
- **Priority:** Future (not needed for dedicated deployment model)
- **Impact:** Each customer deployment handles one organization's load. Horizontal scaling not required until a single customer needs it.

### 11. Embeddings in JSON
Vector embeddings stored as JSON-serialized text, not `pgvector`. Limits semantic search performance at scale.

- **Effort:** ~4 hours (add pgvector column, migrate data)
- **Priority:** Future
- **Impact:** Semantic search works but is slower than native vector operations. Becomes a bottleneck with >100K embeddings.

---

## Recommended Future Work Items (Priority Order)

| # | Item | Effort | Priority | Dependencies |
|---|---|---|---|---|
| F-1 | Design token migration Phase B (remaining 63 screens) | 16h | Medium | None |
| F-2 | Large screen component refactoring (4 screens) | 16h | Medium | None |
| F-3 | Query optimization and slow query logging | 4h | Medium | None |
| F-4 | Responsive design audit and fixes | 20h | Low | F-1 |
| F-5 | Per-screen error handling | 8h | Low | None |
| F-6 | `__Host-` cookie prefix + session fixation | 4h | Low | None |
| F-7 | Caching layer for hot API paths | 8h | Low | None |
| F-8 | pgvector migration for embeddings | 4h | Future | None |

---

## Debt Reduction Strategy

1. **Sprint cadence:** Pick 1-2 items from the Medium priority list per sprint
2. **Low priority items:** Address opportunistically when touching related code
3. **Future items:** Revisit when a customer use case demands it
4. **New debt:** Avoid by enforcing code review checks (component size, hardcoded colors, engine contract)
