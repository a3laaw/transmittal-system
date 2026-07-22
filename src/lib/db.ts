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
      // Migration: assign shortCodes to existing categories that don't have one
      // This is safe to run on every start — it only updates categories with null shortCode
      const shortCodeMap: Record<string, string> = {
        TRANSMITTAL: 'TR',
        MIR: 'MR',
        RFI: 'RF',
        BOOKS: 'LT',
        LETTERS: 'LT',
      };
      const existingCats = await db.category.findMany();
      for (const c of existingCats) {
        if (!c.shortCode && shortCodeMap[c.code]) {
          await db.category.update({
            where: { id: c.id },
            data: { shortCode: shortCodeMap[c.code] },
          });
        }
      }

      // Check if disciplines exist
      const discCount = await db.discipline.count();
      if (discCount > 0) return; // already seeded

      console.log('[seed] Database empty — seeding default data...');

      // Create categories — with shortCode for internal sequencing (NOT written in Excel)
      const categories = [
        { code: 'TRANSMITTAL', shortCode: 'TR', label: 'ترانسميتال', icon: '📄', color: 'bg-blue-100 text-blue-700' },
        { code: 'MIR',         shortCode: 'MR', label: 'مادة',       icon: '📦', color: 'bg-purple-100 text-purple-700' },
        { code: 'RFI',         shortCode: 'RF', label: 'طلب معلومات', icon: '❓', color: 'bg-amber-100 text-amber-700' },
        { code: 'BOOKS',       shortCode: 'LT', label: 'كتب',         icon: '📚', color: 'bg-emerald-100 text-emerald-700' },
      ];
      for (const cat of categories) {
        await db.category.upsert({
          where: { code: cat.code },
          create: cat,
          update: { label: cat.label, icon: cat.icon, color: cat.color, shortCode: cat.shortCode },
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
  // Run migrations first (adds new columns, drops old unique index, etc.)
  ensureMigrations().catch(() => {});
  ensureSeedData().catch(() => {});
}

export async function ensureMigrations(): Promise<void> {
  try {
    const colExists = async (table: string, col: string): Promise<boolean> => {
      try { const r = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`) as any[]; return r.some((x: any) => x.name === col); } catch { return false; }
    };
    for (const [t, c] of [['Transmittal','alternativeTitle'],['Transmittal','disciplineCode'],['Transmittal','parentTransmittalId'],['Category','labelEn'],['Category','templatePath'],['Category','templateType'],['Category','shortCode'],['Discipline','labelEn'],['DocType','labelEn'],['DocType','categoryCode'],['Attachment','url'],['Attachment','urlSource']]) {
      if (!(await colExists(t, c))) await db.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "${c}" TEXT`);
    }

    // Migration: convert old 'withdrawn' action values to 'cancelled'
    // This runs on every startup — safe and idempotent
    try {
      const updated = await db.$executeRawUnsafe(`UPDATE "Revision" SET action = 'cancelled' WHERE action = 'withdrawn'`);
      if (updated > 0) console.log(`[migrations] Converted ${updated} revisions from 'withdrawn' to 'cancelled'`);
    } catch (e) {
      // Non-fatal — table may not exist yet on first run
    }

    // Migration: drop the global unique index on Transmittal.reference (if exists)
    // and add a composite unique index on (category, reference) instead.
    // This allows CIV-001 in TRANSMITTAL and CIV-001 in MIR to coexist.
    try {
      // SQLite stores unique constraints as indexes — find and drop the global one
      const indexes = await db.$queryRawUnsafe(`PRAGMA index_list("Transmittal")`) as any[];
      for (const idx of indexes) {
        const idxName = String(idx.name || '');
        const isUnique = Number(idx.unique) === 1;
        // Drop the old global unique index on "reference" (single-column, NOT composite)
        if (isUnique && idxName === 'Transmittal_reference_key') {
          console.log(`[migrations] Dropping global unique index: ${idxName}`);
          try {
            await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Transmittal_reference_key"`);
          } catch (dropErr) {
            console.error('[migrations] Failed to drop index:', dropErr);
          }
        }
      }
      // Add composite unique index on (category, reference) if not exists
      // Use CREATE IF NOT EXISTS so it's idempotent
      try {
        console.log('[migrations] Ensuring composite unique index on (category, reference)');
        await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Transmittal_category_reference_key" ON "Transmittal"("category", "reference")`);
      } catch (createErr) {
        // If it fails because of duplicate (category, reference) rows, log but don't crash
        console.error('[migrations] Could not create composite index:', createErr);
      }
    } catch (e) {
      console.error('[migrations] reference index migration failed:', e);
      // Non-fatal — the app can still run, just with global uniqueness
    }
  } catch (e) { console.error('[migrations]', e); }
}
