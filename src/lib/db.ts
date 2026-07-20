import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Auto-seed the database with default categories, disciplines, and doc types
 * if they don't exist yet. This runs once on first server start and prevents
 * "Foreign key constraint violated" errors when creating transmittals.
 */
let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      // Check if disciplines exist
      const discCount = await db.discipline.count();
      if (discCount > 0) return; // already seeded

      console.log('[seed] Database empty — seeding default data...');

      // Create categories
      const categories = [
        { code: 'TRANSMITTAL', label: 'ترانسميتال', icon: '📄', color: 'bg-blue-100 text-blue-700' },
        { code: 'MIR', label: 'مادة', icon: '📦', color: 'bg-purple-100 text-purple-700' },
        { code: 'RFI', label: 'طلب معلومات', icon: '❓', color: 'bg-amber-100 text-amber-700' },
        { code: 'BOOKS', label: 'كتب', icon: '📚', color: 'bg-emerald-100 text-emerald-700' },
      ];
      for (const cat of categories) {
        await db.category.upsert({
          where: { code: cat.code },
          create: cat,
          update: { label: cat.label, icon: cat.icon, color: cat.color },
        });
      }

      // Create disciplines
      const disciplines = [
        { code: 'CIV',  label: 'المدنية',     color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-',  categoryCode: 'TRANSMITTAL' },
        { code: 'EL',   label: 'الكهربائية',  color: 'bg-purple-100 text-purple-700', prefix: 'EL-',   categoryCode: 'TRANSMITTAL' },
        { code: 'PL',   label: 'الصحي',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-',   categoryCode: 'TRANSMITTAL' },
        { code: 'HVAC', label: 'التكييف',     color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-', categoryCode: 'TRANSMITTAL' },
        { code: 'FF',   label: 'الحريق',      color: 'bg-red-100 text-red-700',       prefix: 'FF-',   categoryCode: 'TRANSMITTAL' },
        { code: 'ELVE', label: 'المصاعد',     color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ', categoryCode: 'TRANSMITTAL' },
      ];
      for (const d of disciplines) {
        await db.discipline.upsert({
          where: { code: d.code },
          create: d,
          update: { label: d.label, color: d.color, prefix: d.prefix, categoryCode: d.categoryCode },
        });
      }

      // Create doc types
      const docTypes = [
        { code: 'SHOP_DRAWINGS', label: 'رسم تنفيذي' },
        { code: 'SAMPLE', label: 'عينة' },
        { code: 'SOURCE_APPROVAL', label: 'اعتماد مصدر' },
        { code: 'TEST_REPORT', label: 'تقرير اختبار' },
        { code: 'METHOD_STATEMENT', label: 'طريقة تنفيذ' },
        { code: 'CALCULATION', label: 'حسابات' },
        { code: 'SPECIFICATION', label: 'مواصفات' },
        { code: 'CATALOG', label: 'كتالوج' },
        { code: 'AS_BUILT', label: 'كما نُفذ' },
        { code: 'OTHER', label: 'أخرى' },
      ];
      for (const dt of docTypes) {
        await db.docType.upsert({
          where: { code: dt.code },
          create: dt,
          update: { label: dt.label },
        });
      }

      console.log('[seed] ✅ Seed complete: 4 categories, 6 disciplines, 10 doc types');
    } catch (e) {
      console.error('[seed] Error:', e);
      seedPromise = null; // allow retry
    }
  })();
  return seedPromise;
}

// Auto-run seed on module load (in production)
if (process.env.NODE_ENV === 'production') {
  ensureSeedData().catch(() => {});
}

export async function ensureMigrations(): Promise<void> {
  try {
    const colExists = async (table: string, col: string): Promise<boolean> => {
      try { const r = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`) as any[]; return r.some((x: any) => x.name === col); } catch { return false; }
    };
    for (const [t, c] of [['Transmittal','alternativeTitle'],['Transmittal','disciplineCode'],['Transmittal','parentTransmittalId'],['Category','labelEn'],['Category','templatePath'],['Category','templateType'],['Discipline','labelEn'],['DocType','labelEn'],['DocType','categoryCode'],['Attachment','url'],['Attachment','urlSource']]) {
      if (!(await colExists(t, c))) await db.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "${c}" TEXT`);
    }
  } catch (e) { console.error('[migrations]', e); }
}
