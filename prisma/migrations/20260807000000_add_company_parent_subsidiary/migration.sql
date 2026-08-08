-- AlterTable: Add parentId and subsidiaryType to Company model
ALTER TABLE "Company" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Company" ADD COLUMN "subsidiaryType" TEXT;
CREATE INDEX "Company_parentId_idx" ON "Company"("parentId");

-- CreateEnum: AdvisorConversationScope
CREATE TYPE "AdvisorConversationScope" AS ENUM ('account_intelligence', 'market_intelligence', 'competitive_analysis', 'signal_investigation', 'general_intelligence');

-- CreateEnum: AdvisorConversationStatus
CREATE TYPE "AdvisorConversationStatus" AS ENUM ('active', 'archived');

-- CreateEnum: AdvisorMessageRole
CREATE TYPE "AdvisorMessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum: AdvisorMessageStatus
CREATE TYPE "AdvisorMessageStatus" AS ENUM ('pending', 'streaming', 'delivered', 'error');

-- CreateEnum: AdvisorEscalationReason
CREATE TYPE "AdvisorEscalationReason" AS ENUM ('low_confidence', 'conflicting_evidence', 'complex_analysis', 'data_gap', 'user_request');

-- CreateEnum: AdvisorEscalationStatus
CREATE TYPE "AdvisorEscalationStatus" AS ENUM ('requested', 'acknowledged', 'in_progress', 'resolved', 'dismissed');

-- CreateTable: AdvisorConversation
CREATE TABLE "AdvisorConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Intelligence Briefing',
    "scope" "AdvisorConversationScope" NOT NULL DEFAULT 'general_intelligence',
    "status" "AdvisorConversationStatus" NOT NULL DEFAULT 'active',
    "companyId" TEXT,
    "userId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdvisorMessage
CREATE TABLE "AdvisorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AdvisorMessageRole" NOT NULL,
    "status" "AdvisorMessageStatus" NOT NULL DEFAULT 'pending',
    "content" TEXT NOT NULL,
    "contentJson" TEXT,
    "briefingId" TEXT,
    "queryText" TEXT,
    "position" INTEGER NOT NULL,
    "processingDurationMs" INTEGER,
    "modelUsed" TEXT,
    "feedbackType" TEXT,
    "feedbackComment" TEXT,
    "feedbackProvidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdvisorWorkspace
CREATE TABLE "AdvisorWorkspace" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "workspaceData" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorWorkspace_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdvisorWorkspace_conversationId_key" UNIQUE ("conversationId")
);

-- CreateTable: AdvisorEscalation
CREATE TABLE "AdvisorEscalation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" "AdvisorEscalationReason" NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "contextSnapshot" TEXT NOT NULL,
    "status" "AdvisorEscalationStatus" NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdvisorSavedBriefing
CREATE TABLE "AdvisorSavedBriefing" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "briefingData" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorSavedBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AdvisorConversation
CREATE INDEX "AdvisorConversation_companyId_lastActiveAt_idx" ON "AdvisorConversation"("companyId", "lastActiveAt" DESC);
CREATE INDEX "AdvisorConversation_userId_lastActiveAt_idx" ON "AdvisorConversation"("userId", "lastActiveAt" DESC);
CREATE INDEX "AdvisorConversation_status_lastActiveAt_idx" ON "AdvisorConversation"("status", "lastActiveAt" DESC);
CREATE INDEX "AdvisorConversation_createdAt_idx" ON "AdvisorConversation"("createdAt" DESC);

-- CreateIndex: AdvisorMessage
CREATE INDEX "AdvisorMessage_conversationId_position_idx" ON "AdvisorMessage"("conversationId", "position");
CREATE INDEX "AdvisorMessage_conversationId_createdAt_idx" ON "AdvisorMessage"("conversationId", "createdAt" DESC);
CREATE INDEX "AdvisorMessage_briefingId_idx" ON "AdvisorMessage"("briefingId");

-- CreateIndex: AdvisorWorkspace
CREATE INDEX "AdvisorWorkspace_updatedAt_idx" ON "AdvisorWorkspace"("updatedAt" DESC);

-- CreateIndex: AdvisorEscalation
CREATE INDEX "AdvisorEscalation_conversationId_requestedAt_idx" ON "AdvisorEscalation"("conversationId", "requestedAt" DESC);
CREATE INDEX "AdvisorEscalation_status_requestedAt_idx" ON "AdvisorEscalation"("status", "requestedAt" DESC);
CREATE INDEX "AdvisorEscalation_reason_status_idx" ON "AdvisorEscalation"("reason", "status");

-- CreateIndex: AdvisorSavedBriefing
CREATE INDEX "AdvisorSavedBriefing_companyId_createdAt_idx" ON "AdvisorSavedBriefing"("companyId", "createdAt" DESC);
CREATE INDEX "AdvisorSavedBriefing_createdAt_idx" ON "AdvisorSavedBriefing"("createdAt" DESC);

-- AddForeignKey: AdvisorConversation → Company
ALTER TABLE "AdvisorConversation" ADD CONSTRAINT "AdvisorConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AdvisorMessage → AdvisorConversation
ALTER TABLE "AdvisorMessage" ADD CONSTRAINT "AdvisorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AdvisorWorkspace → AdvisorConversation
ALTER TABLE "AdvisorWorkspace" ADD CONSTRAINT "AdvisorWorkspace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AdvisorEscalation → AdvisorConversation
ALTER TABLE "AdvisorEscalation" ADD CONSTRAINT "AdvisorEscalation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AdvisorSavedBriefing → AdvisorConversation
ALTER TABLE "AdvisorSavedBriefing" ADD CONSTRAINT "AdvisorSavedBriefing_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AdvisorSavedBriefing → Company
ALTER TABLE "AdvisorSavedBriefing" ADD CONSTRAINT "AdvisorSavedBriefing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
