import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDisciplinePrefix } from '@/lib/status';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transmittals/next-ref?discipline=CIV
 *
 * Returns the next SEQUENTIAL reference number.
 *
 * Logic:
 * - The sequence is shared PER CATEGORY (TRANSMITTAL has its own sequence,
 *   MIR has its own, RFI has its own, etc.)
 * - Within a category, find the max number across ALL disciplines in that category
 * - Apply the selected discipline's prefix format
 *
 * Example for TRANSMITTAL category:
 *   Existing: CIV-170, EL-147, PL-168 → max in TRANSMITTAL = 170
 *   If user picks CIV → next = CIV-171
 *
 * Example for MIR category (separate sequence):
 *   Existing: MIR-CIV-005, MIR-EL-003 → max in MIR = 5
 *   If user picks MIR-EL → next = MIR-EL-006
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const discipline = (searchParams.get('discipline') || '').toUpperCase().trim();

  if (!discipline) {
    return NextResponse.json({ error: 'discipline is required' }, { status: 400 });
  }

  // Look up the discipline to find its category
  const disc = await db.discipline.findUnique({ where: { code: discipline } });
  const category = disc?.categoryCode || 'TRANSMITTAL';
  const prefix = disc?.prefix || getDisciplinePrefix(discipline);

  // Find all transmittals in this category
  const items = await db.transmittal.findMany({
    where: { category },
    select: { reference: true, discipline: true },
  });

  // Extract numeric portions from ALL references in this category
  let maxNum = 0;
  let paddingWidth = 3;

  for (const item of items) {
    const ref = item.reference;
    const matches = ref.match(/\d+/g);
    if (matches && matches.length > 0) {
      const num = parseInt(matches[matches.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
      for (const m of matches) {
        if (m.length > paddingWidth) {
          paddingWidth = Math.min(m.length, 4);
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(paddingWidth, '0');
  const nextRef = `${prefix}${paddedNum}`;

  // Per-discipline stats
  const disciplineItems = items.filter(i => i.discipline === discipline);
  const recent = disciplineItems.map(i => i.reference).sort().slice(-5);

  // Recent additions across this category
  const allRecent = items
    .map(i => {
      const m = i.reference.match(/\d+/g);
      const num = m && m.length > 0 ? parseInt(m[m.length - 1], 10) : 0;
      return { reference: i.reference, discipline: i.discipline, num };
    })
    .sort((a, b) => b.num - a.num)
    .slice(0, 5)
    .map(r => r.reference);

  return NextResponse.json({
    discipline,
    category,
    nextReference: nextRef,
    nextNumber: nextNum,
    lastMaxInCategory: maxNum,
    paddingWidth,
    prefix,
    recent,
    recentInCategory: allRecent,
    totalInDiscipline: disciplineItems.length,
    totalInCategory: items.length,
  });
}
