-- =====================================================================
-- HerdSense | 04_indexes.sql
-- Indexes for the most frequent lookups.
-- PRIMARY KEY and UNIQUE constraints already create their own indexes
-- (for example Milk_Yield (cattle_id, yield_date, session) and
-- Breeding_Records (calf_id)), so they are not repeated here.
-- =====================================================================

-- Health history of one animal, newest first
CREATE INDEX IF NOT EXISTS idx_health_cattle_date
    ON Health_Records (cattle_id, record_date DESC);

-- Full-text search on vet notes (fallback when semantic search is unavailable)
CREATE INDEX IF NOT EXISTS idx_health_notes_fts
    ON Health_Records USING GIN (to_tsvector('english', vet_notes));

-- Vaccinations due or overdue
CREATE INDEX IF NOT EXISTS idx_vacc_next_due
    ON Vaccinations (next_due_date);

-- Vaccination history of one animal
CREATE INDEX IF NOT EXISTS idx_vacc_cattle_name
    ON Vaccinations (cattle_id, vaccine_name, administered_date DESC);

-- Pedigree tracing: find the breeding records where an animal is a parent
CREATE INDEX IF NOT EXISTS idx_breeding_dam
    ON Breeding_Records (dam_id);

CREATE INDEX IF NOT EXISTS idx_breeding_sire
    ON Breeding_Records (sire_id);

-- Filtering the herd by breed
CREATE INDEX IF NOT EXISTS idx_cattle_breed
    ON Cattle (breed);
