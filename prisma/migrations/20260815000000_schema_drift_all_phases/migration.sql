-- ============================================================================
-- Migration: Schema Drift — All Phases (1-4) Missing Tables & Columns
-- ============================================================================

-- ═══ ReasoningStep: Add adaptive reasoning columns ═══
ALTER TABLE "ReasoningStep" ADD COLUMN IF NOT EXISTS "depth" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "ReasoningStep" ADD COLUMN IF NOT EXISTS "skippedReason" TEXT;
ALTER TABLE "ReasoningStep" ADD COLUMN IF NOT EXISTS "pathId" TEXT;
ALTER TABLE "ReasoningStep" ADD COLUMN IF NOT EXISTS "reasoningGaps" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "ReasoningStep_depth_idx" ON "ReasoningStep"("depth");
CREATE INDEX IF NOT EXISTS "ReasoningStep_pathId_idx" ON "ReasoningStep"("pathId");

-- ═══ ReasoningStrategy ═══
CREATE TABLE IF NOT EXISTS "ReasoningStrategy" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepDepths" JSONB NOT NULL DEFAULT '{}',
    "skipSteps" JSONB NOT NULL DEFAULT '[]',
    "defaultTier" TEXT NOT NULL DEFAULT 'standard',
    "maxTokensPerStep" INTEGER NOT NULL DEFAULT 2000,
    "prioritySignals" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReasoningStrategy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReasoningStrategy_segment_key" ON "ReasoningStrategy"("segment");

-- ═══ CalibrationCurve ═══
CREATE TABLE IF NOT EXISTS "CalibrationCurve" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "buckets" JSONB NOT NULL DEFAULT '{}',
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correctionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'uncalibrated',
    "lastCalibratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalibrationCurve_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CalibrationCurve_dimension_key" ON "CalibrationCurve"("dimension");

-- ═══ TenantScoringConfig ═══
CREATE TABLE IF NOT EXISTS "TenantScoringConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "confidenceWeights" JSONB NOT NULL DEFAULT '{}',
    "recommendationWeights" JSONB NOT NULL DEFAULT '{}',
    "prioritySignals" JSONB NOT NULL DEFAULT '[]',
    "targetIndustries" JSONB NOT NULL DEFAULT '[]',
    "targetSizeRange" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantScoringConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantScoringConfig_tenantId_key" ON "TenantScoringConfig"("tenantId");

-- ═══ ScoringContradictionResolution ═══
CREATE TABLE IF NOT EXISTS "ScoringContradictionResolution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scoringSystemA" TEXT NOT NULL,
    "scoringSystemB" TEXT NOT NULL,
    "scoreA" DOUBLE PRECISION NOT NULL,
    "scoreB" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "resolutionStrategy" TEXT NOT NULL DEFAULT 'weighted_average',
    "resolvedScore" DOUBLE PRECISION,
    "resolutionReason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ScoringContradictionResolution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_companyId_idx" ON "ScoringContradictionResolution"("companyId");
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_severity_idx" ON "ScoringContradictionResolution"("severity");

-- ═══ IntelligenceActivationEvent ═══
CREATE TABLE IF NOT EXISTS "IntelligenceActivationEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "detail" TEXT,
    "error" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceActivationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_companyId_idx" ON "IntelligenceActivationEvent"("companyId");
CREATE INDEX IF NOT EXISTS "IntelligenceEvent_createdAt_idx" ON "IntelligenceActivationEvent"("createdAt");

-- ═══ Compliance & Security Tables ═══
CREATE TABLE IF NOT EXISTS "ComprehensiveAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComprehensiveAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ComprehensiveAuditLog_action_idx" ON "ComprehensiveAuditLog"("action");
CREATE INDEX IF NOT EXISTS "ComprehensiveAuditLog_entity_entityId_createdAt_idx" ON "ComprehensiveAuditLog"("entity", "entityId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "contactId" TEXT,
    "description" TEXT NOT NULL,
    "dataSubjectId" TEXT,
    "responseNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "slaDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");

CREATE TABLE IF NOT EXISTS "SecurityFinding" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owaspCategory" TEXT,
    "cvssScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affectedEndpoints" TEXT NOT NULL DEFAULT '[]',
    "remediation" TEXT NOT NULL,
    "remediationDeadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "evidence" TEXT,
    "externalTestRef" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediatedAt" TIMESTAMP(3),
    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityFinding_severity_idx" ON "SecurityFinding"("severity");
CREATE INDEX IF NOT EXISTS "SecurityFinding_status_idx" ON "SecurityFinding"("status");

-- ═══ CRM & Integration Tables ═══
CREATE TABLE IF NOT EXISTS "CRMConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "instanceUrl" TEXT,
    "scopes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncMode" TEXT NOT NULL DEFAULT 'manual',
    "syncInterval" INTEGER NOT NULL DEFAULT 3600,
    "fieldMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CRMConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CRMSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "crmExternalId" TEXT,
    "action" TEXT NOT NULL,
    "syncDuration" INTEGER,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CRMSyncLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CRMSyncLog_connectionId_idx" ON "CRMSyncLog"("connectionId");

CREATE TABLE IF NOT EXISTS "MergeRecord" (
    "id" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "duplicateId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "mergedBy" TEXT,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergeReason" TEXT NOT NULL,
    "fieldsKept" JSONB,
    CONSTRAINT "MergeRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MergeRecord_survivorId_idx" ON "MergeRecord"("survivorId");

-- ═══ Enrichment & Export Tables ═══
CREATE TABLE IF NOT EXISTS "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "confidence" DOUBLE PRECISION,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "resultData" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

CREATE TABLE IF NOT EXISTS "DataExport" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "filters" JSONB,
    "fields" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "exportedRows" INTEGER NOT NULL DEFAULT 0,
    "fileSize" INTEGER,
    "filePath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataExport_status_idx" ON "DataExport"("status");

CREATE TABLE IF NOT EXISTS "ImportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "columnMap" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);
