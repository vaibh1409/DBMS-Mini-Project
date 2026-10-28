-- =====================================================================
-- HerdSense | procedures_health_vaccinations.sql
-- Stored function and procedure for vaccinations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_vaccinations_due(within_days)
-- Latest dose of each vaccine per active animal whose next dose is due
-- within the given number of days (0 = due today or overdue).
--   SELECT * FROM fn_vaccinations_due();     -- due or overdue
--   SELECT * FROM fn_vaccinations_due(30);   -- also due in the next 30 days
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_vaccinations_due(p_within_days INT DEFAULT 0)
RETURNS TABLE (
    cattle_id      INT,
    tag_number     VARCHAR,
    name           VARCHAR,
    vaccine_name   VARCHAR,
    last_dose      DATE,
    next_due_date  DATE,
    days_until_due INT,
    due_status     TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT c.cattle_id,
           c.tag_number,
           c.name,
           v.vaccine_name,
           v.administered_date,
           v.next_due_date,
           v.next_due_date - CURRENT_DATE,
           CASE
               WHEN v.next_due_date < CURRENT_DATE THEN 'Overdue'
               WHEN v.next_due_date = CURRENT_DATE THEN 'Due Today'
               ELSE 'Upcoming'
           END
    FROM (
        SELECT DISTINCT ON (vac.cattle_id, vac.vaccine_name) vac.*
        FROM Vaccinations vac
        ORDER BY vac.cattle_id, vac.vaccine_name, vac.administered_date DESC
    ) v
    JOIN Cattle c ON c.cattle_id = v.cattle_id
    WHERE c.status = 'Active'
      AND v.next_due_date <= CURRENT_DATE + p_within_days
    ORDER BY v.next_due_date, c.cattle_id;
$$;

-- ---------------------------------------------------------------------
-- sp_vaccinate_herd(vaccine, interval_days, vet, animals[], date)
-- Records one vaccine dose for a list of animals as a single unit of
-- work. Every animal must exist and be Active, and the staff member
-- must be a Vet (checked by the trigger). If any check fails, the whole
-- call fails and none of the doses are saved.
--   CALL sp_vaccinate_herd('LSD', 365, 2, ARRAY[8, 11, 12]);
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_vaccinate_herd(
    p_vaccine_name    VARCHAR,
    p_interval_days   INT,
    p_administered_by INT,
    p_cattle_ids      INT[],
    p_date            DATE DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_cattle_id INT;
    v_status    VARCHAR(10);
    v_count     INT := 0;
BEGIN
    IF p_cattle_ids IS NULL OR cardinality(p_cattle_ids) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'No animals were given.';
    END IF;

    FOREACH v_cattle_id IN ARRAY p_cattle_ids LOOP
        SELECT status INTO v_status FROM Cattle WHERE cattle_id = v_cattle_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'foreign_key_violation',
                MESSAGE = format('Animal %s does not exist. No doses were recorded.', v_cattle_id);
        END IF;
        IF v_status <> 'Active' THEN
            RAISE EXCEPTION USING ERRCODE = 'check_violation',
                MESSAGE = format('Animal %s is %s and cannot be vaccinated. No doses were recorded.', v_cattle_id, v_status);
        END IF;

        INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
        VALUES (v_cattle_id, p_vaccine_name, p_date, p_interval_days, p_administered_by);

        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE '% dose(s) of % recorded.', v_count, p_vaccine_name;
END;
$$;
