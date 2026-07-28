-- Phase 1: Security + Database Foundation
-- Items 1.2-1.6 of the refactoring plan
--
-- Changes:
-- 1.2: Baseline migration (initial migration capture of current schema state)
-- 1.3: Add @relation to previously unmodeled FKs
--      - EmailSequence.companyId → Company.id (was missing FK field, causing schema errors)
--      - ConversationPlan.companyId → Company.id (was name-based reference)
-- 1.4: Add Prisma enums for core status fields
--      - CompanyStatus, CompanyLifecycleStage, CompanyPriorityTier, CompanySource
--      - ContactStatus, ContactConsentStatus, ContactEmailHealth, ContactSource
--      - SignalType, SignalSeverity, SignalImpact, SignalStatus, SignalTimingWindow,
--        SignalMeaningCategory, SignalSourceQuality
--      - JobType, JobStatus
--      - DraftStatus
--      - ImportBatchStatus
-- 1.5: Convert JSON-in-String to proper Json type (30+ fields)
-- 1.6: Connect ConversationPlan to Company via companyId FK

-- Create enums
CREATE TYPE "CompanyStatus" AS ENUM ('prospect', 'researching', 'active', 'engaged', 'paused', 'closed_won', 'closed_lost');
CREATE TYPE "CompanyLifecycleStage" AS ENUM ('discovery', 'qualification', 'proposal', 'negotiation', 'closed');
CREATE TYPE "CompanyPriorityTier" AS ENUM ('HOT', 'ACTIVE', 'NURTURE', 'LOW');
CREATE TYPE "CompanySource" AS ENUM ('import', 'manual', 'crm', 'webhook');
CREATE TYPE "ContactStatus" AS ENUM ('imported', 'cleaned', 'duplicate', 'drafted', 'queued', 'sent', 'replied', 'bounced', 'suppressed', 'archived');
CREATE TYPE "ContactConsentStatus" AS ENUM ('unknown', 'opted_in', 'opted_out');
CREATE TYPE "ContactEmailHealth" AS ENUM ('unknown', 'valid', 'risky', 'invalid');
CREATE TYPE "ContactSource" AS ENUM ('linkedin', 'event', 'referral', 'cold_list', 'inbound', 'manual');
CREATE TYPE "SignalType" AS ENUM ('funding', 'hiring', 'leadership_change', 'tech_change', 'news', 'mention', 'partnership', 'expansion');
CREATE TYPE "SignalSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "SignalImpact" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "SignalStatus" AS ENUM ('detected', 'validated', 'active', 'aging', 'expired', 'archived');
CREATE TYPE "SignalTimingWindow" AS ENUM ('immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired');
CREATE TYPE "SignalMeaningCategory" AS ENUM ('budget_available', 'leadership_openness', 'tech_dissatisfaction', 'growth_pressure', 'compliance_requirement', 'vendor_evaluation', 'unknown');
CREATE TYPE "SignalSourceQuality" AS ENUM ('premium', 'standard', 'low');
CREATE TYPE "JobType" AS ENUM ('enrichment', 'research', 'scoring', 'signal_detection', 'email_generation');
CREATE TYPE "JobStatus" AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "DraftStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'sent');
CREATE TYPE "ImportBatchStatus" AS ENUM ('staged', 'processing', 'completed', 'archived');

-- Add companyId to EmailSequence (was missing — schema error)
ALTER TABLE "EmailSequence" ADD COLUMN "companyId" TEXT;
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add companyId to ConversationPlan + FK to Company
ALTER TABLE "ConversationPlan" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ConversationPlan" ADD CONSTRAINT "ConversationPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ConversationPlan_companyId_idx" ON "ConversationPlan"("companyId");

