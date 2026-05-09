-- ═══════════════════════════════════════════════════════════════════════
-- stibe Portal — Employee Seed (from Excel: stibe Employees Email ID)
-- Password: stibe@2026
-- Faculty/Maths Faculty → teacher role
-- All others           → student role
-- Creates 10 batches: 5×1:1, 3×1:3, 2×group
-- Run: cat scripts/seed-employees.sql | ssh stibe-portal "sudo -u postgres psql -d stibe_portal"
-- ═══════════════════════════════════════════════════════════════════════

DO $seed$
DECLARE
  h   TEXT := '$2b$12$KgUdq7bteRf3TqNNwj6Rm.WElVhkq.MzX51q4W5enIQqGXd2qO3b6';
  pw  TEXT := 'stibe@2026';
  ao  TEXT := 'chinjurp333@gmail.com';
  bc  TEXT := 'Academiccoordinator1SUO@gamil.com';
  own TEXT := 'stibelearningventures@gmail.com';
BEGIN

-- ═══════════════════════════════════════════════════════════════════════
-- 1. TEACHERS (Faculty / Maths Faculty designation)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password)
VALUES
  ('ayanaranik@gmail.com',         'Ayana Rani',          'teacher', '8848457577', true, h, pw),
  ('manjima.jamisha@gmail.com',    'Manjima',              'teacher', '9778243916', true, h, pw),
  ('anjustibe@gmail.com',        'Anju S Venu',          'teacher', '7994069066', true, h, pw),
  ('noorniza07@gmail.com',         'Noorniza',             'teacher', '9447445597', true, h, pw),
  ('sajithsts12@gmail.com',        'Sajith',               'teacher', '9061044374', true, h, pw),
  ('ayshanima283@gmail.com',       'Aysha',                'teacher', '7558045201', true, h, pw),
  ('ronaldobiju77@gmail.com',      'Ronaldo Biju',         'teacher', '9778377118', true, h, pw),
  ('muhammadmubashirvmd@gmail.com','Mubashir',             'teacher', '6235136264', true, h, pw),
  ('jishnutkjishnutk@gmail.com',   'Jishnu',               'teacher', '9747248759', true, h, pw),
  ('nikhithabiju353@gmail.com',    'Nikitha',              'teacher', '9947608464', true, h, pw),
  ('nedhafathima40@gmail.com',     'Nedha',                'teacher', '7306062311', true, h, pw),
  ('duafarrah10@gmail.com',        'Jinsiya',              'teacher', '8089860843', true, h, pw),
  ('muhammedrazalca3030@gmail.com','Razal',                'teacher', '7510353030', true, h, pw),
  ('asnamh968@gmail.com',          'Asna',                 'teacher', '9633943802', true, h, pw),
  ('anwarkh55275@gmail.com',       'Anwar',                'teacher', '9847677286', true, h, pw),
  ('shahzasanam321@gmail.com',     'Shahziya',             'teacher', '8113955109', true, h, pw),
  ('mariafaithe1@gmail.com',       'Maria',                'teacher', '7356904933', true, h, pw),
  ('alishaazad303@gmail.com',      'Aleesha',              'teacher', '8891268682', true, h, pw),
  ('ziyanababu@gmail.com',         'Bincila',              'teacher', '8590371326', true, h, pw),
  ('shibinfarzana@gmail.com',      'Farzana Naushad',      'teacher', '6238106821', true, h, pw),
  ('fayasappu10@gmail.com',        'Fayas',                'teacher', '9400213997', true, h, pw),
  ('muhammedmehfilcr7@gmail.com',  'Mehfil',               'teacher', '7356833252', true, h, pw),
  ('anzaf042@gmail.com',           'Ansaf P B',            'teacher', '9567206611', true, h, pw),
  ('nazrasanoop@gmail.com',        'Nazra',                'teacher', '8848990974', true, h, pw),
  ('essathfarsana50@gmail.com',    'Essath',               'teacher', '8891981850', true, h, pw),
  ('hannaksudheer69@gmail.com',    'Hanna',                'teacher', '9895865099', true, h, pw),
  ('liyaj5750@gmail.com',          'Liya Justin',          'teacher', '7736439386', true, h, pw),
  ('rahfakalathingal@gmail.com',   'Fathima Rahfa K',      'teacher', '6238692452', true, h, pw)
