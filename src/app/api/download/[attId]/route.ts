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

    // Extract transmittalId and filename from filePath
    // filePath format: /api/files/{transmittalId}/{filename}
    const match = att.filePath.match(/\/api\/files\/([^/]+)\/(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 });
    }

    const [, transmittalId, filename] = match;
    const storageRoot = getStorageRoot();
    const absPath = path.join(storageRoot, 'uploads', transmittalId, filename);

    if (!existsSync(absPath)) {
      // Try legacy path
      const legacyPath = path.join('/home/z/my-project', 'public', 'uploads', transmittalId, filename);
      if (!existsSync(legacyPath)) {
        return NextResponse.json({ error: 'الملف غير موجود على القرص' }, { status: 404 });
      }
    }

    const resolvedPath = existsSync(absPath) ? absPath : path.join('/home/z/my-project', 'public', 'uploads', transmittalId, filename);

    // Read file
    const buffer = await readFile(resolvedPath) as Buffer;
    const stat = statSync(resolvedPath);

    // Use application/octet-stream to avoid any content-type blocking
    // Force download with attachment disposition
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
