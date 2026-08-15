-- DeepMindQ Intelligence OS — Baseline Schema Migration
-- Date: 2026-08-15
-- 
-- This migration captures the initial schema as applied via `prisma db push`.
-- Future schema changes should use `prisma migrate dev` to generate versioned migrations.
--
-- Models: Organization, Person, Relationship, Signal, SignalRule, Evidence, SignalEvent,
--         Insight, Briefing, DataIngestion, DataIngestionRow, KnowledgeFolder,
--         KnowledgeFolderEntity, User, Session, AuditLog, AIUsageLog, PromptTemplate
-- 
-- NOTE: This project uses SQLite for development. JSON fields (aliases, evidenceIds,
-- signalIds, keyFindings, riskFactors, recommendedActions, columnMap, errorDetails,
-- customConditions) are documented SQLite workarounds — each has corresponding
-- application-layer parsing/querying logic in the intelligence engines.

-- Enable WAL mode for better concurrent read performance
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
