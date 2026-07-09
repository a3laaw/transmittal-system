import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/categories/[code]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const { label, icon, color } = body;

  const existing = await db.category.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
  }

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
  await db.category.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
