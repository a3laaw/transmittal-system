import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/timeline?category=TRANSMITTAL&discipline=CIV&type=...&from=2026-01-01&to=2026-12-31&q=...
 *
 * Returns a "horizontal timeline" report where each transmittal is a ROW
 * and each revision (REV.0..REV.7) is a column group (Submit / Reply / Action / Days).
 *
 * Response shape:
 *   {
 *     items: [{
 *       id, reference, discipline, category, type, description,
 *       consultantStatus, mohStatus,
 *       revisions: {
 *         0: { submitDate, replyDate, action, daysOpen },
 *         1: { ... },
 *         ...
 *       },
 *       lastSubmitDate, lastReplyDate, totalDays
 *     }],
 *     total
 *   }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const discipline = searchParams.get('discipline') || '';
  const type = searchParams.get('type') || '';
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const where: any = {};
  if (category) where.category = category;
  if (discipline) where.discipline = discipline;
  if (type) where.type = type;
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { description: { contains: q } },
      { type: { contains: q } },
    ];
  }

  const transmittals = await db.transmittal.findMany({
    where,
    include: {
      revisions: { orderBy: { revNumber: 'asc' } },
      reviews: true,
    },
    orderBy: { reference: 'asc' },
  });

  // Build the timeline rows
  const items = transmittals.map(t => {
    const consultant = t.reviews.find(r => r.party === 'CONSULTANT');
    const moh = t.reviews.find(r => r.party === 'MOH');

    // Pivot revisions: { 0: {submitDate, replyDate, action, daysOpen}, 1: {...}, ... }
    const revsMap: Record<number, {
      submitDate: string | null;
      replyDate: string | null;
      action: string | null;
      approvalType: string | null;
      daysOpen: number | null;
    }> = {};

    let lastSubmitDate: Date | null = null;
    let lastReplyDate: Date | null = null;
    let totalDays = 0;

    for (const rev of t.revisions) {
      const submit = rev.submitDate;
      const reply = rev.replyDate;
      let daysOpen: number | null = null;
      if (submit) {
        const end = reply ? new Date(reply) : new Date();
        daysOpen = Math.floor((end.getTime() - new Date(submit).getTime()) / (1000 * 60 * 60 * 24));
        totalDays += daysOpen;
      }
      revsMap[rev.revNumber] = {
        submitDate: submit ? submit.toISOString() : null,
        replyDate: reply ? reply.toISOString() : null,
        action: rev.action,
        approvalType: rev.approvalType || null,
        daysOpen,
      };
      if (submit && (!lastSubmitDate || new Date(submit) > new Date(lastSubmitDate))) {
        lastSubmitDate = new Date(submit);
      }
      if (reply && (!lastReplyDate || new Date(reply) > new Date(lastReplyDate))) {
        lastReplyDate = new Date(reply);
      }
    }

    // Optional date-range filter (filter on last submit date)
    let inDateRange = true;
    if (from && lastSubmitDate) {
      inDateRange = inDateRange && new Date(lastSubmitDate) >= new Date(from);
    }
    if (to && lastSubmitDate) {
      inDateRange = inDateRange && new Date(lastSubmitDate) <= new Date(to);
    }
    if ((from || to) && !lastSubmitDate) {
      inDateRange = false;
    }

    return {
      id: t.id,
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      type: t.type,
      description: t.description,
      consultantStatus: consultant?.status || null,
      mohStatus: moh?.status || null,
      mohSubmitDate: moh?.submitDate ? moh.submitDate.toISOString() : null,
      mohSubmitRev: moh?.submitRev ?? null,
      mohReviewDate: moh?.reviewDate ? moh.reviewDate.toISOString() : null,
      revisions: revsMap,
      revisionsCount: t.revisions.length,
      lastSubmitDate: lastSubmitDate ? lastSubmitDate.toISOString() : null,
      lastReplyDate: lastReplyDate ? lastReplyDate.toISOString() : null,
      totalDays,
      _inDateRange: inDateRange,
    };
  });

  // Filter by date range post-computation
  const filtered = items.filter(i => i._inDateRange);
  const cleaned = filtered.map(({ _inDateRange, ...rest }) => rest);

  return NextResponse.json({
    items: cleaned,
    total: cleaned.length,
  });
}
