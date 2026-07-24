-- Wave 8A Day 1: Intelligence Object Framework Schema Migration
-- Adds 4 fields to CompanySignal to complete the Intelligence Object standard
-- Every AI signal will now carry: businessImpact, recommendedAction, timingWindow, expiresAt

BEGIN;

-- 1. Add Intelligence Object fields to CompanySignal
ALTER TABLE "CompanySignal" ADD COLUMN IF NOT EXISTS "businessImpact" TEXT;
ALTER TABLE "CompanySignal" ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;
ALTER TABLE "CompanySignal" ADD COLUMN IF NOT EXISTS "timingWindow" TEXT;
ALTER TABLE "CompanySignal" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- 2. Add indexes for timing and expiry queries
CREATE INDEX IF NOT EXISTS "CompanySignal_timingWindow_idx" ON "CompanySignal" ("timingWindow");
CREATE INDEX IF NOT EXISTS "CompanySignal_expiresAt_idx" ON "CompanySignal" ("expiresAt");

-- 3. Add compound index for finding active non-expired signals
-- (status = 'active' OR status = 'detected' OR status = 'validated') AND (expiresAt IS NULL OR expiresAt > NOW())
-- Note: PostgreSQL can't do functional partial indexes easily, so we create a simple compound
CREATE INDEX IF NOT EXISTS "CompanySignal_status_expiresAt_idx" ON "CompanySignal" ("status", "expiresAt");

-- 4. Backfill existing signals with Intelligence Object defaults
-- For existing signals, derive timingWindow from severity and expiresAt from signalDate + 90 days
UPDATE "CompanySignal"
SET "timingWindow" = CASE
  WHEN severity = 'critical' THEN 'immediate'
  WHEN severity = 'high' THEN 'within_7_days'
  WHEN severity = 'medium' THEN 'within_30_days'
  WHEN severity = 'low' THEN 'within_90_days'
  ELSE 'within_30_days'
END
WHERE "timingWindow" IS NULL;

UPDATE "CompanySignal"
SET "expiresAt" = CASE
  WHEN "signalDate" IS NOT NULL THEN "signalDate" + INTERVAL '90 days'
  ELSE NOW() + INTERVAL '90 days'
END
WHERE "expiresAt" IS NULL;

-- 5. Add comment documenting the Intelligence Object Framework
COMMENT ON COLUMN "CompanySignal"."businessImpact" IS 'Intelligence Object field: What this signal means for revenue/sales (e.g., "High — indicates $2M cloud migration budget")';
COMMENT ON COLUMN "CompanySignal"."recommendedAction" IS 'Intelligence Object field: What the sales team should do (e.g., "Position cloud optimization assessment within 30 days")';
COMMENT ON COLUMN "CompanySignal"."timingWindow" IS 'Intelligence Object field: When to act — immediate, within_7_days, within_30_days, within_90_days, ongoing, expired';
COMMENT ON COLUMN "CompanySignal"."expiresAt" IS 'Intelligence Object field: When this signal intelligence decays to zero (NULL = never expires)';

COMMIT;
