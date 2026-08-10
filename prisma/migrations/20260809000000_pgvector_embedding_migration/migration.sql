-- Phase 0.4: pgvector Migration
-- Target: BOTH Embedding (live) and RetrievalIndexEntry (future/persistence) tables
-- Adds native vector columns alongside existing JSON/Bytes storage for backward compatibility
-- Requires: PostgreSQL with pgvector extension installed

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Enable pgvector extension
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Add native vector column to Embedding table (LIVE)
--
-- The Embedding table stores TF-IDF/Xenova embeddings as JSON text.
-- We add a native vector(384) column alongside it.
-- The retrieval-engine.ts will:
--   - WRITE: both JSON 'vector' (backward compat) AND 'embedding_vector' (native)
--   - READ: from 'embedding_vector' when available, fallback to JSON 'vector'
--   - SEARCH: use pgvector cosine operator '<=>>' instead of JS brute-force
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Embedding" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(384);

-- Migrate existing JSON embeddings to native vector format
-- Parse JSON array -> cast to vector(384)
UPDATE "Embedding"
SET "embedding_vector" = ("vector"::json)::vector
WHERE "vector" IS NOT NULL
  AND "vector" != '[]'
  AND "embedding_vector" IS NULL;

-- Create index for approximate nearest neighbor (cosine distance)
-- ivfflat with lists=100 is good for up to 100K embeddings
CREATE INDEX IF NOT EXISTS idx_embedding_vector_cosine
  ON "Embedding" USING ivfflat ("embedding_vector" vector_cosine_ops)
  WITH (lists = 100);

-- Create HNSW index for higher quality (exact) search
-- HNSW is better for smaller datasets (<50K) and provides better recall
CREATE INDEX IF NOT EXISTS idx_embedding_vector_hnsw
  ON "Embedding" USING hnsw ("embedding_vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON COLUMN "Embedding"."embedding_vector" IS
  'Phase 0.4: Native pgvector embedding (384 dimensions). Coexists with JSON vector column for backward compatibility.';

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Add native vector column to RetrievalIndexEntry (persistence layer)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "RetrievalIndexEntry" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(384);

CREATE INDEX IF NOT EXISTS idx_retrieval_embedding_vector
  ON "RetrievalIndexEntry" USING ivfflat ("embedding_vector" vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON COLUMN "RetrievalIndexEntry"."embedding_vector" IS
  'Phase 0.4: Native pgvector embedding (384 dimensions). Replaces legacy Bytes vector column.';
