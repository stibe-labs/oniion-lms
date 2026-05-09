// ═══════════════════════════════════════════════════════════════
// Portal — Shared TypeScript Types
// ═══════════════════════════════════════════════════════════════
// All files import from here: import type { ... } from '@/types';
// ═══════════════════════════════════════════════════════════════

// ── Portal Roles ────────────────────────────────────────────

export type PortalRole =
  | 'superadmin'           // Superadmin — sits above owner; manages platform-wide config
  | 'teacher'
  | 'teacher_screen'       // Teacher's tablet/screen-share device — screen share only, no camera/mic
  | 'student'
  | 'batch_coordinator'     // Batch Coordinator — monitoring, attendance, parent comms
  | 'academic_operator'    // Academic Operator — creates rooms, assigns teachers & students
  | 'academic'             // legacy alias — redirects to /academic-operator; no new users should get this role
  | 'hr'                   // HR Associate — creates & manages user accounts + credentials
  | 'parent'
  | 'owner'
  | 'ghost'                // dedicated Ghost Observer role — silent read-only access
  | 'sales'               // Sales CRM — lead management, pipeline, follow-ups
  | 'demo_agent'          // CRM sales agent joining demo sessions
  | 'conference_host'     // Conference admin — publish + subscribe + roomAdmin
  | 'conference_user';    // Conference user — publish + subscribe

// ── User Object (stored in portal session JWT) ─────────────
export interface PortalUser {
  id: string;           // email used as unique ID
  name: string;         // Display name shown in UI
  role: PortalRole;     // Single mapped role
  batch_id?: string;    // Optional — batch context for students/teachers
  token?: string;       // Portal JWT (only present in API responses)
  is_guest?: boolean;   // True for open-classroom guest participants (no portal account)
}

// ── JWT Session Payload ─────────────────────────────────────
export interface SessionPayload extends PortalUser {
  iat: number;
  exp: number;
}

// ── ClassRoom ───────────────────────────────────────────────
export interface ClassRoom {
  id: string;
  room_name: string;
  batch_id: string;
  teacher_id: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  livekit_room_id: string;
  room_url: string;
}

// ── Join Token Payload (decoded JWT from join URL) ─────────
export interface JoinTokenPayload {
  sub: string;           // email
  name: string;          // display name
  role: PortalRole;
  room_id: string;
  batch_id: string;
  class_session_id: string;
  permissions: {
    can_publish_video: boolean;
    can_publish_audio: boolean;
    can_share_screen: boolean;
    can_chat: boolean;
    is_ghost: boolean;
    hidden: boolean;
  };
}

// ── Standard API Response Wrapper ───────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ── Ghost Mode Types ────────────────────────────────────────
export interface GhostRoomSummary {
  id: string;
  room_code: string;
  name: string;
  status: 'waiting' | 'live' | 'ending_soon' | 'ended';
  livekit_room_name: string;
  teacher_name: string | null;
  student_count: number;
  cameras_on: number;
  started_at: string | null;
  scheduled_at: string;
  expires_at: string;
}
