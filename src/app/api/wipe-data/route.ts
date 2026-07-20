import { NextRequest, NextResponse } from 'next/server';
import { db, ensureMigrations } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password !== '0160') return NextResponse.json({ error: 'Wrong password' }, { status: 403 });
    await ensureMigrations();
    const a = await db.attachment.count(); await db.attachment.deleteMany({});
    const r = await db.review.count(); await db.review.deleteMany({});
    const rv = await db.revision.count(); await db.revision.deleteMany({});
    await db.transmittal.updateMany({ data: { parentTransmittalId: null } });
    const t = await db.transmittal.count(); await db.transmittal.deleteMany({});
    return NextResponse.json({ ok: true, wiped: { transmittals: t, revisions: rv, reviews: r, attachments: a } });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
