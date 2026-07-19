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
 *
 * Each main category gets its own set of sub-disciplines (with labelEn for
 * bilingual support), so the user doesn't have to add them manually.
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

      // Create main categories (with labelEn for bilingual UI)
      const categories = [
        { code: 'TRANSMITTAL', label: 'ترانسميتال', labelEn: 'Transmittal', icon: '📄', color: 'bg-blue-100 text-blue-700', templatePath: '/api/templates/TRANSMITTAL', templateType: 'xlsx' },
        { code: 'MIR',         label: 'تفتيش مواد', labelEn: 'Material Inspection', icon: '📦', color: 'bg-purple-100 text-purple-700', templatePath: '/api/templates/MIR', templateType: 'xlsx' },
        { code: 'CHECK_LIST',  label: 'تشيك ليست',  labelEn: 'Check List', icon: '✅', color: 'bg-teal-100 text-teal-700', templatePath: '/api/templates/CHECK_LIST', templateType: 'xlsx' },
        { code: 'RFI',         label: 'طلب معلومات', labelEn: 'Request for Information', icon: '❓', color: 'bg-amber-100 text-amber-700' },
        { code: 'BOOKS',       label: 'كتب',         labelEn: 'Letters', icon: '📚', color: 'bg-emerald-100 text-emerald-700', templatePath: '/api/templates/BOOKS', templateType: 'docx' },
      ];
      for (const cat of categories) {
        await db.category.upsert({
          where: { code: cat.code },
          create: cat,
          update: { label: cat.label, labelEn: cat.labelEn, icon: cat.icon, color: cat.color, ...(cat.templatePath ? { templatePath: cat.templatePath, templateType: cat.templateType } : {}) },
        });
      }

      // Create disciplines — each main category gets its own set of sub-disciplines
      // Format: code, label (ar), labelEn (en), color, prefix, categoryCode
      const disciplines = [
        // TRANSMITTAL — 6 standard disciplines
        { code: 'CIV',  label: 'المدنية',     labelEn: 'Civil',          color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-',  categoryCode: 'TRANSMITTAL' },
        { code: 'EL',   label: 'الكهربائية',  labelEn: 'Electrical',     color: 'bg-purple-100 text-purple-700', prefix: 'EL-',   categoryCode: 'TRANSMITTAL' },
        { code: 'PL',   label: 'الصحي',       labelEn: 'Plumbing',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-',   categoryCode: 'TRANSMITTAL' },
        { code: 'HVAC', label: 'التكييف',     labelEn: 'HVAC',           color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-', categoryCode: 'TRANSMITTAL' },
        { code: 'FF',   label: 'الحريق',      labelEn: 'Fire Fighting',  color: 'bg-red-100 text-red-700',       prefix: 'FF-',   categoryCode: 'TRANSMITTAL' },
        { code: 'ELVE', label: 'المصاعد',     labelEn: 'Elevators',      color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ', categoryCode: 'TRANSMITTAL' },

        // MIR — material inspection disciplines (5)
        { code: 'MIR-CIV',  label: 'مواد مدنية',     labelEn: 'Civil Materials',      color: 'bg-amber-100 text-amber-700',   prefix: 'MIR-CIV-',  categoryCode: 'MIR' },
        { code: 'MIR-EL',   label: 'مواد كهربائية',  labelEn: 'Electrical Materials', color: 'bg-purple-100 text-purple-700', prefix: 'MIR-EL-',   categoryCode: 'MIR' },
        { code: 'MIR-PL',   label: 'مواد صحية',      labelEn: 'Plumbing Materials',   color: 'bg-cyan-100 text-cyan-700',     prefix: 'MIR-PL-',   categoryCode: 'MIR' },
        { code: 'MIR-HVAC', label: 'مواد تكييف',     labelEn: 'HVAC Materials',       color: 'bg-rose-100 text-rose-700',     prefix: 'MIR-HVAC-', categoryCode: 'MIR' },
        { code: 'MIR-FF',   label: 'مواد حريق',      labelEn: 'Fire Materials',       color: 'bg-red-100 text-red-700',       prefix: 'MIR-FF-',   categoryCode: 'MIR' },

        // CHECK_LIST — checklist disciplines (3)
        { code: 'CL-CIV',  label: 'تشيك ليست مدنية',    labelEn: 'Civil Checklist',    color: 'bg-amber-100 text-amber-700',   prefix: 'CL-CIV-',  categoryCode: 'CHECK_LIST' },
        { code: 'CL-EL',   label: 'تشيك ليست كهربائية', labelEn: 'Electrical Checklist', color: 'bg-purple-100 text-purple-700', prefix: 'CL-EL-',   categoryCode: 'CHECK_LIST' },
        { code: 'CL-MECH', label: 'تشيك ليست ميكانيكية', labelEn: 'Mechanical Checklist', color: 'bg-rose-100 text-rose-700',   prefix: 'CL-MECH-', categoryCode: 'CHECK_LIST' },

        // RFI — same 6 disciplines as TRANSMITTAL (different prefix to keep numbering separate)
        { code: 'RFI-CIV',  label: 'مدنية',     labelEn: 'Civil',          color: 'bg-amber-100 text-amber-700',   prefix: 'RFI-CIV-',  categoryCode: 'RFI' },
        { code: 'RFI-EL',   label: 'كهربائية',  labelEn: 'Electrical',     color: 'bg-purple-100 text-purple-700', prefix: 'RFI-EL-',   categoryCode: 'RFI' },
        { code: 'RFI-PL',   label: 'صحي',       labelEn: 'Plumbing',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'RFI-PL-',   categoryCode: 'RFI' },
        { code: 'RFI-HVAC', label: 'تكييف',     labelEn: 'HVAC',           color: 'bg-rose-100 text-rose-700',     prefix: 'RFI-HVAC-', categoryCode: 'RFI' },
        { code: 'RFI-FF',   label: 'حريق',      labelEn: 'Fire Fighting',  color: 'bg-red-100 text-red-700',       prefix: 'RFI-FF-',   categoryCode: 'RFI' },
        { code: 'RFI-ELVE', label: 'مصاعد',     labelEn: 'Elevators',      color: 'bg-emerald-100 text-emerald-700', prefix: 'RFI-ELVE-', categoryCode: 'RFI' },

        // BOOKS — incoming/outgoing letters (2 disciplines)
        { code: 'IN',  label: 'كتب واردة',  labelEn: 'Incoming Letters', color: 'bg-emerald-100 text-emerald-700', prefix: 'IN-',  categoryCode: 'BOOKS' },
        { code: 'OUT', label: 'كتب صادرة',  labelEn: 'Outgoing Letters', color: 'bg-blue-100 text-blue-700',       prefix: 'OUT-', categoryCode: 'BOOKS' },
      ];
      for (const d of disciplines) {
        await db.discipline.upsert({
          where: { code: d.code },
          create: d,
          update: { label: d.label, labelEn: d.labelEn, color: d.color, prefix: d.prefix, categoryCode: d.categoryCode },
        });
      }

      // Create doc types (with labelEn)
      const docTypes = [
        { code: 'SHOP_DRAWINGS',   label: 'رسم تنفيذي',          labelEn: 'Shop Drawings',         categoryCode: 'TRANSMITTAL' },
        { code: 'SAMPLE',          label: 'عينة',                labelEn: 'Sample',                categoryCode: 'TRANSMITTAL' },
        { code: 'SOURCE_APPROVAL', label: 'اعتماد مصدر',          labelEn: 'Source Approval',       categoryCode: 'TRANSMITTAL' },
        { code: 'TEST_REPORT',     label: 'تقرير اختبار',         labelEn: 'Test Report',           categoryCode: 'TRANSMITTAL' },
        { code: 'METHOD_STATEMENT',label: 'طريقة تنفيذ',          labelEn: 'Method Statement',      categoryCode: 'TRANSMITTAL' },
        { code: 'CALCULATION',     label: 'حسابات',              labelEn: 'Calculation',           categoryCode: 'TRANSMITTAL' },
        { code: 'SPECIFICATION',   label: 'مواصفات',             labelEn: 'Specification',         categoryCode: 'TRANSMITTAL' },
        { code: 'CATALOG',         label: 'كتالوج',              labelEn: 'Catalog',               categoryCode: 'TRANSMITTAL' },
        { code: 'AS_BUILT',        label: 'كما نُفذ',             labelEn: 'As Built',              categoryCode: 'TRANSMITTAL' },
        { code: 'OTHER',           label: 'أخرى',                labelEn: 'Other',                 categoryCode: 'TRANSMITTAL' },
      ];
      for (const dt of docTypes) {
        await db.docType.upsert({
          where: { code: dt.code },
          create: dt,
          update: { label: dt.label, labelEn: dt.labelEn, categoryCode: dt.categoryCode },
        });
      }

      console.log('[seed] ✅ Seed complete: 5 categories, 22 disciplines, 10 doc types');
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

/**
 * Ensure DB schema migrations are applied (for SQLite without proper migration tooling).
 * Adds columns that may be missing from older DB files. Safe to call multiple times.
 */
export async function ensureMigrations(): Promise<void> {
  try {
    // Check if columns exist; if not, ALTER TABLE to add them
    const colExists = async (table: string, col: string): Promise<boolean> => {
      try {
        const result = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`) as any[];
        return result.some((r: any) => r.name === col);
      } catch {
        return false;
      }
    };

    if (!(await colExists('Transmittal', 'alternativeTitle'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Transmittal" ADD COLUMN "alternativeTitle" TEXT');
    }
    if (!(await colExists('Transmittal', 'disciplineCode'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Transmittal" ADD COLUMN "disciplineCode" TEXT');
    }
    if (!(await colExists('Transmittal', 'parentTransmittalId'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Transmittal" ADD COLUMN "parentTransmittalId" TEXT');
    }
    if (!(await colExists('Category', 'labelEn'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Category" ADD COLUMN "labelEn" TEXT');
    }
    if (!(await colExists('Category', 'templatePath'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Category" ADD COLUMN "templatePath" TEXT');
    }
    if (!(await colExists('Category', 'templateType'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Category" ADD COLUMN "templateType" TEXT');
    }
    if (!(await colExists('Discipline', 'labelEn'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Discipline" ADD COLUMN "labelEn" TEXT');
    }
    if (!(await colExists('DocType', 'labelEn'))) {
      await db.$executeRawUnsafe('ALTER TABLE "DocType" ADD COLUMN "labelEn" TEXT');
    }
    if (!(await colExists('DocType', 'categoryCode'))) {
      await db.$executeRawUnsafe('ALTER TABLE "DocType" ADD COLUMN "categoryCode" TEXT');
    }
    if (!(await colExists('Attachment', 'url'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Attachment" ADD COLUMN "url" TEXT');
    }
    if (!(await colExists('Attachment', 'urlSource'))) {
      await db.$executeRawUnsafe('ALTER TABLE "Attachment" ADD COLUMN "urlSource" TEXT');
    }
  } catch (e) {
    console.error('[migrations] Error:', e);
  }
}
