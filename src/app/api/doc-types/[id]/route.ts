import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/doc-types/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, label, labelEn } = body;

  const existing = await db.docType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'النوع غير موجود' }, { status: 404 });
  }

  // If code is changing, update all transmittals using the old code
  const newCode = code ? String(code).toUpperCase().trim() : existing.code;
  if (newCode !== existing.code) {
    await db.transmittal.updateMany({
      where: { type: existing.code },
      data: { type: newCode },
    });
  }

  const t = await db.docType.update({
    where: { id },
    data: {
      ...(code !== undefined && { code: newCode }),
      ...(label !== undefined && { label: String(label).trim() }),
      ...(labelEn !== undefined && { labelEn: labelEn ? String(labelEn).trim() : null }),
    },
  });
  return NextResponse.json(t);
}

// DELETE /api/doc-types/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db.docType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'النوع غير موجود' }, { status: 404 });
  }
  // Check if there are transmittals using this type
  const count = await db.transmittal.count({ where: { type: existing.code } });
  if (count > 0) {
    return NextResponse.json(
      { error: `لا يمكن حذف النوع ${existing.code} لأن هناك ${count} ترانسميتال مرتبط به` },
      { status: 400 }
    );
  }
  await db.docType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