ON CONFLICT (email) DO UPDATE SET
  full_name      = EXCLUDED.full_name,
  portal_role    = 'teacher',
  phone          = EXCLUDED.phone,
  is_active      = true,
  password_hash  = EXCLUDED.password_hash,
  plain_password = EXCLUDED.plain_password,
  updated_at     = NOW();

-- Teacher profiles (subjects)
INSERT INTO user_profiles (email, phone, whatsapp, subjects, qualification, experience_years)
VALUES
  ('ayanaranik@gmail.com',         '8848457577','8848457577', ARRAY['Mathematics'],      'Graduate', 3),
  ('manjima.jamisha@gmail.com',    '9778243916','9778243916', ARRAY['Physics'],           'Graduate', 2),
  ('anjustibe@gmail.com',        '7994069066','7994069066', ARRAY['Chemistry'],         'Graduate', 4),
  ('noorniza07@gmail.com',         '9447445597','9447445597', ARRAY['Biology'],           'Graduate', 5),
  ('sajithsts12@gmail.com',        '9061044374','9061044374', ARRAY['English'],           'Graduate', 3),
  ('ayshanima283@gmail.com',       '7558045201','7558045201', ARRAY['Mathematics'],       'Graduate', 2),
  ('ronaldobiju77@gmail.com',      '9778377118','9778377118', ARRAY['Physics'],           'Graduate', 4),
  ('muhammadmubashirvmd@gmail.com','6235136264','6235136264', ARRAY['Physics'],           'Graduate', 1),
  ('jishnutkjishnutk@gmail.com',   '9747248759','9747248759', ARRAY['Chemistry'],         'Graduate', 2),
  ('nikhithabiju353@gmail.com',    '9947608464','9947608464', ARRAY['Biology'],           'Graduate', 3),
  ('nedhafathima40@gmail.com',     '7306062311','7306062311', ARRAY['Mathematics'],       'Graduate', 2),
  ('duafarrah10@gmail.com',        '8089860843','8089860843', ARRAY['English'],           'Graduate', 1),
  ('muhammedrazalca3030@gmail.com','7510353030','7510353030', ARRAY['Mathematics'],       'Graduate', 3),
  ('asnamh968@gmail.com',          '9633943802','9633943802', ARRAY['Physics'],           'Graduate', 2),
  ('anwarkh55275@gmail.com',       '9847677286','9847677286', ARRAY['Chemistry'],         'Graduate', 4),
  ('shahzasanam321@gmail.com',     '8113955109','8113955109', ARRAY['Economics'],         'Graduate', 2),
  ('mariafaithe1@gmail.com',       '7356904933','7356904933', ARRAY['Computer Science'], 'Graduate', 3),
  ('alishaazad303@gmail.com',      '8891268682','8891268682', ARRAY['Physics'],           'Graduate', 1),
  ('ziyanababu@gmail.com',         '8590371326','8590371326', ARRAY['Chemistry'],         'Graduate', 2),
  ('shibinfarzana@gmail.com',      '6238106821','6238106821', ARRAY['Biology'],           'Graduate', 3),
  ('fayasappu10@gmail.com',        '9400213997','9400213997', ARRAY['Mathematics'],       'Graduate', 2),
  ('muhammedmehfilcr7@gmail.com',  '7356833252','7356833252', ARRAY['Physics'],           'Graduate', 1),
  ('anzaf042@gmail.com',           '9567206611','9567206611', ARRAY['Chemistry'],         'Graduate', 3),
  ('nazrasanoop@gmail.com',        '8848990974','8848990974', ARRAY['Biology'],           'Graduate', 2),
  ('essathfarsana50@gmail.com',    '8891981850','8891981850', ARRAY['English'],           'Graduate', 4),
  ('hannaksudheer69@gmail.com',    '9895865099','9895865099', ARRAY['Mathematics'],       'Graduate', 3),
  ('liyaj5750@gmail.com',          '7736439386','7736439386', ARRAY['Mathematics'],       'Graduate', 2),
  ('rahfakalathingal@gmail.com',   '6238692452','6238692452', ARRAY['Mathematics'],       'Graduate', 1)
