import { NextRequest, NextResponse } from 'next/server';
import { db, ensureMigrations } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wipe-data
 * Body: { password: '0160' }
 *
 * Wipes all transmittals, revisions, reviews, and attachments.
 * Categories, disciplines, and doc-types are KEPT (they're configuration).
 *
 * Also removes physical files in storage/uploads/* (best-effort).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password !== '0160') {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 403 });
    }
    await ensureMigrations();

    const a = await db.attachment.count();
    await db.attachment.deleteMany({});
    const r = await db.review.count();
    await db.review.deleteMany({});
    const rv = await db.revision.count();
    await db.revision.deleteMany({});
    // Clear parent links before deleting transmittals (FK constraint)
    await db.transmittal.updateMany({ data: { parentTransmittalId: null } });
    const t = await db.transmittal.count();
    await db.transmittal.deleteMany({});

    // Best-effort: clear physical uploads directory
    try {
      const { getStorageRoot } = await import('@/lib/paths');
      const storageRoot = getStorageRoot();
      const uploadsDir = storageRoot + '/uploads';
      const fs = await import('fs/promises');
      const { existsSync } = await import('fs');
      if (existsSync(uploadsDir)) {
        await fs.rm(uploadsDir, { recursive: true, force: true });
        await fs.mkdir(uploadsDir, { recursive: true });
      }
    } catch {
      // ignore file system errors
    }

    return NextResponse.json({
      ok: true,
      wiped: { transmittals: t, revisions: rv, reviews: r, attachments: a },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
