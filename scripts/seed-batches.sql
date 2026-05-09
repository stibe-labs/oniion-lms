DO $fn$
DECLARE
  bid TEXT;
  AO  TEXT := 'dev.poornasree@gmail.com';
  BC  TEXT := 'tech.poornasree@gmail.com';
  OWN TEXT := 'stibelearningventures@gmail.com';

  s8 TEXT[] := ARRAY[
    'anakharnairmace@gmail.com','arjunprakashk7@gmail.com','emmanuel.altree@gmail.com',
    'hafismohammed006@gmail.com','joelpt1996@gmail.com','mohamedshihas1234@gmail.com',
    'navinaugpaul@gmail.com','ouchithyahari@gmail.com','salihsali04@gmail.com',
    'tenogte@gmail.com'
  ];

  s9 TEXT[] := ARRAY[
    'ahadajitha@gmail.com','anjanaminisurendren@gmail.com','asifalichr@gmail.com',
    'farhananaushad0@gmai.com','hr.pydart@gmail.com','jzlinthomas@gmail.com',
    'mohammedibrahim7907@gmail.com','nebilnavas@gmail.com','sahadanas4510@gmail.com',
    'snehapg070899@gmail.com'
  ];

  s10 TEXT[] := ARRAY[
    'akshayrajkk440@gmail.com','apjabijith@gmail.com','bincy9188@gmail.com',
    'gbenzy07@gmail.com','ijascr25@mail.com','minnathhanan143@gmail.com',
    'munnas369369@gmail.com','official.tishnu@gmail.com','salehkochi@gmail.com',
    'solutions.pydart@gmail.com'
  ];

  teachers TEXT[] := ARRAY[
    'ayanaranik@gmail.com','manjima.jamisha@gmail.com','anjustibe@gmail.com',
    'noorniza07@gmail.com','sajithsts12@gmail.com','ayshanima283@gmail.com',
    'ronaldobiju77@gmail.com','muhammadmubashirvmd@gmail.com','jishnutkjishnutk@gmail.com',
    'nikhithabiju353@gmail.com','nedhafathima40@gmail.com','duafarrah10@gmail.com',
    'muhammedrazalca3030@gmail.com','asnamh968@gmail.com','anwarkh55275@gmail.com',
    'shahzasanam321@gmail.com','mariafaithe1@gmail.com','alishaazad303@gmail.com',
    'shibinfarzana@gmail.com','fayasappu10@gmail.com','muhammedmehfilcr7@gmail.com',
    'anzaf042@gmail.com','nazrasanoop@gmail.com','essathfarsana50@gmail.com',
    'hannaksudheer69@gmail.com','liyaj5750@gmail.com','rahfakalathingal@gmail.com',
    'official4tishnu@gmail.com','it.poornasree@gmail.com','gmhrofficial.stibe@gmai.com'
  ];

  ti INT := 1;
  i  INT;
  j  INT;
  em TEXT;
  subjs TEXT[];
  max_s INT;
