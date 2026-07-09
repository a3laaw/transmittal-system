import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/transmittals/[id]/upload
 *
 * Two modes:
 * 1. File upload — multipart/form-data with field "file"
 *    Saves the file under /public/uploads/{transmittalId}/ and creates an Attachment record.
 * 2. External link — application/json body { url, fileName, urlSource }
 *    Creates an Attachment record pointing to the external URL.
 *
 * Files are served statically from /uploads/... so they work in PWA / offline mode.
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

  // Build a safe filename: keep word chars, dots, dashes, Arabic, underscores
  const safeName = (file.name || 'file')
    .replace(/[^\w.\u0600-\u06FF-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  const relDir = path.join('uploads', id);
  const absDir = path.join(process.cwd(), 'public', relDir);
  if (!existsSync(absDir)) await mkdir(absDir, { recursive: true });

  const fileName = `${Date.now()}-${safeName}`;
  const absPath = path.join(absDir, fileName);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(absPath, bytes);

  // Public path served by Next.js static handler
  const publicPath = `/${relDir.replace(/\\/g, '/')}/${fileName}`;

  const att = await db.attachment.create({
    data: {
      transmittalId: id,
      fileName: file.name || fileName,
      filePath: publicPath,
      fileType: file.type || '',
      fileSize: file.size,
      url: null,
      urlSource: null,
    },
  });

  return NextResponse.json({ ok: true, attachment: att });
}
