import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transmittal = await db.transmittal.findUnique({ where: { id } });
    if (!transmittal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const { url, fileName, urlSource } = body;
      if (!url || !fileName) return NextResponse.json({ error: 'url and fileName required' }, { status: 400 });
      const att = await db.attachment.create({ data: { transmittalId: id, fileName: String(fileName).slice(0,255), url: String(url), urlSource: String(urlSource||'link'), filePath: '', fileType: '', fileSize: 0 } });
      return NextResponse.json({ ok: true, attachment: att });
    }
    if (!contentType.includes('multipart/form-data')) return NextResponse.json({ error: 'Unsupported' }, { status: 400 });
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Failed to read' }, { status: 400 });
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'File required' }, { status: 400 });
    if (file.size > 25*1024*1024) return NextResponse.json({ error: 'Too large' }, { status: 413 });
    const ext = path.extname(file.name||'').toLowerCase();
    const allowed = ['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.pdf','.doc','.docx'];
    if (!allowed.includes(ext)) return NextResponse.json({ error: 'Type not allowed' }, { status: 415 });
    const safeName = (file.name||'file').replace(/[^\w.\u0600-\u06FF-]/g,'_').replace(/_+/g,'_').slice(0,100);
    const absDir = path.join(getStorageRoot(), 'uploads', id);
    if (!existsSync(absDir)) await mkdir(absDir, { recursive: true });
    const fileName = `${Date.now()}-${safeName}`;
    await writeFile(path.join(absDir, fileName), new Uint8Array(await file.arrayBuffer()));
    let fileType = file.type || '';
    if (!fileType) { const m: Record<string,string> = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.bmp':'image/bmp','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }; fileType = m[ext]||''; }
    const att = await db.attachment.create({ data: { transmittalId: id, fileName: file.name||fileName, filePath: `/api/files/${id}/${fileName}`, fileType, fileSize: file.size, url: null, urlSource: null } });
    return NextResponse.json({ ok: true, attachment: att });
  } catch (e: any) { console.error('[upload]', e.message); return NextResponse.json({ error: 'Upload failed' }, { status: 500 }); }
}