ON CONFLICT (email) DO UPDATE SET
  phone            = EXCLUDED.phone,
  whatsapp         = EXCLUDED.whatsapp,
  subjects         = EXCLUDED.subjects,
  qualification    = COALESCE(user_profiles.qualification, EXCLUDED.qualification),
  experience_years = COALESCE(user_profiles.experience_years, EXCLUDED.experience_years),
  updated_at       = NOW();

RAISE NOTICE '✅ 28 teachers inserted/updated';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. STUDENTS (all non-Faculty staff)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password)
VALUES
  ('farhananaushad0@gmai.com',       'Farhana',                'student', '7736423463', true, h, pw),
  ('ahadajitha@gmail.com',           'Ahad',                   'student', '9895085731', true, h, pw),
  ('salihsali04@gmail.com',          'Salih P R',              'student', '6282179991', true, h, pw),
  ('asifalichr@gmail.com',           'Asif',                   'student', '8129179749', true, h, pw),
  ('mohammedibrahim7907@gmail.com',  'Ibrahim',                'student', '7907126725', true, h, pw),
  ('ijascr25@mail.com',              'Ijas Ahmed',             'student', '8129508689', true, h, pw),
  ('salehkochi@gmail.com',           'Saleh Lukman',           'student', '8281646244', true, h, pw),
  ('munnas369369@gmail.com',         'Haris EN',               'student', '7902645990', true, h, pw),
  ('ouchithyahari@gmail.com',        'Ouchithya H R',          'student', '7994866097', true, h, pw),
  ('gbenzy07@gmail.com',             'Benzy G',                'student', '7012037607', true, h, pw),
  ('mohammedsvk11@gmail.com',        'Mohammed Shafi V K',     'student', '9961423371', true, h, pw),
  ('hafismohammed006@gmail.com',     'Hafis Mohammed',         'student', '7736028086', true, h, pw),
  ('jzlinthomas@gmail.com',          'Jeslin Thomas',          'student', '8943516103', true, h, pw),
  ('tenogte@gmail.com',              'Teno G Terry',           'student', '8943870403', true, h, pw),
  ('nebilnavas@gmail.com',           'Mohamed Nebil A N',      'student', '9207076473', true, h, pw),
  ('sahadanas4510@gmail.com',        'Mohammed Sahad A',       'student', '9633422377', true, h, pw),
  ('bincy9188@gmail.com',            'Bincy Sinoy',            'student', '8086894010', true, h, pw),
  ('anakharnairmace@gmail.com',      'Anakha R Nair',          'student', '9747499597', true, h, pw),
  ('emmanuel.altree@gmail.com',      'Emmanuel Sebastian',     'student', '8547769067', true, h, pw),
  ('snehapg070899@gmail.com',        'Sneha PG',               'student', '8157927369', true, h, pw),
  ('joelpt1996@gmail.com',           'Joel P Thomas',          'student', '9847147448', true, h, pw),
  ('akshayrajkk440@gmail.com',       'Akshay Raj K K',         'student', '9746411970', true, h, pw),
  ('navinaugpaul@gmail.com',         'Navin Augustine Paul',   'student', '9383406428', true, h, pw),
  ('apjabijith@gmail.com',           'Abijith P J',            'student', '9074421002', true, h, pw),
  ('arjunprakashk7@gmail.com',       'Arjun K',                'student', '8089835558', true, h, pw),
  ('minnathhanan143@gmail.com',      'Minnath Hanan',          'student', '9744992730', true, h, pw),
  ('anjanaminisurendren@gmail.com',  'Anjana KP',              'student', '8592842861', true, h, pw),
  ('rozanayesudas1@gmail.com',       'Mariam Rozana Yesudas',  'student', '8921762073', true, h, pw),
  ('saniya52432@gmail.com',          'Mary Saniya',            'student', '7736265296', true, h, pw)
ON CONFLICT (email) DO UPDATE SET
  full_name      = EXCLUDED.full_name,
  portal_role    = 'student',
  phone          = EXCLUDED.phone,
  is_active      = true,
  password_hash  = EXCLUDED.password_hash,
  plain_password = EXCLUDED.plain_password,
  updated_at     = NOW();

