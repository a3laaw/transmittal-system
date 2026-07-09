import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import * as XLSX from 'xlsx';
import { findExcelTemplate } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 *
 * Generates a new Excel transmittal file from the template using SheetJS
 * (pure JavaScript — no Python dependency).
 *
 * SheetJS loads the original TRANSIMITALS_template.xlsx preserving ALL
 * formatting: 38 merged ranges, column widths, borders, fonts, fills.
 * Then we set:
 *  - G3 = "Transmittal No:{reference}"
 *  - I3 = "Rev.00"
 *  - G4 = "Date :{DD/MM/YYYY}"
 *  - Description lines split into item rows starting at row 16
 *
 * Works in both dev and standalone production mode.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  const templatePath = findExcelTemplate();
  if (!existsSync(templatePath)) {
    return NextResponse.json(
      { error: `القالب غير موجود: ${templatePath}` },
      { status: 500 },
    );
  }

  // Parse date
  let dateDisplay = date;
  try {
    const dt = new Date(date + 'T00:00:00');
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    dateDisplay = `${dd}/${mm}/${yyyy}`;
  } catch { /* keep original */ }

  try {
    // Load the template with SheetJS, preserving all styles
    const templateBuf = await readFile(templatePath);
    const wb = XLSX.read(templateBuf, { cellStyles: true, cellDates: true });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    // Set header cells
    ws['G3'] = { t: 's', v: `Transmittal No:${reference}` };
    ws['I3'] = { t: 's', v: 'Rev.00' };
    ws['G4'] = { t: 's', v: `Date :${dateDisplay}` };

    // Detect DESCRIPTION column (row 14 or 15)
    let descCol = 5; // default E
    for (let r = 14; r <= 15 && descCol === 5; r++) {
      for (let c = 1; c <= 12; c++) {
        const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
        const cell = ws[addr];
        const v = String(cell?.v || '').toUpperCase();
        if (v.includes('DESCRIPTION')) {
          descCol = c;
          break;
        }
      }
    }

    // Split description into lines and fill item rows (16-26)
    if (description) {
      const parts = description
        .split(/\s*[&/]\s*|\n|,(?=\s)/)
        .map((p) => p.trim())
        .filter(Boolean);
      const maxRows = 11;
      parts.slice(0, maxRows).forEach((part, i) => {
        const row = 16 + i;
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: descCol - 1 });
        ws[addr] = { t: 's', v: part };
      });
    }

    // Rename sheet to reference (max 31 chars, alphanumeric/dash/underscore only)
    const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal';
    wb.SheetNames[0] = sheetName;

    // Write to buffer
    const outBuf = XLSX.write(wb, {
      type: 'buffer',
      cellStyles: true,
      cellDates: true,
      bookType: 'xlsx',
    });

    // Save to temp for debugging (optional)
    const tmpDir = path.join(os.tmpdir(), 'excel-gen');
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

    const filename = `Transmittal-${reference}.xlsx`;
    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(outBuf.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `فشل توليد الملف: ${e.message}` },
      { status: 500 },
    );
  }
}
