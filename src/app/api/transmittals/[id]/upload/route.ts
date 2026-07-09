import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transmittals/[id]/upload
 *
 * Two modes:
 * 1. File upload (FormData with file=) → saves to /public/uploads/transmittals/{id}/
 * 2. External link (JSON with url, fileName, urlSource) → stores URL only
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const t = await db.transmittal.findUnique({ where: { id } });
  if (!t) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') || '';

  // --- Mode 2: External link (JSON) ---
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { url, fileName, urlSource } = body;

    if (!url || !fileName) {
      return NextResponse.json({ error: 'الرابط واسم الملف مطلوبان' }, { status: 400 });
    }

    // Detect source from URL if not provided
    let source = urlSource || 'link';
    const urlLower = url.toLowerCase();
    if (urlLower.includes('github.com') || urlLower.includes('raw.githubusercontent.com')) source = 'github';
    else if (urlLower.includes('supabase')) source = 'supabase';
    else if (urlLower.includes('vercel') || urlLower.includes('now.sh')) source = 'vercel';

    const att = await db.attachment.create({
      data: {
        transmittalId: id,
        fileName,
        filePath: '',
        fileType: '',
        fileSize: 0,
        url,
        urlSource: source,
      },
    });
    return NextResponse.json(att, { status: 201 });
  }

  // --- Mode 1: File upload (FormData) ---
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'transmittals', id);
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext);
  const uniqueName = `${baseName}-${Date.now()}${ext}`;
  const fullPath = path.join(uploadDir, uniqueName);
  const relativePath = `/uploads/transmittals/${id}/${uniqueName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const att = await db.attachment.create({
    data: {
      transmittalId: id,
      fileName: file.name,
      filePath: relativePath,
      fileType: file.type || ext,
      fileSize: file.size,
      url: null,
      urlSource: null,
    },
  });

  return NextResponse.json(att, { status: 201 });
}
