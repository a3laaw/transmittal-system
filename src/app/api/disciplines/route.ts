import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const where: any = category
    ? { OR: [{ categoryCode: category }, { categories: { some: { categoryCode: category } } }] }
    : {};
  const items = await db.discipline.findMany({
    where,
    orderBy: [{ categoryCode: 'asc' }, { code: 'asc' }],
    include: { categories: { select: { categoryCode: true } } },
  });
  const counts = await db.transmittal.groupBy({ by: ['discipline'], _count: true });
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.discipline] = c._count;
  return NextResponse.json({
    items: items.map(d => ({
      ...d,
      category: d.categoryCode,
      allCategories: [d.categoryCode, ...d.categories.map(c => c.categoryCode)].filter(Boolean),
      transmittalsCount: countMap[d.code] || 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, label, labelEn, color, prefix, category, categories } = body;
  if (!code || !label) return NextResponse.json({ error: 'الكود والاسم مطلوبان' }, { status: 400 });
  const codeUpper = String(code).toUpperCase().trim();
  if (!prefix) return NextResponse.json({ error: 'البادئة مطلوبة' }, { status: 400 });
  const categoryCode = category || 'TRANSMITTAL';
  const cat = await db.category.findUnique({ where: { code: categoryCode } });
  if (!cat) return NextResponse.json({ error: `القسم ${categoryCode} غير موجود` }, { status: 400 });
  try {
    const d = await db.discipline.create({
      data: {
        code: codeUpper,
        label: String(label).trim(),
        labelEn: labelEn ? String(labelEn).trim() : null,
        color: color || 'bg-gray-100 text-gray-700',
        prefix: String(prefix).trim(),
        categoryCode,
        ...(Array.isArray(categories) && categories.length > 0
          ? { categories: { create: categories.filter((c: string) => c !== categoryCode).map((c: string) => ({ categoryCode: c })) } }
          : {}),
      },
      include: { categories: true },
    });
    return NextResponse.json({ ...d, category: d.categoryCode, allCategories: [d.categoryCode, ...d.categories.map(c => c.categoryCode)].filter(Boolean) }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: `كود ${codeUpper} موجود` }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