-- Convert enum columns: Company
ALTER TABLE "Company" ALTER COLUMN "status" TYPE "CompanyStatus" USING "status"::"CompanyStatus";
ALTER TABLE "Company" ALTER COLUMN "lifecycleStage" TYPE "CompanyLifecycleStage" USING "lifecycleStage"::"CompanyLifecycleStage";
ALTER TABLE "Company" ALTER COLUMN "priorityTier" TYPE "CompanyPriorityTier" USING "priorityTier"::"CompanyPriorityTier";
ALTER TABLE "Company" ALTER COLUMN "source" TYPE "CompanySource" USING "source"::"CompanySource";

-- Convert enum columns: Contact
ALTER TABLE "Contact" ALTER COLUMN "consentStatus" TYPE "ContactConsentStatus" USING "consentStatus"::"ContactConsentStatus";
ALTER TABLE "Contact" ALTER COLUMN "emailHealth" TYPE "ContactEmailHealth" USING "emailHealth"::"ContactEmailHealth";
ALTER TABLE "Contact" ALTER COLUMN "status" TYPE "ContactStatus" USING "status"::"ContactStatus";
ALTER TABLE "Contact" ALTER COLUMN "source" TYPE "ContactSource" USING "source"::"ContactSource";

-- Convert enum columns: CompanySignal
ALTER TABLE "CompanySignal" ALTER COLUMN "signalType" TYPE "SignalType" USING "signalType"::"SignalType";
ALTER TABLE "CompanySignal" ALTER COLUMN "severity" TYPE "SignalSeverity" USING "severity"::"SignalSeverity";
ALTER TABLE "CompanySignal" ALTER COLUMN "impact" TYPE "SignalImpact" USING "impact"::"SignalImpact";
ALTER TABLE "CompanySignal" ALTER COLUMN "status" TYPE "SignalStatus" USING "status"::"SignalStatus";
ALTER TABLE "CompanySignal" ALTER COLUMN "meaningCategory" TYPE "SignalMeaningCategory" USING "meaningCategory"::"SignalMeaningCategory";
ALTER TABLE "CompanySignal" ALTER COLUMN "timingWindow" TYPE "SignalTimingWindow" USING "timingWindow"::"SignalTimingWindow";
ALTER TABLE "CompanySignal" ALTER COLUMN "sourceQuality" TYPE "SignalSourceQuality" USING "sourceQuality"::"SignalSourceQuality";

-- Convert enum columns: Job
ALTER TABLE "Job" ALTER COLUMN "type" TYPE "JobType" USING "type"::"JobType";
ALTER TABLE "Job" ALTER COLUMN "status" TYPE "JobStatus" USING "status"::"JobStatus";

-- Convert enum columns: Draft
ALTER TABLE "Draft" ALTER COLUMN "status" TYPE "DraftStatus" USING "status"::"DraftStatus";

-- Convert enum columns: ImportBatch
ALTER TABLE "ImportBatch" ALTER COLUMN "status" TYPE "ImportBatchStatus" USING "status"::"ImportBatchStatus";

-- Convert JSON String → Json type (CompanyResearchCard)
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "techStack" TYPE jsonb USING "techStack"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "socialProfiles" TYPE jsonb USING "socialProfiles"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "fieldConfidence" TYPE jsonb USING "fieldConfidence"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "keyPeople" TYPE jsonb USING "keyPeople"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "recentNews" TYPE jsonb USING "recentNews"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "structuredTechLandscape" TYPE jsonb USING "structuredTechLandscape"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "strategicPriorities" TYPE jsonb USING "strategicPriorities"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "businessProblems" TYPE jsonb USING "businessProblems"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "transformationAreas" TYPE jsonb USING "transformationAreas"::jsonb;
ALTER TABLE "CompanyResearchCard" ALTER COLUMN "technologyThemes" TYPE jsonb USING "technologyThemes"::jsonb;

-- Convert JSON String → Json type (Contact, Company)
ALTER TABLE "Contact" ALTER COLUMN "enrichmentData" TYPE jsonb USING "enrichmentData"::jsonb;
ALTER TABLE "Company" ALTER COLUMN "tags" TYPE jsonb USING "tags"::jsonb;

