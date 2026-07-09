import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/transmittals/[id]/revisions — add or update a revision
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { revNumber, submitDate, replyDate, action, approvalType, notes } = body;

  const t = await db.transmittal.findUnique({
    where: { id },
    include: { revisions: { orderBy: { revNumber: 'asc' } } },
  });
  if (!t) {
    return NextResponse.json({ error: 'الترانسميتال غير موجود' }, { status: 404 });
  }

  const requestedRev = Number(revNumber);
  const existingRevs = t.revisions;
  const maxExistingRev = existingRevs.length > 0 ? Math.max(...existingRevs.map(r => r.revNumber)) : -1;
  const existingRev = existingRevs.find(r => r.revNumber === requestedRev);

  // --- WORKFLOW VALIDATION ---

  // 1. Cannot skip revision numbers (e.g., no REV.2 without REV.1)
  if (!existingRev && requestedRev > maxExistingRev + 1) {
    return NextResponse.json(
      { error: `لا يمكن تخطي أرقام المراجعات. المراجعة التالية هي REV.${maxExistingRev + 1}` },
      { status: 400 }
    );
  }

  // 2. For NEW revisions (not updating existing): the latest revision must have a consultant reply
  if (!existingRev && existingRevs.length > 0) {
    const latestRev = existingRevs[existingRevs.length - 1];
    const act = (latestRev.action || '').toLowerCase().trim();

    // If latest rev is withdrawn → transmittal is cancelled, no further actions allowed
    if (act === 'withdrawn') {
      return NextResponse.json(
        { error: `الترانسميتال مسحوب (REV.${latestRev.revNumber}) — لا يمكن إنشاء مراجعات جديدة` },
        { status: 400 }
      );
    }

    if (latestRev.replyDate === null || !latestRev.action) {
      return NextResponse.json(
        { error: `لا يمكن إنشاء مراجعة جديدة قبل رد الاستشاري على REV.${latestRev.revNumber}` },
        { status: 400 }
      );
    }
    // 3. If latest rev is approved (A or B), no need for a new rev
    if (act === 'approved') {
      const at = latestRev.approvalType || '';
      if (at === 'APPROVED' || at === 'APPROVED_AS_NOTED' || at === '') {
        return NextResponse.json(
          { error: `تم اعتماد REV.${latestRev.revNumber} — لا حاجة لمراجعة جديدة` },
          { status: 400 }
        );
      }
      // C (resubmit), D (not approved), E (for information) → allow new rev
    }
    // If rejected → allow new rev
  }

  // 4. For NEW revisions: submitDate is required
  if (!existingRev && !submitDate) {
    return NextResponse.json(
      { error: 'تاريخ الإرسال مطلوب لإنشاء مراجعة جديدة' },
      { status: 400 }
    );
  }

  // If action is not "approved", clear approvalType
  const effectiveApprovalType = action === 'approved' ? (approvalType || null) : null;

  const rev = await db.revision.upsert({
    where: {
      transmittalId_revNumber: {
        transmittalId: id,
        revNumber: requestedRev,
      },
    },
    create: {
      transmittalId: id,
      revNumber: requestedRev,
      submitDate: submitDate ? new Date(submitDate) : null,
      replyDate: replyDate ? new Date(replyDate) : null,
      action: action || null,
      approvalType: effectiveApprovalType,
      notes: notes || null,
    },
    update: {
      submitDate: submitDate !== undefined ? (submitDate ? new Date(submitDate) : null) : undefined,
      replyDate: replyDate !== undefined ? (replyDate ? new Date(replyDate) : null) : undefined,
      action: action !== undefined ? (action || null) : undefined,
      approvalType: approvalType !== undefined ? effectiveApprovalType : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  });

  return NextResponse.json(rev, { status: 201 });
}

// DELETE /api/transmittals/[id]/revisions?rev=1
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const rev = searchParams.get('rev');
  if (!rev) return NextResponse.json({ error: 'rev required' }, { status: 400 });

  await db.revision.delete({
    where: {
      transmittalId_revNumber: {
        transmittalId: id,
        revNumber: Number(rev),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
