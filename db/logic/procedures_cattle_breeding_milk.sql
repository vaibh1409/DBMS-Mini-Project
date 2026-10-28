-- =====================================================================
-- HerdSense | procedures_cattle_breeding_milk.sql
-- Stored functions and procedure for pedigree, milk yield and breeding.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_pedigree(animal, max_generations)
-- Ancestors of an animal, generation by generation, using a recursive
-- CTE over Breeding_Records (calf -> dam and sire).
--   SELECT * FROM fn_pedigree(17);      -- Tulsi's full pedigree
--   SELECT * FROM fn_pedigree(17, 1);   -- parents only
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pedigree(p_cattle_id INT, p_max_generations INT DEFAULT 10)
RETURNS TABLE (
    generation INT,
    relation   TEXT,
    cattle_id  INT,
    tag_number VARCHAR,
    name       VARCHAR,
    breed      VARCHAR,
    path       TEXT
)
LANGUAGE sql STABLE AS $$
    WITH RECURSIVE ancestors AS (
        SELECT c.cattle_id,
               0             AS generation,
               'self'::text  AS relation,
               c.name::text  AS path
        FROM Cattle c
        WHERE c.cattle_id = p_cattle_id

        UNION ALL

        SELECT parent.cattle_id,
               a.generation + 1,
               CASE WHEN parent.cattle_id = b.dam_id THEN 'dam' ELSE 'sire' END,
               a.path || ' <- ' || parent.name
        FROM ancestors a
        JOIN Breeding_Records b ON b.calf_id = a.cattle_id
        JOIN Cattle parent      ON parent.cattle_id IN (b.dam_id, b.sire_id)
        WHERE a.generation < p_max_generations
    )
    SELECT a.generation, a.relation, c.cattle_id, c.tag_number, c.name, c.breed, a.path
    FROM ancestors a
    JOIN Cattle c ON c.cattle_id = a.cattle_id
    ORDER BY a.generation, a.relation, c.name;
$$;

-- ---------------------------------------------------------------------
-- fn_yield_anomalies(recent_days, drop_pct)
-- Yield-anomaly detection: compares each cow's average daily milk over
-- the last `recent_days` days with her own average over the rest of
-- the last 30 days, and returns cows whose yield dropped by more than
-- `drop_pct` percent, with their latest health record for context.
--   SELECT * FROM fn_yield_anomalies();          -- last 3 days, 20% drop
--   SELECT * FROM fn_yield_anomalies(5, 10);
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_yield_anomalies(p_recent_days INT DEFAULT 3, p_drop_pct NUMERIC DEFAULT 20)
RETURNS TABLE (
    cattle_id        INT,
    tag_number       VARCHAR,
    name             VARCHAR,
    recent_avg       NUMERIC,
    baseline_avg     NUMERIC,
    change_pct       NUMERIC,
    latest_condition VARCHAR,
    latest_exam_date DATE
)
LANGUAGE sql STABLE AS $$
    WITH daily AS (
        SELECT m.cattle_id, m.yield_date, sum(m.litres) AS total
        FROM Milk_Yield m
        WHERE m.yield_date > CURRENT_DATE - 30
        GROUP BY m.cattle_id, m.yield_date
    ),
    windows AS (
        SELECT d.cattle_id,
               avg(d.total) FILTER (WHERE d.yield_date >  CURRENT_DATE - p_recent_days) AS recent,
               avg(d.total) FILTER (WHERE d.yield_date <= CURRENT_DATE - p_recent_days) AS baseline
        FROM daily d
        GROUP BY d.cattle_id
    )
    SELECT c.cattle_id,
           c.tag_number,
           c.name,
           round(w.recent, 2),
           round(w.baseline, 2),
           round(100 * (w.recent - w.baseline) / w.baseline, 1),
           h.suspected_condition,
           h.record_date
    FROM windows w
    JOIN Cattle c ON c.cattle_id = w.cattle_id
    LEFT JOIN LATERAL (
        SELECT hr.suspected_condition, hr.record_date
        FROM Health_Records hr
        WHERE hr.cattle_id = c.cattle_id
        ORDER BY hr.record_date DESC
        LIMIT 1
    ) h ON true
    WHERE w.baseline > 0
      AND w.recent < w.baseline * (1 - p_drop_pct / 100)
    ORDER BY 6;
$$;

-- ---------------------------------------------------------------------
-- sp_record_calving(breeding_id, tag, name, sex, breed, date_of_birth)
-- Records a birth as a single unit of work: adds the calf to Cattle and
-- closes the pending breeding record with the calf's id. If anything
-- fails (record not pending, duplicate tag, calf dated before the
-- breeding), neither change is saved.
--   CALL sp_record_calving(16, 'KA-6001', 'Ganga II', 'F', 'HF Cross');
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_record_calving(
    p_breeding_id   INT,
    p_tag_number    VARCHAR,
    p_name          VARCHAR,
    p_sex           CHAR,
    p_breed         VARCHAR,
    p_date_of_birth DATE DEFAULT CURRENT_DATE,
    INOUT p_calf_id INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_outcome VARCHAR(10);
BEGIN
    -- Lock the breeding record so two users cannot record the same birth
    SELECT outcome INTO v_outcome
    FROM Breeding_Records
    WHERE breeding_id = p_breeding_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'foreign_key_violation',
            MESSAGE = format('Breeding record %s does not exist.', p_breeding_id);
    END IF;
    IF v_outcome <> 'Pending' THEN
        RAISE EXCEPTION USING ERRCODE = 'check_violation',
            MESSAGE = format('Breeding record %s is already %s.', p_breeding_id, v_outcome);
    END IF;

    INSERT INTO Cattle (tag_number, name, breed, sex, date_of_birth)
    VALUES (p_tag_number, p_name, p_breed, p_sex, p_date_of_birth)
    RETURNING cattle_id INTO p_calf_id;

    -- The breeding trigger checks that the calf is born after the breeding date
    UPDATE Breeding_Records
       SET outcome = 'Calved',
           calf_id = p_calf_id
     WHERE breeding_id = p_breeding_id;

    RAISE NOTICE 'Calf % (%) recorded for breeding record %.', p_calf_id, p_name, p_breeding_id;
END;
$$;
