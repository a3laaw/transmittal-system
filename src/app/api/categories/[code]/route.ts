import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

// PATCH /api/categories/[code] — update category (with optional template upload)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const existing = await db.category.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') || '';

  // Handle multipart/form-data (file upload)
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const label = form.get('label') as string | null;
    const icon = form.get('icon') as string | null;
    const color = form.get('color') as string | null;
    const file = form.get('excelTemplate') as File | null;
    const removeTemplate = form.get('removeTemplate') === 'true';

    let excelTemplate = existing.excelTemplate;

    // Remove template
    if (removeTemplate) {
      excelTemplate = null;
      // Delete file from disk
      const storageRoot = getStorageRoot();
      const filePath = path.join(storageRoot, 'templates', `${code}.xlsx`);
      if (existsSync(filePath)) {
        try { await unlink(filePath); } catch {}
      }
    }

    // Save new template
    if (file && file instanceof File && file.size > 0) {
      const ext = path.extname(file.name).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xlsm') {
        return NextResponse.json({ error: 'قالب Excel يجب أن يكون ملف .xlsx أو .xlsm' }, { status: 400 });
      }
      const storageRoot = getStorageRoot();
      const templatesDir = path.join(storageRoot, 'templates');
      if (!existsSync(templatesDir)) await mkdir(templatesDir, { recursive: true });
      const fileName = `${code}.xlsx`;
      const absPath = path.join(templatesDir, fileName);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeFile(absPath, bytes);
      excelTemplate = `/api/templates/${code}`;
    }

    const c = await db.category.update({
      where: { code },
      data: {
        ...(label !== null && label !== undefined && { label: String(label).trim() }),
        ...(icon !== null && icon !== undefined && { icon }),
        ...(color !== null && color !== undefined && { color }),
        excelTemplate,
      },
    });
    return NextResponse.json(c);
  }

  // JSON body (no file)
  const body = await req.json();
  const { label, icon, color } = body;

  const c = await db.category.update({
    where: { code },
    data: {
      ...(label !== undefined && { label: String(label).trim() }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
    },
  });
  return NextResponse.json(c);
}

// DELETE /api/categories/[code]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Check if there are disciplines or transmittals linked
  const [discCount, transCount] = await Promise.all([
    db.discipline.count({ where: { categoryCode: code } }),
    db.transmittal.count({ where: { category: code } }),
  ]);
  if (discCount > 0 || transCount > 0) {
    return NextResponse.json(
      { error: `لا يمكن حذف القسم ${code} لأن هناك ${discCount} تخصص و ${transCount} ترانسميتال مرتبط به` },
      { status: 400 }
    );
  }
  // Delete template file if exists
  const storageRoot = getStorageRoot();
  const filePath = path.join(storageRoot, 'templates', `${code}.xlsx`);
  if (existsSync(filePath)) {
    try { await unlink(filePath); } catch {}
  }
  await db.category.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
