-- Phase 6-8: Compliance, Enterprise Admin, DR Models
-- DataAccessAudit, DataDeletionRequest, RetentionPolicy, 
-- ScoringConfigHistory, EnvironmentConfig, BackupRecord

BEGIN;

-- P6.4: Data Access Audit Trail
CREATE TABLE "DataAccessAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataAccessAudit_userId_createdAt_idx" ON "DataAccessAudit"("userId", "createdAt");
CREATE INDEX "DataAccessAudit_entityType_entityId_idx" ON "DataAccessAudit"("entityType", "entityId");
CREATE INDEX "DataAccessAudit_action_createdAt_idx" ON "DataAccessAudit"("action", "createdAt");
CREATE INDEX "DataAccessAudit_createdAt_idx" ON "DataAccessAudit"("createdAt");

-- P6.2: Data Deletion Request (30-day grace)
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "exportDataExportId" TEXT,
    "scope" JSONB NOT NULL,
    "gracePeriodEndsAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");
CREATE INDEX "DataDeletionRequest_requesterId_idx" ON "DataDeletionRequest"("requesterId");
CREATE INDEX "DataDeletionRequest_gracePeriodEndsAt_idx" ON "DataDeletionRequest"("gracePeriodEndsAt");
CREATE INDEX "DataDeletionRequest_createdAt_idx" ON "DataDeletionRequest"("createdAt");

-- P7.4: Retention Policy
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "actionType" TEXT NOT NULL DEFAULT 'delete',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "lastDeletedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RetentionPolicy_entityType_key" UNIQUE ("entityType")
);

CREATE INDEX "RetentionPolicy_entityType_idx" ON "RetentionPolicy"("entityType");
CREATE INDEX "RetentionPolicy_isActive_idx" ON "RetentionPolicy"("isActive");

-- P7.3: Scoring Config History
CREATE TABLE "ScoringConfigHistory" (
    "id" TEXT NOT NULL,
    "previousConfig" JSONB NOT NULL,
    "newConfig" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringConfigHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoringConfigHistory_changedBy_idx" ON "ScoringConfigHistory"("changedBy");
CREATE INDEX "ScoringConfigHistory_createdAt_idx" ON "ScoringConfigHistory"("createdAt");

-- P7.5: Environment Config
CREATE TABLE "EnvironmentConfig" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "databaseUrl" TEXT,
    "deploymentUrl" TEXT,
    "lastPromotedAt" TIMESTAMP(3),
    "promotedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnvironmentConfig_environment_key" UNIQUE ("environment")
);

CREATE INDEX "EnvironmentConfig_environment_idx" ON "EnvironmentConfig"("environment");

-- P8.1: Backup Record
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "storagePath" TEXT,
    "fileSizeBytes" INTEGER,
    "checksum" TEXT,
    "durationMs" INTEGER,
    "snapshotTime" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupRecord_type_idx" ON "BackupRecord"("type");
CREATE INDEX "BackupRecord_status_idx" ON "BackupRecord"("status");
CREATE INDEX "BackupRecord_snapshotTime_idx" ON "BackupRecord"("snapshotTime");
CREATE INDEX "BackupRecord_expiresAt_idx" ON "BackupRecord"("expiresAt");
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

COMMIT;
