-- Migration: Add ConversationPlan table
-- This file should be run against the production PostgreSQL database

CREATE TABLE IF NOT EXISTS "ConversationPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "executiveRole" TEXT NOT NULL,
    "executiveName" TEXT,
    "industry" TEXT,
    "context" TEXT,
    "capabilities" TEXT,
    "plan" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ConversationPlan_companyName_idx" ON "ConversationPlan"("companyName");
CREATE INDEX IF NOT EXISTS "ConversationPlan_createdAt_idx" ON "ConversationPlan"("createdAt");