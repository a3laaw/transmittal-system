// Seed the Category table with default categories and backfill discipline.categoryCode.

import { db } from '../src/lib/db';

const DEFAULT_CATEGORIES = [
  { code: 'TRANSMITTAL', label: 'ترانسميتال',     icon: '📄', color: 'bg-blue-100 text-blue-700' },
  { code: 'MIR',         label: 'MIR - تفتيش مواد', icon: '🔍', color: 'bg-orange-100 text-orange-700' },
  { code: 'RFI',         label: 'RFI - طلب معلومات', icon: '❓', color: 'bg-purple-100 text-purple-700' },
  { code: 'BOOKS',       label: 'كتب',              icon: '📚', color: 'bg-emerald-100 text-emerald-700' },
];

async function main() {
  console.log('Seeding categories...');
  for (const c of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: { code: c.code },
      create: c,
      update: { label: c.label, icon: c.icon, color: c.color },
    });
    console.log('  ✓ ' + c.code + ' - ' + c.label);
  }

  console.log('\nBackfilling discipline.categoryCode based on legacy discipline.category...');
  // The legacy `category` field was on Discipline, but we dropped it.
  // All existing disciplines should map to TRANSMITTAL (their original default).
  const disciplines = await db.discipline.findMany();
  for (const d of disciplines) {
    if (!d.categoryCode) {
      await db.discipline.update({
        where: { code: d.code },
        data: { categoryCode: 'TRANSMITTAL' },
      });
      console.log('  ✓ ' + d.code + ' → TRANSMITTAL');
    }
  }

  console.log('\nFinal state:');
  const cats = await db.category.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { disciplines: true, transmittals: true } } } });
  for (const c of cats) {
    console.log('  ' + c.code + ' (' + c.label + ') - ' + c._count.disciplines + ' disciplines, ' + c._count.transmittals + ' transmittals');
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
