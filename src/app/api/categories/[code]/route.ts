import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir, unlink, readdir } from 'fs/promises';
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
    const labelEn = form.get('labelEn') as string | null;
    const icon = form.get('icon') as string | null;
    const color = form.get('color') as string | null;
    const file = form.get('template') as File | null;
    const removeTemplate = form.get('removeTemplate') === 'true';

    let templatePath = existing.templatePath;
    let templateType = existing.templateType;

    // Remove template
    if (removeTemplate) {
      templatePath = null;
      templateType = null;
      // Delete file from disk (try all extensions)
      const storageRoot = getStorageRoot();
      const templatesDir = path.join(storageRoot, 'templates');
      if (existsSync(templatesDir)) {
        try {
          const files = await readdir(templatesDir);
          for (const f of files) {
            if (f.startsWith(`${code}.`)) {
              await unlink(path.join(templatesDir, f));
            }
          }
        } catch {}
      }
    }

    // Save new template (any file type)
    if (file && file instanceof File && file.size > 0) {
      const ext = path.extname(file.name).toLowerCase().replace('.', '');
      const allowedTypes = ['xlsx', 'xlsm', 'docx', 'doc', 'pdf', 'txt'];
      if (!allowedTypes.includes(ext)) {
        return NextResponse.json(
          { error: `نوع القالب غير مدعوم. الأنواع المدعومة: ${allowedTypes.join(', ')}` },
          { status: 400 },
        );
      }
      const storageRoot = getStorageRoot();
      const templatesDir = path.join(storageRoot, 'templates');
      if (!existsSync(templatesDir)) await mkdir(templatesDir, { recursive: true });
      // Delete old template file (any extension)
      if (existsSync(templatesDir)) {
        try {
          const files = await readdir(templatesDir);
          for (const f of files) {
            if (f.startsWith(`${code}.`)) {
              await unlink(path.join(templatesDir, f));
            }
          }
        } catch {}
      }
      const fileName = `${code}.${ext}`;
      const absPath = path.join(templatesDir, fileName);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeFile(absPath, bytes);
      templatePath = `/api/templates/${code}`;
      templateType = ext;
    }

    const c = await db.category.update({
      where: { code },
      data: {
        ...(label !== null && label !== undefined && { label: String(label).trim() }),
        ...(labelEn !== null && labelEn !== undefined && { labelEn: labelEn ? String(labelEn).trim() : null }),
        ...(icon !== null && icon !== undefined && { icon }),
        ...(color !== null && color !== undefined && { color }),
        templatePath,
        templateType,
      },
    });
    return NextResponse.json(c);
  }

  // JSON body (no file)
  const body = await req.json();
  const { label, labelEn, icon, color } = body;

  const c = await db.category.update({
    where: { code },
    data: {
      ...(label !== undefined && { label: String(label).trim() }),
      ...(labelEn !== undefined && { labelEn: labelEn ? String(labelEn).trim() : null }),
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
  // Delete template file if exists (any extension)
  const storageRoot = getStorageRoot();
  const templatesDir = path.join(storageRoot, 'templates');
  if (existsSync(templatesDir)) {
    try {
      const files = await readdir(templatesDir);
      for (const f of files) {
        if (f.startsWith(`${code}.`)) {
          await unlink(path.join(templatesDir, f));
        }
      }
    } catch {}
  }
  await db.category.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
