import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/types
 * Returns distinct types used across all transmittals (for the filter dropdown).
 */
export async function GET() {
  const results = await db.transmittal.findMany({
    where: { NOT: { type: null } },
    distinct: ['type'],
    select: { type: true },
  });
  const types = results
    .map(r => r.type!.trim())
    .filter(t => t.length > 0)
    .sort();
  return NextResponse.json({ items: types });
}
