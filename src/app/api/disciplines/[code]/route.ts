import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/disciplines/[code]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const { label, color, prefix, category } = body;

  const existing = await db.discipline.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
  }

  // If category is changing, update all transmittals of this discipline too
  if (category && category !== existing.categoryCode) {
    // Verify new category exists
    const cat = await db.category.findUnique({ where: { code: category } });
    if (!cat) {
      return NextResponse.json({ error: `القسم الرئيسي ${category} غير موجود` }, { status: 400 });
    }
    await db.transmittal.updateMany({
      where: { discipline: code },
      data: { category },
    });
  }

  const d = await db.discipline.update({
    where: { code },
    data: {
      ...(label !== undefined && { label: String(label).trim() }),
      ...(color !== undefined && { color }),
      ...(prefix !== undefined && { prefix: String(prefix).trim() }),
      ...(category !== undefined && { categoryCode: category }),
    },
  });
  return NextResponse.json({ ...d, category: d.categoryCode });
}

// DELETE /api/disciplines/[code]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const count = await db.transmittal.count({ where: { discipline: code } });
  if (count > 0) {
    return NextResponse.json(
      { error: `لا يمكن حذف القسم ${code} لأن هناك ${count} ترانسميتال مرتبط به` },
      { status: 400 }
    );
  }
  await db.discipline.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
