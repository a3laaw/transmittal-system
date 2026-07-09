// Seed the DocType table with default types.
import { db } from '../src/lib/db';

const DEFAULT_TYPES = [
  { code: 'SHOP DRAWINGS', label: 'رسم تنفيذي' },
  { code: 'SAMPLE', label: 'عينة' },
  { code: 'SOURCE APPROVAL', label: 'اعتماد مصدر' },
  { code: 'COMPANY PROFILE', label: 'ملف شركة' },
  { code: 'TEST REPORT', label: 'تقرير اختبار' },
  { code: 'SUBMITTAL', label: 'طلب اعتماد' },
  { code: 'MATERIAL APPROVAL', label: 'اعتماد مادة' },
  { code: 'METHOD STATEMENT', label: 'طريقة تنفيذ' },
  { code: 'CALCULATION', label: 'حسابات' },
];

async function main() {
  console.log('Seeding doc types...');
  for (const t of DEFAULT_TYPES) {
    await db.docType.upsert({
      where: { code: t.code },
      create: t,
      update: { label: t.label },
    });
    console.log('  ✓ ' + t.code + ' - ' + t.label);
  }
  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
