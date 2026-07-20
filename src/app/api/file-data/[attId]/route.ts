import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/file-data/[attId]
 * Returns file content as base64 data URL.
 * The browser can download it directly without any server proxy issues.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attId: string }> },
) {
  try {
    const { attId } = await params;
    if (!attId) {
      return NextResponse.json({ error: 'معرف المرفق مطلوب' }, { status: 400 });
    }

    const att = await db.attachment.findUnique({ where: { id: attId } });
    if (!att) {
      return NextResponse.json({ error: 'المرفق غير موجود' }, { status: 404 });
    }

    if (!att.filePath) {
      return NextResponse.json({ error: 'مسار الملف غير موجود' }, { status: 404 });
    }

    // Extract relative path from filePath (strip /api/files/ prefix)
    // Supports two formats:
    //   Old: /api/files/{transmittalId}/{filename}        → uploads/{transmittalId}/{filename}
    //   New: /api/files/{cat}/{disc}/{id}/{filename}      → uploads/{cat}/{disc}/{id}/{filename}
    const match = att.filePath.match(/\/api\/files\/(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 });
    }

    const relPath = match[1]; // "cat/disc/id/filename" OR "id/filename"
    const storageRoot = getStorageRoot();
    const absPath = path.join(storageRoot, 'uploads', ...relPath.split('/'));

    let resolvedPath = absPath;
    if (!existsSync(absPath)) {
      // Try legacy paths (old install locations) — backwards compat
      const parts = relPath.split('/');
      const legacyCandidates: string[] = [];
      // Try last 2 parts as {transmittalId}/{filename} (old format)
      if (parts.length >= 2) {
        const transmittalId = parts[parts.length - 2];
        const filename = parts[parts.length - 1];
        legacyCandidates.push(
          path.join(storageRoot, 'uploads', transmittalId, filename),
          path.join(process.cwd(), 'public', 'uploads', transmittalId, filename),
          path.join(process.cwd(), 'storage', 'uploads', transmittalId, filename),
        );
      }
      const found = legacyCandidates.find(p => existsSync(p));
      if (found) {
        resolvedPath = found;
      } else {
        return NextResponse.json({
          error: 'الملف غير موجود على القرص',
          searched: [absPath, ...legacyCandidates],
          storedPath: att.filePath,
          storageRoot,
        }, { status: 404 });
      }
    }

    const buffer = await readFile(resolvedPath);
    const base64 = buffer.toString('base64');

    // Determine MIME type
    const filename = relPath.split('/').pop() || 'download';
    const ext = path.extname(att.fileName || filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      ok: true,
      fileName: att.fileName,
      mimeType,
      size: buffer.length,
      dataUrl,
    });
  } catch (e: any) {
    console.error('[file-data] Error:', e.message, e.stack);
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
  }
}
