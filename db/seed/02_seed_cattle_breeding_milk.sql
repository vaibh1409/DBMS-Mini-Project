-- =====================================================================
-- HerdSense | 02_seed_cattle_breeding_milk.sql
-- Sample herd across four generations, breeding history and
-- 30 days of milk yield. Run after 01_seed_staff.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cattle
-- Generation 1 (founders): 1-7 | Generation 2: 8-12
-- Generation 3: 13-16       | Generation 4: 17-20
-- Recent calves of the milking cows: 21-27
-- ---------------------------------------------------------------------
INSERT INTO Cattle (cattle_id, tag_number, name, breed, sex, date_of_birth, status) VALUES
    ( 1, 'KA-1001', 'Ganga',     'Gir',           'F', '2012-02-14', 'Deceased'),
    ( 2, 'KA-1002', 'Bhima',     'Gir',           'M', '2011-08-03', 'Sold'),
    ( 3, 'KA-1003', 'Kaveri',    'Sahiwal',       'F', '2013-05-21', 'Sold'),
    ( 4, 'KA-1004', 'Arjuna',    'Sahiwal',       'M', '2012-11-30', 'Active'),
    ( 5, 'KA-1005', 'Tunga',     'HF Cross',      'F', '2014-01-10', 'Active'),
    ( 6, 'KA-1006', 'Shiva',     'HF Cross',      'M', '2013-09-17', 'Active'),
    ( 7, 'KA-1007', 'Veera',     'Gir',           'M', '2014-06-05', 'Active'),
    ( 8, 'KA-2001', 'Gauri',     'Gir',           'F', '2016-03-02', 'Active'),
    ( 9, 'KA-2002', 'Nandi',     'Gir',           'M', '2017-03-15', 'Sold'),
    (10, 'KA-2003', 'Lakshmi',   'Sahiwal',       'F', '2017-04-25', 'Active'),
    (11, 'KA-2004', 'Sundari',   'HF Cross',      'F', '2017-08-08', 'Active'),
    (12, 'KA-2005', 'Kamadhenu', 'Gir x Sahiwal', 'F', '2018-02-19', 'Active'),
    (13, 'KA-3001', 'Radha',     'Gir',           'F', '2020-01-15', 'Active'),
    (14, 'KA-3002', 'Meena',     'Sahiwal x Gir', 'F', '2020-09-03', 'Active'),
    (15, 'KA-3003', 'Chandra',   'HF Cross',      'F', '2021-03-28', 'Active'),
    (16, 'KA-3004', 'Basava',    'Gir',           'M', '2021-07-12', 'Sold'),
    (17, 'KA-4001', 'Tulsi',     'Gir x Sahiwal', 'F', '2023-02-20', 'Active'),
    (18, 'KA-4002', 'Kalyani',   'Sahiwal x HF',  'F', '2023-10-05', 'Active'),
    (19, 'KA-4003', 'Pooja',     'HF x Sahiwal',  'F', '2024-04-14', 'Active'),
    (20, 'KA-4004', 'Ganesha',   'Gir x Sahiwal', 'M', '2025-01-09', 'Active');

-- Recent calves of the cows that are in milk now. Dates are relative to
-- today so the herd stays current: a cow gives milk after calving.
INSERT INTO Cattle (cattle_id, tag_number, name, breed, sex, date_of_birth, status) VALUES
    (21, 'KA-5001', 'Shanti',  'Gir x Sahiwal', 'F', CURRENT_DATE - 281, 'Active'),
    (22, 'KA-5002', 'Nandini', 'Sahiwal x HF',  'F', CURRENT_DATE - 327, 'Active'),
    (23, 'KA-5003', 'Hanuma',  'HF x Gir',      'M', CURRENT_DATE - 321, 'Active'),
    (24, 'KA-5004', 'Kirti',   'Gir x Sahiwal', 'F', CURRENT_DATE - 410, 'Active'),
    (25, 'KA-5005', 'Gowri',   'Gir x HF',      'F', CURRENT_DATE - 48,  'Active'),
    (26, 'KA-5006', 'Varsha',  'HF x Gir',      'F', CURRENT_DATE - 401, 'Active'),
    (27, 'KA-5007', 'Tara',    'HF x Sahiwal',  'F', CURRENT_DATE - 901, 'Active');

DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('cattle', 'cattle_id'), (SELECT max(cattle_id) FROM Cattle)); END $$;

