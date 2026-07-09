import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/{transmittalId}/{filename}
 *
 * Serves an uploaded file from the persistent storage directory
 * (/home/z/my-project/storage/uploads/{transmittalId}/{filename}).
 *
 * This route is required because in Next.js standalone production mode,
 * files written to `public/` at runtime are NOT served as static assets
 * (public/ is copied at build time only). Serving via an API route works
 * in both dev and production.
 *
 * Supports range requests (partial content) for video/audio/PDF streaming.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transmittalId: string; filename: string }> },
) {
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

  const absPath = path.join(getStorageRoot(), 'uploads', transmittalId, filename);
  if (!absPath.startsWith(getStorageRoot())) {
    return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 });
  }
  if (!existsSync(absPath)) {
    return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(absPath);
  } catch {
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
  }

  // Determine MIME type from extension
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.json': 'application/json',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Check for Range header (streaming support for large files / videos / PDFs)
  const rangeHeader = req.headers.get('range');
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (match) {
      const startStr = match[1];
      const endStr = match[2];
      const fileSize = stat.size;
      let start = startStr ? parseInt(startStr, 10) : 0;
      let end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }
      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;
      const buf = await readFile(absPath);
      const chunk = buf.subarray(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=86400',
        },
      });
    }
  }

  // Full file response
  const buffer = await readFile(absPath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '_')}"`,
    },
  });
}
