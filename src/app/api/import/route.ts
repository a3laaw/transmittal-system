import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/import
 * Body: FormData with file = LOG_Final.xlsm or TRANSIMITALS.xlsx
 *
 * Reads Excel using SheetJS (xlsx) — JavaScript, no Python needed.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 });
  }

  // Read file buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse Excel with SheetJS
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetNames = workbook.SheetNames;

  const DISCIPLINE_SHEETS = ['CIV', 'EL', 'PL', 'HVAC', 'FF', 'ELVE'];

  const extracted: any[] = [];

  for (const sn of sheetNames) {
    const discCode = sn.trim().toUpperCase();
    if (!DISCIPLINE_SHEETS.includes(discCode)) continue;

    const ws = workbook.Sheets[sn];
    if (!ws) continue;

    // Convert to JSON array (header row at row 4, data starts at row 6)
    // Columns: A=#, B=type, C=Reference, D=Description, E=SubmitDate, F=ReplyDate, G=Action
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 5, defval: null });

    for (const row of rows) {
      const reference = String(row[2] || '').trim();
      const description = String(row[3] || '').trim();
      const typeVal = String(row[1] || '').trim();

      if (!description && !reference) continue;
      if (!description) continue;

      // Build revisions
      const revisions = [];
      for (let revIdx = 0; revIdx < 8; revIdx++) {
        const submitCol = 4 + revIdx * 3;
        const replyCol = 5 + revIdx * 3;
        const actionCol = 6 + revIdx * 3;

        const submit = row[submitCol];
        const reply = row[replyCol];
        const actionRaw = String(row[actionCol] || '').toLowerCase().trim();

        if (!submit && !actionRaw) continue;

        let action = '';
        let approvalType = '';
        if (actionRaw.includes('approved') && actionRaw.includes('noted') && actionRaw.includes('resubmit')) {
          action = 'approved'; approvalType = 'APPROVED_AS_NOTED_RESUBMIT';
        } else if (actionRaw.includes('approved') && actionRaw.includes('noted')) {
          action = 'approved'; approvalType = 'APPROVED_AS_NOTED';
        } else if (actionRaw.includes('not approved') || actionRaw.includes('not_approve')) {
          action = 'approved'; approvalType = 'NOT_APPROVED';
        } else if (actionRaw.includes('for information') || actionRaw.includes('more info')) {
          action = 'approved'; approvalType = 'FOR_INFORMATION';
        } else if (actionRaw === 'approved' || actionRaw.includes('approved')) {
          action = 'approved'; approvalType = 'APPROVED';
        } else if (actionRaw.includes('reject')) {
          action = 'rejected';
        } else if (actionRaw.includes('withdrawn') || actionRaw.includes('withdraw')) {
          action = 'withdrawn';
        } else if (actionRaw.includes('pending')) {
          action = ''; // don't store pending
        } else if (actionRaw) {
          action = actionRaw;
        }

        if (submit || action) {
          revisions.push({
            revNumber: revIdx,
            submitDate: submit instanceof Date ? submit.toISOString() : (submit ? String(submit) : null),
            replyDate: reply instanceof Date ? reply.toISOString() : (reply ? String(reply) : null),
            action: action || null,
            approvalType: action === 'approved' ? approvalType : null,
          });
        }
      }

      // Consultant status (column 29 = AC)
      const consultantRaw = String(row[28] || '').trim();
      const mohRaw = String(row[29] || '').trim();

      const normStatus = (s: string) => {
        if (!s) return '';
        const sl = s.toLowerCase();
        if (sl.includes('approved') && !sl.includes('overdue')) return 'Approved';
        if (sl.includes('overdue')) return 'Overdue';
        if (sl.includes('under review') || sl.includes('pending')) return 'Under Review';
        if (sl.includes('cancelled')) return 'Cancelled';
        if (sl.includes('submit') && sl.includes('rev')) return 'Submit Next Rev';
        return s;
      };

      extracted.push({
        reference,
        discipline: discCode,
        type: typeVal,
        description,
        revisions,
        consultantStatus: normStatus(consultantRaw),
        mohStatus: normStatus(mohRaw),
      });
    }
  }

  // Clear DB
  await db.review.deleteMany();
  await db.revision.deleteMany();
  await db.transmittal.deleteMany();

  // Insert
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of extracted) {
    try {
      if (!item.description || !item.description.trim()) {
        skipped++;
        continue;
      }

      const t = await db.transmittal.create({
        data: {
          reference: item.reference,
          discipline: item.discipline,
          disciplineCode: item.discipline,
          category: 'TRANSMITTAL',
          type: item.type || null,
          description: item.description,
          revisions: {
            create: item.revisions.filter((r: any) => r.submitDate || r.action).map((r: any) => ({
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
    imported,
    skipped,
    errors: errors.slice(0, 20),
    totalExtracted: extracted.length,
  });
}
