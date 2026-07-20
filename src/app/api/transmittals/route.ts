import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeOverallStatus, computeConsultantStatus, computeMohStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

// GET /api/transmittals?discipline=CIV&type=SHOP+DRAWINGS&q=...&category=TRANSMITTAL&sortBy=date&sortOrder=desc
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const discipline = searchParams.get('discipline') || '';
  const type = searchParams.get('type') || '';
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const status = searchParams.get('status') || '';
  const mohStatus = searchParams.get('mohStatus') || '';
  const category = searchParams.get('category') || '';
  const sortBy = searchParams.get('sortBy') || 'date';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const where: any = {};
  if (discipline) where.discipline = discipline;
  if (type) where.type = type;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { description: { contains: q } },
      { type: { contains: q } },
    ];
  }

  // Determine Prisma orderBy based on sortBy
  let prismaOrderBy: any = { reference: 'asc' };
  if (sortBy === 'reference') prismaOrderBy = { reference: sortOrder === 'asc' ? 'asc' : 'desc' };
  else if (sortBy === 'discipline') prismaOrderBy = { discipline: sortOrder === 'asc' ? 'asc' : 'desc' };
  // date and status are computed after fetch — sort in JS below

  const transmittals = await db.transmittal.findMany({
    where,
    include: {
      revisions: { orderBy: { revNumber: 'asc' } },
      reviews: true,
      parent: { select: { id: true, reference: true, description: true, category: true } },
      children: { select: { id: true, reference: true, description: true, category: true } },
    },
    orderBy: prismaOrderBy,
  });

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
    const consultantStatus = computeConsultantStatus(
      t.revisions.map(r => ({
        submitDate: r.submitDate,
        replyDate: r.replyDate,
        action: r.action,
        approvalType: r.approvalType,
      })),
      consultant as any,
    );
    const mohComputed = computeMohStatus(moh as any);
    return {
      id: t.id,
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      type: t.type,
      description: t.description,
      parentTransmittalId: t.parentTransmittalId,
      parent: t.parent,
      children: t.children,
      createdAt: t.createdAt,
      revisionsCount: t.revisions.length,
      lastSubmitDate: t.revisions.filter(r => r.submitDate).slice(-1)[0]?.submitDate ?? null,
      lastReplyDate: t.revisions.filter(r => r.replyDate).slice(-1)[0]?.replyDate ?? null,
      computedStatus: overall,
      consultantStatus,
      mohStatus: mohComputed,
      mohSubmitDate: moh?.submitDate ?? null,
      mohSubmitRev: moh?.submitRev ?? null,
      mohReviewDate: moh?.reviewDate ?? null,
    };
  });

  // Filter by computed status
  let filtered = enriched;
  if (status) filtered = filtered.filter(t => t.computedStatus.status === status);
  if (mohStatus) filtered = filtered.filter(t => t.mohStatus.status === mohStatus);

  // Sort by date or status (computed fields, not in DB)
  if (sortBy === 'date') {
    filtered.sort((a, b) => {
      const da = new Date(a.lastSubmitDate || a.createdAt).getTime();
      const db_ = new Date(b.lastSubmitDate || b.createdAt).getTime();
      return sortOrder === 'asc' ? da - db_ : db_ - da;
    });
  } else if (sortBy === 'status') {
    filtered.sort((a, b) => {
      const sa = a.computedStatus.status;
      const sb = b.computedStatus.status;
      return sortOrder === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }

  return NextResponse.json({ items: filtered, total: filtered.length });
}

// POST /api/transmittals — create new
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { reference, discipline, type, description, parentTransmittalId } = body;

  if (!reference || !discipline) {
    return NextResponse.json({ error: 'المرجع والتخصص مطلوبان' }, { status: 400 });
  }

  const existing = await db.transmittal.findUnique({ where: { reference } });
  if (existing) {
    return NextResponse.json({ error: `المرجع ${reference} موجود مسبقاً` }, { status: 409 });
  }

  // Look up the discipline's category
  const disc = await db.discipline.findUnique({ where: { code: discipline } });
  const category = disc?.categoryCode || 'TRANSMITTAL';

  const t = await db.transmittal.create({
    data: {
      reference,
      discipline,
      disciplineCode: discipline,
      category,
      type: type || null,
      description: description || null,
      parentTransmittalId: parentTransmittalId || null,
      revisions: { create: [{ revNumber: 0, submitDate: new Date() }] },
    },
    include: { revisions: true },
  });

  return NextResponse.json(t, { status: 201 });
}
