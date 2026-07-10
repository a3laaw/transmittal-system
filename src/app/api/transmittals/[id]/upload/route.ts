import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/transmittals/[id]/upload
 *
 * Two modes:
 * 1. File upload — multipart/form-data with field "file"
 *    Saves the file to /home/z/my-project/storage/uploads/{transmittalId}/
 *    (NOT in public/ — that doesn't work in standalone production mode).
 *    Files are served via /api/files/{transmittalId}/{filename}.
 * 2. External link — application/json body { url, fileName, urlSource }
 *    Creates an Attachment record pointing to the external URL.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify transmittal exists
  const transmittal = await db.transmittal.findUnique({ where: { id } });
  if (!transmittal) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') || '';

  // ---------- Mode 2: External link (JSON body) ----------
  if (contentType.includes('application/json')) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 });
    }
    const { url, fileName, urlSource } = body as {
      url?: string; fileName?: string; urlSource?: string;
    };
    if (!url || !fileName) {
      return NextResponse.json({ error: 'الرابط واسم الملف مطلوبان' }, { status: 400 });
    }
    const att = await db.attachment.create({
      data: {
        transmittalId: id,
        fileName: String(fileName).slice(0, 255),
        url: String(url),
        urlSource: String(urlSource || 'link'),
        filePath: '',
        fileType: '',
        fileSize: 0,
      },
    });
    return NextResponse.json({ ok: true, attachment: att });
  }

  // ---------- Mode 1: File upload (FormData) ----------
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'نوع المحتوى غير مدعوم — استخدم multipart/form-data أو application/json' },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'فشل قراءة البيانات' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
  }

  // Size guard — 25 MB max
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'حجم الملف يتجاوز 25 ميجابايت' }, { status: 413 });
  }

  // Type guard — only images, PDF, and Word documents allowed
  const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.pdf', '.doc', '.docx'];
  const ext = path.extname(file.name || '').toLowerCase();
  const isImage = file.type && file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || ext === '.pdf';
  const isWord = file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.doc' || ext === '.docx';
  if (!isImage && !isPdf && !isWord && !ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: 'نوع الملف غير مدعوم. يُسمح فقط بالصور (PNG, JPG, GIF, WebP) و PDF و Word' },
      { status: 415 },
    );
  }

  // Build a safe filename: keep word chars, dots, dashes, Arabic, underscores
  const safeName = (file.name || 'file')
    .replace(/[^\w.\u0600-\u06FF-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  const relDir = path.join('uploads', id);
  const absDir = path.join(getStorageRoot(), relDir);
  if (!existsSync(absDir)) await mkdir(absDir, { recursive: true });

  const fileName = `${Date.now()}-${safeName}`;
  const absPath = path.join(absDir, fileName);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(absPath, bytes);

  // Determine MIME type — use browser-provided type, fall back to extension
  let fileType = file.type || '';
  if (!fileType) {
    const ext = path.extname(file.name || '').toLowerCase();
    const extMimes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
    };
    if (extMimes[ext]) fileType = extMimes[ext];
  }

  // Public URL — served via /api/files/{id}/{filename} (works in dev & standalone production)
  const publicPath = `/api/files/${id}/${fileName}`;

  const att = await db.attachment.create({
    data: {
      transmittalId: id,
      fileName: file.name || fileName,
      filePath: publicPath,
      fileType: fileType,
      fileSize: file.size,
      url: null,
      urlSource: null,
    },
  });

  return NextResponse.json({ ok: true, attachment: att });
}
