/**
 * Seed script: Import stibe employees from Excel data
 * - Faculty/Maths Faculty → teacher role
 * - All other designations → student role (with 50 prepaid sessions)
 * - Creates batches, assigns teachers & students, schedules sessions
 *
 * Run: npx tsx scripts/seed-employees.ts
 */

import { hash } from 'bcryptjs';
import { db } from '../lib/db';

const PASSWORD = 'stibe@2026';
const AO_EMAIL = 'dev.poornasree@gmail.com';
const BC_EMAIL = 'tech.poornasree@gmail.com';
const CREATOR_EMAIL = 'stibelearningventures@gmail.com';

// ── All employees from Excel ──
const employees = [
  { name: 'Ayana Rani', email: 'ayanaranik@gmail.com', phone: '8848457577', designation: 'Faculty' },
  { name: 'Manjima', email: 'manjima.jamisha@gmail.com', phone: '9778243916', designation: 'Faculty' },
  { name: 'Anju S Venu', email: 'anjustibe@gmail.com', phone: '7994069066', designation: 'Faculty' },
  { name: 'Noorniza', email: 'noorniza07@gmail.com', phone: '9447445597', designation: 'Faculty' },
  { name: 'Sajith', email: 'sajithsts12@gmail.com', phone: '9061044374', designation: 'Faculty' },
  { name: 'Aysha', email: 'ayshanima283@gmail.com', phone: '7558045201', designation: 'Faculty' },
  { name: 'Ronaldo Biju', email: 'ronaldobiju77@gmail.com', phone: '9778377118', designation: 'Faculty' },
  { name: 'Mubashir', email: 'muhammadmubashirvmd@gmail.com', phone: '6235136264', designation: 'Faculty' },
  { name: 'Jishnu', email: 'jishnutkjishnutk@gmail.com', phone: '9747248759', designation: 'Faculty' },
  { name: 'Nikitha', email: 'nikhithabiju353@gmail.com', phone: '9947608464', designation: 'Faculty' },
  { name: 'Farhana', email: 'farhananaushad0@gmai.com', phone: '7736423463', designation: 'Branch Manager' },
  { name: 'Nedha', email: 'nedhafathima40@gmail.com', phone: '7306062311', designation: 'Faculty' },
  { name: 'Ahad', email: 'ahadajitha@gmail.com', phone: '9895085731', designation: 'Branch Manager' },
  { name: 'Jinsiya', email: 'duafarrah10@gmail.com', phone: '8089860843', designation: 'Faculty' },
  { name: 'Razal', email: 'muhammedrazalca3030@gmail.com', phone: '7510353030', designation: 'Faculty' },
  { name: 'Asna', email: 'asnamh968@gmail.com', phone: '9633943802', designation: 'Faculty' },
  { name: 'Anwar', email: 'anwarkh55275@gmail.com', phone: '9847677286', designation: 'Faculty' },
  { name: 'Salih P R', email: 'salihsali04@gmail.com', phone: '6282179991', designation: 'Branch Manager' },
  { name: 'Shahziya', email: 'shahzasanam321@gmail.com', phone: '8113955109', designation: 'Faculty' },
  { name: 'Asif', email: 'asifalichr@gmail.com', phone: '8129179749', designation: 'Branch Manager' },
  { name: 'Maria', email: 'mariafaithe1@gmail.com', phone: '7356904933', designation: 'Faculty' },
  { name: 'Aleesha', email: 'alishaazad303@gmail.com', phone: '8891268682', designation: 'Faculty' },
  { name: 'Bincila', email: 'ziyanababu@gmail.com', phone: '8590371326', designation: 'Faculty' },
  { name: 'Ibrahim', email: 'mohammedibrahim7907@gmail.com', phone: '7907126725', designation: 'Branch Manager' },
  { name: 'Farzana Naushad', email: 'shibinfarzana@gmail.com', phone: '6238106821', designation: 'Faculty' },
  { name: 'Fayas', email: 'fayasappu10@gmail.com', phone: '9400213997', designation: 'Faculty' },
  { name: 'Ijas Ahmed', email: 'ijascr25@mail.com', phone: '8129508689', designation: 'Branch Manager' },
  { name: 'Mehfil', email: 'muhammedmehfilcr7@gmail.com', phone: '7356833252', designation: 'Faculty' },
  { name: 'Saleh Lukman', email: 'salehkochi@gmail.com', phone: '8281646244', designation: 'Branch Manager' },
  { name: 'Ansaf P B', email: 'anzaf042@gmail.com', phone: '9567206611', designation: 'Faculty' },
  { name: 'Nazra', email: 'nazrasanoop@gmail.com', phone: '8848990974', designation: 'Faculty' },
  { name: 'Essath', email: 'essathfarsana50@gmail.com', phone: '8891981850', designation: 'Faculty' },
  { name: 'Hanna', email: 'hannaksudheer69@gmail.com', phone: '9895865099', designation: 'Faculty' },
  { name: 'Liya Justin', email: 'liyaj5750@gmail.com', phone: '7736439386', designation: 'Maths Faculty' },
  { name: 'Fathima Rahfa K', email: 'rahfakalathingal@gmail.com', phone: '6238692452', designation: 'Faculty' },
  // Non-faculty (→ students)
  { name: 'Haris EN', email: 'munnas369369@gmail.com', phone: '7902645990', designation: 'Media Head' },
  { name: 'Ouchithya H R', email: 'ouchithyahari@gmail.com', phone: '7994866097', designation: 'Academic Counselor' },
  { name: 'Benzy G', email: 'gbenzy07@gmail.com', phone: '7012037607', designation: 'HR Associate' },
  { name: 'Mohammed Shafi V K', email: 'mohammedsvk11@gmail.com', phone: '9961423371', designation: 'Business Head' },
  { name: 'Hafis Mohammed', email: 'hafismohammed006@gmail.com', phone: '7736028086', designation: 'Graphic Designer' },
  { name: 'Jeslin Thomas', email: 'jzlinthomas@gmail.com', phone: '8943516103', designation: 'HR Manager' },
  { name: 'Teno G Terry', email: 'tenogte@gmail.com', phone: '8943870403', designation: 'Sales Executive' },
  { name: 'Mohamed Nebil A N', email: 'nebilnavas@gmail.com', phone: '9207076473', designation: 'General Manager' },
  { name: 'Mohammed Sahad A', email: 'sahadanas4510@gmail.com', phone: '9633422377', designation: 'Accounts' },
  { name: 'Bincy Sinoy', email: 'bincy9188@gmail.com', phone: '8086894010', designation: 'Team Leader' },
  { name: 'Anakha R Nair', email: 'anakharnairmace@gmail.com', phone: '9747499597', designation: 'Sales Trainer' },
  { name: 'Emmanuel Sebastian', email: 'emmanuel.altree@gmail.com', phone: '8547769067', designation: 'Marketing Executive' },
  { name: 'Sneha PG', email: 'snehapg070899@gmail.com', phone: '8157927369', designation: 'Academic Counselor' },
  { name: 'Joel P Thomas', email: 'joelpt1996@gmail.com', phone: '9847147448', designation: 'Digital Head' },
  { name: 'Akshay Raj K K', email: 'akshayrajkk440@gmail.com', phone: '9746411970', designation: 'Business Head' },
  { name: 'Navin Augustine Paul', email: 'navinaugpaul@gmail.com', phone: '9383406428', designation: 'Accountant' },
  { name: 'Abijith P J', email: 'apjabijith@gmail.com', phone: '9074421002', designation: 'Video Editor' },
  { name: 'Arjun K', email: 'arjunprakashk7@gmail.com', phone: '8089835558', designation: 'Jr Software Developer' },
  { name: 'Minnath Hanan', email: 'minnathhanan143@gmail.com', phone: '9744992730', designation: 'Finance' },
  { name: 'Anjana KP', email: 'anjanaminisurendren@gmail.com', phone: '8592842861', designation: 'HR' },
  { name: 'Mariam Rozana Yesudas', email: 'rozanayesudas1@gmail.com', phone: '8921762073', designation: 'Academic Counsellor' },
  { name: 'Mary Saniya', email: 'saniya52432@gmail.com', phone: '7736265296', designation: 'Academic Counsellor' },
];