-- Convert JSON String → Json type (CompanySignal)
ALTER TABLE "CompanySignal" ALTER COLUMN "evidenceIds" TYPE jsonb USING "evidenceIds"::jsonb;

-- Convert JSON String → Json type (ConversationPlan, Playbook)
ALTER TABLE "ConversationPlan" ALTER COLUMN "plan" TYPE jsonb USING "plan"::jsonb;
ALTER TABLE "Playbook" ALTER COLUMN "steps" TYPE jsonb USING "steps"::jsonb;

-- Convert JSON String → Json type (AccountStrategy)
ALTER TABLE "AccountStrategy" ALTER COLUMN "swotAnalysis" TYPE jsonb USING "swotAnalysis"::jsonb;
ALTER TABLE "AccountStrategy" ALTER COLUMN "keyInitiatives" TYPE jsonb USING "keyInitiatives"::jsonb;
ALTER TABLE "AccountStrategy" ALTER COLUMN "stakeholderMap" TYPE jsonb USING "stakeholderMap"::jsonb;

-- Convert JSON String → Json type (Job)
ALTER TABLE "Job" ALTER COLUMN "stepDetail" TYPE jsonb USING "stepDetail"::jsonb;
ALTER TABLE "Job" ALTER COLUMN "payload" TYPE jsonb USING "payload"::jsonb;
ALTER TABLE "Job" ALTER COLUMN "result" TYPE jsonb USING "result"::jsonb;

-- Convert JSON String → Json type (AIGenerationAudit)
ALTER TABLE "AIGenerationAudit" ALTER COLUMN "evidenceIdsUsed" TYPE jsonb USING "evidenceIdsUsed"::jsonb;
ALTER TABLE "AIGenerationAudit" ALTER COLUMN "signalIdsUsed" TYPE jsonb USING "signalIdsUsed"::jsonb;
ALTER TABLE "AIGenerationAudit" ALTER COLUMN "capabilityAssetIdsUsed" TYPE jsonb USING "capabilityAssetIdsUsed"::jsonb;
ALTER TABLE "AIGenerationAudit" ALTER COLUMN "governanceChecks" TYPE jsonb USING "governanceChecks"::jsonb;
ALTER TABLE "AIGenerationAudit" ALTER COLUMN "inputParams" TYPE jsonb USING "inputParams"::jsonb;

-- Convert JSON String → Json type (ActionArtifact)
ALTER TABLE "ActionArtifact" ALTER COLUMN "content" TYPE jsonb USING "content"::jsonb;
ALTER TABLE "ActionArtifact" ALTER COLUMN "evidenceReferences" TYPE jsonb USING "evidenceReferences"::jsonb;

-- Convert JSON String → Json type (EngineRun)
ALTER TABLE "EngineRun" ALTER COLUMN "inputSummary" TYPE jsonb USING "inputSummary"::jsonb;
ALTER TABLE "EngineRun" ALTER COLUMN "outputSummary" TYPE jsonb USING "outputSummary"::jsonb;

-- Convert JSON String → Json type (metadata fields across models)
ALTER TABLE "CompanyTimelineEvent" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "OtpCode" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "ConnectorRun" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "IntelligenceObject" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "IntelligenceObject" ALTER COLUMN "confidenceBreakdown" TYPE jsonb USING "confidenceBreakdown"::jsonb;
ALTER TABLE "IntelligenceAssociation" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "IntelligenceTimeline" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "IntelligenceAlert" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "AIInsight" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "metadata" TYPE jsonb USING "metadata"::jsonb;
ALTER TABLE "HumanIntelligenceInbox" ALTER COLUMN "tags" TYPE jsonb USING "tags"::jsonb;

-- Add index for EmailSequence.companyId
CREATE INDEX "EmailSequence_companyId_idx" ON "EmailSequence"("companyId");
