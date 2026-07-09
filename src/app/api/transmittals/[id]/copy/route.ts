import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDisciplinePrefix } from '@/lib/status';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transmittals/[id]/copy
 * Body: { description?: string } - optional override for the description
 *
 * Copies the transmittal's data (discipline, type, description) into a new transmittal
 * with an auto-generated next sequential reference number (within the same category).
 *
 * - If description is provided in the body, it overrides the source's description
 * - Does NOT copy revisions or reviews (starts fresh with REV.0)
 * - Returns the new transmittal
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Parse body (optional description override)
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const descriptionOverride = typeof body.description === 'string' ? body.description.trim() : null;

  const source = await db.transmittal.findUnique({
    where: { id },
    include: { revisions: { orderBy: { revNumber: 'asc' } } },
  });
  if (!source) {
    return NextResponse.json({ error: 'الترانسميتال الأصلي غير موجود' }, { status: 404 });
  }

  // Find max number in this category
  const items = await db.transmittal.findMany({
    where: { category: source.category },
    select: { reference: true },
  });
  let maxNum = 0;
  let paddingWidth = 3;
  for (const item of items) {
    const matches = item.reference.match(/\d+/g);
    if (matches && matches.length > 0) {
      const num = parseInt(matches[matches.length - 1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
      for (const m of matches) {
        if (m.length > paddingWidth) paddingWidth = Math.min(m.length, 4);
      }
    }
  }

  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(paddingWidth, '0');

  // Look up the discipline's prefix and category
  const disc = await db.discipline.findUnique({ where: { code: source.discipline } });
  const prefix = disc?.prefix || getDisciplinePrefix(source.discipline);
  const category = disc?.categoryCode || source.category || 'TRANSMITTAL';
  const newRef = `${prefix}${paddedNum}`;

  // Create the new transmittal — use overridden description if provided, else source's
  const newT = await db.transmittal.create({
    data: {
      reference: newRef,
      discipline: source.discipline,
      disciplineCode: source.discipline,
      category: source.category,
      type: source.type,
      description: descriptionOverride !== null ? (descriptionOverride || null) : source.description,
      // Create REV.0 with today's date
      revisions: {
        create: [{ revNumber: 0, submitDate: new Date() }],
      },
    },
    include: { revisions: true },
  });

  return NextResponse.json({
    ok: true,
    newTransmittal: newT,
    sourceReference: source.reference,
    newReference: newRef,
  }, { status: 201 });
}
