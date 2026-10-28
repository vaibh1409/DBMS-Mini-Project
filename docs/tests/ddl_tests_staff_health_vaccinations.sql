-- =====================================================================
-- HerdSense | DDL constraint tests: Farm_Staff, Health_Records, Vaccinations
-- Checks that the database itself rejects invalid data.
-- Runs inside a transaction that is rolled back, so no data is kept.
--
-- Run:  psql -U <user> -d herdsense -f docs/tests/ddl_tests_staff_health_vaccinations.sql
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
    (9101, 'Test Vet',      'test_vet',      'x', 'Vet'),
    (9102, 'Test Farmhand', 'test_farmhand', 'x', 'Farmhand');

INSERT INTO Cattle (cattle_id, tag_number, name, breed, sex, date_of_birth) VALUES
    (9101, 'T-H1', 'Kamadhenu', 'Gir',     'F', '2019-03-01'),
    (9102, 'T-H2', 'Sundari',   'Sahiwal', 'F', '2020-05-12');

DO $$
BEGIN
    -- Farm_Staff --------------------------------------------------------
    PERFORM pg_temp.expect_error('S1 duplicate username', '23505',
        $q$INSERT INTO Farm_Staff (full_name, username, password_hash, role)
           VALUES ('Someone', 'test_vet', 'x', 'Vet')$q$);
    PERFORM pg_temp.expect_error('S2 invalid role', '23514',
        $q$INSERT INTO Farm_Staff (full_name, username, password_hash, role)
           VALUES ('Someone', 'someone', 'x', 'Admin')$q$);
    PERFORM pg_temp.expect_error('S3 missing password_hash (NOT NULL)', '23502',
        $q$INSERT INTO Farm_Staff (full_name, username, role)
           VALUES ('Someone', 'someone2', 'Vet')$q$);
    PERFORM pg_temp.expect_true('S4 created_at is filled by default',
        $q$SELECT created_at IS NOT NULL FROM Farm_Staff WHERE staff_id = 9101$q$);

    -- Health_Records ----------------------------------------------------
    PERFORM pg_temp.expect_error('H1 blank vet notes', '23514',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (9101, 9101, '2024-02-01', '   ', 'Mild')$q$);
    PERFORM pg_temp.expect_error('H2 invalid severity', '23514',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (9101, 9101, '2024-02-01', 'Off feed', 'Critical')$q$);
    PERFORM pg_temp.expect_error('H3 record_date in the future', '23514',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (9101, 9101, CURRENT_DATE + 1, 'Off feed', 'Mild')$q$);
    PERFORM pg_temp.expect_error('H4 animal does not exist (foreign key)', '23503',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (12345, 9101, '2024-02-01', 'Off feed', 'Mild')$q$);
    PERFORM pg_temp.expect_error('H5 vet does not exist (foreign key)', '23503',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity)
           VALUES (9101, 12345, '2024-02-01', 'Off feed', 'Mild')$q$);

    INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, suspected_condition, treatment, severity) VALUES
        (9101, 9101, '2024-02-01', 'Swollen rear left quarter, clots in milk, cow restless during milking',
         'Mastitis', 'Intramammary antibiotic, strip quarter twice daily', 'Moderate'),
        (9101, 9101, '2024-03-10', 'Reduced appetite and mild limp on front right hoof',
         'Lameness', 'Hoof trimming and rest', 'Mild'),
        (9102, 9101, '2024-02-20', 'Nasal discharge and coughing, temperature slightly raised',
         'Respiratory infection', 'Anti-inflammatory and observation', 'Mild');

    PERFORM pg_temp.expect_true('H6 full-text search finds notes mentioning "swollen"',
        $q$SELECT count(*) = 1 FROM Health_Records
            WHERE to_tsvector('english', vet_notes) @@ to_tsquery('english', 'swollen')$q$);
    PERFORM pg_temp.expect_true('H7 v_cattle_health_summary shows count and latest condition',
        $q$SELECT health_record_count = 2 AND last_suspected_condition = 'Lameness'
             FROM v_cattle_health_summary WHERE cattle_id = 9101$q$);
    PERFORM pg_temp.expect_error('H8 deleting a vet who has records (RESTRICT)', '23503',
        $q$DELETE FROM Farm_Staff WHERE staff_id = 9101$q$);

    -- Vaccinations ------------------------------------------------------
    PERFORM pg_temp.expect_error('V1 interval_days must be positive', '23514',
        $q$INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
           VALUES (9101, 'FMD', '2024-01-01', 0, 9101)$q$);
    PERFORM pg_temp.expect_error('V2 administered_date in the future', '23514',
        $q$INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
           VALUES (9101, 'FMD', CURRENT_DATE + 1, 180, 9101)$q$);
    PERFORM pg_temp.expect_error('V3 animal does not exist (foreign key)', '23503',
        $q$INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
           VALUES (12345, 'FMD', '2024-01-01', 180, 9101)$q$);

    -- next_due_date is set explicitly here; from Phase 5 a trigger sets it.
    -- Animal 9101: older FMD dose overdue, newer FMD dose not yet due -> not listed.
    -- Animal 9102: only FMD dose is overdue -> listed.
    INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, next_due_date, administered_by) VALUES
        (9101, 'FMD', CURRENT_DATE - 400, 180, CURRENT_DATE - 220, 9101),
        (9101, 'FMD', CURRENT_DATE - 10,  180, CURRENT_DATE + 170, 9101),
        (9102, 'FMD', CURRENT_DATE - 200, 180, CURRENT_DATE - 20,  9101);

    PERFORM pg_temp.expect_true('V4 v_vaccinations_due lists the overdue animal',
        $q$SELECT count(*) = 1 FROM v_vaccinations_due
            WHERE cattle_id = 9102 AND due_status = 'Overdue' AND days_overdue = 20$q$);
    PERFORM pg_temp.expect_true('V5 v_vaccinations_due ignores doses replaced by a newer one',
        $q$SELECT count(*) = 0 FROM v_vaccinations_due WHERE cattle_id = 9101$q$);
    PERFORM pg_temp.expect_true('V6 deleting an animal removes its health and vaccination records (CASCADE)',
        $q$WITH d AS (DELETE FROM Cattle WHERE cattle_id = 9101 RETURNING 1)
           SELECT (SELECT count(*) FROM d) = 1$q$);
    PERFORM pg_temp.expect_true('V7 no health or vaccination records left for the deleted animal',
        $q$SELECT (SELECT count(*) FROM Health_Records WHERE cattle_id = 9101)
                + (SELECT count(*) FROM Vaccinations  WHERE cattle_id = 9101) = 0$q$);
END $$;

-- ---------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------
SELECT id AS "#", test, expected, actual, result FROM test_results ORDER BY id;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed,
       count(*)                                AS total
FROM test_results;

ROLLBACK;
