-- =====================================================================
-- HerdSense | note_embeddings.sql
-- Vector store for vet-note embeddings (see docs/design/vector_design.md).
-- Run after the schema scripts, because it references Health_Records.
-- =====================================================================

DROP TABLE IF EXISTS Note_Embeddings CASCADE;

CREATE TABLE Note_Embeddings (
    embedding_id         SERIAL        PRIMARY KEY,
    health_id            INT           NOT NULL,
    cattle_id            INT           NOT NULL,     -- metadata
    note_date            DATE          NOT NULL,     -- metadata
    suspected_condition  VARCHAR(100),               -- metadata
    embedding            vector(384)   NOT NULL,     -- all-MiniLM-L6-v2 embedding of vet_notes

    -- One embedding per note; removing the note removes its embedding
    CONSTRAINT uq_embedding_health UNIQUE (health_id),
    CONSTRAINT fk_embedding_health FOREIGN KEY (health_id)
        REFERENCES Health_Records (health_id) ON DELETE CASCADE
);

-- Approximate nearest-neighbour index for cosine distance (<=>)
CREATE INDEX idx_note_embeddings_hnsw
    ON Note_Embeddings USING hnsw (embedding vector_cosine_ops);

-- Metadata filters used alongside similarity search
CREATE INDEX idx_note_embeddings_condition ON Note_Embeddings (suspected_condition);
CREATE INDEX idx_note_embeddings_cattle    ON Note_Embeddings (cattle_id);
