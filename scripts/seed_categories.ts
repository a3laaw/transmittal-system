// Update disciplines to have category field, and backfill Transmittals with category.

import { db } from '../src/lib/db';

const DISCIPLINES_WITH_CATEGORY = [
  // Transmittal category (existing 6 disciplines)
  { code: 'CIV',  label: 'المدنية',     color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-',  category: 'TRANSMITTAL' },
  { code: 'EL',   label: 'الكهربائية',  color: 'bg-purple-100 text-purple-700', prefix: 'EL-',   category: 'TRANSMITTAL' },
  { code: 'PL',   label: 'الصحي',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-',   category: 'TRANSMITTAL' },
  { code: 'HVAC', label: 'التكييف',     color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-', category: 'TRANSMITTAL' },
  { code: 'FF',   label: 'الحريق',      color: 'bg-red-100 text-red-700',       prefix: 'FF-',   category: 'TRANSMITTAL' },
  { code: 'ELVE', label: 'المصاعد',     color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ', category: 'TRANSMITTAL' },
];

async function main() {
  console.log('Updating disciplines with category field...');
  for (const d of DISCIPLINES_WITH_CATEGORY) {
    await db.discipline.upsert({
      where: { code: d.code },
      create: d,
      update: { category: d.category, label: d.label, color: d.color, prefix: d.prefix },
    });
    console.log('  ✓ ' + d.code + ' (' + d.category + ')');
  }

  console.log('\nBackfilling category on existing Transmittals...');
  const transmittals = await db.transmittal.findMany({ select: { id: true, discipline: true } });
  let updated = 0;
  for (const t of transmittals) {
    // Look up the discipline's category
    const disc = await db.discipline.findUnique({ where: { code: t.discipline }, select: { category: true } });
    const cat = disc?.category || 'TRANSMITTAL';
    await db.transmittal.update({
      where: { id: t.id },
      data: { category: cat },
    });
    updated++;
  }
  console.log('  ✓ Updated ' + updated + ' transmittals with category');

  console.log('\nFinal discipline list:');
  const all = await db.discipline.findMany({ orderBy: { code: 'asc' } });
  for (const d of all) {
    console.log('  ' + d.code + ' - ' + d.label + ' [' + d.category + ']');
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
