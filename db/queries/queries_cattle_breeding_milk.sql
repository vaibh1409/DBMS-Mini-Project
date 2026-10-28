-- =====================================================================
-- HerdSense | queries_cattle_breeding_milk.sql
-- Important queries on cattle, pedigree, breeding and milk yield:
-- joins (including self-joins), GROUP BY / HAVING, aggregates,
-- nested and correlated subqueries, and recursive CTEs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Q1. INNER JOIN with self-joins: every calving with the names of the
--     dam, sire and calf (Cattle is joined three times).
-- ---------------------------------------------------------------------
SELECT b.breeding_id,
       b.breeding_date,
       b.method,
       dam.name   AS dam,
       sire.name  AS sire,
       calf.name  AS calf,
       calf.date_of_birth
FROM Breeding_Records b
JOIN Cattle dam  ON dam.cattle_id  = b.dam_id
JOIN Cattle sire ON sire.cattle_id = b.sire_id
JOIN Cattle calf ON calf.cattle_id = b.calf_id
ORDER BY calf.date_of_birth;

-- ---------------------------------------------------------------------
-- Q2. LEFT JOIN: every animal with its recorded parents. Founders have
--     no breeding record as a calf, so dam and sire come back NULL.
-- ---------------------------------------------------------------------
SELECT c.tag_number,
       c.name,
       c.breed,
       c.sex,
       dam.name  AS dam,
       sire.name AS sire
FROM Cattle c
LEFT JOIN Breeding_Records b ON b.calf_id    = c.cattle_id
LEFT JOIN Cattle dam         ON dam.cattle_id  = b.dam_id
LEFT JOIN Cattle sire        ON sire.cattle_id = b.sire_id
ORDER BY c.cattle_id;

-- ---------------------------------------------------------------------
-- Q3. GROUP BY + HAVING + aggregates: milk summary per cow over the
--     last 30 days, only for cows averaging more than 10 litres a day.
-- ---------------------------------------------------------------------
SELECT d.tag_number,
       d.name,
       count(*)                      AS days_recorded,
       round(avg(d.total_litres), 2) AS avg_daily_litres,
       min(d.total_litres)           AS lowest_day,
       max(d.total_litres)           AS highest_day,
       sum(d.total_litres)           AS total_litres_30_days
FROM v_daily_milk_totals d
WHERE d.yield_date > CURRENT_DATE - 30
GROUP BY d.cattle_id, d.tag_number, d.name
HAVING avg(d.total_litres) > 10
ORDER BY avg_daily_litres DESC;

-- ---------------------------------------------------------------------
-- Q4. Nested (non-correlated) subquery: cows whose average daily yield
--     is above the herd's average daily yield.
-- ---------------------------------------------------------------------
SELECT d.name,
       round(avg(d.total_litres), 2) AS avg_daily_litres
FROM v_daily_milk_totals d
GROUP BY d.cattle_id, d.name
HAVING avg(d.total_litres) > (SELECT avg(total_litres) FROM v_daily_milk_totals)
ORDER BY avg_daily_litres DESC;

-- ---------------------------------------------------------------------
-- Q5. Correlated subquery: compare each cow's average over the last
--     3 days with her own average over the 27 days before. The inner
--     query refers to the outer row's cattle_id, so it runs per cow.
--     A drop of more than 20% is flagged.
-- ---------------------------------------------------------------------
SELECT recent.name,
       recent.last_3_days_avg,
       recent.earlier_avg,
       round(100 * (recent.last_3_days_avg - recent.earlier_avg) / recent.earlier_avg, 1) AS change_pct,
       CASE WHEN recent.last_3_days_avg < 0.8 * recent.earlier_avg THEN 'DROP' ELSE 'normal' END AS flag
FROM (
    SELECT c.cattle_id,
           c.name,
           (SELECT round(avg(d.total_litres), 2)
              FROM v_daily_milk_totals d
             WHERE d.cattle_id = c.cattle_id
               AND d.yield_date > CURRENT_DATE - 3)  AS last_3_days_avg,
           (SELECT round(avg(d.total_litres), 2)
              FROM v_daily_milk_totals d
             WHERE d.cattle_id = c.cattle_id
               AND d.yield_date <= CURRENT_DATE - 3) AS earlier_avg
    FROM Cattle c
    WHERE EXISTS (SELECT 1 FROM Milk_Yield m WHERE m.cattle_id = c.cattle_id)
) AS recent
ORDER BY change_pct;

-- ---------------------------------------------------------------------
-- Q6. GROUP BY + HAVING with conditional aggregates: breeding success
--     rate per sire, for sires used at least twice.
-- ---------------------------------------------------------------------
SELECT s.name                                             AS sire,
       count(*)                                           AS breedings,
       count(*) FILTER (WHERE b.outcome = 'Calved')       AS calved,
       count(*) FILTER (WHERE b.outcome = 'Failed')       AS failed,
       count(*) FILTER (WHERE b.outcome = 'Pending')      AS pending,
       round(100.0 * count(*) FILTER (WHERE b.outcome = 'Calved')
             / NULLIF(count(*) FILTER (WHERE b.outcome <> 'Pending'), 0), 1) AS success_rate_pct
FROM Breeding_Records b
JOIN Cattle s ON s.cattle_id = b.sire_id
GROUP BY s.cattle_id, s.name
HAVING count(*) >= 2
ORDER BY success_rate_pct DESC, breedings DESC;

