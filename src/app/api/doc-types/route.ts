import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/doc-types — list all document types with count
export async function GET() {
  const items = await db.docType.findMany({ orderBy: { code: 'asc' } });
  // Count transmittals per type
  const counts = await db.transmittal.groupBy({
    by: ['type'],
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) {
    if (c.type) countMap[c.type] = c._count;
  }
  return NextResponse.json({
    items: items.map(t => ({
      ...t,
      transmittalsCount: countMap[t.code] || 0,
    })),
  });
}

// POST /api/doc-types — create new type
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, label } = body;
  if (!code || !label) {
    return NextResponse.json({ error: 'الكود والاسم مطلوبان' }, { status: 400 });
  }
  const codeUpper = String(code).toUpperCase().trim();
  try {
    const t = await db.docType.create({
      data: { code: codeUpper, label: String(label).trim() },
    });
    return NextResponse.json(t, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: `كود النوع ${codeUpper} موجود مسبقاً` }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
