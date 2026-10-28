-- =====================================================================
-- HerdSense | 03_health_vaccinations.sql
-- Health_Records (source of vet-note embeddings) and Vaccinations.
-- Run after 02_cattle_breeding_milk.sql.
-- =====================================================================

DROP TABLE IF EXISTS Vaccinations   CASCADE;
DROP TABLE IF EXISTS Health_Records CASCADE;

-- ---------------------------------------------------------------------
-- Health_Records: one row per vet examination
-- ---------------------------------------------------------------------
CREATE TABLE Health_Records (
    health_id            SERIAL        PRIMARY KEY,
    cattle_id            INT           NOT NULL,
    vet_id               INT           NOT NULL,
    record_date          DATE          NOT NULL,
    vet_notes            TEXT          NOT NULL,
    suspected_condition  VARCHAR(100),
    treatment            TEXT,
    severity             VARCHAR(10)   NOT NULL,

    CONSTRAINT fk_health_cattle FOREIGN KEY (cattle_id)
        REFERENCES Cattle (cattle_id) ON DELETE CASCADE,
    CONSTRAINT fk_health_vet    FOREIGN KEY (vet_id)
        REFERENCES Farm_Staff (staff_id) ON DELETE RESTRICT,

    CONSTRAINT chk_health_date     CHECK (record_date <= CURRENT_DATE),
    CONSTRAINT chk_health_notes    CHECK (length(trim(vet_notes)) > 0),
    CONSTRAINT chk_health_severity CHECK (severity IN ('Mild', 'Moderate', 'Severe'))
);

-- ---------------------------------------------------------------------
-- Vaccinations: one row per dose given.
-- next_due_date is filled by a trigger (added in db/logic/triggers.sql).
-- ---------------------------------------------------------------------
CREATE TABLE Vaccinations (
    vaccination_id     SERIAL        PRIMARY KEY,
    cattle_id          INT           NOT NULL,
    vaccine_name       VARCHAR(100)  NOT NULL,
    administered_date  DATE          NOT NULL,
    interval_days      INT           NOT NULL,
    next_due_date      DATE,
    administered_by    INT           NOT NULL,

    CONSTRAINT fk_vacc_cattle FOREIGN KEY (cattle_id)
        REFERENCES Cattle (cattle_id) ON DELETE CASCADE,
    CONSTRAINT fk_vacc_staff  FOREIGN KEY (administered_by)
        REFERENCES Farm_Staff (staff_id) ON DELETE RESTRICT,

    CONSTRAINT chk_vacc_date     CHECK (administered_date <= CURRENT_DATE),
    CONSTRAINT chk_vacc_interval CHECK (interval_days > 0)
);
