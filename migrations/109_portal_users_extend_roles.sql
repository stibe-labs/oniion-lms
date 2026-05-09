-- Migration 109: Expand portal_users portal_role CHECK to include superadmin,
-- demo_agent, conference_host, conference_user roles

ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS portal_users_portal_role_check;

ALTER TABLE portal_users
  ADD CONSTRAINT portal_users_portal_role_check
  CHECK (portal_role IN (
    'superadmin',
    'teacher', 'teacher_screen',
    'student',
    'batch_coordinator',
    'academic_operator', 'academic',
    'hr',
    'parent',
    'owner',
    'ghost',
    'sales',
    'demo_agent',
    'conference_host', 'conference_user'
  ));
