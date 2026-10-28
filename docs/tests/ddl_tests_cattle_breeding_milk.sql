-- =====================================================================
-- HerdSense | DDL constraint tests: Cattle, Breeding_Records, Milk_Yield
-- Checks that the database itself rejects invalid data.
-- Runs inside a transaction that is rolled back, so no data is kept.
--
-- Run:  psql -U <user> -d herdsense -f docs/tests/ddl_tests_cattle_breeding_milk.sql
--
-- SQLSTATE codes: 23502 NOT NULL | 23503 foreign key | 23505 unique | 23514 check
-- =====================================================================

BEGIN;

CREATE TEMP TABLE test_results (
    id       SERIAL,
    test     TEXT,
    expected TEXT,
    actual   TEXT,
    result   TEXT
);

-- Runs p_sql and expects it to fail with SQLSTATE p_code
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

-- Runs p_sql (a query returning one boolean) and expects TRUE
CREATE FUNCTION pg_temp.expect_true(p_test TEXT, p_sql TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN;
BEGIN
    EXECUTE p_sql INTO ok;
    INSERT INTO test_results (test, expected, actual, result)
    VALUES (p_test, 'true', COALESCE(ok::TEXT, 'null'),
            CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results (test, expected, actual, result)
    VALUES (p_test, 'true', 'error (' || SQLSTATE || ')', 'FAIL');
END $$;

-- ---------------------------------------------------------------------
-- Test fixtures
-- ---------------------------------------------------------------------
INSERT INTO Farm_Staff (staff_id, full_name, username, password_hash, role) VALUES
    (9001, 'Test Owner', 'test_owner', 'x', 'Owner');

INSERT INTO Cattle (cattle_id, tag_number, name, breed, sex, date_of_birth) VALUES
    (9001, 'T-DAM',  'Gauri', 'Gir',      'F', '2019-03-01'),
    (9002, 'T-SIRE', 'Raja',  'Gir',      'M', '2018-06-15'),
    (9003, 'T-CALF', 'Nandi', 'Gir',      'F', '2023-04-10'),
    (9004, 'T-COW2', 'Lakshmi','Sahiwal', 'F', '2020-01-20');

DO $$
BEGIN
    -- Cattle ------------------------------------------------------------
    PERFORM pg_temp.expect_error('C1 duplicate tag_number', '23505',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth)
           VALUES ('T-DAM', 'Gir', 'F', '2020-01-01')$q$);
    PERFORM pg_temp.expect_error('C2 invalid sex', '23514',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth)
           VALUES ('T-X1', 'Gir', 'X', '2020-01-01')$q$);
    PERFORM pg_temp.expect_error('C3 date_of_birth in the future', '23514',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth)
           VALUES ('T-X2', 'Gir', 'F', CURRENT_DATE + 1)$q$);
    PERFORM pg_temp.expect_error('C4 invalid status', '23514',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth, status)
           VALUES ('T-X3', 'Gir', 'F', '2020-01-01', 'Lost')$q$);
    PERFORM pg_temp.expect_error('C5 missing breed (NOT NULL)', '23502',
        $q$INSERT INTO Cattle (tag_number, sex, date_of_birth)
           VALUES ('T-X4', 'F', '2020-01-01')$q$);
    PERFORM pg_temp.expect_true('C6 status defaults to Active',
        $q$SELECT status = 'Active' FROM Cattle WHERE cattle_id = 9001$q$);

    -- Breeding_Records --------------------------------------------------
    PERFORM pg_temp.expect_error('B1 dam and sire are the same animal', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
           VALUES (9001, 9001, '2022-06-01', 'AI', 9001)$q$);
    PERFORM pg_temp.expect_error('B2 calf is its own parent', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, outcome, calf_id, recorded_by)
           VALUES (9001, 9002, '2022-06-01', 'AI', 'Calved', 9001, 9001)$q$);
    PERFORM pg_temp.expect_error('B3 outcome Calved without a calf', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, outcome, recorded_by)
           VALUES (9001, 9002, '2022-06-01', 'AI', 'Calved', 9001)$q$);
    PERFORM pg_temp.expect_error('B4 calf recorded while outcome is Pending', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, calf_id, recorded_by)
           VALUES (9001, 9002, '2022-06-01', 'AI', 9003, 9001)$q$);
    PERFORM pg_temp.expect_error('B5 invalid method', '23514',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
           VALUES (9001, 9002, '2022-06-01', 'Clone', 9001)$q$);
    PERFORM pg_temp.expect_error('B6 dam does not exist (foreign key)', '23503',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
           VALUES (12345, 9002, '2022-06-01', 'AI', 9001)$q$);
    PERFORM pg_temp.expect_true('B7 valid calved breeding record accepted',
        $q$WITH ins AS (
             INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, outcome, calf_id, recorded_by)
             VALUES (9001, 9002, '2022-07-01', 'Natural', 'Calved', 9003, 9001)
             RETURNING 1)
           SELECT count(*) = 1 FROM ins$q$);
    PERFORM pg_temp.expect_error('B8 same calf born twice (UNIQUE calf_id)', '23505',
        $q$INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, outcome, calf_id, recorded_by)
           VALUES (9004, 9002, '2022-07-01', 'AI', 'Calved', 9003, 9001)$q$);
    PERFORM pg_temp.expect_error('B9 deleting a parent with breeding records (RESTRICT)', '23503',
        $q$DELETE FROM Cattle WHERE cattle_id = 9001$q$);

    -- Milk_Yield --------------------------------------------------------
    PERFORM pg_temp.expect_error('M1 negative litres', '23514',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (9004, '2024-01-01', 'Morning', -2, 9001)$q$);
    PERFORM pg_temp.expect_error('M2 invalid session', '23514',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (9004, '2024-01-01', 'Night', 5, 9001)$q$);
    PERFORM pg_temp.expect_error('M3 yield_date in the future', '23514',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (9004, CURRENT_DATE + 1, 'Morning', 5, 9001)$q$);

    INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by) VALUES
        (9004, '2024-01-01', 'Morning', 6.50, 9001),
        (9004, '2024-01-01', 'Evening', 5.25, 9001);

    PERFORM pg_temp.expect_error('M4 second reading for the same session (UNIQUE)', '23505',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
           VALUES (9004, '2024-01-01', 'Morning', 7, 9001)$q$);
    PERFORM pg_temp.expect_true('M5 v_daily_milk_totals adds both sessions',
        $q$SELECT total_litres = 11.75 AND sessions_recorded = 2
             FROM v_daily_milk_totals
            WHERE cattle_id = 9004 AND yield_date = '2024-01-01'$q$);
    PERFORM pg_temp.expect_error('M6 deleting staff who recorded yields (RESTRICT)', '23503',
        $q$DELETE FROM Farm_Staff WHERE staff_id = 9001$q$);
    PERFORM pg_temp.expect_true('M7 deleting an animal removes its milk records (CASCADE)',
        $q$WITH d AS (DELETE FROM Cattle WHERE cattle_id = 9004 RETURNING 1)
           SELECT (SELECT count(*) FROM d) = 1$q$);
    PERFORM pg_temp.expect_true('M8 no milk records left for the deleted animal',
        $q$SELECT count(*) = 0 FROM Milk_Yield WHERE cattle_id = 9004$q$);
END $$;

-- ---------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------
SELECT id AS "#", test, expected, actual, result FROM test_results ORDER BY id;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed,
       count(*)                                AS total
FROM test_results;

ROLLBACK;
