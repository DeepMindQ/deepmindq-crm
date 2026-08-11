-- ============================================================================
-- Migration: Phase C — Missing Index Catchup (69 indexes)
-- ============================================================================
-- These indexes are declared in prisma/schema.prisma but were missing from
-- prior migration SQL files. Using CREATE INDEX IF NOT EXISTS for safety.

-- ═══ AdvisorConversation indexes ═══
CREATE INDEX IF NOT EXISTS "AdvisorConversation_companyId_lastActiveAt_idx" ON "AdvisorConversation"("companyId", "lastActiveAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorConversation_createdAt_idx" ON "AdvisorConversation"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorConversation_status_lastActiveAt_idx" ON "AdvisorConversation"("status", "lastActiveAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorConversation_userId_lastActiveAt_idx" ON "AdvisorConversation"("userId", "lastActiveAt" DESC);

-- ═══ AdvisorEscalation indexes ═══
CREATE INDEX IF NOT EXISTS "AdvisorEscalation_conversationId_requestedAt_idx" ON "AdvisorEscalation"("conversationId", "requestedAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorEscalation_status_requestedAt_idx" ON "AdvisorEscalation"("status", "requestedAt" DESC);

-- ═══ AdvisorMessage indexes ═══
CREATE INDEX IF NOT EXISTS "AdvisorMessage_conversationId_createdAt_idx" ON "AdvisorMessage"("conversationId", "createdAt" DESC);

-- ═══ AdvisorSavedBriefing indexes ═══
CREATE INDEX IF NOT EXISTS "AdvisorSavedBriefing_companyId_createdAt_idx" ON "AdvisorSavedBriefing"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdvisorSavedBriefing_createdAt_idx" ON "AdvisorSavedBriefing"("createdAt");

-- ═══ AdvisorWorkspace indexes ═══
CREATE INDEX IF NOT EXISTS "AdvisorWorkspace_updatedAt_idx" ON "AdvisorWorkspace"("updatedAt");

-- ═══ CRMConnection indexes ═══
CREATE INDEX IF NOT EXISTS "CRMConnection_isActive_idx" ON "CRMConnection"("isActive");
CREATE INDEX IF NOT EXISTS "CRMConnection_provider_idx" ON "CRMConnection"("provider");

-- ═══ CRMSyncLog indexes ═══
CREATE INDEX IF NOT EXISTS "CRMSyncLog_connectionId_idx" ON "CRMSyncLog"("connectionId");
CREATE INDEX IF NOT EXISTS "CRMSyncLog_direction_idx" ON "CRMSyncLog"("direction");
CREATE INDEX IF NOT EXISTS "CRMSyncLog_entityType_idx" ON "CRMSyncLog"("entityType");
CREATE INDEX IF NOT EXISTS "CRMSyncLog_syncedAt_idx" ON "CRMSyncLog"("syncedAt");

-- ═══ Company additional indexes ═══
CREATE INDEX IF NOT EXISTS "Company_accountPriorityScore_idx" ON "Company"("accountPriorityScore" DESC);
CREATE INDEX IF NOT EXISTS "Company_status_priorityTier_idx" ON "Company"("status", "priorityTier");

-- ═══ Contact additional indexes ═══
CREATE INDEX IF NOT EXISTS "Contact_companyId_leadScore_idx" ON "Contact"("companyId", "leadScore" DESC);
CREATE INDEX IF NOT EXISTS "Contact_companyId_status_idx" ON "Contact"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Contact_emailHealth_idx" ON "Contact"("emailHealth");

-- ═══ DataExport indexes ═══
CREATE INDEX IF NOT EXISTS "DataExport_createdAt_idx" ON "DataExport"("createdAt");
CREATE INDEX IF NOT EXISTS "DataExport_createdBy_idx" ON "DataExport"("createdBy");
CREATE INDEX IF NOT EXISTS "DataExport_entityType_idx" ON "DataExport"("entityType");
CREATE INDEX IF NOT EXISTS "DataExport_status_idx" ON "DataExport"("status");

-- ═══ EnrichmentJob indexes ═══
CREATE INDEX IF NOT EXISTS "EnrichmentJob_createdAt_idx" ON "EnrichmentJob"("createdAt");
CREATE INDEX IF NOT EXISTS "EnrichmentJob_entityType_entityId_idx" ON "EnrichmentJob"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "EnrichmentJob_providerId_idx" ON "EnrichmentJob"("providerId");
CREATE INDEX IF NOT EXISTS "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

-- ═══ IntelligenceActivationEvent indexes ═══
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_companyId_createdAt_idx" ON "IntelligenceActivationEvent"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_companyId_idx" ON "IntelligenceActivationEvent"("companyId");
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_createdAt_idx" ON "IntelligenceActivationEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_status_idx" ON "IntelligenceActivationEvent"("status");
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_step_idx" ON "IntelligenceActivationEvent"("step");
CREATE INDEX IF NOT EXISTS "IntelligenceActivationEvent_trigger_idx" ON "IntelligenceActivationEvent"("trigger");

-- ═══ IntelligenceSnapshot indexes ═══
CREATE INDEX IF NOT EXISTS "IntelligenceSnapshot_companyId_capturedAt_idx" ON "IntelligenceSnapshot"("companyId", "capturedAt" DESC);

-- ═══ MergeRecord indexes ═══
CREATE INDEX IF NOT EXISTS "MergeRecord_duplicateId_idx" ON "MergeRecord"("duplicateId");
CREATE INDEX IF NOT EXISTS "MergeRecord_entityType_idx" ON "MergeRecord"("entityType");
CREATE INDEX IF NOT EXISTS "MergeRecord_mergedAt_idx" ON "MergeRecord"("mergedAt");
CREATE INDEX IF NOT EXISTS "MergeRecord_survivorId_idx" ON "MergeRecord"("survivorId");

-- ═══ PersistenceHealthSnapshot indexes ═══
CREATE INDEX IF NOT EXISTS "PersistenceHealthSnapshot_createdAt_idx" ON "PersistenceHealthSnapshot"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PersistenceHealthSnapshot_store_createdAt_idx" ON "PersistenceHealthSnapshot"("store", "createdAt" DESC);

-- ═══ PersistenceOperationLog indexes ═══
CREATE INDEX IF NOT EXISTS "PersistenceOperationLog_createdAt_idx" ON "PersistenceOperationLog"("createdAt" DESC);

-- ═══ PriorityScoreHistory indexes ═══
CREATE INDEX IF NOT EXISTS "PriorityScoreHistory_companyId_computedAt_idx" ON "PriorityScoreHistory"("companyId", "computedAt" DESC);

-- ═══ PrivacyRequest indexes ═══
CREATE INDEX IF NOT EXISTS "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_requesterEmail_idx" ON "PrivacyRequest"("requesterEmail");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_slaDeadline_idx" ON "PrivacyRequest"("slaDeadline");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");

-- ═══ ScoringContradictionResolution indexes ═══
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_companyId_idx" ON "ScoringContradictionResolution"("companyId");
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_detectedAt_idx" ON "ScoringContradictionResolution"("detectedAt");
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_scoringSystemA_scoringSystemB_idx" ON "ScoringContradictionResolution"("scoringSystemA", "scoringSystemB");
CREATE INDEX IF NOT EXISTS "ScoringContradictionResolution_severity_idx" ON "ScoringContradictionResolution"("severity");

-- ═══ SecurityFinding indexes ═══
CREATE INDEX IF NOT EXISTS "SecurityFinding_category_idx" ON "SecurityFinding"("category");
CREATE INDEX IF NOT EXISTS "SecurityFinding_discoveredAt_idx" ON "SecurityFinding"("discoveredAt");
CREATE INDEX IF NOT EXISTS "SecurityFinding_remediationDeadline_idx" ON "SecurityFinding"("remediationDeadline");
CREATE INDEX IF NOT EXISTS "SecurityFinding_severity_idx" ON "SecurityFinding"("severity");
CREATE INDEX IF NOT EXISTS "SecurityFinding_status_idx" ON "SecurityFinding"("status");

-- ═══ WebhookDeadLetter indexes ═══
CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_createdAt_idx" ON "WebhookDeadLetter"("createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_event_idx" ON "WebhookDeadLetter"("event");
CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_resolvedAt_idx" ON "WebhookDeadLetter"("resolvedAt");

-- ═══ WebhookDelivery indexes ═══
CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_event_idx" ON "WebhookDelivery"("event");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookConfigId_idx" ON "WebhookDelivery"("webhookConfigId");

-- ═══ AICache index ═══
CREATE INDEX IF NOT EXISTS "AICache_hitCount_idx" ON "AICache"("hitCount" DESC);
