import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
      disciplinesCount: c._count.disciplines,
      transmittalsCount: c._count.transmittals,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

// POST /api/categories — create new category
export async function POST(req: NextRequest) {
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
