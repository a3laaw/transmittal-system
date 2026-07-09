import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/transmittals/[id]/reviews — upsert a review (CONSULTANT or MOH)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { party, status, submitDate, submitRev, reviewDate, notes } = body;

  if (!party || !['CONSULTANT', 'MOH'].includes(party)) {
    return NextResponse.json({ error: 'الجهة يجب أن تكون CONSULTANT أو MOH' }, { status: 400 });
  }

  // WORKFLOW VALIDATION
  const t = await db.transmittal.findUnique({
    where: { id },
    include: { revisions: true, reviews: true },
  });
  if (!t) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  if (party === 'CONSULTANT') {
    // Must have at least one submitted revision
    const submittedRevs = t.revisions.filter(r => r.submitDate !== null);
    if (submittedRevs.length === 0) {
      return NextResponse.json(
        { error: 'لا يمكن تسجيل رد الاستشاري بدون مراجعة مرسلة' },
        { status: 400 }
      );
    }
    // If latest rev is already withdrawn → no consultant reply needed
    const latestRev = t.revisions[t.revisions.length - 1];
    const latestAct = (latestRev.action || '').toLowerCase().trim();
    if (latestAct === 'withdrawn') {
      return NextResponse.json(
        { error: 'الترانسميتال مسحوب — لا يحتاج رد استشاري' },
        { status: 400 }
      );
    }
  }

  if (party === 'MOH') {
    // Must have been sent to MOH first (MOH review must exist with submitDate)
    const existingMoh = t.reviews.find(r => r.party === 'MOH');
    if (!existingMoh || !existingMoh.submitDate) {
      return NextResponse.json(
        { error: 'لا يمكن تسجيل رد الوزارة قبل الإرسال للوزارة' },
        { status: 400 }
      );
    }
  }

  const review = await db.review.upsert({
    where: {
      transmittalId_party: {
        transmittalId: id,
        party,
      },
    },
    create: {
      transmittalId: id,
      party,
      status: status || null,
      submitDate: submitDate ? new Date(submitDate) : null,
      submitRev: submitRev ?? null,
      reviewDate: reviewDate ? new Date(reviewDate) : null,
      notes: notes || null,
    },
    update: {
      status: status !== undefined ? (status || null) : undefined,
      submitDate: submitDate !== undefined ? (submitDate ? new Date(submitDate) : null) : undefined,
      submitRev: submitRev !== undefined ? (submitRev ?? null) : undefined,
      reviewDate: reviewDate !== undefined ? (reviewDate ? new Date(reviewDate) : null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  });

  return NextResponse.json(review, { status: 201 });
}

// DELETE /api/transmittals/[id]/reviews?party=CONSULTANT
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const party = searchParams.get('party');
  if (!party) return NextResponse.json({ error: 'party required' }, { status: 400 });

  await db.review.delete({
    where: {
      transmittalId_party: {
        transmittalId: id,
        party,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
