-- ============================================================================
-- Migration: Phase 5 — Performance Indexes
-- Date: 2026-08-10
-- Adds composite indexes for high-traffic query patterns
-- ============================================================================

-- ═══ Contact: Composite indexes for filtered contact lists ═══
CREATE INDEX IF NOT EXISTS "Contact_companyId_status_idx" ON "Contact"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Contact_companyId_leadScore_idx" ON "Contact"("companyId", "leadScore" DESC);
CREATE INDEX IF NOT EXISTS "Contact_emailHealth_idx" ON "Contact"("emailHealth");

-- ═══ Company: Composite index for filtered + tiered listings ═══
CREATE INDEX IF NOT EXISTS "Company_status_priorityTier_idx" ON "Company"("status", "priorityTier");
