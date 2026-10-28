-- =====================================================================
-- HerdSense | alter_drop_demo.sql
-- Demonstrates ALTER and DROP statements on the schema.
-- NOT part of setup: run it on its own after the schema scripts.
-- Every change is undone by the end, so the schema is left as it was.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ALTER TABLE on a real table (Cattle)
-- ---------------------------------------------------------------------

-- 1. Add a column
ALTER TABLE Cattle ADD COLUMN weight_kg NUMERIC(6,2);

-- 2. Change its data type
ALTER TABLE Cattle ALTER COLUMN weight_kg TYPE NUMERIC(7,2);

-- 3. Add a constraint to it
ALTER TABLE Cattle ADD CONSTRAINT chk_cattle_weight CHECK (weight_kg > 0);

-- 4. Rename the column
ALTER TABLE Cattle RENAME COLUMN weight_kg TO body_weight_kg;

-- Show the altered table
\d Cattle

-- 5. Drop the constraint, then the column
ALTER TABLE Cattle DROP CONSTRAINT chk_cattle_weight;
ALTER TABLE Cattle DROP COLUMN body_weight_kg;

-- ---------------------------------------------------------------------
-- DROP INDEX, DROP VIEW and DROP TABLE on throwaway objects
-- ---------------------------------------------------------------------

CREATE TABLE Demo_Scratch (
    demo_id  SERIAL PRIMARY KEY,
    label    VARCHAR(30) NOT NULL
);
CREATE INDEX idx_demo_label ON Demo_Scratch (label);
CREATE VIEW v_demo_scratch AS SELECT label FROM Demo_Scratch;

DROP VIEW  v_demo_scratch;
DROP INDEX idx_demo_label;
DROP TABLE Demo_Scratch;

-- Confirm the schema is back to its original seven-column Cattle table
\d Cattle
