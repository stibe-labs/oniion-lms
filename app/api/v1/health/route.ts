import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomService } from '@/lib/livekit';

const startTime = Date.now();

/**
 * GET /api/v1/health
 * Server health check — tests DB, Redis, LiveKit connectivity.
 * No auth required. Always returns 200.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let overallStatus = 'ok';

  // DB check
  try {
    await db.query('SELECT 1');
    checks.db = 'ok';
  } catch (e) {
    checks.db = `error: ${String(e)}`;
    overallStatus = 'degraded';
  }

  // LiveKit check
  try {
    await roomService.listRooms();
    checks.livekit = 'ok';
  } catch (e) {
    checks.livekit = `error: ${String(e)}`;
    overallStatus = 'degraded';
  }

  // Redis check (via BullMQ or direct)
  try {
    const { redis } = await import('@/lib/redis');
    await redis.ping();
    checks.redis = 'ok';
  } catch (e) {
    checks.redis = `error: ${String(e)}`;
    overallStatus = 'degraded';
  }

  return NextResponse.json({
    status: overallStatus,
    db: checks.db,
    redis: checks.redis,
    livekit: checks.livekit,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
  });
}