-- ---------------------------------------------------------------------
-- Q7. Correlated EXISTS / NOT EXISTS:
--     (a) active bulls that have sired at least one calf
--     (b) active cows that have never been bred
-- ---------------------------------------------------------------------
SELECT c.name, c.breed, 'proven sire' AS note
FROM Cattle c
WHERE c.sex = 'M' AND c.status = 'Active'
  AND EXISTS (SELECT 1 FROM Breeding_Records b
               WHERE b.sire_id = c.cattle_id AND b.outcome = 'Calved')
UNION ALL
SELECT c.name, c.breed, 'never bred' AS note
FROM Cattle c
WHERE c.sex = 'F' AND c.status = 'Active'
  AND NOT EXISTS (SELECT 1 FROM Breeding_Records b WHERE b.dam_id = c.cattle_id)
ORDER BY note, name;

-- ---------------------------------------------------------------------
-- Q8. Recursive CTE: pedigree of Tulsi (17). The anchor is the animal
--     itself; each recursive step finds the dam and sire of the
--     previous generation through Breeding_Records.calf_id.
-- ---------------------------------------------------------------------
WITH RECURSIVE ancestors AS (
    SELECT c.cattle_id,
           c.name,
           0                 AS generation,
           'self'::text      AS relation,
           c.name::text      AS path
    FROM Cattle c
    WHERE c.cattle_id = 17

    UNION ALL

    SELECT parent.cattle_id,
           parent.name,
           a.generation + 1,
           CASE WHEN parent.cattle_id = b.dam_id THEN 'dam' ELSE 'sire' END,
           a.path || ' <- ' || parent.name
    FROM ancestors a
    JOIN Breeding_Records b ON b.calf_id = a.cattle_id
    JOIN Cattle parent      ON parent.cattle_id IN (b.dam_id, b.sire_id)
)
SELECT generation, relation, name, path
FROM ancestors
ORDER BY generation, relation, name;

-- ---------------------------------------------------------------------
-- Q9. Recursive CTE in the other direction: all descendants of the
--     founder cow Ganga (1), with how many generations down they are.
-- ---------------------------------------------------------------------
WITH RECURSIVE descendants AS (
    SELECT c.cattle_id, c.name, 0 AS generation
    FROM Cattle c
    WHERE c.cattle_id = 1

    UNION ALL

    SELECT calf.cattle_id, calf.name, d.generation + 1
    FROM descendants d
    JOIN Breeding_Records b ON d.cattle_id IN (b.dam_id, b.sire_id)
    JOIN Cattle calf        ON calf.cattle_id = b.calf_id
)
SELECT generation, name, cattle_id
FROM descendants
WHERE generation > 0
ORDER BY generation, name;

-- ---------------------------------------------------------------------
-- Q10. Recursive CTE + join + GROUP BY / HAVING: recurring illness in
--      a bloodline. Each founder cow (a cow with no recorded dam) starts
--      a maternal line; the CTE follows daughters and granddaughters,
--      then health records are counted per line and condition.
-- ---------------------------------------------------------------------
WITH RECURSIVE maternal_line AS (
    SELECT c.cattle_id, c.name AS founder, c.cattle_id AS founder_id
    FROM Cattle c
    WHERE c.sex = 'F'
      AND NOT EXISTS (SELECT 1 FROM Breeding_Records b WHERE b.calf_id = c.cattle_id)

    UNION ALL

    SELECT b.calf_id, m.founder, m.founder_id
    FROM maternal_line m
    JOIN Breeding_Records b ON b.dam_id = m.cattle_id
    WHERE b.calf_id IS NOT NULL
)
SELECT m.founder                       AS bloodline_founder,
       h.suspected_condition           AS condition,
       count(*)                        AS cases,
       count(DISTINCT h.cattle_id)     AS animals_affected,
       string_agg(DISTINCT c.name, ', ') AS animals
FROM maternal_line m
JOIN Health_Records h ON h.cattle_id = m.cattle_id
JOIN Cattle c         ON c.cattle_id = h.cattle_id
WHERE h.suspected_condition IS NOT NULL
GROUP BY m.founder_id, m.founder, h.suspected_condition
HAVING count(DISTINCT h.cattle_id) >= 2
ORDER BY animals_affected DESC, cases DESC;

-- ---------------------------------------------------------------------
-- Q11. Breeding window: cows in milk with their last calving date and
--      whether they are ready to be bred again. A cow is listed as
--      ready when at least 60 days have passed since calving and she
--      has no pending breeding.
-- ---------------------------------------------------------------------
SELECT c.name,
       last_calving.last_calving_date,
       CURRENT_DATE - last_calving.last_calving_date AS days_since_calving,
       CASE
           WHEN EXISTS (SELECT 1 FROM Breeding_Records p
                         WHERE p.dam_id = c.cattle_id AND p.outcome = 'Pending') THEN 'already bred (pending)'
           WHEN CURRENT_DATE - last_calving.last_calving_date >= 60            THEN 'ready to breed'
           ELSE 'too soon after calving'
       END AS breeding_status
FROM Cattle c
JOIN (
    SELECT b.dam_id, max(calf.date_of_birth) AS last_calving_date
    FROM Breeding_Records b
    JOIN Cattle calf ON calf.cattle_id = b.calf_id
    GROUP BY b.dam_id
) AS last_calving ON last_calving.dam_id = c.cattle_id
WHERE c.status = 'Active'
  AND EXISTS (SELECT 1 FROM Milk_Yield m
               WHERE m.cattle_id = c.cattle_id AND m.yield_date > CURRENT_DATE - 30)
ORDER BY days_since_calving DESC;
