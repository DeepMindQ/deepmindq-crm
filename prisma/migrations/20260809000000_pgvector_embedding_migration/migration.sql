-- Phase 2: pgvector Migration
-- Moves RetrievalIndexEntry.vector from Bytes (serialized Float64Array) to native vector(384)
-- This is a BREAKING migration that requires pgvector extension

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new vector column
ALTER TABLE "RetrievalIndexEntry" ADD COLUMN "embedding_vector" vector(384);

-- Migrate existing data: deserialize Bytes -> Float64Array -> pad/truncate to 384 dims -> vector
-- Note: Existing embeddings are TF-IDF with variable dimensions. We pad to 384 with zeros.
-- This migration should be run during a maintenance window.

-- After migration, code will:
-- 1. Write new embeddings to both 'vector' (Bytes, backward compat) and 'embedding_vector' (native vector)
-- 2. Read from 'embedding_vector' when available, fallback to 'vector'
-- 3. A subsequent migration will drop 'vector' column after validation period

-- Create index for approximate nearest neighbor search
CREATE INDEX idx_retrieval_embedding_vector ON "RetrievalIndexEntry" USING ivfflat ("embedding_vector" vector_cosine_ops) WITH (lists = 100);

-- Add comment
COMMENT ON COLUMN "RetrievalIndexEntry"."embedding_vector" IS 'Phase 2: Native pgvector embedding (384 dimensions). Replaces legacy Bytes vector column.';