// ── Subject assignments for teachers (rotating) ──
const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Social Science', 'Hindi', 'Computer Science', 'Malayalam', 'Economics',
];

const GRADES = ['8', '9', '10', '11', '12'];
const BOARDS = ['CBSE', 'State Board'];
const SECTIONS = ['A', 'B'];

// Faculty designations → teacher
function isFaculty(d: string) {
  return d.toLowerCase().includes('faculty');
}

async function main() {
  const passwordHash = await hash(PASSWORD, 12);
  console.log('🔐 Password hashed');

  const facultyList = employees.filter(e => isFaculty(e.designation));
  const studentList = employees.filter(e => !isFaculty(e.designation));

  console.log(`👩‍🏫 Faculty (teachers): ${facultyList.length}`);
  console.log(`👨‍🎓 Non-faculty (students): ${studentList.length}`);

  // ═══════════════════════════════════════════════════════════
  // 1. Create teacher accounts
  // ═══════════════════════════════════════════════════════════
  let teacherCount = 0;
  for (let i = 0; i < facultyList.length; i++) {
    const f = facultyList[i];
    const subj = SUBJECTS[i % SUBJECTS.length];
    const email = f.email.toLowerCase().trim();
    const phone = f.phone.replace(/\s/g, '');

    // Skip if mohammedsvk11 is already owner
    if (email === 'mohammedsvk11@gmail.com') continue;

    // Upsert portal_users
    await db.query(
      `INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password)
       VALUES ($1, $2, 'teacher', $3, true, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         portal_role = 'teacher',
         phone = EXCLUDED.phone,
         is_active = true,
         password_hash = EXCLUDED.password_hash,
         plain_password = EXCLUDED.plain_password,
         updated_at = NOW()`,
      [email, f.name, phone, passwordHash, PASSWORD]
    );

    // Upsert user_profiles
    await db.query(
      `INSERT INTO user_profiles (email, phone, whatsapp, subjects, qualification, experience_years)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         phone = EXCLUDED.phone,
         whatsapp = EXCLUDED.whatsapp,
         subjects = EXCLUDED.subjects,
         qualification = COALESCE(user_profiles.qualification, EXCLUDED.qualification),
         experience_years = COALESCE(user_profiles.experience_years, EXCLUDED.experience_years),
         updated_at = NOW()`,
      [email, phone, phone, [subj], 'Graduate', Math.floor(Math.random() * 5) + 1]
    );

    teacherCount++;
    console.log(`  ✅ Teacher: ${f.name} (${email}) → ${subj}`);
  }
  console.log(`\n📊 Created ${teacherCount} teachers\n`);

  // ═══════════════════════════════════════════════════════════
  // 2. Create student accounts with 50 session credits
  // ═══════════════════════════════════════════════════════════
  let studentCount = 0;
  for (let i = 0; i < studentList.length; i++) {
    const s = studentList[i];
    const email = s.email.toLowerCase().trim();
    const phone = s.phone.replace(/\s/g, '');
    const grade = GRADES[i % GRADES.length];
    const board = BOARDS[i % BOARDS.length];

    // Skip if already an owner or AO
    if (email === 'mohammedsvk11@gmail.com') continue;

    // Upsert portal_users
    await db.query(
      `INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password)
       VALUES ($1, $2, 'student', $3, true, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         portal_role = 'student',
         phone = EXCLUDED.phone,
         is_active = true,
         password_hash = EXCLUDED.password_hash,
         plain_password = EXCLUDED.plain_password,
         updated_at = NOW()`,
      [email, s.name, phone, passwordHash, PASSWORD]
    );

    // Upsert user_profiles
    await db.query(
      `INSERT INTO user_profiles (email, phone, whatsapp, grade, board, section)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         phone = EXCLUDED.phone,
         whatsapp = EXCLUDED.whatsapp,
         grade = EXCLUDED.grade,
         board = EXCLUDED.board,
         section = EXCLUDED.section,
         updated_at = NOW()`,
      [email, phone, phone, grade, board, SECTIONS[i % SECTIONS.length]]
    );

    // Create session credits — 50 sessions for 3 subjects
    const studentSubjects = [
      SUBJECTS[i % SUBJECTS.length],
      SUBJECTS[(i + 3) % SUBJECTS.length],
      SUBJECTS[(i + 6) % SUBJECTS.length],
    ];
    for (const subj of studentSubjects) {
      await db.query(
        `INSERT INTO student_session_credits
         (id, student_email, subject, batch_type, total_sessions, used_sessions, fee_per_session_paise, currency, source, is_active)
         VALUES (gen_random_uuid(), $1, $2, 'one_to_many', 50, 0, 15000, 'INR', 'manual', true)
         ON CONFLICT DO NOTHING`,
        [email, subj]
      );
    }

    studentCount++;
    console.log(`  ✅ Student: ${s.name} (${email}) → Grade ${grade} ${board}`);
  }
  console.log(`\n📊 Created ${studentCount} students (each with 50 session credits × 3 subjects)\n`);

  // ═══════════════════════════════════════════════════════════
  // 3. Create batches (grade × section combinations)
  // ═══════════════════════════════════════════════════════════
  console.log('📦 Creating batches...\n');

  // Batches: mix of 1:1, 1:3, and group (one_to_many)
  const batchDefs = [
    // ── 1:1 batches (1 student each) ──
    { name: 'CBSE G8 Math 1:1', grade: '8', board: 'CBSE', section: 'A', type: 'one_to_one', maxStudents: 1, subjects: ['Mathematics'] },
    { name: 'CBSE G9 Physics 1:1', grade: '9', board: 'CBSE', section: 'B', type: 'one_to_one', maxStudents: 1, subjects: ['Physics'] },
    { name: 'State G8 Chemistry 1:1', grade: '8', board: 'State Board', section: 'A', type: 'one_to_one', maxStudents: 1, subjects: ['Chemistry'] },
    { name: 'CBSE G10 Biology 1:1', grade: '10', board: 'CBSE', section: 'A', type: 'one_to_one', maxStudents: 1, subjects: ['Biology'] },
    { name: 'CBSE G11 Math 1:1', grade: '11', board: 'CBSE', section: 'B', type: 'one_to_one', maxStudents: 1, subjects: ['Mathematics'] },
    // ── 1:3 batches (3 students each) ──
    { name: 'CBSE G9 Math-Physics 1:3', grade: '9', board: 'CBSE', section: 'A', type: 'one_to_three', maxStudents: 3, subjects: ['Mathematics', 'Physics'] },
    { name: 'CBSE G10 Science 1:3', grade: '10', board: 'CBSE', section: 'B', type: 'one_to_three', maxStudents: 3, subjects: ['Physics', 'Chemistry', 'Biology'] },
    { name: 'State G9 Math-English 1:3', grade: '9', board: 'State Board', section: 'B', type: 'one_to_three', maxStudents: 3, subjects: ['Mathematics', 'English'] },
    // ── Group batches (remaining students) ──
    { name: 'CBSE G10 Full Science Group', grade: '10', board: 'CBSE', section: 'A', type: 'one_to_many', maxStudents: 15, subjects: ['Mathematics', 'Physics', 'Chemistry'] },
    { name: 'State G11 Commerce Group', grade: '11', board: 'State Board', section: 'A', type: 'one_to_many', maxStudents: 15, subjects: ['Economics', 'Computer Science'] },
  ];

  const batchIds: string[] = [];
  const teacherEmails = facultyList
    .filter(f => f.email.toLowerCase() !== 'mohammedsvk11@gmail.com')
    .map(f => f.email.toLowerCase().trim());
  const studentEmails = studentList
    .filter(s => s.email.toLowerCase() !== 'mohammedsvk11@gmail.com')
    .map(s => s.email.toLowerCase().trim());

  let teacherIdx = 0;
  let studentIdx = 0;

  for (const bd of batchDefs) {
    const batchId = `batch_${Math.random().toString(36).substring(2, 14)}`;

    await db.query(
      `INSERT INTO batches (batch_id, batch_name, batch_type, grade, board, section, subjects,
         coordinator_email, academic_operator_email, max_students, status, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12)`,
      [batchId, bd.name, bd.type, bd.grade, bd.board, bd.section, bd.subjects,
        BC_EMAIL, AO_EMAIL, bd.maxStudents, CREATOR_EMAIL, `Test batch — ${bd.board} Grade ${bd.grade} (${bd.type})`]
    );

    batchIds.push(batchId);
    console.log(`  📦 Batch: ${bd.name} (${batchId})`);

    // Assign teachers (one per subject)
    for (const subj of bd.subjects) {
      const tEmail = teacherEmails[teacherIdx % teacherEmails.length];
      teacherIdx++;
      await db.query(
        `INSERT INTO batch_teachers (batch_id, teacher_email, subject)
         VALUES ($1, $2, $3)
         ON CONFLICT (batch_id, subject) DO NOTHING`,
        [batchId, tEmail, subj]
      );

      // Add batch_id to teacher's batch_ids array
      await db.query(
        `UPDATE portal_users SET batch_ids = array_append(
           COALESCE(batch_ids, '{}'), $1
         ) WHERE email = $2 AND NOT ($1 = ANY(COALESCE(batch_ids, '{}')))`,
        [batchId, tEmail]
      );
      console.log(`    👩‍🏫 ${tEmail} → ${subj}`);
    }

    // Assign students: 1 for 1:1, 3 for 1:3, up to maxStudents for group
    const nStudents = bd.maxStudents;
    for (let s = 0; s < nStudents && studentIdx < studentEmails.length; s++) {
      const sEmail = studentEmails[studentIdx % studentEmails.length];
      studentIdx++;
      await db.query(
        `INSERT INTO batch_students (batch_id, student_email)
         VALUES ($1, $2)
         ON CONFLICT (batch_id, student_email) DO NOTHING`,
        [batchId, sEmail]
      );

      // Add batch_id to student's batch_ids
      await db.query(
        `UPDATE portal_users SET batch_ids = array_append(
           COALESCE(batch_ids, '{}'), $1
         ) WHERE email = $2 AND NOT ($1 = ANY(COALESCE(batch_ids, '{}')))`,
        [batchId, sEmail]
      );
      console.log(`    👨‍🎓 ${sEmail}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. Schedule sessions for each batch (next 7 days)
  // ═══════════════════════════════════════════════════════════
  console.log('\n📅 Scheduling sessions...\n');

  const today = new Date();
  let sessionCount = 0;

  for (let bi = 0; bi < batchDefs.length; bi++) {
    const bd = batchDefs[bi];
    const batchId = batchIds[bi];

    // Get teachers for this batch
    const btRes = await db.query(
      `SELECT bt.teacher_email, bt.subject, pu.full_name
       FROM batch_teachers bt
       JOIN portal_users pu ON pu.email = bt.teacher_email
       WHERE bt.batch_id = $1`,
      [batchId]
    );

    // Schedule 2 sessions per subject over next 5 days
    for (const bt of btRes.rows) {
      for (let day = 0; day < 2; day++) {
        const sessDate = new Date(today);
        sessDate.setDate(today.getDate() + day + (bi % 3)); // stagger across days

        const dateStr = sessDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // Stagger start times: 09:00, 10:30, 14:00, 15:30, 17:00
        const timeSlots = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
        const startTime = timeSlots[(sessionCount) % timeSlots.length];

        const sessionId = `sess_${Math.random().toString(36).substring(2, 14)}`;

        await db.query(
          `INSERT INTO batch_sessions
           (session_id, batch_id, subject, teacher_email, teacher_name,
            scheduled_date, start_time, duration_minutes, teaching_minutes,
            prep_buffer_minutes, status, topic, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 60, 50, 10, 'scheduled', $8, $9)`,
          [sessionId, batchId, bt.subject, bt.teacher_email, bt.full_name,
            dateStr, startTime, `${bt.subject} - Session ${day + 1}`, CREATOR_EMAIL]
        );

        sessionCount++;
        console.log(`  📅 ${bd.name} | ${bt.subject} | ${dateStr} ${startTime} | ${bt.full_name}`);
      }
    }
  }

  console.log(`\n📊 Scheduled ${sessionCount} sessions across ${batchDefs.length} batches\n`);

  // ═══════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE');
  console.log(`   Teachers: ${teacherCount}`);
  console.log(`   Students: ${studentCount} (50 sessions × 3 subjects each)`);
  console.log(`   Batches: ${batchDefs.length}`);
  console.log(`   Sessions: ${sessionCount}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log('═══════════════════════════════════════════════');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
