import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (b.password !== '0160') return NextResponse.json({ error: 'Wrong' }, { status: 403 });
  await db.attachment.deleteMany({}); await db.review.deleteMany({}); await db.revision.deleteMany({});
  await db.transmittal.updateMany({ data: { parentTransmittalId: null } });
  const t = await db.transmittal.count(); await db.transmittal.deleteMany({});
  return NextResponse.json({ ok: true, wiped: { transmittals: t } });
}
