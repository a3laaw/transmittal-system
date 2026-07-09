import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transmittals/[id]/attachments — list all attachments for a transmittal
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.attachment.findMany({
    where: { transmittalId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ items });
}

/**
 * DELETE /api/transmittals/[id]/attachments?attId=xxx — delete an attachment
 * Also removes the physical file from /public/uploads/... if it was an uploaded file.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const attId = searchParams.get('attId');
  if (!attId) return NextResponse.json({ error: 'attId required' }, { status: 400 });

  // Fetch first so we can delete the physical file too
  const att = await db.attachment.findFirst({
    where: { id: attId, transmittalId: id },
  });
  if (!att) {
    return NextResponse.json({ error: 'المرفق غير موجود' }, { status: 404 });
  }

  await db.attachment.delete({ where: { id: attId } });

  // Best-effort cleanup of the physical file
  if (att.filePath && att.filePath.startsWith('/uploads/')) {
    const absPath = path.join(process.cwd(), 'public', att.filePath);
    if (existsSync(absPath)) {
      try { await unlink(absPath); } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ ok: true });
}
