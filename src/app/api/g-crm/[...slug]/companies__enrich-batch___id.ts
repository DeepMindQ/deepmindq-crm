/**
 * Individual batch enrichment job endpoint.
 * Re-exports GET and DELETE from the parent module,
 * but the route matcher passes `id` via params.
 *
 * POST /api/g-crm/companies/enrich-batch/[id]  — not used (start via parent)
 * GET  /api/g-crm/companies/enrich-batch/[id]  — poll progress + process next
 * DELETE /api/g-crm/companies/enrich-batch/[id]  — cancel job
 */

export { GET, DELETE } from './companies__enrich-batch';