-- Student profiles (grade, board)
INSERT INTO user_profiles (email, phone, whatsapp, grade, board, section)
VALUES
  ('farhananaushad0@gmai.com',       '7736423463','7736423463','8',  'CBSE',        'A'),
  ('ahadajitha@gmail.com',           '9895085731','9895085731','9',  'CBSE',        'A'),
  ('salihsali04@gmail.com',          '6282179991','6282179991','10', 'CBSE',        'A'),
  ('asifalichr@gmail.com',           '8129179749','8129179749','11', 'CBSE',        'A'),
  ('mohammedibrahim7907@gmail.com',  '7907126725','7907126725','12', 'CBSE',        'B'),
  ('ijascr25@mail.com',              '8129508689','8129508689','8',  'State Board', 'A'),
  ('salehkochi@gmail.com',           '8281646244','8281646244','9',  'State Board', 'A'),
  ('munnas369369@gmail.com',         '7902645990','7902645990','10', 'State Board', 'B'),
  ('ouchithyahari@gmail.com',        '7994866097','7994866097','11', 'State Board', 'A'),
  ('gbenzy07@gmail.com',             '7012037607','7012037607','12', 'State Board', 'B'),
  ('mohammedsvk11@gmail.com',        '9961423371','9961423371','8',  'CBSE',        'B'),
  ('hafismohammed006@gmail.com',     '7736028086','7736028086','9',  'CBSE',        'A'),
  ('jzlinthomas@gmail.com',          '8943516103','8943516103','10', 'CBSE',        'B'),
  ('tenogte@gmail.com',              '8943870403','8943870403','11', 'CBSE',        'A'),
  ('nebilnavas@gmail.com',           '9207076473','9207076473','12', 'CBSE',        'B'),
  ('sahadanas4510@gmail.com',        '9633422377','9633422377','8',  'State Board', 'B'),
  ('bincy9188@gmail.com',            '8086894010','8086894010','9',  'State Board', 'A'),
  ('anakharnairmace@gmail.com',      '9747499597','9747499597','10', 'State Board', 'B'),
  ('emmanuel.altree@gmail.com',      '8547769067','8547769067','11', 'State Board', 'A'),
  ('snehapg070899@gmail.com',        '8157927369','8157927369','12', 'State Board', 'B'),
  ('joelpt1996@gmail.com',           '9847147448','9847147448','8',  'CBSE',        'A'),
  ('akshayrajkk440@gmail.com',       '9746411970','9746411970','9',  'CBSE',        'B'),
  ('navinaugpaul@gmail.com',         '9383406428','9383406428','10', 'CBSE',        'A'),
  ('apjabijith@gmail.com',           '9074421002','9074421002','11', 'CBSE',        'B'),
  ('arjunprakashk7@gmail.com',       '8089835558','8089835558','12', 'CBSE',        'A'),
  ('minnathhanan143@gmail.com',      '9744992730','9744992730','8',  'State Board', 'A'),
  ('anjanaminisurendren@gmail.com',  '8592842861','8592842861','9',  'State Board', 'B'),
  ('rozanayesudas1@gmail.com',       '8921762073','8921762073','10', 'State Board', 'A'),
  ('saniya52432@gmail.com',          '7736265296','7736265296','11', 'State Board', 'B')
ON CONFLICT (email) DO UPDATE SET
  phone    = EXCLUDED.phone,
  whatsapp = EXCLUDED.whatsapp,
  grade    = EXCLUDED.grade,
  board    = EXCLUDED.board,
  section  = EXCLUDED.section,
  updated_at = NOW();

-- Session credits: 50 sessions × 3 subjects per student
INSERT INTO student_session_credits
  (id, student_email, subject, batch_type, total_sessions, used_sessions, fee_per_session_paise, currency, source, is_active)
