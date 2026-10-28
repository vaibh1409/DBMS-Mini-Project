-- =====================================================================
-- HerdSense | 03_seed_health_vaccinations.sql
-- Sample vet examinations and vaccinations. Run after
-- 02_seed_cattle_breeding_milk.sql, then run `npm run embed` to create
-- the vet-note embeddings.
--
-- The notes describe the same conditions in different words on purpose,
-- so semantic search can be compared with keyword search.
-- Dates are relative to today so the data stays current.
-- =====================================================================

INSERT INTO Health_Records (health_id, cattle_id, vet_id, record_date, vet_notes, suspected_condition, treatment, severity) VALUES
    -- Mastitis
    ( 1, 10, 2, CURRENT_DATE - 3,
      'Rear left quarter hot, hard and painful to touch. Milk from that quarter is watery with yellow flakes and clots. Cow kicks during milking, appetite normal.',
      'Mastitis', 'Intramammary antibiotic after each milking for 3 days, strip the affected quarter, discard milk', 'Moderate'),
    ( 2, 11, 4, CURRENT_DATE - 140,
      'Strip cup test shows clots in the front right quarter. Quarter slightly swollen but cow is eating and alert. Somatic cell count likely high.',
      'Mastitis', 'Intramammary antibiotic, milk the front right quarter last', 'Mild'),
    ( 3, 15, 2, CURRENT_DATE - 410,
      'Udder badly swollen and discoloured with foul smelling bloody secretion. High fever of 41 C, cow off feed and depressed.',
      'Mastitis', 'Systemic antibiotics, anti-inflammatory, IV fluids, frequent stripping', 'Severe'),
    ( 4, 12, 4, CURRENT_DATE - 620,
      'Teat end injured after a fall in the shed. Mild inflammation of the quarter and a few flakes in the milk.',
      'Mastitis', 'Teat dip, topical ointment, monitor with California mastitis test', 'Mild'),

    -- Foot rot and lameness
    ( 5,  8, 2, CURRENT_DATE - 55,
      'Limping on the left hind leg, swelling between the claws with a foul smell, reluctant to walk to the feeding area.',
      'Foot Rot', 'Clean and trim hoof, copper sulphate foot bath, antibiotic injection', 'Moderate'),
    ( 6, 13, 4, CURRENT_DATE - 230,
      'Reduced weight bearing on the front right foot after standing on wet concrete for long hours. Sole bruising found during hoof trimming.',
      'Lameness', 'Hoof trimming, block on the healthy claw, rest on dry bedding', 'Mild'),
    ( 7, 14, 2, CURRENT_DATE - 700,
      'Walks stiffly with an arched back. Overgrown hooves on all four feet.',
      'Lameness', 'Corrective hoof trimming', 'Mild'),
    ( 8,  8, 4, CURRENT_DATE - 5,
      'Follow-up after foot bath treatment. Walking normally and the swelling between the claws has gone.',
      'Foot Rot', 'Treatment complete', 'Mild'),

    -- Milk fever
    ( 9, 11, 2, CURRENT_DATE - 320,
      'Down a day after calving and unable to rise. Cold ears, muscle tremors and dull eyes, mild bloat.',
      'Milk Fever', 'Slow IV calcium borogluconate, oral calcium bolus after recovery', 'Severe'),
    (10,  5, 4, CURRENT_DATE - 900,
      'Found lying on her sternum with the head turned towards the flank 36 hours after calving. Weak and not eating.',
      'Milk Fever', 'IV calcium, help the cow to stand, monitor closely', 'Severe'),

    -- Ketosis
    (11, 15, 4, CURRENT_DATE - 380,
      'Three weeks after calving: sharp drop in milk, eating only roughage and refusing concentrate, sweet fruity smell on the breath.',
      'Ketosis', 'Oral propylene glycol for 5 days, IV dextrose', 'Moderate'),
    (12, 10, 2, CURRENT_DATE - 560,
      'Losing body condition in early lactation, dull, dung firm and dry. Urine strip positive for ketones.',
      'Ketosis', 'Propylene glycol drench, increase energy in the ration', 'Mild'),

    -- Bloat
    (13, 12, 2, CURRENT_DATE - 95,
      'Left side of the abdomen distended like a drum after grazing on wet lucerne. Cow uneasy, kicking at the belly, laboured breathing.',
      'Bloat', 'Stomach tube to release gas, anti-foaming oil drench, remove from legume pasture', 'Severe'),
    (14, 18, 4, CURRENT_DATE - 480,
      'Mild swelling high on the left flank after a sudden switch to green fodder. Still chewing cud.',
      'Bloat', 'Walk the animal, vegetable oil drench, change feed gradually', 'Mild'),

    -- Respiratory
    (15, 17, 4, CURRENT_DATE - 40,
      'Dry cough, nasal discharge and fast breathing, temperature 40.2 C. Several young animals in the same pen are coughing.',
      'Respiratory Infection', 'Antibiotic course, anti-inflammatory, improve shed ventilation', 'Moderate'),
    (16, 19, 2, CURRENT_DATE - 180,
      'Calf breathing with an open mouth, crackling lung sounds, high fever and not suckling well.',
      'Pneumonia', 'Long-acting antibiotic, NSAID, keep warm and dry', 'Severe'),

    -- Calf scours
    (17, 20, 2, CURRENT_DATE - 300,
      'Watery yellow diarrhoea for two days. Calf weak with sunken eyes and a dry mouth.',
      'Calf Scours', 'Oral rehydration solution every 6 hours, continue milk feeding', 'Moderate'),
    (18, 19, 4, CURRENT_DATE - 700,
      'Loose pasty dung and slight dehydration, still drinking milk.',
      'Calf Scours', 'Electrolytes, clean the feeding buckets', 'Mild'),

    -- Tick fever
    (19, 14, 4, CURRENT_DATE - 150,
      'High fever, red coloured urine, pale mucous membranes and many ticks found on the udder and ears.',
      'Tick Fever', 'Anti-babesial injection, tick control spray, blood tonic', 'Severe'),
    (20, 13, 2, CURRENT_DATE - 365,
      'Weak with anaemic gums and fever on and off. Ticks on the body, blood smear sent to the lab.',
      'Tick Fever', 'Acaricide spray, supportive therapy, awaiting smear result', 'Moderate'),

    -- Other cases
    (21, 13, 4, '2025-01-10',
      'Afterbirth not expelled 24 hours after calving and a foul discharge is starting. Cow is eating normally.',
      'Retained Placenta', 'Do not pull manually, uterine antibiotic, monitor temperature', 'Moderate'),
    (22,  7, 2, CURRENT_DATE - 260,
      'Blisters on the tongue and gums, drooling ropey saliva, lesions between the hooves and high fever. A neighbouring farm reported similar cases.',
      'Foot and Mouth Disease', 'Isolate the animal, mouth wash with potassium permanganate, report to the veterinary department', 'Severe'),

    -- Routine checks (no condition)
    (23,  4, 4, CURRENT_DATE - 30,
      'Routine annual examination. Body condition good, no abnormalities found.',
      NULL, NULL, 'Mild'),
    (24, 11, 2, CURRENT_DATE - 10,
      'Checked for heat signs after the failed insemination. Reproductive tract normal, good appetite, normal temperature.',
      NULL, NULL, 'Mild');

DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('health_records', 'health_id'), (SELECT max(health_id) FROM Health_Records)); END $$;

-- ---------------------------------------------------------------------
-- Vaccinations
-- next_due_date is not given here: the trigger in db/logic/triggers.sql
-- fills it as administered_date + interval_days.
-- Intervals: FMD 180 days; HS, BQ and LSD 365 days.
-- ---------------------------------------------------------------------
INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by) VALUES
    -- Foot and Mouth Disease (FMD): earlier round, then the latest round
    ( 8, 'FMD', CURRENT_DATE - 380, 180, 2),
    (11, 'FMD', CURRENT_DATE - 380, 180, 2),
    ( 4, 'FMD', CURRENT_DATE - 200, 180, 2),   -- overdue
    ( 5, 'FMD', CURRENT_DATE - 200, 180, 2),   -- overdue
    ( 8, 'FMD', CURRENT_DATE - 200, 180, 2),   -- overdue
    (11, 'FMD', CURRENT_DATE - 200, 180, 2),   -- overdue
    (12, 'FMD', CURRENT_DATE - 200, 180, 2),   -- overdue
    (10, 'FMD', CURRENT_DATE - 170, 180, 4),
    (13, 'FMD', CURRENT_DATE - 170, 180, 4),
    (14, 'FMD', CURRENT_DATE - 170, 180, 4),
    (15, 'FMD', CURRENT_DATE - 170, 180, 4),

    -- Haemorrhagic Septicaemia (HS)
    (13, 'HS', CURRENT_DATE - 365, 365, 4),    -- due today
    (14, 'HS', CURRENT_DATE - 365, 365, 4),    -- due today
    ( 8, 'HS', CURRENT_DATE - 300, 365, 2),
    (10, 'HS', CURRENT_DATE - 300, 365, 2),
    (11, 'HS', CURRENT_DATE - 300, 365, 2),
    (12, 'HS', CURRENT_DATE - 300, 365, 2),

    -- Black Quarter (BQ) for young stock
    (17, 'BQ', CURRENT_DATE - 400, 365, 4),    -- overdue
    (18, 'BQ', CURRENT_DATE - 400, 365, 4),    -- overdue
    (19, 'BQ', CURRENT_DATE - 100, 365, 2),
    (20, 'BQ', CURRENT_DATE - 100, 365, 2),

    -- Lumpy Skin Disease (LSD)
    ( 4, 'LSD', CURRENT_DATE - 90, 365, 4),
    ( 7, 'LSD', CURRENT_DATE - 90, 365, 4),
    (10, 'LSD', CURRENT_DATE - 90, 365, 4),
    (13, 'LSD', CURRENT_DATE - 90, 365, 4),
    (15, 'LSD', CURRENT_DATE - 90, 365, 4);
