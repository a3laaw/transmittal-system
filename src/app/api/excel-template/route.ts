import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Transmittal', { views: [{ rightToLeft: true, showGridLines: false }] });

    // Parse date
    let dateDisplay: string;
    try {
      const dt = new Date(dateStr);
      dateDisplay = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    } catch { dateDisplay = dateStr; }

    // Title
    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = 'SABAH ALSALEM SOUTH HEALTH CENTER';
    ws.getCell('A1').font = { size: 14, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    // Header info
    ws.getCell('G3').value = `Transmittal No:${reference}`;
    ws.getCell('I3').value = 'Rev.00';
    ws.getCell('G4').value = `Date :${dateDisplay}`;

    ws.getCell('B5').value = 'CONTRACTOR:';
    ws.getCell('B6').value = 'TRANSMISSION OF DRAWINGS, DOCUMENTS, SAMPLES ETC.';
    ws.getCell('B8').value = 'RE: CONTRACT';
    ws.getCell('B9').value = 'CLOVER 2 - BID PACKAGE 2';
    ws.getCell('B10').value = 'TO:';
    ws.getCell('C10').value = 'RESIDENT ENGINEER';
    ws.getCell('E10').value = 'C.C:';
    ws.getCell('F10').value = 'MREC';
    ws.getCell('C11').value = 'Soor Engineering Bureau';
    ws.getCell('B12').value = 'WE ARE SENDING HEREWITH / UNDER SEPARATE COVER, THE DRAWINGS /';
    ws.getCell('B13').value = 'DOCUMENTS / SAMPLES LISTED BELOW. (DELETE AS NECESSARY)';

    // Submit codes table (right side)
    ws.getCell('G5').value = 'SUBMITTED FOR'; ws.getCell('I5').value = 'CODE';
    ws.getCell('G6').value = 'APPROVAL'; ws.getCell('I6').value = 1;
    ws.getCell('G7').value = 'YOUR INFORMATION'; ws.getCell('I7').value = 2;
    ws.getCell('G8').value = 'ACTION';
    ws.getCell('G9').value = 'APPROVED'; ws.getCell('I9').value = 'A';
    ws.getCell('G10').value = 'APPROVED AS NOTED'; ws.getCell('I10').value = 'B';
    ws.getCell('G11').value = 'APPROVED AS NOTED&RESUBMIT'; ws.getCell('I11').value = 'C';
    ws.getCell('G12').value = 'NOT APPROVED'; ws.getCell('I12').value = 'D';
    ws.getCell('G13').value = 'FOR INFORMATION / MORE INFO. REQUIRED'; ws.getCell('I13').value = 'E';

    // Item table headers
    ws.getCell('B14').value = 'QTY';
    ws.getCell('C14').value = 'DRWS. SPEC. O';
    ws.getCell('D14').value = 'ITEM SEQ';
    ws.getCell('E14').value = 'DESCRIPTION';
    ws.getCell('G14').value = '(+)TYP';
    ws.getCell('H14').value = 'CODE';
    ws.getCell('C15').value = 'BOQ. REF.';
    ws.getCell('D15').value = 'NUMBER';
    ws.getCell('H15').value = 'Submittal*';
    ws.getCell('I15').value = 'Action**';

    // Fill description lines (rows 16-26)
    if (description) {
      const parts = description.split(/\s*[&/]\s*|\n/).map(p => p.trim()).filter(p => p);
      parts.slice(0, 11).forEach((part, i) => {
        const row = 16 + i;
        ws.getCell(`E${row}`).value = part;
      });
    }

    // Footer
    ws.getCell('C28').value = 'A ) SUBMITTAL IS AS PER SPECS.';
    ws.getCell('G28').value = 'B) SUBSTITUE SUBMITTAL';
    ws.getCell('D31').value = 'FOR CONTRACTOR';
    ws.getCell('B32').value = "Engineer's Rep. to enter Action Codes and Remarks.";
    ws.getCell('B33').value = 'REMARKS:';
    ws.getCell('C33').value = 'SOOR ENGEERING BUREAU S.E.B';
    ws.getCell('G33').value = '    REMARKS:         Ministry of Health M.O.H';

    // Apply borders to item table area (B14:I26)
    const thin = { style: 'thin' as const, color: { argb: '000000' } };
    for (let r = 14; r <= 26; r++) {
      for (let c = 2; c <= 9; c++) {
        ws.getCell(r, c).border = { top: thin, bottom: thin, left: thin, right: thin };
      }
    }
    // Borders for code table
    for (let r = 5; r <= 13; r++) {
      for (let c = 7; c <= 9; c++) {
        ws.getCell(r, c).border = { top: thin, bottom: thin, left: thin, right: thin };
      }
    }

    // Column widths
    ws.getColumn(1).width = 1.5;
    ws.getColumn(2).width = 9;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 15;
    ws.getColumn(5).width = 6;
    ws.getColumn(6).width = 21;
    ws.getColumn(7).width = 9;
    ws.getColumn(8).width = 15;
    ws.getColumn(9).width = 10;

    // Row heights
    ws.getRow(1).height = 54;
    ws.getRow(3).height = 20;
    ws.getRow(16).height = 27;
    ws.getRow(17).height = 27;

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Transmittal-${reference}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `فشل توليد الملف: ${e.message}` }, { status: 500 });
  }
}