-- ---------------------------------------------------------------------
-- Breeding_Records
-- breeding_date is about 283 days (gestation) before the calf's birth.
-- ---------------------------------------------------------------------
INSERT INTO Breeding_Records (breeding_id, dam_id, sire_id, breeding_date, method, outcome, calf_id, recorded_by) VALUES
    -- Calved: these build the pedigree
    ( 1,  1, 2, '2015-05-24', 'Natural', 'Calved',  8, 1),
    ( 2,  1, 2, '2016-06-05', 'Natural', 'Calved',  9, 1),
    ( 3,  3, 4, '2016-07-16', 'Natural', 'Calved', 10, 1),
    ( 4,  5, 6, '2016-10-29', 'AI',      'Calved', 11, 2),
    ( 5,  3, 2, '2017-05-12', 'AI',      'Calved', 12, 2),
    ( 6,  8, 7, '2019-04-07', 'AI',      'Calved', 13, 2),
    ( 7, 10, 7, '2019-11-25', 'AI',      'Calved', 14, 2),
    ( 8, 11, 7, '2020-06-18', 'AI',      'Calved', 15, 2),
    ( 9,  8, 7, '2020-10-02', 'Natural', 'Calved', 16, 1),
    (10, 13, 4, '2022-05-13', 'AI',      'Calved', 17, 2),
    (11, 14, 6, '2022-12-26', 'AI',      'Calved', 18, 2),
    (12, 15, 4, '2023-07-06', 'AI',      'Calved', 19, 2),
    (13, 13, 4, '2024-04-01', 'Natural', 'Calved', 20, 1),
    -- Failed and pending
    (14, 11, 4, CURRENT_DATE - 200, 'AI', 'Failed', NULL, 2),
    (15, 12, 7, '2026-02-10', 'AI',      'Failed', NULL, 2),
    (16, 15, 6, '2026-07-02', 'Natural', 'Pending', NULL, 1),
    (17, 14, 4, '2026-08-20', 'AI',      'Pending', NULL, 2),
    -- Recent calvings (calf ids 21-27), relative to today
    (18,  8, 4, CURRENT_DATE - 281 - 283, 'AI',      'Calved', 21, 2),
    (19, 10, 6, CURRENT_DATE - 327 - 283, 'AI',      'Calved', 22, 2),
    (20, 11, 7, CURRENT_DATE - 321 - 283, 'Natural', 'Calved', 23, 1),
    (21, 12, 4, CURRENT_DATE - 410 - 283, 'AI',      'Calved', 24, 2),
    (22, 13, 6, CURRENT_DATE -  48 - 283, 'AI',      'Calved', 25, 2),
    (23, 15, 7, CURRENT_DATE - 401 - 283, 'Natural', 'Calved', 26, 1),
    (24,  5, 4, CURRENT_DATE - 901 - 283, 'AI',      'Calved', 27, 2);

DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('breeding_records', 'breeding_id'), (SELECT max(breeding_id) FROM Breeding_Records)); END $$;

-- ---------------------------------------------------------------------
-- Milk_Yield: Morning and Evening readings for six milking cows over
-- the last 30 days, with a small day-to-day variation.
-- Lakshmi (10) drops to about 55% in the last 4 days (mastitis case),
-- which the yield-anomaly procedure should flag.
-- ---------------------------------------------------------------------
INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
SELECT b.cattle_id,
       d::date,
       s.session,
       ROUND(
           ( CASE s.session WHEN 'Morning' THEN b.morning ELSE b.evening END
             + ((EXTRACT(DOY FROM d)::int * 7 + b.cattle_id * 3) % 5) * 0.15 - 0.30 )
           * CASE WHEN b.cattle_id = 10 AND d::date > CURRENT_DATE - 4 THEN 0.55 ELSE 1 END
       , 2),
       CASE s.session WHEN 'Morning' THEN 3 ELSE 5 END
FROM (VALUES
        ( 8,  5.0, 4.2),   -- Gauri
        (10,  6.4, 5.4),   -- Lakshmi
        (11, 10.5, 8.8),   -- Sundari
        (12,  6.0, 5.0),   -- Kamadhenu
        (13,  5.6, 4.6),   -- Radha
        (15,  9.2, 7.8)    -- Chandra
     ) AS b (cattle_id, morning, evening)
CROSS JOIN generate_series(CURRENT_DATE - 29, CURRENT_DATE, INTERVAL '1 day') AS d
CROSS JOIN (VALUES ('Morning'), ('Evening')) AS s (session);
