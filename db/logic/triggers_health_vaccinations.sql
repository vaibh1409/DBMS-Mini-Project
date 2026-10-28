-- =====================================================================
-- HerdSense | triggers_health_vaccinations.sql
-- Triggers on Vaccinations and Health_Records.
-- Run after the schema scripts and db/vector/note_embeddings.sql.
-- Validation errors use SQLSTATE 23514 (check_violation), the same code
-- as a CHECK constraint, so the application handles them the same way.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vaccination due date
--    BEFORE INSERT / UPDATE: next_due_date is always
--    administered_date + interval_days, so it can never be typed wrong
--    or go out of date when a dose is corrected.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_set_next_due_date()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.next_due_date := NEW.administered_date + NEW.interval_days;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vaccination_due_date ON Vaccinations;
CREATE TRIGGER trg_vaccination_due_date
    BEFORE INSERT OR UPDATE OF administered_date, interval_days, next_due_date
    ON Vaccinations
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_set_next_due_date();

-- ---------------------------------------------------------------------
-- 2. Only a Vet can examine animals or give vaccines
--    One trigger function serves both tables; the name of the staff
--    column to check is passed as the trigger argument.
--    If the staff member does not exist, the foreign key reports it.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_require_vet()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_column   TEXT := TG_ARGV[0];
    v_staff_id INT  := (to_jsonb(NEW) ->> TG_ARGV[0])::INT;
    v_role     VARCHAR(10);
BEGIN
    SELECT role INTO v_role FROM Farm_Staff WHERE staff_id = v_staff_id;

    IF FOUND AND v_role <> 'Vet' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'check_violation',
            MESSAGE = format('Staff %s is a %s. Only a Vet can be recorded as %s.%s.',
                             v_staff_id, v_role, TG_TABLE_NAME, v_column);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_health_requires_vet ON Health_Records;
CREATE TRIGGER trg_health_requires_vet
    BEFORE INSERT OR UPDATE OF vet_id
    ON Health_Records
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_require_vet('vet_id');

DROP TRIGGER IF EXISTS trg_vaccination_requires_vet ON Vaccinations;
CREATE TRIGGER trg_vaccination_requires_vet
    BEFORE INSERT OR UPDATE OF administered_by
    ON Vaccinations
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_require_vet('administered_by');

-- ---------------------------------------------------------------------
-- 3. Keep the vector store consistent with the health record
--    AFTER UPDATE on Health_Records:
--    - if the note text changed, the old embedding no longer describes
--      it, so it is deleted (the application re-embeds the note in the
--      same transaction; `npm run embed` re-creates any that are missing)
--    - otherwise the metadata copied into Note_Embeddings is updated
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_sync_note_embedding()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.vet_notes IS DISTINCT FROM OLD.vet_notes THEN
        DELETE FROM Note_Embeddings WHERE health_id = NEW.health_id;
    ELSE
        UPDATE Note_Embeddings
           SET cattle_id           = NEW.cattle_id,
               note_date           = NEW.record_date,
               suspected_condition = NEW.suspected_condition
         WHERE health_id = NEW.health_id;
    END IF;
    RETURN NULL;   -- return value is ignored for AFTER triggers
END;
$$;

DROP TRIGGER IF EXISTS trg_health_embedding_sync ON Health_Records;
CREATE TRIGGER trg_health_embedding_sync
    AFTER UPDATE OF vet_notes, cattle_id, record_date, suspected_condition
    ON Health_Records
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_sync_note_embedding();
