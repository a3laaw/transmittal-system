import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const DISCIPLINE_SHEETS = ['CIV', 'EL', 'PL', 'HVAC', 'FF', 'ELVE'];

/** Clean a cell value. */
function clean(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const dd = String(v.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  let s = String(v).trim();
  s = s.replace(/\s*\n\s*/g, ' / ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\xa0/g, ' ').trim();
  return s;
}

/** Parse action from Excel cell. Returns [action, approvalType]. */
function parseAction(v: any): [string, string] {
  const s = clean(v).toLowerCase();
  if (!s) return ['', ''];
  if (s.includes('approved') && s.includes('noted') && s.includes('resubmit')) return ['approved', 'APPROVED_AS_NOTED_RESUBMIT'];
  if (s.includes('approved') && s.includes('noted')) return ['approved', 'APPROVED_AS_NOTED'];
  if (s.includes('not approved') || s.includes('not_approve')) return ['approved', 'NOT_APPROVED'];
  if (s.includes('for information') || s.includes('more info')) return ['approved', 'FOR_INFORMATION'];
  if (s === 'approved' || s === 'approve' || s.includes('approved')) return ['approved', 'APPROVED'];
  if (s.includes('reject')) return ['rejected', ''];
  if (s.includes('withdrawn') || s.includes('withdraw')) return ['withdrawn', ''];
  if (s.includes('pending')) return ['', ''];
  return [s, ''];
}

/** Normalize review status. */
function normStatus(s: string): string {
  if (!s) return '';
  const sl = s.toLowerCase();
  if (sl.includes('approved') && !sl.includes('overdue')) return 'Approved';
  if (sl.includes('overdue')) return 'Overdue';
  if (sl.includes('under review') || sl.includes('pending')) return 'Under Review';
  if (sl.includes('cancelled')) return 'Cancelled';
  if (sl.includes('submit') && sl.includes('rev')) return 'Submit Next Rev';
  return s;
}

/** Extract transmittals from workbook using SheetJS (in-process, no spawn). */
function extractFromWorkbook(buf: Buffer): any[] {
  const wb = XLSX.read(buf, { cellDates: true, cellNF: false, cellText: false });
  const out: any[] = [];

  for (const sn of DISCIPLINE_SHEETS) {
    if (!wb.SheetNames.includes(sn)) continue;
    const ws = wb.Sheets[sn];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1, raw: true, defval: '', blankrows: false,
    }) as any[][];

    for (let r = 5; r < rows.length; r++) {
      const row = rows[r] || [];
      const reference = clean(row[2]);
      const description = clean(row[3]);
      const typeVal = clean(row[1]);
      if (!description) continue;

      const revisions: any[] = [];
      for (let revIdx = 0; revIdx < 8; revIdx++) {
        const submit = clean(row[4 + revIdx * 3]);
        const reply = clean(row[5 + revIdx * 3]);
        const [action, approvalType] = parseAction(row[6 + revIdx * 3]);
        if (submit || action) {
          revisions.push({
            revNumber: revIdx,
            submitDate: submit,
            replyDate: reply,
            action,
            approvalType: action === 'approved' ? approvalType : '',
          });
        }
      }

      const consultant = clean(row[28]);
      const moh = clean(row[29]);

      out.push({
        reference, discipline: sn, type: typeVal, description,
        revisions,
        consultantStatus: normStatus(consultant),
        mohStatus: normStatus(moh),
      });
    }
  }
  return out;
}

/**
 * POST /api/import — reads Excel file using SheetJS (in-process, no Python).
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Save to temp for debugging
  const tmpDir = path.join(os.tmpdir(), 'transmittal-import');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const uploadPath = path.join(tmpDir, `upload-${Date.now()}.${file.name.split('.').pop() || 'xlsm'}`);
  await writeFile(uploadPath, buffer);

  let extracted: any[];
  try {
    extracted = extractFromWorkbook(buffer);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'تعذّر قراءة الملف. تأكد من أنه ملف Excel صالح.' },
      { status: 500 },
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Clear DB
  await db.review.deleteMany();
  await db.revision.deleteMany();
  await db.transmittal.deleteMany();

  for (const item of extracted) {
    try {
      if (!item.description || !item.description.trim()) { skipped++; continue; }
      await db.transmittal.create({
        data: {
          reference: item.reference,
          discipline: item.discipline,
          disciplineCode: item.discipline,
          category: 'TRANSMITTAL',
          type: item.type || null,
          description: item.description,
          revisions: {
            create: item.revisions
              .filter((r: any) => r.submitDate || r.action)
              .map((r: any) => ({
                revNumber: r.revNumber,
                submitDate: r.submitDate ? new Date(r.submitDate) : null,
                replyDate: r.replyDate ? new Date(r.replyDate) : null,
                action: r.action || null,
                approvalType: r.action === 'approved' ? (r.approvalType || null) : null,
              })),
          },
          reviews: {
            create: [
              ...(item.consultantStatus ? [{ party: 'CONSULTANT', status: item.consultantStatus }] : []),
              ...(item.mohStatus ? [{ party: 'MOH', status: item.mohStatus }] : []),
            ],
          },
        },
      });
      imported++;
    } catch (e: any) {
      errors.push(`${item.reference || '(no ref)'}: ${e.message}`);
    }
  }

  return NextResponse.json({
    imported, skipped,
    errors: errors.slice(0, 20),
    totalExtracted: extracted.length,
  });
}
