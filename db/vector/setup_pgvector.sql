-- =====================================================================
-- HerdSense | setup_pgvector.sql
-- Enables the pgvector extension, which adds the vector data type,
-- distance operators (<=> cosine, <-> L2, <#> inner product) and
-- HNSW / IVFFlat indexes. Run once per database, before the vector table.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Confirm the installed version
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
