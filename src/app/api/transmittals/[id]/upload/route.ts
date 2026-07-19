import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot, getUploadDir, filePathToApiUrl } from '@/lib/paths';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transmittals/[id]/upload
 *
 * Two modes:
 *  1. multipart/form-data — file upload (field name: "file")
 *     Saves the file to storage/uploads/{transmittalId}/{filename}
 *     Each transmittal gets its OWN folder named by its reference (sanitized).
 *
 *  2. application/json — link attachment (url, fileName, urlSource)
 *     No file is saved; only a database record is created.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify transmittal exists
  const t = await db.transmittal.findUnique({ where: { id } });
  if (!t) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') || '';

  // Mode 2: JSON (link attachment)
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { url, fileName, urlSource } = body;
    if (!url || !fileName) {
      return NextResponse.json({ error: 'URL and fileName are required' }, { status: 400 });
    }
    const att = await db.attachment.create({
      data: {
        transmittalId: id,
        fileName: String(fileName).trim(),
        filePath: '',
        fileType: '',
        fileSize: 0,
        url: String(url).trim(),
        urlSource: urlSource || 'link',
      },
    });
    return NextResponse.json(att, { status: 201 });
  }

  // Mode 1: multipart/form-data (file upload)
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Sanitize filename — keep extension, replace problematic chars
  const safeName = String(file.name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);

  // Build folder path: storage/uploads/{transmittalId}/{filename}
  // Each transmittal gets its OWN folder for clean organization
  const uploadDir = getUploadDir(id);
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  // Avoid filename collisions — if exists, append counter
  let finalName = safeName;
  let counter = 1;
  while (existsSync(path.join(uploadDir, finalName))) {
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    finalName = `${base}_${counter}${ext}`;
    counter++;
  }

  const absPath = path.join(uploadDir, finalName);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(absPath, bytes);

  // Build API URL for serving — use /api/files/{transmittalId}/{filename}
  // This matches the existing /api/files/[transmittalId]/[filename] route
  const apiUrl = `/api/files/${id}/${finalName}`;

  // Save attachment record in DB
  const att = await db.attachment.create({
    data: {
      transmittalId: id,
      fileName: file.name, // keep original name in DB for display
      filePath: apiUrl,
      fileType: file.type || path.extname(file.name).slice(1),
      fileSize: file.size,
      url: null,
      urlSource: null,
    },
  });

  return NextResponse.json(att, { status: 201 });
}
