import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// GET /api/v1/academics/settings — return all academic settings
export async function GET() {
  try {
    const result = await db.query(
      `SELECT setting_key, setting_values FROM academic_settings ORDER BY setting_key`
    );

    const settings: Record<string, string[]> = {};
    for (const row of result.rows) {
      settings[row.setting_key as string] = row.setting_values as string[];
    }

    // Provide defaults if table is empty
    if (!settings.subjects) settings.subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    if (!settings.grades) settings.grades = ['8', '9', '10', '11', '12'];
    if (!settings.sections) settings.sections = ['A', 'B', 'C', 'D', 'E', 'F'];
    if (!settings.boards) settings.boards = ['CBSE', 'ICSE', 'ISC', 'State Board', 'IB (International Baccalaureate)', 'IGCSE (Cambridge)', 'NIOS', 'SSC', 'HSC', 'Matriculation Board', 'Anglo Indian Board'];

    return NextResponse.json<ApiResponse>({ success: true, data: settings });
  } catch (err) {
    console.error('[academics/settings] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/v1/academics/settings — update a specific setting
// Body: { key: "subjects", values: ["Physics", "Chemistry", ...] }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, values } = body as { key: string; values: string[] };

    const allowedKeys = ['subjects', 'grades', 'sections', 'boards'];
    if (!key || !allowedKeys.includes(key)) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Invalid key. Allowed: ${allowedKeys.join(', ')}` }, { status: 400 });
    }

    if (!Array.isArray(values) || values.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Values must be a non-empty array' }, { status: 400 });
    }

    // Trim and deduplicate
    const cleaned = [...new Set(values.map(v => String(v).trim()).filter(Boolean))];

    await db.query(
      `INSERT INTO academic_settings (setting_key, setting_values, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_values = $2, updated_at = NOW()`,
      [key, cleaned]
    );

    return NextResponse.json<ApiResponse>({ success: true, data: { key, values: cleaned } });
  } catch (err) {
    console.error('[academics/settings] PUT error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update setting' }, { status: 500 });
  }
}
