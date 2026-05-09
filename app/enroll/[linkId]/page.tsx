// ═══════════════════════════════════════════════════════════════
// Enrollment Page — /enroll/[linkId]
// SSR: validates link, passes data to client component.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import EnrollmentClient from './EnrollmentClient';
import LoginSlideshow from '@/components/auth/LoginSlideshow';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Enrollment · ${n}` };
}
import {
  STUDENT_REGIONS,
  ENROLLMENT_BOARDS,
  ELIGIBLE_GRADES,
  BATCH_TYPE_LABELS,
  PER_CLASS_SUBJECTS_BY_GRADE,
  ONE_TO_FIFTEEN_PACKAGES,
  ONE_TO_THIRTY_PACKAGES,
  ONE_TO_MANY_SUBJECTS_BY_GRADE,
  MIN_SESSIONS_DEFAULT,
  MIN_SESSIONS_MINIMUM,
} from '@/lib/enrollment-fee';

interface Props {
  params: Promise<{ linkId: string }>;
}

export default async function EnrollPage({ params }: Props) {
  const { linkId } = await params;

  const linkRes = await db.query(
    `SELECT * FROM enrollment_links WHERE id = $1 LIMIT 1`,
    [linkId],
  );

  if (linkRes.rows.length === 0) notFound();

  const link = linkRes.rows[0] as Record<string, unknown>;

  const isPaid = link.status === 'paid';
  const isExpired =
    link.status === 'expired' || new Date(link.expires_at as string) < new Date();

  // Fetch subject rates, fee structure, and demo registration data in parallel
  const demoRequestId = link.demo_request_id as string | null;

  const [feeRes, demoRes] = await Promise.all([
    db.query(
      `SELECT id, region_group, board, batch_type, grade,
              fee_paise, early_bird_fee_paise, offer_label, offer_expires_at,
              show_per_class_only, fee_unit, currency, fee_type, batch_name
       FROM enrollment_fee_structure
       WHERE is_active = true
       ORDER BY region_group, board, batch_type, grade`,
    ),
    demoRequestId
      ? db.query(
          `SELECT student_name, student_email, student_phone, student_grade,
                  student_board, student_region
           FROM demo_requests WHERE id = $1 LIMIT 1`,
          [demoRequestId],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  // Use demo registration data to backfill any missing enrollment fields
  const demo = (demoRes.rows[0] || {}) as Record<string, unknown>;

  const feeStructure = feeRes.rows as Array<{
    id: string;
    region_group: string;
    board: string;
    batch_type: string;
    grade: string;
    fee_paise: number;
    early_bird_fee_paise: number | null;
    offer_label: string | null;
    offer_expires_at: string | null;
    show_per_class_only: boolean;
    fee_unit: string;
    currency: string;
    fee_type: string | null;
    batch_name: string | null;
  }>;

  const initialLink = {
    student_name: String(link.student_name || demo.student_name || ''),
    student_email: String(link.student_email || demo.student_email || ''),
    student_phone: String(link.student_phone || demo.student_phone || ''),
    student_grade: (link.student_grade as string) || (demo.student_grade as string) || null,
    student_board: (link.student_board as string) || (demo.student_board as string) || null,
    student_region: (link.student_region as string) || (demo.student_region as string) || null,
    student_whatsapp: (link.student_whatsapp as string) || null,
    student_dob: (link.student_dob as string) || null,
    student_section: (link.student_section as string) || null,
    student_parent_name: (link.student_parent_name as string) || null,
    student_parent_email: (link.student_parent_email as string) || null,
    student_parent_phone: (link.student_parent_phone as string) || null,
    preferred_batch_type: (link.preferred_batch_type as string) || null,
    enrollment_category: (link.enrollment_category as string) || null,
    minimum_sessions: Number(link.minimum_sessions) || 50,
    status: String(link.status || 'active'),
  };

  const constants = {
    student_regions: STUDENT_REGIONS,
    boards: ENROLLMENT_BOARDS,
    eligible_grades: ELIGIBLE_GRADES,
    batch_type_labels: BATCH_TYPE_LABELS,
    perClassSubjectsByGrade: PER_CLASS_SUBJECTS_BY_GRADE,
    oneToFifteenPackages: ONE_TO_FIFTEEN_PACKAGES as unknown as Array<{ id: string; label: string; subjects: string[] }>,
    oneToThirtyPackages: ONE_TO_THIRTY_PACKAGES as unknown as Array<{ id: string; label: string; subjects: string[] }>,
    oneToManySubjectsByGrade: ONE_TO_MANY_SUBJECTS_BY_GRADE,
    minSessionsDefault: MIN_SESSIONS_DEFAULT,
    minSessionsMinimum: MIN_SESSIONS_MINIMUM,
  };

  return (
    <main className="relative min-h-screen w-screen bg-white sm:h-screen sm:overflow-hidden sm:bg-black">
      {/* ── Decorative emerald accent bar — mobile only ── */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 to-teal-500 z-50 sm:hidden" />

      {/* ── Logo — top-left on desktop ── */}
      <div className="absolute top-6 left-8 z-40 hidden sm:block">
        <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
      </div>

      {/* ── Fullscreen image slideshow — desktop only ── */}
      <div className="hidden sm:block">
        <LoginSlideshow />
      </div>

      {/* ── Desktop: right-side panel overlay ── */}
      <div className="hidden sm:flex absolute inset-y-0 right-0 z-30 w-120 md:w-140">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-900/60 via-emerald-950/65 to-teal-950/70 backdrop-blur-xl" />
        <div className="absolute inset-y-0 left-0 w-px bg-emerald-400/10" />
        <div className="relative z-10 w-full overflow-y-auto px-12 py-10">
          <EnrollmentClient
            linkId={linkId}
            initialLink={initialLink}
            feeStructure={feeStructure}
            constants={constants}
            isPaid={isPaid}
            isExpired={isExpired}
          />
        </div>
      </div>

      {/* ── Mobile: natural scroll layout (matches auth feel) ── */}
      <div className="sm:hidden px-6 pt-8 pb-12">
        <EnrollmentClient
          linkId={linkId}
          initialLink={initialLink}
          feeStructure={feeStructure}
          constants={constants}
          isPaid={isPaid}
          isExpired={isExpired}
        />
      </div>
    </main>
  );
}
