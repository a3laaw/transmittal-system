import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transmittals/[id]/upload
 *
 * Two modes:
 * 1. File upload (FormData) → saves to Supabase Storage
 * 2. External link (JSON) → stores URL only
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

  // --- Mode 1: File upload (FormData) → Supabase Storage ---
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 });
  }

  // Try Supabase Storage first (for Vercel production)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    // Use Supabase Storage
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Ensure bucket exists
      const { error: bucketError } = await supabase.storage.createBucket('attachments', { public: true });
      if (bucketError && !bucketError.message.includes('already exists')) {
        throw new Error(`Bucket: ${bucketError.message}`);
      }

      // Upload file
      const ext = file.name.split('.').pop() || '';
      const uniqueName = `${id}/${Date.now()}-${file.name}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(uniqueName, buffer, {
          contentType: file.type || '',
          upsert: false,
        });

      if (error) throw new Error(`Upload: ${error.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(uniqueName);

      const att = await db.attachment.create({
        data: {
          transmittalId: id,
          fileName: file.name,
          filePath: urlData.publicUrl,
          fileType: file.type || ext,
          fileSize: file.size,
          url: urlData.publicUrl,
          urlSource: 'supabase',
        },
      });

      return NextResponse.json(att, { status: 201 });
    } catch (e: any) {
      console.error('Supabase Storage error:', e.message);
      // Fall through to local storage
    }
  }

  // Fallback: Local filesystem (works in dev, not on Vercel)
  const { writeFile, mkdir } = await import('fs/promises');
  const { existsSync } = await import('fs');
  const path = await import('path');

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
