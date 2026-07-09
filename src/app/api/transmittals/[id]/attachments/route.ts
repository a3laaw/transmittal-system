import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot, migrateLegacyFilePath } from '@/lib/paths';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transmittals/[id]/attachments — list all attachments for a transmittal
 * Migrates legacy filePaths (/uploads/...) to new format (/api/files/...) on the fly.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.attachment.findMany({
    where: { transmittalId: id },
    orderBy: { createdAt: 'desc' },
  });
  // Migrate legacy paths for backwards compatibility
  const migrated = items.map((it) => ({
    ...it,
    filePath: it.filePath ? migrateLegacyFilePath(it.filePath) : it.filePath,
  }));
  return NextResponse.json({ items: migrated });
}

/**
 * DELETE /api/transmittals/[id]/attachments?attId=xxx — delete an attachment
 * Also removes the physical file from storage if it was an uploaded file.
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
  if (att.filePath && att.filePath.startsWith('/api/files/')) {
    // New format: /api/files/{transmittalId}/{filename}
    const rel = att.filePath.replace(/^\/api\/files\//, '');
    const absPath = path.join(getStorageRoot(), 'uploads', rel);
    if (absPath.startsWith(getStorageRoot()) && existsSync(absPath)) {
      try { await unlink(absPath); } catch { /* ignore */ }
    }
  } else if (att.filePath && att.filePath.startsWith('/uploads/')) {
    // Legacy format: /uploads/{transmittalId}/{filename}
    const rel = att.filePath.replace(/^\/uploads\//, '');
    const absPath = path.join(getStorageRoot(), 'uploads', rel);
    if (absPath.startsWith(getStorageRoot()) && existsSync(absPath)) {
      try { await unlink(absPath); } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ ok: true });
}
