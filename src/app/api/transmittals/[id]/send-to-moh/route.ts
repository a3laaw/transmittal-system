import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transmittals/[id]/send-to-moh
 * Body: { submitDate: 'YYYY-MM-DD', notes?: string }
 *
 * Marks this transmittal as "sent to MOH" using the LATEST revision (auto).
 * - submitDate: required — the date the transmittal was sent to MOH (user-entered)
 * - notes: optional notes
 * - The rev number is ALWAYS the latest revision (user cannot change it)
 *
 * If MOH review already has submitDate, returns error (already sent).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { submitDate, notes } = body;

  // Validate submitDate (required)
  if (!submitDate) {
    return NextResponse.json({ error: 'تاريخ الإرسال للوزارة مطلوب' }, { status: 400 });
  }

  let parsedDate: Date;
  try {
    parsedDate = new Date(submitDate);
    if (isNaN(parsedDate.getTime())) throw new Error('invalid');
  } catch {
    return NextResponse.json({ error: 'تاريخ الإرسال غير صالح' }, { status: 400 });
  }

  const t = await db.transmittal.findUnique({
    where: { id },
    include: { revisions: { orderBy: { revNumber: 'asc' } }, reviews: true },
  });
  if (!t) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  if (t.revisions.length === 0) {
    return NextResponse.json({ error: 'لا توجد مراجعات على هذا الترانسميتال' }, { status: 400 });
  }

  // WORKFLOW: Consultant must have approved before sending to MOH
  const latestRev = t.revisions[t.revisions.length - 1];
  const latestAction = (latestRev.action || '').toLowerCase().trim();

  // If withdrawn → transmittal is cancelled
  if (latestAction === 'withdrawn') {
    return NextResponse.json(
      { error: `الترانسميتال مسحوب — لا يمكن الإرسال للوزارة` },
      { status: 400 }
    );
  }

  if (latestAction !== 'approved') {
    return NextResponse.json(
      { error: `لا يمكن الإرسال للوزارة قبل اعتماد الاستشاري. الإجراء الحالي على REV.${latestRev.revNumber}: ${latestAction || 'بانتظار الرد'}` },
      { status: 400 }
    );
  }
  // Only approval types A (APPROVED) and B (APPROVED AS NOTED) can be sent to MOH
  // C (resubmit), D (not approved), E (for information) require a new revision first
  const at = latestRev.approvalType || '';
  if (at === 'APPROVED_AS_NOTED_RESUBMIT' || at === 'NOT_APPROVED' || at === 'FOR_INFORMATION') {
    return NextResponse.json(
      { error: `نوع القبول الحالي (${at}) يتطلب مراجعة جديدة قبل الإرسال للوزارة` },
      { status: 400 }
    );
  }
  // Also check: latest rev must have a reply date
  if (latestRev.replyDate === null) {
    return NextResponse.json(
      { error: 'لا يمكن الإرسال للوزارة قبل رد الاستشاري على آخر مراجعة' },
      { status: 400 }
    );
  }

  // ALWAYS use the latest revision
  const revToSend = latestRev.revNumber;

  // Check existing MOH review
  const existingMoh = t.reviews.find(r => r.party === 'MOH');
  if (existingMoh?.submitDate) {
    return NextResponse.json(
      { error: `تم الإرسال للوزارة مسبقاً بتاريخ ${new Date(existingMoh.submitDate).toLocaleDateString('en-GB')}` },
      { status: 400 }
    );
  }

  // Upsert MOH review with user-provided submitDate and auto latest rev
  const review = await db.review.upsert({
    where: { transmittalId_party: { transmittalId: id, party: 'MOH' } },
    create: {
      transmittalId: id,
      party: 'MOH',
      status: 'Under Review',
      submitDate: parsedDate,
      submitRev: revToSend,
      notes: notes || null,
    },
    update: {
      status: 'Under Review',
      submitDate: parsedDate,
      submitRev: revToSend,
      notes: notes || null,
    },
  });

  return NextResponse.json({
    ok: true,
    review,
    sentRev: revToSend,
    sentDate: review.submitDate,
  });
}
