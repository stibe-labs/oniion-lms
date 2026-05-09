import { db } from '../lib/db';

async function main() {
  console.log('=== BATCH SESSIONS ===');
  const sessions = await db.query(
    `SELECT session_id, batch_id, subject, scheduled_date::text, start_time::text, status, teacher_email
     FROM batch_sessions ORDER BY scheduled_date, start_time`
  );
  console.log(JSON.stringify(sessions.rows, null, 2));

  console.log('\n=== BATCHES ===');
  const batches = await db.query(
    `SELECT batch_id, batch_name, batch_type, grade, status, coordinator_email, academic_operator_email
     FROM batches ORDER BY created_at`
  );
  console.log(JSON.stringify(batches.rows, null, 2));

  console.log('\n=== BATCH STUDENTS ===');
  const students = await db.query(
    `SELECT * FROM batch_students`
  );
  console.log(JSON.stringify(students.rows, null, 2));

  console.log('\n=== BATCH TEACHERS ===');
  const teachers = await db.query(
    `SELECT * FROM batch_teachers`
  );
  console.log(JSON.stringify(teachers.rows, null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
