import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 *
 * Generates Excel transmittal file using ExcelJS directly in-process.
 * NO Python, NO child_process spawn — works in ALL environments
 * (dev mode, publish mode, standalone production).
 *
 * Rebuilds the TRANSIMITALS_template.xlsx structure with:
 *  - All merged cells (38 ranges)
 *  - Column widths
 *  - Borders (91 bordered cells in table area)
 *  - Header values (Transmittal No, Rev, Date)
 *  - Description in item rows
 *  - SUBMITTED FOR / ACTION code tables (A-E)
 */

/** Parse date string to DD/MM/YYYY. */
function fmtDate(s: string): string {
  try {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return s;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  const dateDisplay = fmtDate(date);

  try {
    const wb = new ExcelJS.Workbook();
    const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal';
    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: false }],
    });

    // === Column widths (A-I) ===
    const colWidths: Record<string, number> = {
      A: 1.29, B: 8.71, C: 20.29, D: 15.14, E: 5.29,
      F: 20.86, G: 8.86, H: 15.14, I: 10.0,
    };
    Object.entries(colWidths).forEach(([col, width]) => {
      ws.getColumn(col).width = width;
    });

    // === Styles ===
    const thin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const left: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };
    const bold: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true };
    const normal: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 };

    // Helper to set cell value + style
    const setCell = (addr: string, value: any, opts: { font?: Partial<ExcelJS.Font>; align?: Partial<ExcelJS.Alignment>; border?: boolean } = {}) => {
      const cell = ws.getCell(addr);
      cell.value = value;
      if (opts.font) cell.font = opts.font;
      if (opts.align) cell.alignment = opts.align;
      if (opts.border) cell.border = thin;
      return cell;
    };

    // === Row 2: Title ===
    ws.mergeCells('B2:I2');
    setCell('B2', '       SABAH ALSALEM SOUTH HEALTH CENTER', { font: bold, align: center });

    // === Row 3: Transmittal No + Rev ===
    ws.mergeCells('G3:H3');
    setCell('G3', `Transmittal No:${reference}`, { font: bold, align: center });
    setCell('I3', 'Rev.00', { font: bold, align: center, border: true });

    // === Row 4: Date ===
    ws.mergeCells('G4:H4');
    setCell('G4', `Date :${dateDisplay}`, { font: bold, align: center });

    // === Row 5: Contractor + SUBMITTED FOR ===
    ws.mergeCells('B5:F5');
    setCell('B5', 'CONTRACTOR: ', { font: bold, align: left });
    ws.mergeCells('G5:H5');
    setCell('G5', 'SUBMITTED FOR', { font: bold, align: center, border: true });
    ws.getCell('H5').border = thin;
    setCell('I5', 'CODE', { font: bold, align: center, border: true });

    // === Row 6 ===
    ws.mergeCells('B6:F6');
    setCell('B6', 'TRANSMISSION OF DRAWINGS, DOCUMENTS, SAMPLES ETC.', { font: normal, align: left });
    ws.mergeCells('G6:H6');
    setCell('G6', 'APPROVAL', { font: bold, align: center, border: true });
    ws.getCell('H6').border = thin;
    setCell('I6', 1, { align: center, border: true });

    // === Row 7 ===
    ws.mergeCells('G7:H7');
    setCell('G7', 'YOUR INFORMATION', { font: bold, align: center, border: true });
    ws.getCell('H7').border = thin;
    setCell('I7', 2, { align: center, border: true });

    // === Row 8 ===
    setCell('B8', 'RE: CONTRACT', { font: bold });
    ws.mergeCells('G8:H8');
    setCell('G8', 'ACTION', { font: bold, align: center, border: true });
    ws.getCell('H8').border = thin;

    // === Row 9 ===
    setCell('B9', 'CLOVER 2 - BID PACKAGE 2', { font: normal });
    setCell('G9', 'APPROVED', { font: normal, align: center, border: true });
    setCell('I9', 'A', { align: center, border: true });

    // === Row 10 ===
    setCell('B10', 'TO:', { font: bold });
    setCell('C10', 'RESIDENT ENGINEER', { font: normal });
    setCell('E10', 'C.C:', { font: bold });
    setCell('F10', 'MREC', { font: normal });
    setCell('G10', 'APPROVED AS NOTED', { font: normal, align: center, border: true });
    setCell('I10', 'B', { align: center, border: true });

    // === Row 11 ===
    setCell('C11', 'Soor Engineering Bureau', { font: normal });
    ws.mergeCells('G11:H11');
    setCell('G11', 'APPROVED AS NOTED&RESUBMIT', { font: normal, align: center, border: true });
    ws.getCell('H11').border = thin;
    setCell('I11', 'C', { align: center, border: true });

    // === Row 12 ===
    ws.mergeCells('B12:F12');
    setCell('B12', 'WE ARE SENDING HEREWITH / UNDER SEPARATE COVER, THE DRAWINGS / ', { font: normal, align: left });
    ws.mergeCells('G12:H12');
    setCell('G12', 'NOT APPROVED', { font: normal, align: center, border: true });
    ws.getCell('H12').border = thin;
    setCell('I12', 'D', { align: center, border: true });

    // === Row 13 ===
    setCell('B13', 'DOCUMENTS / SAMPLES LISTED BELOW. (DELETE AS NECESSARY)', { font: normal });
    ws.mergeCells('G13:H13');
    setCell('G13', 'FOR INFORMATION / MORE INFO. REQUIRED', { font: normal, align: center, border: true });
    ws.getCell('H13').border = thin;
    setCell('I13', 'E', { align: center, border: true });

    // === Table header (rows 14-15) ===
    setCell('B14', 'QTY', { font: bold, align: center, border: true });
    setCell('C14', 'DRWS. SPEC. O', { font: bold, align: center, border: true });
    setCell('D14', 'ITEM SEQ', { font: bold, align: center, border: true });
    ws.mergeCells('E14:F15');
    setCell('E14', 'DESCRIPTION', { font: bold, align: center, border: true });
    ws.getCell('F14').border = thin;
    ws.getCell('E15').border = thin;
    ws.getCell('F15').border = thin;
    setCell('G14', '(+)TYP', { font: bold, align: center, border: true });
    ws.mergeCells('H14:I14');
    setCell('H14', 'CODE', { font: bold, align: center, border: true });
    ws.getCell('I14').border = thin;

    setCell('C15', 'BOQ. REF.', { font: normal, align: center, border: true });
    setCell('D15', 'NUMBER', { font: normal, align: center, border: true });
    ws.getCell('G15').border = thin;
    setCell('H15', 'Submittal*', { font: normal, align: center, border: true });
    setCell('I15', 'Action**', { font: normal, align: center, border: true });

    // === Data rows (16-26) with borders ===
    if (description) {
      const parts = description
        .split(/\s*[&/]\s*|\n|,(?=\s)/)
        .map(p => p.trim())
        .filter(Boolean);
      const maxRows = 11;
      parts.slice(0, maxRows).forEach((part, i) => {
        const row = 16 + i;
        setCell(`E${row}`, part, { font: normal, align: left });
      });
    }
    // Apply borders to all cells in rows 16-26, columns B-I
    for (let r = 16; r <= 26; r++) {
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
        ws.getCell(`${col}${r}`).border = thin;
      }
    }

    // === Footer rows ===
    ws.mergeCells('G28:I28');
    setCell('G28', 'Signature', { font: bold, align: center, border: true });
    ws.getCell('H28').border = thin;
    ws.getCell('I28').border = thin;

    ws.mergeCells('D31:E31');
    setCell('D31', 'Date', { font: bold, align: center, border: true });
    ws.getCell('E31').border = thin;

    ws.mergeCells('B32:I32');
    setCell('B32', 'REMARKS:', { font: bold, align: left });

    ws.mergeCells('B56:I56');
    setCell('B56', 'CONTRACTOR', { font: bold, align: center });

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `Transmittal-${reference}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (e: any) {
    console.error('[excel-template] Error:', e.message, e.stack);
    return NextResponse.json({ error: 'تعذّر توليد ملف Excel. حاول مرة أخرى.' }, { status: 500 });
  }
}