BEGIN

  -- Grade 8: 10 x 1:1 batches
  RAISE NOTICE '== 1:1 batches (Grade 8) ==';
  FOR i IN 1..10 LOOP
    bid := 'batch_' || substr(md5(random()::text || i::text), 1, 12);
    INSERT INTO batches (batch_id, batch_name, batch_type, grade, board,
      subjects, coordinator_email, academic_operator_email, max_students, status, created_by, notes)
    VALUES (bid, 'One-to-One G8 #' || i, 'one_to_one', '8', 'CBSE',
      ARRAY['Mathematics'], BC, AO, 1, 'active', OWN, 'Individual — CBSE Grade 8');

    INSERT INTO batch_teachers (batch_id, teacher_email, subject)
      VALUES (bid, teachers[ti], 'Mathematics') ON CONFLICT DO NOTHING;
    UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
      WHERE email = teachers[ti] AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
    ti := (ti % array_length(teachers,1)) + 1;

    INSERT INTO batch_students (batch_id, student_email)
      VALUES (bid, s8[i]) ON CONFLICT DO NOTHING;
    UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
      WHERE email = s8[i] AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
    RAISE NOTICE '  1:1 #% — %', i, s8[i];
  END LOOP;

  -- Grade 9: 4 x 1:3 batches (3+3+3+1)
  RAISE NOTICE '== 1:3 batches (Grade 9) ==';
  FOR i IN 1..4 LOOP
    bid := 'batch_' || substr(md5(random()::text || (i+20)::text), 1, 12);

    subjs := CASE i
      WHEN 1 THEN ARRAY['Mathematics','Physics']
      WHEN 2 THEN ARRAY['Mathematics','Chemistry']
      WHEN 3 THEN ARRAY['Mathematics','Biology']
      ELSE        ARRAY['Mathematics','English']
    END;
    max_s := CASE WHEN i <= 3 THEN 3 ELSE 1 END;

    INSERT INTO batches (batch_id, batch_name, batch_type, grade, board,
      subjects, coordinator_email, academic_operator_email, max_students, status, created_by, notes)
    VALUES (bid, 'One-to-Three G9 #' || i, 'one_to_three', '9', 'CBSE',
      subjs, BC, AO, 3, 'active', OWN, 'Group of 3 — CBSE Grade 9');

    FOR j IN 1..array_length(subjs,1) LOOP
      INSERT INTO batch_teachers (batch_id, teacher_email, subject)
        VALUES (bid, teachers[ti], subjs[j]) ON CONFLICT DO NOTHING;
      UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
        WHERE email = teachers[ti] AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
      ti := (ti % array_length(teachers,1)) + 1;
    END LOOP;

    FOR j IN 1..max_s LOOP
      em := s9[(i-1)*3 + j];
      INSERT INTO batch_students (batch_id, student_email)
        VALUES (bid, em) ON CONFLICT DO NOTHING;
      UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
        WHERE email = em AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
    END LOOP;
    RAISE NOTICE '  1:3 #% — % students', i, max_s;
  END LOOP;

  -- Grade 10: 2 x 1:5 batches (5+5)
  RAISE NOTICE '== 1:5 batches (Grade 10) ==';
  FOR i IN 1..2 LOOP
    bid := 'batch_' || substr(md5(random()::text || (i+40)::text), 1, 12);

    subjs := CASE i
      WHEN 1 THEN ARRAY['Mathematics','Physics','Chemistry']
      ELSE        ARRAY['Mathematics','Biology','English']
    END;

    INSERT INTO batches (batch_id, batch_name, batch_type, grade, board,
      subjects, coordinator_email, academic_operator_email, max_students, status, created_by, notes)
    VALUES (bid, 'One-to-Five G10 #' || i, 'one_to_many', '10', 'CBSE',
      subjs, BC, AO, 5, 'active', OWN, 'Group of 5 — CBSE Grade 10');

    FOR j IN 1..array_length(subjs,1) LOOP
      INSERT INTO batch_teachers (batch_id, teacher_email, subject)
        VALUES (bid, teachers[ti], subjs[j]) ON CONFLICT DO NOTHING;
      UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
        WHERE email = teachers[ti] AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
      ti := (ti % array_length(teachers,1)) + 1;
    END LOOP;

    FOR j IN 1..5 LOOP
      em := s10[(i-1)*5 + j];
      INSERT INTO batch_students (batch_id, student_email)
        VALUES (bid, em) ON CONFLICT DO NOTHING;
      UPDATE portal_users SET batch_ids = array_append(COALESCE(batch_ids,'{}'), bid)
        WHERE email = em AND NOT (bid = ANY(COALESCE(batch_ids,'{}')));
    END LOOP;
    RAISE NOTICE '  1:5 #% — 5 students', i;
  END LOOP;

  RAISE NOTICE 'Done — 16 batches created.';
END $fn$;
