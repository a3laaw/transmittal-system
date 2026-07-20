import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.transmittal.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const b = await req.json(); const { url, fileName, urlSource } = b;
    if (!url || !fileName) return NextResponse.json({ error: 'Required' }, { status: 400 });
    return NextResponse.json(await db.attachment.create({ data: { transmittalId: id, fileName: String(fileName).trim(), filePath: '', fileType: '', fileSize: 0, url: String(url).trim(), urlSource: urlSource || 'link' } }), { status: 201 });
  }
  if (!ct.includes('multipart/form-data')) return NextResponse.json({ error: 'Unsupported' }, { status: 400 });
  const form = await req.formData(); const file = form.get('file') as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const safeName = String(file.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0, 200);
  const cat = t.category || 'TRANSMITTAL'; const disc = t.disciplineCode || t.discipline || 'UNKNOWN';
  const sr = (process.env.CUSTOM_STORAGE_PATH || '') || getStorageRoot();
  const dir = path.join(sr, 'uploads', cat, disc, id);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  let fn = safeName, i = 1;
  while (existsSync(path.join(dir, fn))) { const e = path.extname(safeName); fn = `${path.basename(safeName, e)}_${i}${e}`; i++; }
  await writeFile(path.join(dir, fn), new Uint8Array(await file.arrayBuffer()));
  // Store RELATIVE path from storage root so file-data API can resolve it
  // Format: /api/files/{cat}/{disc}/{id}/{filename}
  const url = `/api/files/${cat}/${disc}/${id}/${fn}`;
  return NextResponse.json(await db.attachment.create({ data: { transmittalId: id, fileName: file.name, filePath: url, fileType: file.type || path.extname(file.name).slice(1), fileSize: file.size } }), { status: 201 });
}
