-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('new', 'prospect', 'researching', 'active', 'engaged', 'paused', 'archived', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "CompanyLifecycleStage" AS ENUM ('discovery', 'qualification', 'proposal', 'negotiation', 'closed');

-- CreateEnum
CREATE TYPE "CompanyPriorityTier" AS ENUM ('HOT', 'ACTIVE', 'NURTURE', 'LOW');

-- CreateEnum
CREATE TYPE "CompanySource" AS ENUM ('import', 'manual', 'crm', 'webhook', 'demo');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'engaged', 'imported', 'cleaned', 'duplicate', 'drafted', 'queued', 'sent', 'replied', 'bounced', 'suppressed', 'archived');

-- CreateEnum
CREATE TYPE "ContactConsentStatus" AS ENUM ('unknown', 'opted_in', 'opted_out');

-- CreateEnum
CREATE TYPE "ContactEmailHealth" AS ENUM ('unknown', 'valid', 'risky', 'invalid');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('linkedin', 'event', 'referral', 'cold_list', 'inbound', 'manual');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('funding', 'hiring', 'leadership_change', 'leadership', 'tech_change', 'technology', 'news', 'mention', 'partnership', 'expansion', 'people_change', 'internal_memory');

-- CreateEnum
CREATE TYPE "SignalSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "SignalImpact" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('detected', 'validated', 'active', 'aging', 'expired', 'archived');

-- CreateEnum
CREATE TYPE "SignalTimingWindow" AS ENUM ('immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired');

-- CreateEnum
CREATE TYPE "SignalMeaningCategory" AS ENUM ('budget_available', 'leadership_openness', 'tech_dissatisfaction', 'growth_pressure', 'compliance_requirement', 'vendor_evaluation', 'unknown');

