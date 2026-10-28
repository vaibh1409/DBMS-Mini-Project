-- =====================================================================
-- HerdSense | Trigger, function and procedure tests:
--             cattle, breeding and milk yield
-- Run on the seeded database (after db/seed/*.sql). Everything runs in
-- a transaction that is rolled back, so no data is changed.
--
-- Run:  psql -U <user> -d herdsense -f docs/tests/logic_tests_cattle_breeding_milk.sql
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
    v_cattle_before INT;
    v_calf_id       INT;
BEGIN
    -- Breeding trigger ---------------------------------------------------
    PERFORM pg_temp.expect_error('T1 trigger: a bull cannot be recorded as the dam', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
           VALUES (4, 7, CURRENT_DATE - 10, 'Natural', 1)$q$);
    PERFORM pg_temp.expect_error('T2 trigger: a cow cannot be recorded as the sire', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
           VALUES (8, 10, CURRENT_DATE - 10, 'AI', 1)$q$);
    PERFORM pg_temp.expect_error('T3 trigger: calf cannot be born before the breeding date', '23514',
        $q$UPDATE Breeding_Records SET outcome = 'Calved', calf_id = 19 WHERE breeding_id = 17$q$);
    PERFORM pg_temp.expect_true('T4 trigger: a valid breeding record is accepted',
        $q$WITH ins AS (INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
                        VALUES (21, 7, CURRENT_DATE - 5, 'AI', 2) RETURNING 1)
           SELECT count(*) = 1 FROM ins$q$);

    -- Milk trigger -------------------------------------------------------
    PERFORM pg_temp.expect_error('T5 trigger: milk cannot be recorded for a bull', '23514',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (4, CURRENT_DATE - 40, 'Morning', 3, 3)$q$);
    PERFORM pg_temp.expect_error('T6 trigger: milk cannot be recorded for a sold cow', '23514',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (3, CURRENT_DATE - 40, 'Morning', 3, 3)$q$);

    -- fn_pedigree (recursive CTE) -----------------------------------------
    PERFORM pg_temp.expect_true('T7 fn_pedigree: Tulsi has 7 rows over 3 generations',
        $q$SELECT count(*) = 7 AND max(generation) = 3 FROM fn_pedigree(17)$q$);
    PERFORM pg_temp.expect_true('T8 fn_pedigree: great-grandparents are Ganga and Bhima',
        $q$SELECT array_agg(name ORDER BY name) = ARRAY['Bhima','Ganga']::varchar[]
             FROM fn_pedigree(17) WHERE generation = 3$q$);
    PERFORM pg_temp.expect_true('T9 fn_pedigree: generation limit stops at parents',
        $q$SELECT count(*) = 3 FROM fn_pedigree(17, 1)$q$);
    PERFORM pg_temp.expect_true('T10 fn_pedigree: a founder has no ancestors',
        $q$SELECT count(*) = 1 FROM fn_pedigree(1)$q$);

    -- fn_yield_anomalies ---------------------------------------------------
    PERFORM pg_temp.expect_true('T11 fn_yield_anomalies: only Lakshmi is flagged',
        $q$SELECT array_agg(name) = ARRAY['Lakshmi']::varchar[] FROM fn_yield_anomalies()$q$);
    PERFORM pg_temp.expect_true('T12 fn_yield_anomalies: shows her latest condition (Mastitis)',
        $q$SELECT latest_condition = 'Mastitis' AND change_pct < -20 FROM fn_yield_anomalies() WHERE cattle_id = 10$q$);
    PERFORM pg_temp.expect_true('T13 fn_yield_anomalies: a 50% threshold flags nobody',
        $q$SELECT count(*) = 0 FROM fn_yield_anomalies(3, 50)$q$);

    -- sp_record_calving (transaction) ----------------------------------------
    SELECT count(*) INTO v_cattle_before FROM Cattle;

    CALL sp_record_calving(16, 'KA-6001', 'Ganga II', 'F', 'HF Cross', CURRENT_DATE, v_calf_id);
    PERFORM pg_temp.expect_true('T14 sp_record_calving: adds the calf and closes the breeding record',
        format($q$SELECT b.outcome = 'Calved' AND b.calf_id = %s AND c.name = 'Ganga II'
                    FROM Breeding_Records b JOIN Cattle c ON c.cattle_id = b.calf_id
                   WHERE b.breeding_id = 16$q$, v_calf_id));

    PERFORM pg_temp.expect_error('T15 sp_record_calving: a breeding already calved is rejected', '23514',
        $q$CALL sp_record_calving(16, 'KA-6002', 'Twin', 'F', 'HF Cross')$q$);
    PERFORM pg_temp.expect_error('T16 sp_record_calving: a calf dated before the breeding is rejected', '23514',
        $q$CALL sp_record_calving(17, 'KA-6003', 'Early', 'F', 'Sahiwal x Gir', '2026-01-01')$q$);
    PERFORM pg_temp.expect_true('T17 sp_record_calving: failed calls left no half-saved calf',
        format($q$SELECT count(*) = %s + 1 FROM Cattle$q$, v_cattle_before));
    PERFORM pg_temp.expect_true('T18 sp_record_calving: breeding 17 is still Pending',
        $q$SELECT outcome = 'Pending' AND calf_id IS NULL FROM Breeding_Records WHERE breeding_id = 17$q$);
END $$;

SELECT id AS "#", test, expected, actual, result FROM test_results ORDER BY id;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed, count(*) AS total FROM test_results;

ROLLBACK;
