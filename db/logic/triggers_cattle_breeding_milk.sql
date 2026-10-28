-- =====================================================================
-- HerdSense | triggers_cattle_breeding_milk.sql
-- Validation triggers on Breeding_Records and Milk_Yield: rules that
-- need data from another table, so a CHECK constraint cannot express
-- them. Errors use SQLSTATE 23514 (check_violation), like a CHECK.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Breeding records must make biological sense
--    - the dam must be female and the sire male
--    - a recorded calf must be born after the breeding date
--    If an animal does not exist, the foreign key reports it.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_check_breeding()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_sex CHAR(1);
    v_dob DATE;
BEGIN
    SELECT sex INTO v_sex FROM Cattle WHERE cattle_id = NEW.dam_id;
    IF FOUND AND v_sex <> 'F' THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation',
            MESSAGE = format('Dam %s is not female.', NEW.dam_id);
    END IF;

    SELECT sex INTO v_sex FROM Cattle WHERE cattle_id = NEW.sire_id;
    IF FOUND AND v_sex <> 'M' THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation',
            MESSAGE = format('Sire %s is not male.', NEW.sire_id);
    END IF;

    IF NEW.calf_id IS NOT NULL THEN
        SELECT date_of_birth INTO v_dob FROM Cattle WHERE cattle_id = NEW.calf_id;
        IF FOUND AND v_dob <= NEW.breeding_date THEN
            RAISE EXCEPTION USING ERRCODE = 'check_violation',
                MESSAGE = format('Calf %s was born on %s, which is not after the breeding date %s.',
                                 NEW.calf_id, v_dob, NEW.breeding_date);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_breeding_check ON Breeding_Records;
CREATE TRIGGER trg_breeding_check
    BEFORE INSERT OR UPDATE OF dam_id, sire_id, calf_id, breeding_date
    ON Breeding_Records
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_check_breeding();

-- ---------------------------------------------------------------------
-- 2. Milk can only be recorded for an active female animal
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_check_milking_cow()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_sex    CHAR(1);
    v_status VARCHAR(10);
BEGIN
    SELECT sex, status INTO v_sex, v_status FROM Cattle WHERE cattle_id = NEW.cattle_id;

    IF FOUND AND v_sex <> 'F' THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation',
            MESSAGE = format('Animal %s is male; milk yield cannot be recorded.', NEW.cattle_id);
    END IF;
    IF FOUND AND v_status <> 'Active' THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation',
            MESSAGE = format('Animal %s is %s; milk yield cannot be recorded.', NEW.cattle_id, v_status);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milk_yield_check ON Milk_Yield;
CREATE TRIGGER trg_milk_yield_check
    BEFORE INSERT OR UPDATE OF cattle_id
    ON Milk_Yield
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_check_milking_cow();
