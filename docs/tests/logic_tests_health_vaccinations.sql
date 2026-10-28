-- =====================================================================
-- HerdSense | Trigger, function and procedure tests:
--             health records and vaccinations
-- Run on the seeded database (after db/seed/*.sql).
-- Everything runs in a transaction that is rolled back.
--
-- Run:  psql -U <user> -d herdsense -f docs/tests/logic_tests_health_vaccinations.sql
-- =====================================================================

BEGIN;

CREATE TEMP TABLE test_results (id SERIAL, test TEXT, expected TEXT, actual TEXT, result TEXT);

CREATE FUNCTION pg_temp.expect_error(p_test TEXT, p_code TEXT, p_sql TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
        INSERT INTO test_results (test, expected, actual, result)
        VALUES (p_test, 'rejected (' || p_code || ')', 'accepted', 'FAIL');
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results (test, expected, actual, result)
        VALUES (p_test, 'rejected (' || p_code || ')', 'rejected (' || SQLSTATE || ')',
                CASE WHEN SQLSTATE = p_code THEN 'PASS' ELSE 'FAIL' END);
    END;
END $$;

CREATE FUNCTION pg_temp.expect_true(p_test TEXT, p_sql TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN;
BEGIN
    EXECUTE p_sql INTO ok;
    INSERT INTO test_results (test, expected, actual, result)
    VALUES (p_test, 'true', COALESCE(ok::TEXT, 'null'), CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results (test, expected, actual, result)
    VALUES (p_test, 'true', 'error (' || SQLSTATE || ')', 'FAIL');
END $$;

DO $$
DECLARE
    v_doses_before INT;
BEGIN
    -- Vaccination due-date trigger ------------------------------------------
    PERFORM pg_temp.expect_true('T1 trigger: every seeded dose has a due date',
        $q$SELECT count(*) = 0 FROM Vaccinations WHERE next_due_date IS NULL$q$);
    PERFORM pg_temp.expect_true('T2 trigger: due date = administered date + interval',
        $q$WITH ins AS (INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
                        VALUES (21, 'BQ', '2026-01-01', 365, 2) RETURNING next_due_date)
           SELECT next_due_date = DATE '2027-01-01' FROM ins$q$);
    PERFORM pg_temp.expect_true('T3 trigger: changing the interval recomputes the due date',
        $q$WITH upd AS (UPDATE Vaccinations SET interval_days = 180
                         WHERE cattle_id = 21 AND vaccine_name = 'BQ' RETURNING next_due_date)
           SELECT next_due_date = DATE '2026-06-30' FROM upd$q$);
    PERFORM pg_temp.expect_true('T4 trigger: a hand-typed due date is overwritten',
        $q$WITH upd AS (UPDATE Vaccinations SET next_due_date = '2030-01-01'
                         WHERE cattle_id = 21 AND vaccine_name = 'BQ' RETURNING next_due_date)
           SELECT next_due_date = DATE '2026-06-30' FROM upd$q$);

    -- Vet-only trigger -----------------------------------------------------
    PERFORM pg_temp.expect_error('T5 trigger: a farmhand cannot be recorded as the examining vet', '23514',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (8, 3, CURRENT_DATE, 'Checked feet', 'Mild')$q$);
    PERFORM pg_temp.expect_error('T6 trigger: the owner cannot be recorded as giving a vaccine', '23514',
        $q$INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
           VALUES (8, 'LSD', CURRENT_DATE, 365, 1)$q$);
    PERFORM pg_temp.expect_error('T7 trigger: changing a record to a farmhand vet is rejected', '23514',
        $q$UPDATE Health_Records SET vet_id = 5 WHERE health_id = 1$q$);

    -- Embedding sync trigger ------------------------------------------------
    -- Make sure note 24 has an embedding (a placeholder vector if
    -- `npm run embed` has not been run), so the test does not depend on it
    INSERT INTO Note_Embeddings (health_id, cattle_id, note_date, suspected_condition, embedding)
    SELECT 24, cattle_id, record_date, suspected_condition, array_fill(0.01, ARRAY[384])::vector
    FROM Health_Records WHERE health_id = 24
    ON CONFLICT (health_id) DO NOTHING;

    UPDATE Health_Records SET suspected_condition = 'Mastitis' WHERE health_id = 24;
    PERFORM pg_temp.expect_true('T8 trigger: a new condition is copied to the embedding metadata',
        $q$SELECT suspected_condition = 'Mastitis' FROM Note_Embeddings WHERE health_id = 24$q$);
    UPDATE Health_Records SET vet_notes = 'Rechecked, udder normal.' WHERE health_id = 24;
    PERFORM pg_temp.expect_true('T9 trigger: changing the note text removes the stale embedding',
        $q$SELECT count(*) = 0 FROM Note_Embeddings WHERE health_id = 24$q$);

    -- fn_vaccinations_due ---------------------------------------------------
    PERFORM pg_temp.expect_true('T10 fn_vaccinations_due(0) matches the v_vaccinations_due view',
        $q$SELECT (SELECT count(*) FROM fn_vaccinations_due(0)) = (SELECT count(*) FROM v_vaccinations_due)$q$);
    PERFORM pg_temp.expect_true('T11 fn_vaccinations_due(0): Meena''s HS dose is due today',
        $q$SELECT due_status = 'Due Today' FROM fn_vaccinations_due(0) WHERE cattle_id = 14 AND vaccine_name = 'HS'$q$);
    PERFORM pg_temp.expect_true('T12 fn_vaccinations_due(30) adds doses due in the next 30 days',
        $q$SELECT due_status = 'Upcoming' AND days_until_due = 10
             FROM fn_vaccinations_due(30) WHERE cattle_id = 10 AND vaccine_name = 'FMD'$q$);

    -- sp_vaccinate_herd (transaction) ---------------------------------------
    SELECT count(*) INTO v_doses_before FROM Vaccinations;

    CALL sp_vaccinate_herd('LSD', 365, 2, ARRAY[8, 11, 12]);
    PERFORM pg_temp.expect_true('T13 sp_vaccinate_herd: records one dose per animal with due dates',
        $q$SELECT count(*) = 3 AND bool_and(next_due_date = CURRENT_DATE + 365)
             FROM Vaccinations WHERE vaccine_name = 'LSD' AND administered_date = CURRENT_DATE$q$);
    PERFORM pg_temp.expect_error('T14 sp_vaccinate_herd: a sold animal in the list rejects the call', '23514',
        $q$CALL sp_vaccinate_herd('HS', 365, 2, ARRAY[13, 14, 2])$q$);
    PERFORM pg_temp.expect_error('T15 sp_vaccinate_herd: an unknown animal rejects the call', '23503',
        $q$CALL sp_vaccinate_herd('HS', 365, 2, ARRAY[13, 999])$q$);
    PERFORM pg_temp.expect_error('T16 sp_vaccinate_herd: a farmhand cannot vaccinate', '23514',
        $q$CALL sp_vaccinate_herd('HS', 365, 3, ARRAY[13, 14])$q$);
    PERFORM pg_temp.expect_true('T17 sp_vaccinate_herd: failed calls saved no doses at all',
        format($q$SELECT count(*) = %s + 3 FROM Vaccinations$q$, v_doses_before));
END $$;

SELECT id AS "#", test, expected, actual, result FROM test_results ORDER BY id;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed, count(*) AS total FROM test_results;

ROLLBACK;
