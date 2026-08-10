-- ============================================================================
-- Migration: Phase 4 — Webhook Reliability + Enterprise Integrations
-- Date: 2026-08-10
-- Tables: WebhookDelivery, WebhookDeadLetter
-- ============================================================================

-- ═══ P4.3: Webhook Delivery Tracking ═══
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookConfigId" TEXT,
    "event" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_event_idx" ON "WebhookDelivery"("event");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookConfigId_idx" ON "WebhookDelivery"("webhookConfigId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- ═══ P4.3: Webhook Dead-Letter Queue ═══
CREATE TABLE IF NOT EXISTS "WebhookDeadLetter" (
    "id" TEXT NOT NULL,
    "originalDeliveryId" TEXT,
    "event" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "totalRetries" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_event_idx" ON "WebhookDeadLetter"("event");
CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_resolvedAt_idx" ON "WebhookDeadLetter"("resolvedAt");
CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_createdAt_idx" ON "WebhookDeadLetter"("createdAt");
