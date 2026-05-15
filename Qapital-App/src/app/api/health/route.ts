import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Simple health check endpoint for monitoring (e.g., UptimeRobot).
 * Returns {"status":"ok","timestamp":"..."} when the app is running.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