-- CreateEnum
CREATE TYPE "SignalSourceQuality" AS ENUM ('premium', 'standard', 'low');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('enrichment', 'research', 'scoring', 'signal_detection', 'email_generation');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'sent');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('staged', 'processing', 'completed', 'archived', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('HOT_ACCOUNT', 'WARM_ACCOUNT', 'NURTURE', 'AT_RISK');

-- CreateEnum
CREATE TYPE "IntelligencePersistenceStore" AS ENUM ('knowledge_graph_nodes', 'knowledge_graph_edges', 'ai_memory', 'retrieval_index', 'retrieval_corpus_stats', 'retrieval_metrics');

-- CreateEnum
CREATE TYPE "KnowledgeGraphEntityType" AS ENUM ('company', 'person', 'technology', 'industry', 'role', 'location', 'product', 'financial', 'event', 'generic', 'capability', 'signal', 'opportunity', 'document', 'conversation');

-- CreateEnum
CREATE TYPE "KnowledgeGraphRelationship" AS ENUM ('WORKS_AT', 'WORKED_AT', 'BOARD_MEMBER_OF', 'REPORTS_TO', 'PARTNERS_WITH', 'COMPETES_WITH', 'ACQUIRED_BY', 'INVESTED_IN', 'SUPPLIES_TO', 'VENDOR_FOR', 'USES_TECHNOLOGY', 'DEPLOYS_ON', 'MIGRATED_FROM', 'MIGRATED_TO', 'INTEGRATES_WITH', 'BUILDS_ON', 'HAS_SIGNAL', 'INDICATES_OPPORTUNITY', 'MATCHES_CAPABILITY', 'INFLUENCES', 'MENTIONS', 'SUPPORTS_CLAIM', 'CONTRADICTS_CLAIM', 'HAPPENED_BEFORE', 'HAPPENED_DURING', 'DERIVED_FROM', 'EXTRACTED_FROM', 'RELATED_TO', 'SIMILAR_TO');

-- CreateEnum
CREATE TYPE "AIMemoryLayer" AS ENUM ('working', 'conversation', 'enterprise', 'institutional');

-- CreateEnum
CREATE TYPE "AIMemoryCategory" AS ENUM ('company_intelligence', 'contact_intelligence', 'signal_analysis', 'conversation_history', 'user_preference', 'reasoning_chain', 'learning_insight', 'capability_knowledge', 'competitive_intelligence', 'market_knowledge', 'feedback', 'error_correction');

-- CreateEnum
CREATE TYPE "AIMemoryPriority" AS ENUM ('critical', 'high', 'medium', 'low', 'ephemeral');

-- CreateEnum
CREATE TYPE "AIMemorySource" AS ENUM ('ai_generation', 'user_input', 'system_detection', 'external_intelligence', 'human_intelligence', 'learning_event', 'conversation', 'api_call');

-- CreateEnum
CREATE TYPE "RetrievalSourceTier" AS ENUM ('premium', 'standard', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "PersistenceOperationStatus" AS ENUM ('pending', 'completed', 'failed', 'dead_letter');

-- CreateEnum
CREATE TYPE "IntelligenceScopeType" AS ENUM ('global', 'company_scoped');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "editedName" TEXT,
    "email" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "title" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "companyId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "consentStatus" "ContactConsentStatus" NOT NULL DEFAULT 'unknown',
    "emailHealth" "ContactEmailHealth" NOT NULL DEFAULT 'unknown',
    "emailHealthScore" INTEGER NOT NULL DEFAULT 0,
    "status" "ContactStatus" NOT NULL DEFAULT 'imported',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressionReason" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "companyFitScore" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "enrichmentScore" INTEGER NOT NULL DEFAULT 0,
    "aiConversionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enrichmentData" JSONB,
    "consentSource" TEXT,
    "consentDate" TIMESTAMP(3),
    "consentIp" TEXT,
    "assignedTo" TEXT,
    "source" "ContactSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "sizeRange" TEXT,
    "location" TEXT,
    "country" TEXT,
    "website" TEXT,
    "internalSummary" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "CompanyStatus" NOT NULL DEFAULT 'prospect',
    "lifecycleStage" "CompanyLifecycleStage" NOT NULL DEFAULT 'discovery',
    "assignedTo" TEXT,
    "intelligenceScore" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "accountPriorityScore" DOUBLE PRECISION,
    "priorityTier" "CompanyPriorityTier",
    "priorityComputedAt" TIMESTAMP(3),
    "lastEnrichedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "source" "CompanySource" NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "questionableRows" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'staged',
    "mappingProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyResearchCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessOverview" TEXT,
    "techLandscape" TEXT,
    "potentialChallenges" TEXT,
    "possibleOpportunities" TEXT,
    "relevantServices" TEXT,
    "keyDecisionMakers" TEXT,
    "internalNotes" TEXT,
    "revenue" TEXT,
    "employeeCount" TEXT,
    "fundingStage" TEXT,
    "techStack" JSONB,
    "socialProfiles" JSONB,
    "enrichmentSource" TEXT,
    "enrichmentDate" TIMESTAMP(3),
    "fieldConfidence" JSONB,
    "industry" TEXT,
    "website" TEXT,
    "keyPeople" JSONB DEFAULT '[]',
    "recentNews" JSONB DEFAULT '[]',
    "structuredTechLandscape" JSONB DEFAULT '{}',
    "strategicPriorities" JSONB DEFAULT '[]',
    "businessProblems" JSONB DEFAULT '[]',
    "transformationAreas" JSONB DEFAULT '[]',
    "technologyThemes" JSONB DEFAULT '[]',
    "profileFreshnessAt" TIMESTAMP(3),
    "signalFreshnessAt" TIMESTAMP(3),
    "contactFreshnessAt" TIMESTAMP(3),
    "techFreshnessAt" TIMESTAMP(3),
    "lastResearchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyResearchCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "body" TEXT NOT NULL,
    "author" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalType" "SignalType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "severity" "SignalSeverity" NOT NULL DEFAULT 'medium',
    "impact" "SignalImpact" NOT NULL DEFAULT 'medium',
    "signalDate" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "opportunityType" TEXT,
    "publicationDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "buyingArea" TEXT,
    "techRequirement" TEXT,
    "serviceRequirement" TEXT,
    "matchingCapability" TEXT,
    "sourceQuality" "SignalSourceQuality" NOT NULL DEFAULT 'standard',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "meaningCategory" "SignalMeaningCategory",
    "businessImpact" TEXT,
    "recommendedAction" TEXT,
    "timingWindow" "SignalTimingWindow",
    "expiresAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" "SignalStatus" NOT NULL DEFAULT 'detected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "searchQuery" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceName" TEXT,
    "snippet" TEXT NOT NULL,
    "extractedField" TEXT,
    "extractedValue" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceDate" TIMESTAMP(3),
    "sourceQualityTier" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTimelineEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serviceLine" TEXT,
    "targetIndustries" TEXT,
    "targetRoles" TEXT,
    "targetCompanySizes" TEXT,
    "problems" TEXT,
    "evidence" TEXT,
    "content" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentAssetId" TEXT,
    "tags" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "usedInEmails" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "solution" TEXT,
    "accelerator" TEXT,
    "technology" TEXT,
    "industry" TEXT,
    "businessProblem" TEXT,
    "customerOutcome" TEXT,
    "differentiator" TEXT,
    "caseStudyRef" TEXT,
    "proofPointRef" TEXT,
    "keywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "serviceLine" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "category" TEXT,
    "variables" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceLine" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT,
    "triggerSignalId" TEXT,
    "triggerCapabilityMatchId" TEXT,
    "triggerReason" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'manual',
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 3,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "templateId" TEXT,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextStepAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "confidenceScore" INTEGER,
    "sourceSnippetsUsed" TEXT,
    "assumptionFlags" TEXT,
    "reviewNotes" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'pending_review',
    "rejectReason" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "variantLabel" TEXT,
    "abTestId" TEXT,
    "trackingPixelId" TEXT,
    "sequenceId" TEXT,
    "sequenceStepId" TEXT,
    "assigneeId" TEXT,
    "governanceAuditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendQueue" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "provider" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "bounced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "queueId" TEXT,
    "contactId" TEXT NOT NULL,
    "draftId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "winnerVariant" TEXT,
    "totalSends" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "draftId" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "category" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bounce" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "queueId" TEXT,
    "bounceType" TEXT,
    "reason" TEXT,
    "providerData" TEXT,
    "bouncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bounce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "removalReason" TEXT,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" TEXT NOT NULL,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "isStatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentContact" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "executiveRole" TEXT NOT NULL,
    "executiveName" TEXT,
    "industry" TEXT,
    "context" TEXT,
    "capabilities" TEXT,
    "plan" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "targetIndustry" TEXT,
    "targetRole" TEXT,
    "targetCompanySize" TEXT,
    "steps" JSONB NOT NULL,
    "aiTips" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountStrategy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "currentSituation" TEXT,
    "swotAnalysis" JSONB,
    "keyInitiatives" JSONB,
    "stakeholderMap" JSONB,
    "competitivePosition" TEXT,
    "nextSteps" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "designation" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "passwordHash" TEXT,
    "hasPassword" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataUpload" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'created',
    "columnMapping" TEXT NOT NULL,
    "consentSource" TEXT NOT NULL DEFAULT 'manual_upload',
    "leadSource" TEXT NOT NULL DEFAULT 'manual',
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadRow" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "mappedData" TEXT,
    "normalizedData" TEXT,
    "validationIssues" TEXT,
    "suggestedCorrections" TEXT,
    "appliedCorrections" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "duplicateOfRow" INTEGER,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMappingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnMappingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValidationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizationMapping" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalizationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringWeight" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "field" TEXT,
    "key" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizationLog" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "uploadRowId" TEXT,
    "rowIndex" INTEGER,
    "category" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "ruleApplied" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityScore" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "uploadRowId" TEXT,
    "rowIndex" INTEGER,
    "companyId" TEXT,
    "totalScore" INTEGER NOT NULL,
    "completenessScore" INTEGER NOT NULL,
    "validityScore" INTEGER NOT NULL,
    "richnessScore" INTEGER NOT NULL,
    "details" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "companyId" TEXT,
    "contactId" TEXT,
    "batchId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "stepDetail" JSONB,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "errorCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "step" TEXT,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGenerationAudit" (
    "id" TEXT NOT NULL,
    "generationType" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "researchContextVersion" TEXT,
    "evidenceIdsUsed" JSONB NOT NULL DEFAULT '[]',
    "signalIdsUsed" JSONB NOT NULL DEFAULT '[]',
    "capabilityAssetIdsUsed" JSONB NOT NULL DEFAULT '[]',
    "researchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "governancePassed" BOOLEAN NOT NULL DEFAULT true,
    "governanceChecks" JSONB DEFAULT '{}',
    "outputSummary" TEXT,
    "modelUsed" TEXT,
    "promptVersion" TEXT,
    "inputParams" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGenerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalCapabilityMatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "businessProblem" TEXT,
    "expectedOutcome" TEXT,
    "salesAngle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalCapabilityMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityRecommendation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "capabilityMatchId" TEXT NOT NULL,
    "opportunityTitle" TEXT NOT NULL,
    "businessTrigger" TEXT NOT NULL,
    "whyNow" TEXT NOT NULL,
    "businessProblem" TEXT NOT NULL,
    "recommendedCapability" TEXT NOT NULL,
    "recommendedStakeholders" TEXT NOT NULL DEFAULT '[]',
    "suggestedConversation" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunityScore" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "rejectionReason" TEXT,
    "rejectionFeedback" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confidenceBreakdown" JSONB,
    "confidenceFactors" JSONB,

    CONSTRAINT "OpportunityRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pursuit" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "owner" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'active',
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "outcome" TEXT,
    "outcomeStage" TEXT,
    "notes" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pursuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceValidation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedBy" TEXT,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "artifactSnapshot" JSONB,
    "rating" INTEGER NOT NULL,
    "accuracy" TEXT,
    "relevance" TEXT,
    "actionability" TEXT,
    "feedback" TEXT,
    "validatorContext" JSONB,

    CONSTRAINT "IntelligenceValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalValidation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'WEAK',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "sourceDomainCount" INTEGER NOT NULL DEFAULT 0,
    "signalAge" INTEGER NOT NULL DEFAULT 0,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyIntelligenceHealth" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dataCompletenessScore" INTEGER NOT NULL DEFAULT 0,
    "signalCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "contactCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "overallHealthScore" INTEGER NOT NULL DEFAULT 0,
    "fieldCoverage" JSONB,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "activeSignals" INTEGER NOT NULL DEFAULT 0,
    "totalEvidence" INTEGER NOT NULL DEFAULT 0,
    "activeEvidence" INTEGER NOT NULL DEFAULT 0,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "filledFields" INTEGER NOT NULL DEFAULT 0,
    "totalTrackedFields" INTEGER NOT NULL DEFAULT 12,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyIntelligenceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceConflict" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedSignals" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "IntelligenceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityScoreHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountPriorityScore" INTEGER NOT NULL,
    "priorityTier" TEXT NOT NULL,
    "staticFitTotal" INTEGER NOT NULL,
    "dynamicIntelTotal" INTEGER NOT NULL,
    "timingUrgencyTotal" INTEGER NOT NULL,
    "previousScore" DOUBLE PRECISION,
    "previousTier" TEXT,
    "newScore" DOUBLE PRECISION,
    "newTier" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerDetails" TEXT,
    "staticFitScore" DOUBLE PRECISION,
    "dynamicIntelScore" DOUBLE PRECISION,
    "timingUrgencyScore" DOUBLE PRECISION,
    "whyNowReasons" TEXT,
    "intelligenceScore" INTEGER,
    "intelligenceTier" TEXT,
    "revenueScore" DOUBLE PRECISION,
    "revenueCategory" TEXT,
    "scoreTriggerType" TEXT DEFAULT 'priority',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorityScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userDecision" TEXT NOT NULL,
    "feedbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceFeedback" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recommendationSnapshot" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "feedbackReason" TEXT,
    "feedbackDetail" TEXT,
    "correctSignals" TEXT DEFAULT '[]',
    "incorrectSignals" TEXT DEFAULT '[]',
    "correctAction" BOOLEAN,
    "actualOutcome" TEXT,
    "priorityAtFeedback" TEXT,
    "scoreAtFeedback" INTEGER,
    "confidenceAtFeedback" TEXT,
    "memoryCreated" BOOLEAN NOT NULL DEFAULT false,
    "learningEventId" TEXT,
    "calibrationApplied" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSourceReliability" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "totalEvidence" INTEGER NOT NULL DEFAULT 0,
    "validatedCorrect" INTEGER NOT NULL DEFAULT 0,
    "validatedIncorrect" INTEGER NOT NULL DEFAULT 0,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSourceReliability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" TEXT NOT NULL DEFAULT '{}',
    "scheduleFrequency" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "recordsAcquired" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordsAcquired" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceObject" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectorId" TEXT,
    "connectorRunId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT,
    "origin" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sourceUrl" TEXT,
    "capturedAt" TIMESTAMP(3),
    "originalConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidenceBreakdown" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'new',
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAlias" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "intelligenceObjectId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousValue" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceAssociation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "associationType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changedFields" TEXT NOT NULL DEFAULT '{}',
    "changeReason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceHealth" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "avgRecordsPerRun" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "totalSuccesses" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanIntelligenceInbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "intelligenceObjectId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HumanIntelligenceInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceTimeline" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "connectorId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "alertType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBrief" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "accountHealth" TEXT NOT NULL DEFAULT 'unknown',
    "keySignals" JSONB NOT NULL DEFAULT '[]',
    "themes" JSONB NOT NULL DEFAULT '[]',
    "recentChanges" JSONB NOT NULL DEFAULT '[]',
    "opportunityAreas" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "recommendedEngagement" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "AccountBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matchedPattern" TEXT NOT NULL,
    "sourceIntelligenceIds" JSONB NOT NULL DEFAULT '[]',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountScore" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB NOT NULL DEFAULT '{}',
    "category" "AccountCategory" NOT NULL DEFAULT 'NURTURE',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicInsight" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyThemes" JSONB NOT NULL DEFAULT '[]',
    "reasoningSummary" JSONB NOT NULL DEFAULT '{}',
    "supportingEvidence" JSONB NOT NULL DEFAULT '[]',
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL DEFAULT 'LLM',
    "modelUsed" TEXT,
    "expiresAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEngagementStrategy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "strategicInsightId" TEXT NOT NULL,
    "situationAssessment" JSONB NOT NULL DEFAULT '{}',
    "recommendedEntry" JSONB NOT NULL DEFAULT '{}',
    "firstMeetingObjective" TEXT NOT NULL DEFAULT 'discovery',
    "conversationAngles" JSONB NOT NULL DEFAULT '[]',
    "riskFactors" JSONB NOT NULL DEFAULT '[]',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL DEFAULT 'LLM',
    "modelUsed" TEXT,
    "expiresAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEngagementStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SIGNAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '[]',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasoning" TEXT,
    "recommendedAction" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'ai_generated',
    "sourceRoute" TEXT,
    "modelUsed" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionArtifact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceReferences" JSONB NOT NULL DEFAULT '[]',
    "sourceSignalCount" INTEGER NOT NULL DEFAULT 0,
    "sourceContactCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "expiresAt" TIMESTAMP(3),
    "generatedBy" TEXT NOT NULL DEFAULT 'sprint3_engine',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineRun" (
    "id" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "compositionId" TEXT,
    "inputSummary" JSONB NOT NULL,
    "outputSummary" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "llmCallCount" INTEGER NOT NULL DEFAULT 0,
    "llmTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "llmCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasoningContext" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reasoningState" JSONB NOT NULL DEFAULT '{}',
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winProbability" DOUBLE PRECISION,
    "opportunityScore" DOUBLE PRECISION,
    "recommendedActions" JSONB NOT NULL DEFAULT '[]',
    "matchedCapabilities" JSONB NOT NULL DEFAULT '[]',
    "matchedCaseStudies" JSONB NOT NULL DEFAULT '[]',
    "competitivePosition" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'empty',
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "totalAIcalls" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buildDurationMs" INTEGER,
    "builtAt" TIMESTAMP(3),
    "staleAt" TIMESTAMP(3),
    "lastRebuiltAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasoningContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasoningStep" (
    "id" TEXT NOT NULL,
    "reasoningContextId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepGroup" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "summary" TEXT,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "knowledgeIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "dependsOnSteps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentOrchestration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reasoningContextId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerSignalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executionPlan" TEXT NOT NULL DEFAULT '[]',
    "totalAgents" INTEGER NOT NULL DEFAULT 0,
    "completedAgents" INTEGER NOT NULL DEFAULT 0,
    "failedAgents" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "totalAIcalls" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputSummary" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentOrchestration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "orchestrationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "inputContext" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dependsOn" JSONB NOT NULL DEFAULT '[]',
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learnedInsight" TEXT NOT NULL,
    "applicableContext" TEXT NOT NULL DEFAULT '{}',
    "applicableTags" TEXT NOT NULL DEFAULT '[]',
    "createdCapabilityAssetId" TEXT,
    "updatedCapabilityAssetId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reuseCount" INTEGER NOT NULL DEFAULT 0,
    "lastReusedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'upload',
    "originalContent" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "processedChunks" INTEGER NOT NULL DEFAULT 0,
    "capabilityAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT,
    "subCategory" TEXT,
    "industry" TEXT,
    "technology" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "embeddingId" TEXT,
    "contentHash" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pipelineType" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalStages" INTEGER NOT NULL DEFAULT 16,
    "completedStages" INTEGER NOT NULL DEFAULT 0,
    "failedStages" INTEGER NOT NULL DEFAULT 0,
    "skippedStages" INTEGER NOT NULL DEFAULT 0,
    "stageResults" TEXT NOT NULL DEFAULT '[]',
    "aiCallsMade" INTEGER NOT NULL DEFAULT 0,
    "tavilyCallsMade" INTEGER NOT NULL DEFAULT 0,
    "embeddingCallsMade" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "accountBriefId" TEXT,
    "accountScoreId" TEXT,
    "strategicInsightId" TEXT,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FusionResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signalIds" JSONB NOT NULL DEFAULT '[]',
    "capabilityIds" JSONB NOT NULL DEFAULT '[]',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "fusionType" TEXT NOT NULL,
    "fusionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "businessProblem" TEXT,
    "recommendedCapability" TEXT,
    "relevantCaseStudy" TEXT,
    "proofPoints" JSONB NOT NULL DEFAULT '[]',
    "reasoningChain" JSONB NOT NULL DEFAULT '[]',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceStrength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FusionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICallLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "genType" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "pipelineRunId" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "durationMs" INTEGER,
    "wasCached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomEmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceActionHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceIds" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyIntelligenceFreshness" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastRefreshAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignalCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "degradationLevel" TEXT NOT NULL DEFAULT 'fresh',
    "nextRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyIntelligenceFreshness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleProfileEnrichment" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "headline" TEXT,
    "currentCompany" TEXT,
    "currentTitle" TEXT,
    "location" TEXT,
    "profileSummary" TEXT,
    "skills" TEXT,
    "experienceHighlights" TEXT,
    "sourceProvider" TEXT,
    "rawProfileData" TEXT,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "PeopleProfileEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'homepage',
    "contentHash" TEXT NOT NULL,
    "contentText" TEXT,
    "pageTitle" TEXT,
    "detectedChanges" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitiveSignal" (
    "id" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventSummary" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impactAnalysis" TEXT,
    "affectedAccounts" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitiveSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intelligenceScore" INTEGER NOT NULL DEFAULT 0,
    "priorityTier" TEXT,
    "activeSignalCount" INTEGER NOT NULL DEFAULT 0,
    "activeEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "highSeverityCount" INTEGER NOT NULL DEFAULT 0,
    "topSignalTypes" TEXT,
    "topSignalIds" TEXT,
    "captureReason" TEXT NOT NULL DEFAULT 'scheduled',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGraphNode" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "KnowledgeGraphEntityType" NOT NULL,
    "aliases" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "companyId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "sourceAttribution" TEXT,
    "confidenceHistory" TEXT,
    "createdAtMs" INTEGER NOT NULL,
    "updatedAtMs" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGraphEdge" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationship" "KnowledgeGraphRelationship" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "observedAt" TEXT,
    "expiresAt" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "source" TEXT,
    "evidenceIds" TEXT NOT NULL,
    "companyId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "sourceAttribution" TEXT,
    "confidenceHistory" TEXT,
    "createdAtMs" INTEGER NOT NULL,
    "updatedAtMs" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMemoryEntry" (
    "id" TEXT NOT NULL,
    "layer" "AIMemoryLayer" NOT NULL,
    "category" "AIMemoryCategory" NOT NULL,
    "priority" "AIMemoryPriority" NOT NULL,
    "scopeType" "IntelligenceScopeType" NOT NULL DEFAULT 'global',
    "scopeEntityType" TEXT,
    "scopeEntityId" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "tags" TEXT NOT NULL,
    "referencedEntityIds" TEXT NOT NULL,
    "sourceType" "AIMemorySource" NOT NULL,
    "sourceDescription" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceTimestampMs" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAtMs" INTEGER NOT NULL DEFAULT 0,
    "expiresAtMs" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentMemoryId" TEXT,
    "childMemoryIds" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "companyId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "confidenceHistory" TEXT,
    "versionHistory" TEXT,
    "createdAtMs" INTEGER NOT NULL,
    "updatedAtMs" INTEGER NOT NULL,

    CONSTRAINT "AIMemoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalIndexEntry" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "vector" BYTEA,
    "termFrequencies" TEXT NOT NULL,
    "source" TEXT,
    "sourceDate" TEXT,
    "sourceTier" "RetrievalSourceTier" NOT NULL DEFAULT 'unknown',
    "entities" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "companyId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "sourceAttribution" TEXT,
    "indexedAtMs" INTEGER NOT NULL,
    "createdAtMs" INTEGER NOT NULL,
    "updatedAtMs" INTEGER NOT NULL,

    CONSTRAINT "RetrievalIndexEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalCorpusStats" (
    "id" TEXT NOT NULL DEFAULT 'singleton_corpus',
    "documentFrequency" TEXT NOT NULL,
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAtMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RetrievalCorpusStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersistenceOperationLog" (
    "id" TEXT NOT NULL,
    "store" "IntelligencePersistenceStore" NOT NULL,
    "operation" TEXT NOT NULL,
    "mapKey" TEXT NOT NULL,
    "companyId" TEXT,
    "payloadSummary" TEXT NOT NULL,
    "status" "PersistenceOperationStatus" NOT NULL DEFAULT 'pending',
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersistenceOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersistenceHealthSnapshot" (
    "id" TEXT NOT NULL,
    "store" "IntelligencePersistenceStore" NOT NULL,
    "healthy" BOOLEAN NOT NULL,
    "lastWriteAtMs" INTEGER,
    "lastWriteLatencyMs" INTEGER,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "failureQueueDepth" INTEGER NOT NULL DEFAULT 0,
    "totalWrites" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "snapshotReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersistenceHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowModeReconciliation" (
    "id" TEXT NOT NULL,
    "store" "IntelligencePersistenceStore" NOT NULL,
    "mapCount" INTEGER NOT NULL,
    "dbCount" INTEGER NOT NULL,
    "missingFromDb" INTEGER NOT NULL,
    "missingFromMap" INTEGER NOT NULL,
    "mismatchedEntries" INTEGER NOT NULL,
    "mismatchDetails" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowModeReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "Contact_batchId_idx" ON "Contact"("batchId");

-- CreateIndex
CREATE INDEX "Contact_leadScore_idx" ON "Contact"("leadScore");

-- CreateIndex
CREATE INDEX "Contact_assignedTo_idx" ON "Contact"("assignedTo");

-- CreateIndex
CREATE INDEX "Contact_source_idx" ON "Contact"("source");

-- CreateIndex
CREATE INDEX "Company_domain_idx" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Company_normalizedName_idx" ON "Company"("normalizedName");

-- CreateIndex
CREATE INDEX "Company_industry_idx" ON "Company"("industry");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_lifecycleStage_idx" ON "Company"("lifecycleStage");

-- CreateIndex
CREATE INDEX "Company_assignedTo_idx" ON "Company"("assignedTo");

-- CreateIndex
CREATE INDEX "Company_intelligenceScore_idx" ON "Company"("intelligenceScore");

-- CreateIndex
CREATE INDEX "Company_priorityTier_idx" ON "Company"("priorityTier");

-- CreateIndex
CREATE INDEX "Company_accountPriorityScore_idx" ON "Company"("accountPriorityScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileHash_key" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyResearchCard_companyId_key" ON "CompanyResearchCard"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNote_companyId_idx" ON "CompanyNote"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNote_category_idx" ON "CompanyNote"("category");

-- CreateIndex
CREATE INDEX "CompanySignal_meaningCategory_idx" ON "CompanySignal"("meaningCategory");

-- CreateIndex
CREATE INDEX "CompanySignal_companyId_idx" ON "CompanySignal"("companyId");

-- CreateIndex
CREATE INDEX "CompanySignal_signalType_idx" ON "CompanySignal"("signalType");

-- CreateIndex
CREATE INDEX "CompanySignal_severity_idx" ON "CompanySignal"("severity");

-- CreateIndex
CREATE INDEX "CompanySignal_impact_idx" ON "CompanySignal"("impact");

-- CreateIndex
CREATE INDEX "CompanySignal_createdAt_idx" ON "CompanySignal"("createdAt");

-- CreateIndex
CREATE INDEX "CompanySignal_signalDate_idx" ON "CompanySignal"("signalDate");

-- CreateIndex
CREATE INDEX "CompanySignal_timingWindow_idx" ON "CompanySignal"("timingWindow");

-- CreateIndex
CREATE INDEX "CompanySignal_expiresAt_idx" ON "CompanySignal"("expiresAt");

-- CreateIndex
CREATE INDEX "CompanySignal_status_expiresAt_idx" ON "CompanySignal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CompanySignal_companyId_signalType_createdAt_idx" ON "CompanySignal"("companyId", "signalType", "createdAt");

-- CreateIndex
CREATE INDEX "CompanySignal_companyId_status_idx" ON "CompanySignal"("companyId", "status");

-- CreateIndex
CREATE INDEX "Evidence_companyId_idx" ON "Evidence"("companyId");

-- CreateIndex
CREATE INDEX "Evidence_extractedField_idx" ON "Evidence"("extractedField");

-- CreateIndex
CREATE INDEX "Evidence_jobId_idx" ON "Evidence"("jobId");

-- CreateIndex
CREATE INDEX "Evidence_confidence_idx" ON "Evidence"("confidence");

-- CreateIndex
CREATE INDEX "Evidence_createdAt_idx" ON "Evidence"("createdAt");

-- CreateIndex
CREATE INDEX "Evidence_status_idx" ON "Evidence"("status");

-- CreateIndex
CREATE INDEX "Evidence_companyId_status_createdAt_idx" ON "Evidence"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_companyId_extractedField_confidence_idx" ON "Evidence"("companyId", "extractedField", "confidence");

-- CreateIndex
CREATE INDEX "CompanyTimelineEvent_companyId_idx" ON "CompanyTimelineEvent"("companyId");

-- CreateIndex
CREATE INDEX "CompanyTimelineEvent_eventType_idx" ON "CompanyTimelineEvent"("eventType");

-- CreateIndex
CREATE INDEX "CompanyTimelineEvent_createdAt_idx" ON "CompanyTimelineEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");

-- CreateIndex
CREATE INDEX "CapabilityAsset_category_idx" ON "CapabilityAsset"("category");

-- CreateIndex
CREATE INDEX "CapabilityAsset_serviceLine_idx" ON "CapabilityAsset"("serviceLine");

-- CreateIndex
CREATE INDEX "CapabilityAsset_isActive_idx" ON "CapabilityAsset"("isActive");

-- CreateIndex
CREATE INDEX "CapabilityAsset_parentAssetId_idx" ON "CapabilityAsset"("parentAssetId");

-- CreateIndex
CREATE INDEX "CapabilityAsset_contentHash_idx" ON "CapabilityAsset"("contentHash");

-- CreateIndex
CREATE INDEX "CapabilityAsset_technology_idx" ON "CapabilityAsset"("technology");

-- CreateIndex
CREATE INDEX "CapabilityAsset_industry_idx" ON "CapabilityAsset"("industry");

-- CreateIndex
CREATE INDEX "EmailTemplate_serviceLine_idx" ON "EmailTemplate"("serviceLine");

-- CreateIndex
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");

-- CreateIndex
CREATE INDEX "EmailSequence_serviceLine_idx" ON "EmailSequence"("serviceLine");

-- CreateIndex
CREATE INDEX "EmailSequence_isActive_idx" ON "EmailSequence"("isActive");

-- CreateIndex
CREATE INDEX "EmailSequence_companyId_idx" ON "EmailSequence"("companyId");

-- CreateIndex
CREATE INDEX "EmailSequence_generatedBy_idx" ON "EmailSequence"("generatedBy");

-- CreateIndex
CREATE INDEX "EmailSequence_opportunityId_idx" ON "EmailSequence"("opportunityId");

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStep_sequenceId_stepNumber_key" ON "SequenceStep"("sequenceId", "stepNumber");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_idx" ON "SequenceEnrollment"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_contactId_idx" ON "SequenceEnrollment"("contactId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_status_idx" ON "SequenceEnrollment"("status");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_nextStepAt_idx" ON "SequenceEnrollment"("nextStepAt");

-- CreateIndex
CREATE INDEX "Draft_contactId_idx" ON "Draft"("contactId");

-- CreateIndex
CREATE INDEX "Draft_status_idx" ON "Draft"("status");

-- CreateIndex
CREATE INDEX "Draft_abTestId_idx" ON "Draft"("abTestId");

-- CreateIndex
CREATE INDEX "Draft_sequenceId_idx" ON "Draft"("sequenceId");

-- CreateIndex
CREATE INDEX "Draft_assigneeId_idx" ON "Draft"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "SendQueue_draftId_key" ON "SendQueue"("draftId");

-- CreateIndex
CREATE INDEX "SendQueue_status_idx" ON "SendQueue"("status");

-- CreateIndex
CREATE INDEX "SendQueue_scheduledAt_idx" ON "SendQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailEvent_queueId_idx" ON "EmailEvent"("queueId");

-- CreateIndex
CREATE INDEX "EmailEvent_contactId_idx" ON "EmailEvent"("contactId");

-- CreateIndex
CREATE INDEX "EmailEvent_eventType_idx" ON "EmailEvent"("eventType");

-- CreateIndex
CREATE INDEX "EmailEvent_createdAt_idx" ON "EmailEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ABTest_status_idx" ON "ABTest"("status");

-- CreateIndex
CREATE INDEX "ABTest_createdAt_idx" ON "ABTest"("createdAt");

-- CreateIndex
CREATE INDEX "Reply_contactId_idx" ON "Reply"("contactId");

-- CreateIndex
CREATE INDEX "Reply_category_idx" ON "Reply"("category");

-- CreateIndex
CREATE INDEX "Reply_draftId_idx" ON "Reply"("draftId");

-- CreateIndex
CREATE INDEX "Bounce_contactId_idx" ON "Bounce"("contactId");

-- CreateIndex
CREATE INDEX "Bounce_queueId_idx" ON "Bounce"("queueId");

-- CreateIndex
CREATE UNIQUE INDEX "Suppression_contactId_key" ON "Suppression"("contactId");

-- CreateIndex
CREATE INDEX "Suppression_reason_idx" ON "Suppression"("reason");

-- CreateIndex
CREATE INDEX "Suppression_method_idx" ON "Suppression"("method");

-- CreateIndex
CREATE INDEX "Segment_name_idx" ON "Segment"("name");

-- CreateIndex
CREATE INDEX "SegmentContact_segmentId_idx" ON "SegmentContact"("segmentId");

-- CreateIndex
CREATE INDEX "SegmentContact_contactId_idx" ON "SegmentContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentContact_segmentId_contactId_key" ON "SegmentContact"("segmentId", "contactId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationPlan_companyId_idx" ON "ConversationPlan"("companyId");

-- CreateIndex
CREATE INDEX "ConversationPlan_companyName_idx" ON "ConversationPlan"("companyName");

-- CreateIndex
CREATE INDEX "ConversationPlan_createdAt_idx" ON "ConversationPlan"("createdAt");

-- CreateIndex
CREATE INDEX "Playbook_category_idx" ON "Playbook"("category");

-- CreateIndex
CREATE INDEX "Playbook_isActive_idx" ON "Playbook"("isActive");

-- CreateIndex
CREATE INDEX "Playbook_createdAt_idx" ON "Playbook"("createdAt");

-- CreateIndex
CREATE INDEX "AccountStrategy_companyId_idx" ON "AccountStrategy"("companyId");

-- CreateIndex
CREATE INDEX "AccountStrategy_status_idx" ON "AccountStrategy"("status");

-- CreateIndex
CREATE INDEX "AccountStrategy_createdAt_idx" ON "AccountStrategy"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- CreateIndex
CREATE INDEX "OtpCode_code_idx" ON "OtpCode"("code");

-- CreateIndex
CREATE INDEX "OtpCode_purpose_idx" ON "OtpCode"("purpose");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_verified_idx" ON "OtpCode"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "DataUpload_status_idx" ON "DataUpload"("status");

-- CreateIndex
CREATE INDEX "DataUpload_createdAt_idx" ON "DataUpload"("createdAt");

-- CreateIndex
CREATE INDEX "UploadRow_uploadId_idx" ON "UploadRow"("uploadId");

-- CreateIndex
CREATE INDEX "UploadRow_status_idx" ON "UploadRow"("status");

-- CreateIndex
CREATE INDEX "UploadRow_qualityScore_idx" ON "UploadRow"("qualityScore");

-- CreateIndex
CREATE INDEX "UploadRow_companyId_idx" ON "UploadRow"("companyId");

-- CreateIndex
CREATE INDEX "ColumnMappingRule_targetField_idx" ON "ColumnMappingRule"("targetField");

-- CreateIndex
CREATE INDEX "ColumnMappingRule_isActive_idx" ON "ColumnMappingRule"("isActive");

-- CreateIndex
CREATE INDEX "ColumnMappingRule_priority_idx" ON "ColumnMappingRule"("priority");

-- CreateIndex
CREATE INDEX "FieldValidationRule_targetField_idx" ON "FieldValidationRule"("targetField");

-- CreateIndex
CREATE INDEX "FieldValidationRule_isActive_idx" ON "FieldValidationRule"("isActive");

-- CreateIndex
CREATE INDEX "NormalizationMapping_category_idx" ON "NormalizationMapping"("category");

-- CreateIndex
CREATE INDEX "NormalizationMapping_isActive_idx" ON "NormalizationMapping"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizationMapping_category_sourceValue_key" ON "NormalizationMapping"("category", "sourceValue");

-- CreateIndex
CREATE INDEX "ScoringWeight_dimension_idx" ON "ScoringWeight"("dimension");

-- CreateIndex
CREATE INDEX "ScoringWeight_isActive_idx" ON "ScoringWeight"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringWeight_dimension_field_key_key" ON "ScoringWeight"("dimension", "field", "key");

-- CreateIndex
CREATE INDEX "NormalizationLog_uploadId_idx" ON "NormalizationLog"("uploadId");

-- CreateIndex
CREATE INDEX "NormalizationLog_category_idx" ON "NormalizationLog"("category");

-- CreateIndex
CREATE INDEX "NormalizationLog_field_idx" ON "NormalizationLog"("field");

-- CreateIndex
CREATE INDEX "NormalizationLog_createdAt_idx" ON "NormalizationLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataQualityScore_companyId_idx" ON "DataQualityScore"("companyId");

-- CreateIndex
CREATE INDEX "DataQualityScore_uploadId_idx" ON "DataQualityScore"("uploadId");

-- CreateIndex
CREATE INDEX "DataQualityScore_totalScore_idx" ON "DataQualityScore"("totalScore");

-- CreateIndex
CREATE INDEX "DataQualityScore_createdAt_idx" ON "DataQualityScore"("createdAt");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_contactId_idx" ON "Job"("contactId");

-- CreateIndex
CREATE INDEX "Job_priority_idx" ON "Job"("priority");

-- CreateIndex
CREATE INDEX "Job_status_type_idx" ON "Job"("status", "type");

-- CreateIndex
CREATE INDEX "Job_nextRetryAt_idx" ON "Job"("nextRetryAt");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_jobId_level_idx" ON "JobLog"("jobId", "level");

-- CreateIndex
CREATE INDEX "JobLog_createdAt_idx" ON "JobLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_generationType_idx" ON "AIGenerationAudit"("generationType");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_companyId_idx" ON "AIGenerationAudit"("companyId");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_contactId_idx" ON "AIGenerationAudit"("contactId");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_createdAt_idx" ON "AIGenerationAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_governancePassed_idx" ON "AIGenerationAudit"("governancePassed");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_companyId_generationType_createdAt_idx" ON "AIGenerationAudit"("companyId", "generationType", "createdAt");

-- CreateIndex
CREATE INDEX "AIGenerationAudit_companyId_createdAt_idx" ON "AIGenerationAudit"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_companyId_idx" ON "SignalCapabilityMatch"("companyId");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_signalId_idx" ON "SignalCapabilityMatch"("signalId");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_capabilityId_idx" ON "SignalCapabilityMatch"("capabilityId");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_matchScore_idx" ON "SignalCapabilityMatch"("matchScore");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_companyId_signalId_idx" ON "SignalCapabilityMatch"("companyId", "signalId");

-- CreateIndex
CREATE INDEX "SignalCapabilityMatch_companyId_capabilityId_idx" ON "SignalCapabilityMatch"("companyId", "capabilityId");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_companyId_idx" ON "OpportunityRecommendation"("companyId");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_signalId_idx" ON "OpportunityRecommendation"("signalId");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_capabilityMatchId_idx" ON "OpportunityRecommendation"("capabilityMatchId");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_status_idx" ON "OpportunityRecommendation"("status");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_priority_idx" ON "OpportunityRecommendation"("priority");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_opportunityScore_idx" ON "OpportunityRecommendation"("opportunityScore");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_createdAt_idx" ON "OpportunityRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_companyId_status_idx" ON "OpportunityRecommendation"("companyId", "status");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_status_priority_idx" ON "OpportunityRecommendation"("status", "priority");

-- CreateIndex
CREATE INDEX "Pursuit_opportunityId_idx" ON "Pursuit"("opportunityId");

-- CreateIndex
CREATE INDEX "Pursuit_companyId_idx" ON "Pursuit"("companyId");

-- CreateIndex
CREATE INDEX "Pursuit_owner_idx" ON "Pursuit"("owner");

-- CreateIndex
CREATE INDEX "Pursuit_status_idx" ON "Pursuit"("status");

-- CreateIndex
CREATE INDEX "Pursuit_outcomeStage_idx" ON "Pursuit"("outcomeStage");

-- CreateIndex
CREATE INDEX "Pursuit_createdAt_idx" ON "Pursuit"("createdAt");

-- CreateIndex
CREATE INDEX "Pursuit_lastActivityAt_idx" ON "Pursuit"("lastActivityAt");

-- CreateIndex
CREATE INDEX "IntelligenceValidation_artifactType_artifactId_idx" ON "IntelligenceValidation"("artifactType", "artifactId");

-- CreateIndex
CREATE INDEX "IntelligenceValidation_companyId_idx" ON "IntelligenceValidation"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceValidation_validatedAt_idx" ON "IntelligenceValidation"("validatedAt");

-- CreateIndex
CREATE INDEX "IntelligenceValidation_accuracy_idx" ON "IntelligenceValidation"("accuracy");

-- CreateIndex
CREATE INDEX "IntelligenceValidation_companyId_artifactType_idx" ON "IntelligenceValidation"("companyId", "artifactType");

-- CreateIndex
CREATE UNIQUE INDEX "SignalValidation_signalId_key" ON "SignalValidation"("signalId");

-- CreateIndex
CREATE INDEX "SignalValidation_companyId_idx" ON "SignalValidation"("companyId");

-- CreateIndex
CREATE INDEX "SignalValidation_signalId_idx" ON "SignalValidation"("signalId");

-- CreateIndex
CREATE INDEX "SignalValidation_validationStatus_idx" ON "SignalValidation"("validationStatus");

-- CreateIndex
CREATE INDEX "SignalValidation_companyId_validationStatus_idx" ON "SignalValidation"("companyId", "validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyIntelligenceHealth_companyId_key" ON "CompanyIntelligenceHealth"("companyId");

-- CreateIndex
CREATE INDEX "CompanyIntelligenceHealth_overallHealthScore_idx" ON "CompanyIntelligenceHealth"("overallHealthScore" DESC);

-- CreateIndex
CREATE INDEX "CompanyIntelligenceHealth_companyId_idx" ON "CompanyIntelligenceHealth"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceConflict_companyId_idx" ON "IntelligenceConflict"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceConflict_status_idx" ON "IntelligenceConflict"("status");

-- CreateIndex
CREATE INDEX "IntelligenceConflict_severity_idx" ON "IntelligenceConflict"("severity");

-- CreateIndex
CREATE INDEX "IntelligenceConflict_companyId_status_idx" ON "IntelligenceConflict"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "PriorityScoreHistory_companyId_idx" ON "PriorityScoreHistory"("companyId");

-- CreateIndex
CREATE INDEX "PriorityScoreHistory_companyId_computedAt_idx" ON "PriorityScoreHistory"("companyId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "PriorityScoreHistory_computedAt_idx" ON "PriorityScoreHistory"("computedAt");

-- CreateIndex
CREATE INDEX "PriorityScoreHistory_triggerType_idx" ON "PriorityScoreHistory"("triggerType");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_recommendationId_idx" ON "RecommendationFeedback"("recommendationId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_companyId_idx" ON "RecommendationFeedback"("companyId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userDecision_idx" ON "RecommendationFeedback"("userDecision");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_companyId_idx" ON "IntelligenceFeedback"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_verdict_idx" ON "IntelligenceFeedback"("verdict");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_sentiment_idx" ON "IntelligenceFeedback"("sentiment");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_feedbackReason_idx" ON "IntelligenceFeedback"("feedbackReason");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_createdAt_idx" ON "IntelligenceFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_companyId_verdict_idx" ON "IntelligenceFeedback"("companyId", "verdict");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSourceReliability_domain_key" ON "EvidenceSourceReliability"("domain");

-- CreateIndex
CREATE INDEX "EvidenceSourceReliability_domain_idx" ON "EvidenceSourceReliability"("domain");

-- CreateIndex
CREATE INDEX "EvidenceSourceReliability_reliabilityScore_idx" ON "EvidenceSourceReliability"("reliabilityScore");

-- CreateIndex
CREATE INDEX "Connector_sourceType_idx" ON "Connector"("sourceType");

-- CreateIndex
CREATE INDEX "Connector_status_idx" ON "Connector"("status");

-- CreateIndex
CREATE INDEX "Connector_lastRunAt_idx" ON "Connector"("lastRunAt");

-- CreateIndex
CREATE INDEX "ConnectorRun_connectorId_idx" ON "ConnectorRun"("connectorId");

-- CreateIndex
CREATE INDEX "ConnectorRun_status_idx" ON "ConnectorRun"("status");

-- CreateIndex
CREATE INDEX "ConnectorRun_createdAt_idx" ON "ConnectorRun"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceObject_companyId_idx" ON "IntelligenceObject"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceObject_sourceType_idx" ON "IntelligenceObject"("sourceType");

-- CreateIndex
CREATE INDEX "IntelligenceObject_status_idx" ON "IntelligenceObject"("status");

-- CreateIndex
CREATE INDEX "IntelligenceObject_capturedAt_idx" ON "IntelligenceObject"("capturedAt");

-- CreateIndex
CREATE INDEX "IntelligenceObject_originalConfidence_idx" ON "IntelligenceObject"("originalConfidence");

-- CreateIndex
CREATE INDEX "IntelligenceObject_companyId_status_createdAt_idx" ON "IntelligenceObject"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceObject_connectorId_idx" ON "IntelligenceObject"("connectorId");

-- CreateIndex
CREATE INDEX "IntelligenceObject_connectorRunId_idx" ON "IntelligenceObject"("connectorRunId");

-- CreateIndex
CREATE INDEX "IntelligenceObject_evidenceId_idx" ON "IntelligenceObject"("evidenceId");

-- CreateIndex
CREATE INDEX "CompanyAlias_alias_idx" ON "CompanyAlias"("alias");

-- CreateIndex
CREATE INDEX "CompanyAlias_companyId_idx" ON "CompanyAlias"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAlias_companyId_alias_key" ON "CompanyAlias"("companyId", "alias");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_companyId_idx" ON "KnowledgeEntry"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_category_idx" ON "KnowledgeEntry"("category");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_companyId_category_idx" ON "KnowledgeEntry"("companyId", "category");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_intelligenceObjectId_idx" ON "KnowledgeEntry"("intelligenceObjectId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_confidence_idx" ON "KnowledgeEntry"("confidence");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_updatedAt_idx" ON "KnowledgeEntry"("updatedAt");

-- CreateIndex
CREATE INDEX "IntelligenceAssociation_companyId_idx" ON "IntelligenceAssociation"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceAssociation_sourceId_idx" ON "IntelligenceAssociation"("sourceId");

-- CreateIndex
CREATE INDEX "IntelligenceAssociation_targetId_idx" ON "IntelligenceAssociation"("targetId");

-- CreateIndex
CREATE INDEX "IntelligenceAssociation_associationType_idx" ON "IntelligenceAssociation"("associationType");

-- CreateIndex
CREATE INDEX "IntelligenceAssociation_resolved_idx" ON "IntelligenceAssociation"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceAssociation_sourceId_targetId_associationType_key" ON "IntelligenceAssociation"("sourceId", "targetId", "associationType");

-- CreateIndex
CREATE INDEX "KnowledgeVersion_knowledgeEntryId_idx" ON "KnowledgeVersion"("knowledgeEntryId");

-- CreateIndex
CREATE INDEX "KnowledgeVersion_knowledgeEntryId_version_idx" ON "KnowledgeVersion"("knowledgeEntryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_knowledgeEntryId_version_key" ON "KnowledgeVersion"("knowledgeEntryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SourceHealth_connectorId_key" ON "SourceHealth"("connectorId");

-- CreateIndex
CREATE INDEX "SourceHealth_connectorId_idx" ON "SourceHealth"("connectorId");

-- CreateIndex
CREATE INDEX "SourceHealth_healthScore_idx" ON "SourceHealth"("healthScore");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_companyId_idx" ON "HumanIntelligenceInbox"("companyId");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_status_idx" ON "HumanIntelligenceInbox"("status");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_submittedBy_idx" ON "HumanIntelligenceInbox"("submittedBy");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_priority_idx" ON "HumanIntelligenceInbox"("priority");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_createdAt_idx" ON "HumanIntelligenceInbox"("createdAt");

-- CreateIndex
CREATE INDEX "HumanIntelligenceInbox_companyId_status_idx" ON "HumanIntelligenceInbox"("companyId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_companyId_idx" ON "IntelligenceTimeline"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_eventType_idx" ON "IntelligenceTimeline"("eventType");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_entityType_entityId_idx" ON "IntelligenceTimeline"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_createdAt_idx" ON "IntelligenceTimeline"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_companyId_createdAt_idx" ON "IntelligenceTimeline"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceTimeline_actor_idx" ON "IntelligenceTimeline"("actor");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_companyId_idx" ON "IntelligenceAlert"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_connectorId_idx" ON "IntelligenceAlert"("connectorId");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_severity_idx" ON "IntelligenceAlert"("severity");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_alertType_idx" ON "IntelligenceAlert"("alertType");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_status_idx" ON "IntelligenceAlert"("status");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_createdAt_idx" ON "IntelligenceAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBrief_companyId_key" ON "AccountBrief"("companyId");

-- CreateIndex
CREATE INDEX "AccountBrief_companyId_idx" ON "AccountBrief"("companyId");

-- CreateIndex
CREATE INDEX "AccountBrief_confidence_idx" ON "AccountBrief"("confidence");

-- CreateIndex
CREATE INDEX "AccountBrief_generatedAt_idx" ON "AccountBrief"("generatedAt");

-- CreateIndex
CREATE INDEX "OpportunitySignal_companyId_idx" ON "OpportunitySignal"("companyId");

-- CreateIndex
CREATE INDEX "OpportunitySignal_signalType_idx" ON "OpportunitySignal"("signalType");

-- CreateIndex
CREATE INDEX "OpportunitySignal_score_idx" ON "OpportunitySignal"("score");

-- CreateIndex
CREATE INDEX "OpportunitySignal_status_idx" ON "OpportunitySignal"("status");

-- CreateIndex
CREATE INDEX "OpportunitySignal_companyId_signalType_idx" ON "OpportunitySignal"("companyId", "signalType");

-- CreateIndex
CREATE INDEX "OpportunitySignal_createdAt_idx" ON "OpportunitySignal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountScore_companyId_key" ON "AccountScore"("companyId");

-- CreateIndex
CREATE INDEX "AccountScore_companyId_idx" ON "AccountScore"("companyId");

-- CreateIndex
CREATE INDEX "AccountScore_category_idx" ON "AccountScore"("category");

-- CreateIndex
CREATE INDEX "AccountScore_score_idx" ON "AccountScore"("score");

-- CreateIndex
CREATE INDEX "StrategicInsight_companyId_idx" ON "StrategicInsight"("companyId");

-- CreateIndex
CREATE INDEX "StrategicInsight_insightType_idx" ON "StrategicInsight"("insightType");

-- CreateIndex
CREATE INDEX "StrategicInsight_confidenceScore_idx" ON "StrategicInsight"("confidenceScore");

-- CreateIndex
CREATE INDEX "StrategicInsight_generatedAt_idx" ON "StrategicInsight"("generatedAt");

-- CreateIndex
CREATE INDEX "StrategicInsight_companyId_generatedAt_idx" ON "StrategicInsight"("companyId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "AIEngagementStrategy_companyId_idx" ON "AIEngagementStrategy"("companyId");

-- CreateIndex
CREATE INDEX "AIEngagementStrategy_strategicInsightId_idx" ON "AIEngagementStrategy"("strategicInsightId");

-- CreateIndex
CREATE INDEX "AIEngagementStrategy_priorityScore_idx" ON "AIEngagementStrategy"("priorityScore");

-- CreateIndex
CREATE INDEX "AIEngagementStrategy_generatedAt_idx" ON "AIEngagementStrategy"("generatedAt");

-- CreateIndex
CREATE INDEX "AIEngagementStrategy_companyId_generatedAt_idx" ON "AIEngagementStrategy"("companyId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "AIInsight_companyId_idx" ON "AIInsight"("companyId");

-- CreateIndex
CREATE INDEX "AIInsight_contactId_idx" ON "AIInsight"("contactId");

-- CreateIndex
CREATE INDEX "AIInsight_opportunityId_idx" ON "AIInsight"("opportunityId");

-- CreateIndex
CREATE INDEX "AIInsight_type_idx" ON "AIInsight"("type");

-- CreateIndex
CREATE INDEX "AIInsight_status_idx" ON "AIInsight"("status");

-- CreateIndex
CREATE INDEX "AIInsight_confidenceScore_idx" ON "AIInsight"("confidenceScore");

-- CreateIndex
CREATE INDEX "AIInsight_impactScore_idx" ON "AIInsight"("impactScore");

-- CreateIndex
CREATE INDEX "AIInsight_createdAt_idx" ON "AIInsight"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIInsight_companyId_type_status_idx" ON "AIInsight"("companyId", "type", "status");

-- CreateIndex
CREATE INDEX "AIInsight_expiresAt_idx" ON "AIInsight"("expiresAt");

-- CreateIndex
CREATE INDEX "ActionArtifact_companyId_idx" ON "ActionArtifact"("companyId");

-- CreateIndex
CREATE INDEX "ActionArtifact_actionType_idx" ON "ActionArtifact"("actionType");

-- CreateIndex
CREATE INDEX "ActionArtifact_companyId_actionType_idx" ON "ActionArtifact"("companyId", "actionType");

-- CreateIndex
CREATE INDEX "ActionArtifact_priorityScore_idx" ON "ActionArtifact"("priorityScore" DESC);

-- CreateIndex
CREATE INDEX "ActionArtifact_status_idx" ON "ActionArtifact"("status");

-- CreateIndex
CREATE INDEX "ActionArtifact_generatedAt_idx" ON "ActionArtifact"("generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ActionArtifact_expiresAt_idx" ON "ActionArtifact"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_entityId_key" ON "Embedding"("entityId");

-- CreateIndex
CREATE INDEX "Embedding_entityType_idx" ON "Embedding"("entityType");

-- CreateIndex
CREATE INDEX "Embedding_entityId_idx" ON "Embedding"("entityId");

-- CreateIndex
CREATE INDEX "Embedding_model_idx" ON "Embedding"("model");

-- CreateIndex
CREATE INDEX "EngineRun_engine_idx" ON "EngineRun"("engine");

-- CreateIndex
CREATE INDEX "EngineRun_compositionId_idx" ON "EngineRun"("compositionId");

-- CreateIndex
CREATE INDEX "EngineRun_companyId_idx" ON "EngineRun"("companyId");

-- CreateIndex
CREATE INDEX "EngineRun_contactId_idx" ON "EngineRun"("contactId");

-- CreateIndex
CREATE INDEX "EngineRun_createdAt_idx" ON "EngineRun"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReasoningContext_companyId_key" ON "ReasoningContext"("companyId");

-- CreateIndex
CREATE INDEX "ReasoningContext_companyId_idx" ON "ReasoningContext"("companyId");

-- CreateIndex
CREATE INDEX "ReasoningContext_status_idx" ON "ReasoningContext"("status");

-- CreateIndex
CREATE INDEX "ReasoningContext_overallConfidence_idx" ON "ReasoningContext"("overallConfidence");

-- CreateIndex
CREATE INDEX "ReasoningContext_builtAt_idx" ON "ReasoningContext"("builtAt");

-- CreateIndex
CREATE INDEX "ReasoningContext_staleAt_idx" ON "ReasoningContext"("staleAt");

-- CreateIndex
CREATE INDEX "ReasoningStep_reasoningContextId_idx" ON "ReasoningStep"("reasoningContextId");

-- CreateIndex
CREATE INDEX "ReasoningStep_stepName_idx" ON "ReasoningStep"("stepName");

-- CreateIndex
CREATE INDEX "ReasoningStep_stepGroup_idx" ON "ReasoningStep"("stepGroup");

-- CreateIndex
CREATE INDEX "ReasoningStep_confidence_idx" ON "ReasoningStep"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "ReasoningStep_reasoningContextId_stepNumber_key" ON "ReasoningStep"("reasoningContextId", "stepNumber");

-- CreateIndex
CREATE INDEX "AgentOrchestration_companyId_idx" ON "AgentOrchestration"("companyId");

-- CreateIndex
CREATE INDEX "AgentOrchestration_status_idx" ON "AgentOrchestration"("status");

-- CreateIndex
CREATE INDEX "AgentOrchestration_triggerType_idx" ON "AgentOrchestration"("triggerType");

-- CreateIndex
CREATE INDEX "AgentOrchestration_createdAt_idx" ON "AgentOrchestration"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_orchestrationId_idx" ON "AgentRun"("orchestrationId");

-- CreateIndex
CREATE INDEX "AgentRun_agentName_idx" ON "AgentRun"("agentName");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AICache_cacheKey_key" ON "AICache"("cacheKey");

-- CreateIndex
CREATE INDEX "AICache_cacheKey_idx" ON "AICache"("cacheKey");

-- CreateIndex
CREATE INDEX "AICache_expiresAt_idx" ON "AICache"("expiresAt");

-- CreateIndex
CREATE INDEX "AICache_modelUsed_idx" ON "AICache"("modelUsed");

-- CreateIndex
CREATE INDEX "AICache_hitCount_idx" ON "AICache"("hitCount" DESC);

-- CreateIndex
CREATE INDEX "LearningEvent_companyId_idx" ON "LearningEvent"("companyId");

-- CreateIndex
CREATE INDEX "LearningEvent_eventType_idx" ON "LearningEvent"("eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_confidence_idx" ON "LearningEvent"("confidence");

-- CreateIndex
CREATE INDEX "LearningEvent_reuseCount_idx" ON "LearningEvent"("reuseCount" DESC);

-- CreateIndex
CREATE INDEX "LearningEvent_verified_idx" ON "LearningEvent"("verified");

-- CreateIndex
CREATE INDEX "LearningEvent_createdAt_idx" ON "LearningEvent"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_documentType_idx" ON "KnowledgeDocument"("documentType");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_contentHash_idx" ON "KnowledgeDocument"("contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_capabilityAssetId_idx" ON "KnowledgeDocument"("capabilityAssetId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_createdAt_idx" ON "KnowledgeDocument"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_chunkIndex_idx" ON "KnowledgeChunk"("chunkIndex");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_category_idx" ON "KnowledgeChunk"("category");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_industry_idx" ON "KnowledgeChunk"("industry");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_technology_idx" ON "KnowledgeChunk"("technology");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_embeddingId_idx" ON "KnowledgeChunk"("embeddingId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_contentHash_idx" ON "KnowledgeChunk"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "PipelineRun_companyId_idx" ON "PipelineRun"("companyId");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_startedAt_idx" ON "PipelineRun"("startedAt");

-- CreateIndex
CREATE INDEX "PipelineRun_companyId_startedAt_idx" ON "PipelineRun"("companyId", "startedAt");

-- CreateIndex
CREATE INDEX "FusionResult_companyId_idx" ON "FusionResult"("companyId");

-- CreateIndex
CREATE INDEX "FusionResult_fusionType_idx" ON "FusionResult"("fusionType");

-- CreateIndex
CREATE INDEX "FusionResult_fusionScore_idx" ON "FusionResult"("fusionScore");

-- CreateIndex
CREATE INDEX "FusionResult_status_idx" ON "FusionResult"("status");

-- CreateIndex
CREATE INDEX "FusionResult_companyId_fusionType_idx" ON "FusionResult"("companyId", "fusionType");

-- CreateIndex
CREATE INDEX "AICallLog_companyId_idx" ON "AICallLog"("companyId");

-- CreateIndex
CREATE INDEX "AICallLog_genType_idx" ON "AICallLog"("genType");

-- CreateIndex
CREATE INDEX "AICallLog_provider_idx" ON "AICallLog"("provider");

-- CreateIndex
CREATE INDEX "AICallLog_createdAt_idx" ON "AICallLog"("createdAt");

-- CreateIndex
CREATE INDEX "AICallLog_companyId_createdAt_idx" ON "AICallLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AICallLog_contactId_idx" ON "AICallLog"("contactId");

-- CreateIndex
CREATE INDEX "CustomEmailTemplate_name_idx" ON "CustomEmailTemplate"("name");

-- CreateIndex
CREATE INDEX "CustomEmailTemplate_category_idx" ON "CustomEmailTemplate"("category");

-- CreateIndex
CREATE INDEX "AIUsageLog_feature_idx" ON "AIUsageLog"("feature");

-- CreateIndex
CREATE INDEX "AIUsageLog_provider_idx" ON "AIUsageLog"("provider");

-- CreateIndex
CREATE INDEX "AIUsageLog_companyId_idx" ON "AIUsageLog"("companyId");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceActionHistory_companyId_actionType_idx" ON "IntelligenceActionHistory"("companyId", "actionType");

-- CreateIndex
CREATE INDEX "IntelligenceActionHistory_companyId_createdAt_idx" ON "IntelligenceActionHistory"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceActionHistory_createdAt_idx" ON "IntelligenceActionHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyIntelligenceFreshness_companyId_key" ON "CompanyIntelligenceFreshness"("companyId");

-- CreateIndex
CREATE INDEX "CompanyIntelligenceFreshness_freshnessScore_idx" ON "CompanyIntelligenceFreshness"("freshnessScore");

-- CreateIndex
CREATE INDEX "CompanyIntelligenceFreshness_degradationLevel_idx" ON "CompanyIntelligenceFreshness"("degradationLevel");

-- CreateIndex
CREATE INDEX "CompanyIntelligenceFreshness_nextRefreshAt_idx" ON "CompanyIntelligenceFreshness"("nextRefreshAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeopleProfileEnrichment_contactId_key" ON "PeopleProfileEnrichment"("contactId");

-- CreateIndex
CREATE INDEX "PeopleProfileEnrichment_status_idx" ON "PeopleProfileEnrichment"("status");

-- CreateIndex
CREATE INDEX "PeopleProfileEnrichment_enrichedAt_idx" ON "PeopleProfileEnrichment"("enrichedAt");

-- CreateIndex
CREATE INDEX "WebsiteSnapshot_companyId_pageType_idx" ON "WebsiteSnapshot"("companyId", "pageType");

-- CreateIndex
CREATE INDEX "WebsiteSnapshot_contentHash_idx" ON "WebsiteSnapshot"("contentHash");

-- CreateIndex
CREATE INDEX "WebsiteSnapshot_createdAt_idx" ON "WebsiteSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "CompetitiveSignal_competitorName_idx" ON "CompetitiveSignal"("competitorName");

-- CreateIndex
CREATE INDEX "CompetitiveSignal_eventType_idx" ON "CompetitiveSignal"("eventType");

-- CreateIndex
CREATE INDEX "CompetitiveSignal_status_idx" ON "CompetitiveSignal"("status");

-- CreateIndex
CREATE INDEX "CompetitiveSignal_createdAt_idx" ON "CompetitiveSignal"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceSnapshot_companyId_idx" ON "IntelligenceSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "IntelligenceSnapshot_companyId_capturedAt_idx" ON "IntelligenceSnapshot"("companyId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "IntelligenceSnapshot_capturedAt_idx" ON "IntelligenceSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "IntelligenceSnapshot_captureReason_idx" ON "IntelligenceSnapshot"("captureReason");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_type_idx" ON "KnowledgeGraphNode"("type");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_companyId_idx" ON "KnowledgeGraphNode"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_label_idx" ON "KnowledgeGraphNode"("label");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_companyId_type_idx" ON "KnowledgeGraphNode"("companyId", "type");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_isGlobal_idx" ON "KnowledgeGraphNode"("isGlobal");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_updatedAtMs_idx" ON "KnowledgeGraphNode"("updatedAtMs" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphNode_id_key" ON "KnowledgeGraphNode"("id");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_sourceId_idx" ON "KnowledgeGraphEdge"("sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_targetId_idx" ON "KnowledgeGraphEdge"("targetId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_companyId_idx" ON "KnowledgeGraphEdge"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_relationship_idx" ON "KnowledgeGraphEdge"("relationship");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_companyId_relationship_idx" ON "KnowledgeGraphEdge"("companyId", "relationship");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_sourceId_targetId_idx" ON "KnowledgeGraphEdge"("sourceId", "targetId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_isGlobal_idx" ON "KnowledgeGraphEdge"("isGlobal");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_createdAtMs_idx" ON "KnowledgeGraphEdge"("createdAtMs" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphEdge_id_key" ON "KnowledgeGraphEdge"("id");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_layer_idx" ON "AIMemoryEntry"("layer");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_category_idx" ON "AIMemoryEntry"("category");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_companyId_idx" ON "AIMemoryEntry"("companyId");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_companyId_layer_idx" ON "AIMemoryEntry"("companyId", "layer");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_scopeType_scopeEntityId_idx" ON "AIMemoryEntry"("scopeType", "scopeEntityId");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_priority_idx" ON "AIMemoryEntry"("priority");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_confidence_idx" ON "AIMemoryEntry"("confidence" DESC);

-- CreateIndex
CREATE INDEX "AIMemoryEntry_expiresAtMs_idx" ON "AIMemoryEntry"("expiresAtMs");

-- CreateIndex
CREATE INDEX "AIMemoryEntry_updatedAtMs_idx" ON "AIMemoryEntry"("updatedAtMs" DESC);

-- CreateIndex
CREATE INDEX "AIMemoryEntry_isGlobal_idx" ON "AIMemoryEntry"("isGlobal");

-- CreateIndex
CREATE UNIQUE INDEX "AIMemoryEntry_id_key" ON "AIMemoryEntry"("id");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_entityId_idx" ON "RetrievalIndexEntry"("entityId");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_companyId_idx" ON "RetrievalIndexEntry"("companyId");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_companyId_entityType_idx" ON "RetrievalIndexEntry"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_sourceTier_idx" ON "RetrievalIndexEntry"("sourceTier");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_indexedAtMs_idx" ON "RetrievalIndexEntry"("indexedAtMs" DESC);

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_entityType_idx" ON "RetrievalIndexEntry"("entityType");

-- CreateIndex
CREATE INDEX "RetrievalIndexEntry_isGlobal_idx" ON "RetrievalIndexEntry"("isGlobal");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalIndexEntry_id_key" ON "RetrievalIndexEntry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalCorpusStats_id_key" ON "RetrievalCorpusStats"("id");

-- CreateIndex
CREATE INDEX "PersistenceOperationLog_store_status_idx" ON "PersistenceOperationLog"("store", "status");

-- CreateIndex
CREATE INDEX "PersistenceOperationLog_companyId_store_idx" ON "PersistenceOperationLog"("companyId", "store");

-- CreateIndex
CREATE INDEX "PersistenceOperationLog_status_createdAt_idx" ON "PersistenceOperationLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PersistenceOperationLog_nextRetryAt_idx" ON "PersistenceOperationLog"("nextRetryAt");

-- CreateIndex
CREATE INDEX "PersistenceOperationLog_createdAt_idx" ON "PersistenceOperationLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PersistenceHealthSnapshot_store_createdAt_idx" ON "PersistenceHealthSnapshot"("store", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PersistenceHealthSnapshot_healthy_idx" ON "PersistenceHealthSnapshot"("healthy");

-- CreateIndex
CREATE INDEX "PersistenceHealthSnapshot_createdAt_idx" ON "PersistenceHealthSnapshot"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShadowModeReconciliation_store_createdAt_idx" ON "ShadowModeReconciliation"("store", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShadowModeReconciliation_createdAt_idx" ON "ShadowModeReconciliation"("createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyResearchCard" ADD CONSTRAINT "CompanyResearchCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySignal" ADD CONSTRAINT "CompanySignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTimelineEvent" ADD CONSTRAINT "CompanyTimelineEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OpportunityRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ABTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendQueue" ADD CONSTRAINT "SendQueue_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bounce" ADD CONSTRAINT "Bounce_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentContact" ADD CONSTRAINT "SegmentContact_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentContact" ADD CONSTRAINT "SegmentContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPlan" ADD CONSTRAINT "ConversationPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountStrategy" ADD CONSTRAINT "AccountStrategy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadRow" ADD CONSTRAINT "UploadRow_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "DataUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationAudit" ADD CONSTRAINT "AIGenerationAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationAudit" ADD CONSTRAINT "AIGenerationAudit_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalCapabilityMatch" ADD CONSTRAINT "SignalCapabilityMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalCapabilityMatch" ADD CONSTRAINT "SignalCapabilityMatch_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "CompanySignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalCapabilityMatch" ADD CONSTRAINT "SignalCapabilityMatch_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "CapabilityAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "CompanySignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_capabilityMatchId_fkey" FOREIGN KEY ("capabilityMatchId") REFERENCES "SignalCapabilityMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pursuit" ADD CONSTRAINT "Pursuit_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OpportunityRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pursuit" ADD CONSTRAINT "Pursuit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceValidation" ADD CONSTRAINT "IntelligenceValidation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalValidation" ADD CONSTRAINT "SignalValidation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalValidation" ADD CONSTRAINT "SignalValidation_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "CompanySignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyIntelligenceHealth" ADD CONSTRAINT "CompanyIntelligenceHealth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceConflict" ADD CONSTRAINT "IntelligenceConflict_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityScoreHistory" ADD CONSTRAINT "PriorityScoreHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "OpportunityRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceFeedback" ADD CONSTRAINT "IntelligenceFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceObject" ADD CONSTRAINT "IntelligenceObject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAlias" ADD CONSTRAINT "CompanyAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceAssociation" ADD CONSTRAINT "IntelligenceAssociation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceAssociation" ADD CONSTRAINT "IntelligenceAssociation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntelligenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceAssociation" ADD CONSTRAINT "IntelligenceAssociation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "IntelligenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceHealth" ADD CONSTRAINT "SourceHealth_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanIntelligenceInbox" ADD CONSTRAINT "HumanIntelligenceInbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceTimeline" ADD CONSTRAINT "IntelligenceTimeline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceAlert" ADD CONSTRAINT "IntelligenceAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBrief" ADD CONSTRAINT "AccountBrief_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountScore" ADD CONSTRAINT "AccountScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicInsight" ADD CONSTRAINT "StrategicInsight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEngagementStrategy" ADD CONSTRAINT "AIEngagementStrategy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEngagementStrategy" ADD CONSTRAINT "AIEngagementStrategy_strategicInsightId_fkey" FOREIGN KEY ("strategicInsightId") REFERENCES "StrategicInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionArtifact" ADD CONSTRAINT "ActionArtifact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasoningContext" ADD CONSTRAINT "ReasoningContext_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasoningStep" ADD CONSTRAINT "ReasoningStep_reasoningContextId_fkey" FOREIGN KEY ("reasoningContextId") REFERENCES "ReasoningContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOrchestration" ADD CONSTRAINT "AgentOrchestration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOrchestration" ADD CONSTRAINT "AgentOrchestration_reasoningContextId_fkey" FOREIGN KEY ("reasoningContextId") REFERENCES "ReasoningContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_orchestrationId_fkey" FOREIGN KEY ("orchestrationId") REFERENCES "AgentOrchestration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_capabilityAssetId_fkey" FOREIGN KEY ("capabilityAssetId") REFERENCES "CapabilityAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FusionResult" ADD CONSTRAINT "FusionResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceActionHistory" ADD CONSTRAINT "IntelligenceActionHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

