-- Open Classroom join approval system
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS auto_approve_joins BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE open_classroom_participants ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'auto_approved';
-- approval_status: 'auto_approved' | 'pending' | 'approved' | 'denied'
