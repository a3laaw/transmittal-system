import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeOverallStatus, computeMohStatus, DEFAULT_DISCIPLINES, DEFAULT_CATEGORIES } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const [transmittals, disciplines, categories] = await Promise.all([
    db.transmittal.findMany({
      include: {
        revisions: { orderBy: { revNumber: 'asc' } },
        reviews: true,
      },
    }),
    db.discipline.findMany({ orderBy: [{ categoryCode: 'asc' }, { code: 'asc' }] }),
    db.category.findMany({ orderBy: { code: 'asc' } }),
  ]);

  const discList = disciplines.length > 0
    ? disciplines.map(d => ({ ...d, category: d.categoryCode }))
    : DEFAULT_DISCIPLINES.map(d => ({ ...d, category: d.categoryCode, id: '', createdAt: new Date(), updatedAt: new Date() }));
  const catList = categories.length > 0
    ? categories
    : DEFAULT_CATEGORIES.map(c => ({ ...c, id: '', createdAt: new Date(), updatedAt: new Date() }));

  // Compute status for each
  const enriched = transmittals.map(t => {
    const consultant = t.reviews.find(r => r.party === 'CONSULTANT');
    const moh = t.reviews.find(r => r.party === 'MOH');
    const overall = computeOverallStatus(
      t.revisions.map(r => ({
        submitDate: r.submitDate,
        replyDate: r.replyDate,
        action: r.action,
        approvalType: r.approvalType,
      })),
      consultant as any,
      moh as any,
    );
    const mohComputed = computeMohStatus(moh as any);
    return { ...t, computedStatus: overall, mohStatus: mohComputed, consultant, moh };
  });

  // Global KPIs
  const total = enriched.length;
  const approved = enriched.filter(t => t.computedStatus.status === 'approved').length;
  const pending = enriched.filter(t => t.computedStatus.status === 'pending').length;
  const overdue = enriched.filter(t => t.computedStatus.status === 'overdue').length;
  const cancelled = enriched.filter(t => t.computedStatus.status === 'cancelled').length;
  const resubmit = enriched.filter(t => t.computedStatus.status === 'resubmit').length;

  // MOH-specific KPIs
  const mohSent = enriched.filter(t => t.mohStatus.status !== 'not_sent').length;
  const mohApproved = enriched.filter(t => t.mohStatus.status === 'approved').length;
  const mohOverdue = enriched.filter(t => t.mohStatus.status === 'overdue').length;
  const mohUnderReview = enriched.filter(t => t.mohStatus.status === 'under_review').length;

  // Per-category breakdown
  const perCategory = catList.map(cat => {
    const catItems = enriched.filter(t => t.category === cat.code);
    const catDisciplines = discList.filter(d => d.category === cat.code);
    return {
      code: cat.code,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      total: catItems.length,
      approved: catItems.filter(t => t.computedStatus.status === 'approved').length,
      pending: catItems.filter(t => t.computedStatus.status === 'pending').length,
      overdue: catItems.filter(t => t.computedStatus.status === 'overdue').length,
      cancelled: catItems.filter(t => t.computedStatus.status === 'cancelled').length,
      resubmit: catItems.filter(t => t.computedStatus.status === 'resubmit').length,
      mohSent: catItems.filter(t => t.mohStatus.status !== 'not_sent').length,
      mohApproved: catItems.filter(t => t.mohStatus.status === 'approved').length,
      mohOverdue: catItems.filter(t => t.mohStatus.status === 'overdue').length,
      disciplinesCount: catDisciplines.length,
      lastReference: catItems.length > 0
        ? catItems.sort((a, b) => a.reference.localeCompare(b.reference)).slice(-1)[0].reference
        : null,
    };
  });

  // Per-discipline breakdown (still grouped by category)
  const perDiscipline = discList.map(d => {
    const items = enriched.filter(t => t.discipline === d.code);
    return {
      code: d.code,
      label: d.label,
      color: d.color,
      category: d.category,
      total: items.length,
      approved: items.filter(t => t.computedStatus.status === 'approved').length,
      pending: items.filter(t => t.computedStatus.status === 'pending').length,
      overdue: items.filter(t => t.computedStatus.status === 'overdue').length,
      cancelled: items.filter(t => t.computedStatus.status === 'cancelled').length,
      resubmit: items.filter(t => t.computedStatus.status === 'resubmit').length,
      mohSent: items.filter(t => t.mohStatus.status !== 'not_sent').length,
      mohApproved: items.filter(t => t.mohStatus.status === 'approved').length,
      mohOverdue: items.filter(t => t.mohStatus.status === 'overdue').length,
      lastReference: items.length > 0
        ? items.sort((a, b) => a.reference.localeCompare(b.reference)).slice(-1)[0].reference
        : null,
    };
  });

  // Recent transmittals
  const recent = enriched
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      description: t.description,
      status: t.computedStatus,
      mohStatus: t.mohStatus,
    }));

  // Overdue at Consultant
  const consultantOverdueList = enriched
    .filter(t => t.computedStatus.status === 'overdue')
    .sort((a, b) => {
      const aRevs = a.revisions.filter(r => r.submitDate);
      const bRevs = b.revisions.filter(r => r.submitDate);
      if (aRevs.length === 0 || bRevs.length === 0) return 0;
      const aLast = aRevs[aRevs.length - 1].submitDate!.getTime();
      const bLast = bRevs[bRevs.length - 1].submitDate!.getTime();
      return aLast - bLast;
    })
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      description: t.description,
      status: t.computedStatus,
      party: 'CONSULTANT',
    }));

  // Overdue at MOH
  const mohOverdueList = enriched
    .filter(t => t.mohStatus.status === 'overdue')
    .sort((a, b) => {
      const aTime = a.moh?.submitDate?.getTime() ?? 0;
      const bTime = b.moh?.submitDate?.getTime() ?? 0;
      return aTime - bTime;
    })
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      description: t.description,
      status: t.mohStatus,
      party: 'MOH',
    }));

  return NextResponse.json({
    kpis: { total, approved, pending, overdue, cancelled, resubmit },
    mohKpis: { sent: mohSent, approved: mohApproved, overdue: mohOverdue, underReview: mohUnderReview },
    perCategory,
    perDiscipline,
    disciplines: discList,
    categories: catList,
    recent,
    consultantOverdueList,
    mohOverdueList,
  });
}
