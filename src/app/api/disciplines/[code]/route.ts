import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const { label, labelEn, color, prefix, category, categories } = body;
  const existing = await db.discipline.findUnique({ where: { code }, include: { categories: true } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (category && category !== existing.categoryCode) {
    const cat = await db.category.findUnique({ where: { code: category } });
    if (!cat) return NextResponse.json({ error: `القسم ${category} غير موجود` }, { status: 400 });
    await db.transmittal.updateMany({ where: { discipline: code }, data: { category } });
  }
  if (Array.isArray(categories)) {
    const existingCatCodes = existing.categories.map(c => c.categoryCode);
    const toAdd = categories.filter((c: string) => c !== category && !existingCatCodes.includes(c));
    const toRemove = existingCatCodes.filter(c => c !== category && !categories.includes(c));
    if (toAdd.length > 0) {
      await db.disciplineCategory.deleteMany({ where: { disciplineId: existing.id, categoryCode: { in: toAdd } } });
      await db.disciplineCategory.createMany({ data: toAdd.map((c: string) => ({ disciplineId: existing.id, categoryCode: c })) });
    }
    if (toRemove.length > 0) {
      await db.disciplineCategory.deleteMany({ where: { disciplineId: existing.id, categoryCode: { in: toRemove } } });
    }
  }
  const d = await db.discipline.update({
    where: { code },
    data: {
      ...(label !== undefined && { label: String(label).trim() }),
      ...(labelEn !== undefined && { labelEn: labelEn ? String(labelEn).trim() : null }),
      ...(color !== undefined && { color }),
      ...(prefix !== undefined && { prefix: String(prefix).trim() }),
      ...(category !== undefined && { categoryCode: category }),
    },
    include: { categories: { select: { categoryCode: true } } },
  });
  return NextResponse.json({ ...d, category: d.categoryCode, allCategories: [d.categoryCode, ...d.categories.map(c => c.categoryCode)].filter(Boolean) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const count = await db.transmittal.count({ where: { discipline: code } });
  if (count > 0) return NextResponse.json({ error: `لا يمكن حذف ${code} - ${count} مستند مرتبط` }, { status: 400 });
  await db.discipline.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
