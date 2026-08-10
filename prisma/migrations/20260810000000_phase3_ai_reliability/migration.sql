-- ============================================================================
-- Migration: Phase 3 — AI Reliability & Accuracy
-- Date: 2026-08-10
-- Tables: AIGenerationSnapshot, AIExperiment
-- ============================================================================

-- ═══ P3.3: AI Output Versioning ═══
-- Versioned snapshots of AI-generated output for diff/history/comparison.
-- Every AI generation gets a versioned snapshot.

CREATE TABLE IF NOT EXISTS "AIGenerationSnapshot" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "generationType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governanceChecks" JSONB DEFAULT '{}',
    "hallucinationRisk" DOUBLE PRECISION,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGenerationSnapshot_pkey" PRIMARY KEY ("id")
);

-- Self-referential FK for version chain
ALTER TABLE "AIGenerationSnapshot" ADD CONSTRAINT "AIGenerationSnapshot_previousVersionId_fkey"
    FOREIGN KEY ("previousVersionId") REFERENCES "AIGenerationSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "AIGenerationSnapshot_entityType_entityId_generationType_idx" ON "AIGenerationSnapshot"("entityType", "entityId", "generationType");
CREATE INDEX IF NOT EXISTS "AIGenerationSnapshot_entityType_entityId_generationType_version_idx" ON "AIGenerationSnapshot"("entityType", "entityId", "generationType", "version");
CREATE INDEX IF NOT EXISTS "AIGenerationSnapshot_createdAt_idx" ON "AIGenerationSnapshot"("createdAt");
CREATE INDEX IF NOT EXISTS "AIGenerationSnapshot_generationType_idx" ON "AIGenerationSnapshot"("generationType");
CREATE INDEX IF NOT EXISTS "AIGenerationSnapshot_previousVersionId_idx" ON "AIGenerationSnapshot"("previousVersionId");

-- ═══ P3.6: AI Experiment Persistence ═══
-- Persists A/B testing experiments (prompt, model, scoring_weights) across restarts.

CREATE TABLE IF NOT EXISTS "AIExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "experimentType" TEXT NOT NULL DEFAULT 'prompt',
    "promptId" TEXT,
    "targetEntity" TEXT,
    "variants" JSONB NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "results" JSONB,
    "winner" TEXT,
    "confidence" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIExperiment_pkey" PRIMARY KEY ("id")
);

-- Indexes for experiment queries
CREATE INDEX IF NOT EXISTS "AIExperiment_status_idx" ON "AIExperiment"("status");
CREATE INDEX IF NOT EXISTS "AIExperiment_experimentType_idx" ON "AIExperiment"("experimentType");
CREATE INDEX IF NOT EXISTS "AIExperiment_createdAt_idx" ON "AIExperiment"("createdAt");