SELECT gen_random_uuid(), e.email, s.subject, 'one_to_many', 50, 0, 15000, 'INR', 'manual', true
FROM (VALUES
  ('farhananaushad0@gmai.com'),('ahadajitha@gmail.com'),('salihsali04@gmail.com'),
  ('asifalichr@gmail.com'),('mohammedibrahim7907@gmail.com'),('ijascr25@mail.com'),
  ('salehkochi@gmail.com'),('munnas369369@gmail.com'),('ouchithyahari@gmail.com'),
  ('gbenzy07@gmail.com'),('mohammedsvk11@gmail.com'),('hafismohammed006@gmail.com'),
  ('jzlinthomas@gmail.com'),('tenogte@gmail.com'),('nebilnavas@gmail.com'),
  ('sahadanas4510@gmail.com'),('bincy9188@gmail.com'),('anakharnairmace@gmail.com'),
  ('emmanuel.altree@gmail.com'),('snehapg070899@gmail.com'),('joelpt1996@gmail.com'),
  ('akshayrajkk440@gmail.com'),('navinaugpaul@gmail.com'),('apjabijith@gmail.com'),
  ('arjunprakashk7@gmail.com'),('minnathhanan143@gmail.com'),('anjanaminisurendren@gmail.com'),
  ('rozanayesudas1@gmail.com'),('saniya52432@gmail.com')
) AS e(email)
CROSS JOIN (VALUES ('Mathematics'),('Physics'),('Chemistry')) AS s(subject)
ON CONFLICT DO NOTHING;

RAISE NOTICE '✅ 29 students inserted/updated with 50-session credits';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. BATCHES — 5×1:1, 3×1:3, 2×Group
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1:1 Batches ──────────────────────────────────────────────────────
INSERT INTO batches (batch_id, batch_name, batch_type, grade, board, section, subjects,
  coordinator_email, academic_operator_email, max_students, status, created_by, notes)
VALUES
  ('emp_batch_11','CBSE G8 Math 1:1',        'one_to_one','8', 'CBSE',        'A',ARRAY['Mathematics'],    bc,ao,1,'active',own,'1:1 — CBSE Grade 8 Math'),
  ('emp_batch_12','CBSE G9 Physics 1:1',     'one_to_one','9', 'CBSE',        'B',ARRAY['Physics'],        bc,ao,1,'active',own,'1:1 — CBSE Grade 9 Physics'),
  ('emp_batch_13','State G8 Chemistry 1:1',  'one_to_one','8', 'State Board', 'A',ARRAY['Chemistry'],      bc,ao,1,'active',own,'1:1 — State Board Grade 8 Chemistry'),
  ('emp_batch_14','CBSE G10 Biology 1:1',    'one_to_one','10','CBSE',        'A',ARRAY['Biology'],        bc,ao,1,'active',own,'1:1 — CBSE Grade 10 Biology'),
  ('emp_batch_15','CBSE G11 Math 1:1',       'one_to_one','11','CBSE',        'B',ARRAY['Mathematics'],    bc,ao,1,'active',own,'1:1 — CBSE Grade 11 Math')
ON CONFLICT (batch_id) DO NOTHING;

-- ── 1:3 Batches ──────────────────────────────────────────────────────
INSERT INTO batches (batch_id, batch_name, batch_type, grade, board, section, subjects,
  coordinator_email, academic_operator_email, max_students, status, created_by, notes)
VALUES
  ('emp_batch_31','State G8 Math-Physics 1:3',  'one_to_three','8','State Board','A',ARRAY['Mathematics','Physics'],          bc,ao,3,'active',own,'1:3 — State Board Grade 8'),
  ('emp_batch_32','CBSE G9 Science 1:3',         'one_to_three','9','CBSE',       'A',ARRAY['Physics','Chemistry','Biology'],  bc,ao,3,'active',own,'1:3 — CBSE Grade 9 Science'),
  ('emp_batch_33','State G9 Math-English 1:3',   'one_to_three','9','State Board','B',ARRAY['Mathematics','English'],          bc,ao,3,'active',own,'1:3 — State Board Grade 9')
ON CONFLICT (batch_id) DO NOTHING;

-- ── Group Batches (one_to_many) ───────────────────────────────────────
INSERT INTO batches (batch_id, batch_name, batch_type, grade, board, section, subjects,
  coordinator_email, academic_operator_email, max_students, status, created_by, notes)
