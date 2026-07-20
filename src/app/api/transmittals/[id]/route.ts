import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

// GET /api/transmittals/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const t = await db.transmittal.findUnique({
    where: { id },
    include: {
      revisions: { orderBy: { revNumber: 'asc' } },
      reviews: { orderBy: { party: 'asc' } },
      parent: { select: { id: true, reference: true, description: true, category: true } },
      children: { select: { id: true, reference: true, description: true, category: true } },
    },
  });

  if (!t) {
    return NextResponse.json({ error: 'لم يتم العثور على الترانسميتال' }, { status: 404 });
  }

  const consultant = t.reviews.find(r => r.party === 'CONSULTANT');
  const moh = t.reviews.find(r => r.party === 'MOH');
  const computed = computeStatus(
    t.revisions.map(r => ({
      submitDate: r.submitDate,
      replyDate: r.replyDate,
      action: r.action,
      approvalType: r.approvalType,
    })),
    consultant?.status,
    moh?.status,
  );

  return NextResponse.json({ ...t, computedStatus: computed, consultant, moh });
}

// PATCH /api/transmittals/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { type, description, discipline, parentTransmittalId, alternativeTitle } = body;

  const t = await db.transmittal.update({
    where: { id },
    data: {
      ...(type !== undefined && { type: type || null }),
      ...(description !== undefined && { description: description || null }),
      ...(discipline && { discipline }),
      ...(parentTransmittalId !== undefined && { parentTransmittalId: parentTransmittalId || null }),
      ...(alternativeTitle !== undefined && { alternativeTitle: alternativeTitle || null }),
    },
  });

  return NextResponse.json(t);
}

// DELETE /api/transmittals/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.transmittal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
