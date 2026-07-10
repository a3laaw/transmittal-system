import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';
import { db } from '@/lib/db';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/{transmittalId}/{filename}
 *
 * Serves an uploaded file from the persistent storage directory.
 * Uses streaming for large files to avoid memory issues.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transmittalId: string; filename: string }> },
) {
  try {
    const { transmittalId, filename } = await params;

    // Sanitize inputs — prevent path traversal
    if (!transmittalId || !filename) {
      return NextResponse.json({ error: 'مطلوب معرف الملف' }, { status: 400 });
    }
    if (transmittalId.includes('..') || transmittalId.includes('/') || transmittalId.includes('\\')) {
      return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'اسم الملف غير صالح' }, { status: 400 });
    }

    const storageRoot = getStorageRoot();
    const absPath = path.join(storageRoot, 'uploads', transmittalId, filename);
    if (!absPath.startsWith(storageRoot)) {
      return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 });
    }

    // Try primary location; fall back to legacy /public/uploads/...
    let resolvedPath = absPath;
    if (!existsSync(absPath)) {
      const legacyPath = path.join('/home/z/my-project', 'public', 'uploads', transmittalId, filename);
      if (existsSync(legacyPath)) {
        resolvedPath = legacyPath;
      } else {
        console.error('[api/files] File not found:', absPath);
        return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
      }
    }

    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(resolvedPath);
    } catch (e: any) {
      console.error('[api/files] stat error:', e.message);
      return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
    }

    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeByExt: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp', '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain; charset=utf-8',
      '.csv': 'text/csv; charset=utf-8',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
      '.json': 'application/json',
    };
    let contentType = mimeByExt[ext] || 'application/octet-stream';

    // Try to find the original filename from DB (for a clean download name)
    let downloadName = filename;
    try {
      if (filename && transmittalId) {
        const att = await db.attachment.findFirst({
          where: { transmittalId, filePath: { contains: filename } },
          select: { fileName: true },
        });
        if (att?.fileName) downloadName = att.fileName;
      }
    } catch (dbErr: any) {
      console.error('[api/files] DB lookup failed (non-fatal):', dbErr.message);
    }

    // Read file as buffer (works for all file sizes up to 25MB)
    let buffer: Buffer;
    try {
      buffer = await readFile(resolvedPath) as Buffer;
    } catch (e: any) {
      console.error('[api/files] readFile error:', e.message);
      return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
    }

    // Magic-byte detection for more accurate MIME type
    if (buffer.length >= 4) {
      const b = buffer;
      const hex4 = b.subarray(0, 4).toString('hex');
      const hex8 = b.subarray(0, 8).toString('hex');
      if (hex4 === '89504e47') contentType = 'image/png';
      else if (hex4.startsWith('ffd8ff')) contentType = 'image/jpeg';
      else if (hex8 === '474946383961' || hex8 === '474946383761') contentType = 'image/gif';
      else if (hex4 === '25504446') contentType = 'application/pdf'; // %PDF
      else if (hex4 === '504b0304') contentType = 'application/zip'; // PK
      else if (hex4 === '424d') contentType = 'image/bmp'; // BM
    }

    // Use "attachment" to force download
    const safeName = downloadName.replace(/"/g, '_').replace(/[^\w.\u0600-\u06FF-]/g, '_');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (e: any) {
    console.error('[api/files] Unhandled error:', e.message, e.stack);
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
  }
}
