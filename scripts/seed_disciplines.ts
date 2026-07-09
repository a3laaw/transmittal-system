// Seed the Discipline table with default disciplines and backfill disciplineCode
// on existing Transmittals based on their legacy `discipline` field.

import { db } from '../src/lib/db';

const DEFAULT_DISCIPLINES = [
  { code: 'CIV',  label: 'المدنية',     color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-' },
  { code: 'EL',   label: 'الكهربائية',  color: 'bg-purple-100 text-purple-700', prefix: 'EL-' },
  { code: 'PL',   label: 'الصحي',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-' },
  { code: 'HVAC', label: 'التكييف',     color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-' },
  { code: 'FF',   label: 'الحريق',      color: 'bg-red-100 text-red-700',       prefix: 'FF-' },
  { code: 'ELVE', label: 'المصاعد',     color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ' },
];

async function main() {
  console.log('Seeding disciplines...');
  for (const d of DEFAULT_DISCIPLINES) {
    await db.discipline.upsert({
      where: { code: d.code },
      create: d,
      update: { label: d.label, color: d.color, prefix: d.prefix },
    });
    console.log('  ✓ ' + d.code + ' - ' + d.label);
  }

  console.log('\nBackfilling disciplineCode on existing transmittals...');
  const transmittals = await db.transmittal.findMany({ select: { id: true, discipline: true } });
  let updated = 0;
  for (const t of transmittals) {
    if (t.discipline) {
      await db.transmittal.update({
        where: { id: t.id },
        data: { disciplineCode: t.discipline },
      });
      updated++;
    }
  }
  console.log('  ✓ Updated ' + updated + ' transmittals');

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
