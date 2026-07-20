import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/disciplines?category=TRANSMITTAL
// Returns all disciplines, optionally filtered by category
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';

  const where = category ? { categoryCode: category } : {};
  const items = await db.discipline.findMany({
    where,
    orderBy: [{ categoryCode: 'asc' }, { code: 'asc' }],
  });
  // Count transmittals per discipline
  const counts = await db.transmittal.groupBy({
    by: ['discipline'],
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.discipline] = c._count;
  return NextResponse.json({
    items: items.map(d => ({
      ...d,
      category: d.categoryCode, // backward-compat alias
      transmittalsCount: countMap[d.code] || 0,
    })),
  });
}

// POST /api/disciplines — create new discipline
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, label, color, prefix, category } = body;
  if (!code || !label) {
    return NextResponse.json({ error: 'الكود والاسم مطلوبان' }, { status: 400 });
  }
  const codeUpper = String(code).toUpperCase().trim();
  if (!prefix) {
    return NextResponse.json({ error: 'البادئة مطلوبة (مثل CIV-)' }, { status: 400 });
  }
  const categoryCode = category || 'TRANSMITTAL';
  // Verify category exists
  const cat = await db.category.findUnique({ where: { code: categoryCode } });
  if (!cat) {
    return NextResponse.json({ error: `القسم الرئيسي ${categoryCode} غير موجود` }, { status: 400 });
  }
  try {
    const d = await db.discipline.create({
      data: {
        code: codeUpper,
        label: String(label).trim(),
        color: color || 'bg-gray-100 text-gray-700',
        prefix: String(prefix).trim(),
        categoryCode,
      },
    });
    return NextResponse.json({ ...d, category: d.categoryCode }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: `كود القسم ${codeUpper} موجود مسبقاً` }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
