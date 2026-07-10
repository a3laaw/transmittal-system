import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

// GET /api/categories — list all categories with discipline + transmittal counts
export async function GET() {
  const items = await db.category.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: {
        select: { disciplines: true, transmittals: true },
      },
    },
  });
  return NextResponse.json({
    items: items.map(c => ({
      id: c.id,
      code: c.code,
      label: c.label,
      icon: c.icon,
      color: c.color,
      excelTemplate: c.excelTemplate,
      disciplinesCount: c._count.disciplines,
      transmittalsCount: c._count.transmittals,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

// POST /api/categories — create new category (with optional Excel template upload)
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  // If multipart/form-data, handle file upload
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const code = String(form.get('code') || '').toUpperCase().trim();
    const label = String(form.get('label') || '').trim();
    const icon = String(form.get('icon') || '📄');
    const color = String(form.get('color') || 'bg-blue-100 text-blue-700');
    const file = form.get('excelTemplate') as File | null;

    if (!code || !label) {
      return NextResponse.json({ error: 'الكود والاسم مطلوبان' }, { status: 400 });
    }

    let excelTemplate: string | null = null;

    // Save uploaded template
    if (file && file instanceof File) {
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

    try {
      const c = await db.category.create({
        data: { code, label, icon, color, excelTemplate },
      });
      return NextResponse.json(c, { status: 201 });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return NextResponse.json({ error: `كود القسم ${code} موجود مسبقاً` }, { status: 409 });
      }
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // JSON body (no file)
  const body = await req.json();
  const { code, label, icon, color } = body;
  if (!code || !label) {
    return NextResponse.json({ error: 'الكود والاسم مطلوبان' }, { status: 400 });
  }
  const codeUpper = String(code).toUpperCase().trim();
  try {
    const c = await db.category.create({
      data: {
        code: codeUpper,
        label: String(label).trim(),
        icon: icon || '📄',
        color: color || 'bg-blue-100 text-blue-700',
      },
    });
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: `كود القسم ${codeUpper} موجود مسبقاً` }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
