-- =====================================================================
-- HerdSense | queries_health_vaccinations.sql
-- Important queries on health records and vaccinations: joins,
-- GROUP BY / HAVING, aggregates, nested and correlated subqueries,
-- set operations and full-text search.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Q1. Three-table JOIN: examinations in the last 90 days with the
--     animal and the vet who examined it, newest first.
-- ---------------------------------------------------------------------
SELECT h.record_date,
       c.tag_number,
       c.name                AS animal,
       s.full_name           AS vet,
       h.suspected_condition,
       h.severity
FROM Health_Records h
JOIN Cattle c     ON c.cattle_id = h.cattle_id
JOIN Farm_Staff s ON s.staff_id  = h.vet_id
WHERE h.record_date >= CURRENT_DATE - 90
ORDER BY h.record_date DESC;

-- ---------------------------------------------------------------------
-- Q2. GROUP BY + HAVING + aggregates: conditions seen more than once,
--     with how many animals they affected and when they were seen.
-- ---------------------------------------------------------------------
SELECT h.suspected_condition       AS condition,
       count(*)                    AS cases,
       count(DISTINCT h.cattle_id) AS animals,
       min(h.record_date)          AS first_seen,
       max(h.record_date)          AS last_seen
FROM Health_Records h
WHERE h.suspected_condition IS NOT NULL
GROUP BY h.suspected_condition
HAVING count(*) >= 2
ORDER BY cases DESC, condition;

-- ---------------------------------------------------------------------
-- Q3. Conditional aggregates: workload of each vet split by severity.
--     LEFT JOIN keeps vets who have no records.
-- ---------------------------------------------------------------------
SELECT s.full_name                                       AS vet,
       count(h.health_id)                                AS examinations,
       count(*) FILTER (WHERE h.severity = 'Severe')     AS severe,
       count(*) FILTER (WHERE h.severity = 'Moderate')   AS moderate,
       count(*) FILTER (WHERE h.severity = 'Mild')       AS mild
FROM Farm_Staff s
LEFT JOIN Health_Records h ON h.vet_id = s.staff_id
WHERE s.role = 'Vet'
GROUP BY s.staff_id, s.full_name
ORDER BY examinations DESC;

-- ---------------------------------------------------------------------
-- Q4. Nested subquery with NOT IN: active animals that have never had
--     the Lumpy Skin Disease (LSD) vaccine.
-- ---------------------------------------------------------------------
SELECT c.tag_number, c.name, c.date_of_birth
FROM Cattle c
WHERE c.status = 'Active'
  AND c.cattle_id NOT IN (SELECT v.cattle_id FROM Vaccinations v WHERE v.vaccine_name = 'LSD')
ORDER BY c.cattle_id;

-- ---------------------------------------------------------------------
-- Q5. Correlated subquery: the most recent examination of each animal.
--     The inner query finds the latest date for the outer row's animal.
-- ---------------------------------------------------------------------
SELECT c.name,
       h.record_date,
       h.suspected_condition,
       h.severity
FROM Health_Records h
JOIN Cattle c ON c.cattle_id = h.cattle_id
WHERE h.record_date = (SELECT max(h2.record_date)
                         FROM Health_Records h2
                        WHERE h2.cattle_id = h.cattle_id)
ORDER BY h.record_date DESC;

-- ---------------------------------------------------------------------
-- Q6. Correlated NOT EXISTS: vaccinations that are due or overdue.
--     A dose counts only if no later dose of the same vaccine was
--     given to the same animal. The due date is worked out here as
--     administered_date + interval_days.
-- ---------------------------------------------------------------------
SELECT c.name,
       v.vaccine_name,
       v.administered_date                                     AS last_dose,
       v.administered_date + v.interval_days                   AS due_date,
       CURRENT_DATE - (v.administered_date + v.interval_days)  AS days_overdue
FROM Vaccinations v
JOIN Cattle c ON c.cattle_id = v.cattle_id
WHERE c.status = 'Active'
  AND v.administered_date + v.interval_days <= CURRENT_DATE
  AND NOT EXISTS (SELECT 1
                    FROM Vaccinations later
                   WHERE later.cattle_id    = v.cattle_id
                     AND later.vaccine_name = v.vaccine_name
                     AND later.administered_date > v.administered_date)
ORDER BY days_overdue DESC, c.name;

-- ---------------------------------------------------------------------
-- Q7. GROUP BY two columns + HAVING: the same condition coming back in
--     the same animal.
-- ---------------------------------------------------------------------
SELECT c.name,
       h.suspected_condition       AS condition,
       count(*)                    AS times_recorded,
       string_agg(h.record_date::text, ', ' ORDER BY h.record_date) AS dates
FROM Health_Records h
JOIN Cattle c ON c.cattle_id = h.cattle_id
WHERE h.suspected_condition IS NOT NULL
GROUP BY c.cattle_id, c.name, h.suspected_condition
HAVING count(*) >= 2;

-- ---------------------------------------------------------------------
-- Q8. Health and milk together: animals examined in the last 7 days,
--     with their milk in the 3 days since compared with the 3 days
--     before the examination (nested subqueries on the daily view).
-- ---------------------------------------------------------------------
SELECT c.name,
       h.record_date,
       h.suspected_condition,
       (SELECT round(avg(d.total_litres), 2) FROM v_daily_milk_totals d
         WHERE d.cattle_id = h.cattle_id
           AND d.yield_date BETWEEN h.record_date - 3 AND h.record_date - 1) AS litres_before,
       (SELECT round(avg(d.total_litres), 2) FROM v_daily_milk_totals d
         WHERE d.cattle_id = h.cattle_id
           AND d.yield_date BETWEEN h.record_date AND h.record_date + 2)     AS litres_after
FROM Health_Records h
JOIN Cattle c ON c.cattle_id = h.cattle_id
WHERE h.record_date >= CURRENT_DATE - 7
  AND h.cattle_id IN (SELECT cattle_id FROM Milk_Yield)
ORDER BY h.record_date DESC;

-- ---------------------------------------------------------------------
-- Q9. UNION ALL: one timeline of everything recorded for Sundari (11):
--     examinations, vaccinations and breeding events.
-- ---------------------------------------------------------------------
SELECT h.record_date       AS event_date, 'Health'      AS event_type,
       coalesce(h.suspected_condition, 'Routine check') AS detail
FROM Health_Records h WHERE h.cattle_id = 11
UNION ALL
SELECT v.administered_date, 'Vaccination', v.vaccine_name
FROM Vaccinations v WHERE v.cattle_id = 11
UNION ALL
SELECT b.breeding_date, 'Breeding', b.method || ' - ' || b.outcome
FROM Breeding_Records b WHERE b.dam_id = 11
ORDER BY event_date DESC;

-- ---------------------------------------------------------------------
-- Q10. Full-text search on vet notes (uses the GIN index
--      idx_health_notes_fts), ranked by relevance. The query matches
--      notes containing any of the words; notes containing more of them
--      rank higher. Words are stemmed, so "clot" also matches "clots".
-- ---------------------------------------------------------------------
SELECT h.health_id,
       c.name,
       h.suspected_condition,
       round(ts_rank(to_tsvector('english', h.vet_notes), q)::numeric, 3) AS rank,
       left(h.vet_notes, 70) AS vet_notes
FROM Health_Records h
JOIN Cattle c ON c.cattle_id = h.cattle_id,
     to_tsquery('english', 'udder | milk | quarter | clot') AS q
WHERE to_tsvector('english', h.vet_notes) @@ q
ORDER BY rank DESC;
