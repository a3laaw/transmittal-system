-- ============================================
-- Transmittal Management System - Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- Category (الأقسام الرئيسية)
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT DEFAULT '📄',
    "color" TEXT DEFAULT 'bg-blue-100 text-blue-700',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- DocType (أنواع المستندات)
CREATE TABLE IF NOT EXISTS "DocType" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Discipline (التخصصات الفرعية)
CREATE TABLE IF NOT EXISTS "Discipline" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "categoryCode" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("categoryCode") REFERENCES "Category"("code") ON DELETE RESTRICT
);

-- Transmittal (الترانسميتالات)
CREATE TABLE IF NOT EXISTS "Transmittal" (
    "id" TEXT PRIMARY KEY,
    "reference" TEXT UNIQUE NOT NULL,
    "discipline" TEXT NOT NULL,
    "disciplineCode" TEXT,
    "category" TEXT DEFAULT 'TRANSMITTAL',
    "type" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("category") REFERENCES "Category"("code") ON DELETE RESTRICT
);

-- Revision (المراجعات)
CREATE TABLE IF NOT EXISTS "Revision" (
    "id" TEXT PRIMARY KEY,
    "transmittalId" TEXT NOT NULL,
    "revNumber" INTEGER NOT NULL,
    "submitDate" TIMESTAMP(3),
    "replyDate" TIMESTAMP(3),
    "action" TEXT,
    "approvalType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("transmittalId") REFERENCES "Transmittal"("id") ON DELETE CASCADE,
    UNIQUE("transmittalId", "revNumber")
);

-- Review (مراجعات الاستشاري والوزارة)
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT PRIMARY KEY,
    "transmittalId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "status" TEXT,
    "submitDate" TIMESTAMP(3),
    "submitRev" INTEGER,
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("transmittalId") REFERENCES "Transmittal"("id") ON DELETE CASCADE,
    UNIQUE("transmittalId", "party")
);

-- Attachment (المرفقات)
CREATE TABLE IF NOT EXISTS "Attachment" (
    "id" TEXT PRIMARY KEY,
    "transmittalId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT DEFAULT '',
    "fileType" TEXT DEFAULT '',
    "fileSize" INTEGER DEFAULT 0,
    "url" TEXT,
    "urlSource" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("transmittalId") REFERENCES "Transmittal"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_transmittal_discipline" ON "Transmittal"("discipline");
CREATE INDEX IF NOT EXISTS "idx_transmittal_disciplineCode" ON "Transmittal"("disciplineCode");
CREATE INDEX IF NOT EXISTS "idx_transmittal_category" ON "Transmittal"("category");
CREATE INDEX IF NOT EXISTS "idx_transmittal_reference" ON "Transmittal"("reference");
CREATE INDEX IF NOT EXISTS "idx_revision_transmittalId" ON "Revision"("transmittalId");
CREATE INDEX IF NOT EXISTS "idx_review_transmittalId" ON "Review"("transmittalId");
CREATE INDEX IF NOT EXISTS "idx_attachment_transmittalId" ON "Attachment"("transmittalId");

-- ============================================
-- Seed Data (البيانات الأولية)
-- ============================================

-- Categories
INSERT INTO "Category" ("id", "code", "label", "icon", "color") VALUES
('cat_transmittal', 'TRANSMITTAL', 'ترانسميتال', '📄', 'bg-blue-100 text-blue-700'),
('cat_mir', 'MIR', 'MIR - تفتيش مواد', '🔍', 'bg-orange-100 text-orange-700'),
('cat_rfi', 'RFI', 'RFI - طلب معلومات', '❓', 'bg-purple-100 text-purple-700'),
('cat_books', 'BOOKS', 'كتب', '📚', 'bg-emerald-100 text-emerald-700')
ON CONFLICT ("code") DO NOTHING;

-- DocTypes
INSERT INTO "DocType" ("id", "code", "label") VALUES
('dt_shop', 'SHOP DRAWINGS', 'رسم تنفيذي'),
('dt_sample', 'SAMPLE', 'عينة'),
('dt_source', 'SOURCE APPROVAL', 'اعتماد مصدر'),
('dt_company', 'COMPANY PROFILE', 'ملف شركة'),
('dt_test', 'TEST REPORT', 'تقرير اختبار'),
('dt_submittal', 'SUBMITTAL', 'طلب اعتماد'),
('dt_material', 'MATERIAL APPROVAL', 'اعتماد مادة'),
('dt_method', 'METHOD STATEMENT', 'طريقة تنفيذ'),
('dt_calc', 'CALCULATION', 'حسابات')
ON CONFLICT ("code") DO NOTHING;

-- Disciplines
INSERT INTO "Discipline" ("id", "code", "label", "color", "prefix", "categoryCode") VALUES
('disc_civ', 'CIV', 'المدنية', 'bg-amber-100 text-amber-700', 'CIV-', 'TRANSMITTAL'),
('disc_el', 'EL', 'الكهربائية', 'bg-purple-100 text-purple-700', 'EL-', 'TRANSMITTAL'),
('disc_pl', 'PL', 'الصحي', 'bg-cyan-100 text-cyan-700', 'PL-', 'TRANSMITTAL'),
('disc_hvac', 'HVAC', 'التكييف', 'bg-rose-100 text-rose-700', 'HAVC-', 'TRANSMITTAL'),
('disc_ff', 'FF', 'الحريق', 'bg-red-100 text-red-700', 'FF-', 'TRANSMITTAL'),
('disc_elve', 'ELVE', 'المصاعد', 'bg-emerald-100 text-emerald-700', 'ELEV ', 'TRANSMITTAL')
ON CONFLICT ("code") DO NOTHING;

-- ============================================
-- Done! Tables created and seeded.
-- ============================================
