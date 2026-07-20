import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/download/[attId]
 *
 * Simple download endpoint that serves a file by attachment ID.
 * Uses application/octet-stream to avoid any content-type blocking.
 * Forces download with Content-Disposition: attachment.
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

    // Get attachment from DB
    const att = await db.attachment.findUnique({ where: { id: attId } });
    if (!att) {
      return NextResponse.json({ error: 'المرفق غير موجود' }, { status: 404 });
    }

    if (!att.filePath) {
      return NextResponse.json({ error: 'مسار الملف غير موجود' }, { status: 404 });
    }

    // Extract relative path from filePath (strip /api/files/ prefix)
    // Supports: /api/files/{cat}/{disc}/{id}/{filename} OR /api/files/{id}/{filename}
    const match = att.filePath.match(/\/api\/files\/(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 });
    }

    const relPath = match[1];
    const storageRoot = getStorageRoot();
    const absPath = path.join(storageRoot, 'uploads', ...relPath.split('/'));

    let resolvedPath = absPath;
    if (!existsSync(absPath)) {
      // Try legacy paths
      const parts = relPath.split('/');
      const legacyCandidates: string[] = [];
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
      if (!found) {
        return NextResponse.json({
          error: 'الملف غير موجود على القرص',
          searched: [absPath, ...legacyCandidates],
          storedPath: att.filePath,
        }, { status: 404 });
      }
      resolvedPath = found;
    }

    // Read file
    const buffer = await readFile(resolvedPath) as Buffer;
    const stat = statSync(resolvedPath);

    // Use application/octet-stream to avoid any content-type blocking
    const filename = relPath.split('/').pop() || 'download';
    const safeName = (att.fileName || filename).replace(/[^\w.\u0600-\u06FF-]/g, '_');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (e: any) {
    console.error('[download] Error:', e.message, e.stack);
    return NextResponse.json({ error: 'تعذّر تنزيل الملف' }, { status: 500 });
  }
}
