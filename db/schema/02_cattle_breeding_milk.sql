-- =====================================================================
-- HerdSense | 02_cattle_breeding_milk.sql
-- Cattle, Breeding_Records (parent lineage) and Milk_Yield.
-- Run after 01_staff.sql.
-- =====================================================================

DROP TABLE IF EXISTS Milk_Yield       CASCADE;
DROP TABLE IF EXISTS Breeding_Records CASCADE;
DROP TABLE IF EXISTS Cattle           CASCADE;

-- ---------------------------------------------------------------------
-- Cattle: one row per animal
-- ---------------------------------------------------------------------
CREATE TABLE Cattle (
    cattle_id      SERIAL       PRIMARY KEY,
    tag_number     VARCHAR(20)  NOT NULL,
    name           VARCHAR(50),
    breed          VARCHAR(50)  NOT NULL,
    sex            CHAR(1)      NOT NULL,
    date_of_birth  DATE         NOT NULL,
    status         VARCHAR(10)  NOT NULL DEFAULT 'Active',

    CONSTRAINT uq_cattle_tag     UNIQUE (tag_number),
    CONSTRAINT chk_cattle_sex    CHECK (sex IN ('F', 'M')),
    CONSTRAINT chk_cattle_dob    CHECK (date_of_birth <= CURRENT_DATE),
    CONSTRAINT chk_cattle_status CHECK (status IN ('Active', 'Sold', 'Deceased'))
);

-- ---------------------------------------------------------------------
-- Breeding_Records: dam, sire and calf all reference Cattle,
-- forming the recursive parent-offspring relationship (pedigree).
-- ---------------------------------------------------------------------
CREATE TABLE Breeding_Records (
    breeding_id    SERIAL       PRIMARY KEY,
    dam_id         INT          NOT NULL,
    sire_id        INT          NOT NULL,
    breeding_date  DATE         NOT NULL,
    method         VARCHAR(10)  NOT NULL,
    outcome        VARCHAR(10)  NOT NULL DEFAULT 'Pending',
    calf_id        INT,
    recorded_by    INT          NOT NULL,

    CONSTRAINT fk_breeding_dam   FOREIGN KEY (dam_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_sire  FOREIGN KEY (sire_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_calf  FOREIGN KEY (calf_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_staff FOREIGN KEY (recorded_by)
        REFERENCES Farm_Staff (staff_id) ON DELETE RESTRICT,

    CONSTRAINT uq_breeding_calf       UNIQUE (calf_id),
    CONSTRAINT chk_breeding_date      CHECK (breeding_date <= CURRENT_DATE),
    CONSTRAINT chk_breeding_method    CHECK (method IN ('Natural', 'AI')),
    CONSTRAINT chk_breeding_outcome   CHECK (outcome IN ('Pending', 'Calved', 'Failed')),
    CONSTRAINT chk_breeding_parents   CHECK (dam_id <> sire_id),
    CONSTRAINT chk_breeding_calf_self CHECK (calf_id IS NULL
                                             OR (calf_id <> dam_id AND calf_id <> sire_id)),
    CONSTRAINT chk_breeding_calved    CHECK ((outcome = 'Calved') = (calf_id IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- Milk_Yield: one reading per animal per milking session
-- ---------------------------------------------------------------------
CREATE TABLE Milk_Yield (
    yield_id     SERIAL        PRIMARY KEY,
    cattle_id    INT           NOT NULL,
    yield_date   DATE          NOT NULL,
    session      VARCHAR(10)   NOT NULL,
    litres       NUMERIC(5,2)  NOT NULL,
    recorded_by  INT           NOT NULL,

    CONSTRAINT fk_yield_cattle FOREIGN KEY (cattle_id)
        REFERENCES Cattle (cattle_id) ON DELETE CASCADE,
    CONSTRAINT fk_yield_staff  FOREIGN KEY (recorded_by)
        REFERENCES Farm_Staff (staff_id) ON DELETE RESTRICT,

    CONSTRAINT uq_yield_session   UNIQUE (cattle_id, yield_date, session),
    CONSTRAINT chk_yield_date     CHECK (yield_date <= CURRENT_DATE),
    CONSTRAINT chk_yield_session  CHECK (session IN ('Morning', 'Evening')),
    CONSTRAINT chk_yield_litres   CHECK (litres >= 0)
);