VALUES
  ('emp_batch_g1','CBSE G10 Full Science Group', 'one_to_many','10','CBSE',        'A',ARRAY['Mathematics','Physics','Chemistry'],bc,ao,15,'active',own,'Group — CBSE Grade 10'),
  ('emp_batch_g2','State G11 Commerce Group',     'one_to_many','11','State Board', 'B',ARRAY['Economics','Computer Science'],    bc,ao,15,'active',own,'Group — State Board Grade 11')
ON CONFLICT (batch_id) DO NOTHING;

RAISE NOTICE '✅ 10 batches created (5×1:1, 3×1:3, 2×group)';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. TEACHER → BATCH ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════════
-- 1:1 batches
INSERT INTO batch_teachers (batch_id, teacher_email, subject) VALUES
  ('emp_batch_11','ayanaranik@gmail.com',        'Mathematics'),
  ('emp_batch_12','manjima.jamisha@gmail.com',   'Physics'),
  ('emp_batch_13','anjustibe@gmail.com',        'Chemistry'),
  ('emp_batch_14','noorniza07@gmail.com',         'Biology'),
  ('emp_batch_15','sajithsts12@gmail.com',        'Mathematics')
ON CONFLICT DO NOTHING;

-- 1:3 batches
INSERT INTO batch_teachers (batch_id, teacher_email, subject) VALUES
  ('emp_batch_31','ayshanima283@gmail.com',        'Mathematics'),
  ('emp_batch_31','ronaldobiju77@gmail.com',       'Physics'),
  ('emp_batch_32','muhammadmubashirvmd@gmail.com', 'Physics'),
  ('emp_batch_32','jishnutkjishnutk@gmail.com',    'Chemistry'),
  ('emp_batch_32','nikhithabiju353@gmail.com',     'Biology'),
  ('emp_batch_33','nedhafathima40@gmail.com',      'Mathematics'),
  ('emp_batch_33','duafarrah10@gmail.com',         'English')
ON CONFLICT DO NOTHING;

-- Group batches
INSERT INTO batch_teachers (batch_id, teacher_email, subject) VALUES
  ('emp_batch_g1','muhammedrazalca3030@gmail.com', 'Mathematics'),
  ('emp_batch_g1','asnamh968@gmail.com',            'Physics'),
  ('emp_batch_g1','anwarkh55275@gmail.com',         'Chemistry'),
  ('emp_batch_g2','shahzasanam321@gmail.com',       'Economics'),
  ('emp_batch_g2','mariafaithe1@gmail.com',         'Computer Science')
ON CONFLICT DO NOTHING;

