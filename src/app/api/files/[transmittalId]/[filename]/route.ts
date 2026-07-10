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
 * Falls back to legacy /public/uploads/{transmittalId}/{filename} for files
 * uploaded before the storage migration.
 *
 * This route is required because in Next.js standalone production mode,
 * files written to `public/` at runtime are NOT served as static assets
 * (public/ is copied at build time only). Serving via an API route works
 * in both dev and production.
 *
 * Supports range requests (partial content) for video/audio/PDF streaming.
 * Detects MIME type from magic bytes (most reliable) with extension fallback.
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
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(resolvedPath);
  } catch {
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
  }

  // Determine MIME type — prefer magic bytes (most reliable), fall back to extension
  const ext = path.extname(filename).toLowerCase();
  const mimeByExt: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
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

  // Read first few bytes to detect by magic bytes
  let contentType = mimeByExt[ext] || 'application/octet-stream';
  let buffer: Buffer;
  try {
    buffer = await readFile(resolvedPath);
  } catch {
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 500 });
  }
  // Magic-byte detection (first 8 bytes)
  if (buffer.length >= 4) {
    const b = buffer;
    const hex4 = b.subarray(0, 4).toString('hex');
    const hex8 = b.subarray(0, 8).toString('hex');
    if (hex4 === '89504e47') contentType = 'image/png';
    else if (hex4 === 'ffd8ffe0' || hex4 === 'ffd8ffe1' || hex4 === 'ffd8ffe2' || hex4 === 'ffd8ffe3' || hex4 === 'ffd8ffdb') contentType = 'image/jpeg';
    else if (hex8 === '474946383961' || hex8 === '474946383761') contentType = 'image/gif';
    else if (hex8 === '52494646' && b.subarray(8, 12).toString('ascii') === 'WEBP') contentType = 'image/webp';
    else if (hex4 === '25504446') contentType = 'application/pdf'; // %PDF
    else if (hex4 === '504b0304') contentType = 'application/zip'; // PK..
    else if (hex8 === 'd0cf11e0a1b11ae1') contentType = 'application/vnd.ms-office'; // MS Office legacy
    else if (hex4 === '424d') contentType = 'image/bmp'; // BM
    else if (hex8 === '0000002066747970' || hex8.startsWith('000000')) {
      // MP4 family: ftyp box at offset 4
      if (b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp') contentType = 'video/mp4';
    }
    else if (hex4 === '494433' || hex4 === 'fffb') contentType = 'audio/mpeg'; // ID3 or MP3 frame
  }

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
      const chunk = buffer.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  // Full file response
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '_')}"`,
    },
  });
}