-- Update batch_ids on teacher portal_users rows
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_11') WHERE email='ayanaranik@gmail.com' AND NOT ('emp_batch_11'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_12') WHERE email='manjima.jamisha@gmail.com' AND NOT ('emp_batch_12'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_13') WHERE email='anjustibe@gmail.com' AND NOT ('emp_batch_13'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_14') WHERE email='noorniza07@gmail.com' AND NOT ('emp_batch_14'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_15') WHERE email='sajithsts12@gmail.com' AND NOT ('emp_batch_15'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_31') WHERE email='ayshanima283@gmail.com' AND NOT ('emp_batch_31'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_31') WHERE email='ronaldobiju77@gmail.com' AND NOT ('emp_batch_31'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='muhammadmubashirvmd@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='jishnutkjishnutk@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='nikhithabiju353@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_33') WHERE email='nedhafathima40@gmail.com' AND NOT ('emp_batch_33'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_33') WHERE email='duafarrah10@gmail.com' AND NOT ('emp_batch_33'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='muhammedrazalca3030@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='asnamh968@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='anwarkh55275@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='shahzasanam321@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='mariafaithe1@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));

RAISE NOTICE '✅ Teachers assigned to batches';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. STUDENT → BATCH ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════════
-- 1:1 → 1 student each
INSERT INTO batch_students (batch_id, student_email) VALUES
  ('emp_batch_11','farhananaushad0@gmai.com'),
  ('emp_batch_12','ahadajitha@gmail.com'),
  ('emp_batch_13','salihsali04@gmail.com'),
  ('emp_batch_14','asifalichr@gmail.com'),
  ('emp_batch_15','mohammedibrahim7907@gmail.com')
ON CONFLICT DO NOTHING;

-- 1:3 → 3 students each
INSERT INTO batch_students (batch_id, student_email) VALUES
  ('emp_batch_31','ijascr25@mail.com'),
  ('emp_batch_31','salehkochi@gmail.com'),
  ('emp_batch_31','munnas369369@gmail.com'),
  ('emp_batch_32','ouchithyahari@gmail.com'),
  ('emp_batch_32','gbenzy07@gmail.com'),
  ('emp_batch_32','mohammedsvk11@gmail.com'),
  ('emp_batch_33','hafismohammed006@gmail.com'),
  ('emp_batch_33','jzlinthomas@gmail.com'),
  ('emp_batch_33','tenogte@gmail.com')
ON CONFLICT DO NOTHING;

-- Group → 10 and 5 students
INSERT INTO batch_students (batch_id, student_email) VALUES
  ('emp_batch_g1','nebilnavas@gmail.com'),
  ('emp_batch_g1','sahadanas4510@gmail.com'),
  ('emp_batch_g1','bincy9188@gmail.com'),
  ('emp_batch_g1','anakharnairmace@gmail.com'),
  ('emp_batch_g1','emmanuel.altree@gmail.com'),
  ('emp_batch_g1','snehapg070899@gmail.com'),
  ('emp_batch_g1','joelpt1996@gmail.com'),
  ('emp_batch_g1','akshayrajkk440@gmail.com'),
  ('emp_batch_g1','navinaugpaul@gmail.com'),
  ('emp_batch_g1','apjabijith@gmail.com'),
  ('emp_batch_g2','arjunprakashk7@gmail.com'),
  ('emp_batch_g2','minnathhanan143@gmail.com'),
  ('emp_batch_g2','anjanaminisurendren@gmail.com'),
  ('emp_batch_g2','rozanayesudas1@gmail.com'),
  ('emp_batch_g2','saniya52432@gmail.com')
ON CONFLICT DO NOTHING;

-- Update batch_ids on student portal_users rows
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_11') WHERE email='farhananaushad0@gmai.com' AND NOT ('emp_batch_11'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_12') WHERE email='ahadajitha@gmail.com' AND NOT ('emp_batch_12'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_13') WHERE email='salihsali04@gmail.com' AND NOT ('emp_batch_13'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_14') WHERE email='asifalichr@gmail.com' AND NOT ('emp_batch_14'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_15') WHERE email='mohammedibrahim7907@gmail.com' AND NOT ('emp_batch_15'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_31') WHERE email='ijascr25@mail.com' AND NOT ('emp_batch_31'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_31') WHERE email='salehkochi@gmail.com' AND NOT ('emp_batch_31'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_31') WHERE email='munnas369369@gmail.com' AND NOT ('emp_batch_31'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='ouchithyahari@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='gbenzy07@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_32') WHERE email='mohammedsvk11@gmail.com' AND NOT ('emp_batch_32'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_33') WHERE email='hafismohammed006@gmail.com' AND NOT ('emp_batch_33'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_33') WHERE email='jzlinthomas@gmail.com' AND NOT ('emp_batch_33'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_33') WHERE email='tenogte@gmail.com' AND NOT ('emp_batch_33'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='nebilnavas@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='sahadanas4510@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='bincy9188@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='anakharnairmace@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='emmanuel.altree@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='snehapg070899@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='joelpt1996@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='akshayrajkk440@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='navinaugpaul@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g1') WHERE email='apjabijith@gmail.com' AND NOT ('emp_batch_g1'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='arjunprakashk7@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='minnathhanan143@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='anjanaminisurendren@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='rozanayesudas1@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));
UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'),'emp_batch_g2') WHERE email='saniya52432@gmail.com' AND NOT ('emp_batch_g2'=ANY(COALESCE(batch_ids,'{}')));

RAISE NOTICE '✅ Students assigned to batches';
RAISE NOTICE '═══════════════════════════════════════════════';
RAISE NOTICE 'SEED COMPLETE: 28 teachers, 29 students, 10 batches';
RAISE NOTICE '  5 × 1:1 (one student each)';
RAISE NOTICE '  3 × 1:3 (three students each)';
RAISE NOTICE '  2 × Group (10 + 5 students)';
RAISE NOTICE '  Password: stibe@2026';
RAISE NOTICE '═══════════════════════════════════════════════';

END $seed$;
