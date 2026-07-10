/**
 * Generate Excel transmittal file from template — JavaScript fallback.
 * Run via: node gen_excel_js.js <output_path> <reference> <date_YYYY-MM-DD> <description>
 *
 * This rebuilds the TRANSIMITALS_template.xlsx structure using ExcelJS,
 * preserving all merged cells, column widths, borders, and cell values.
 * Used as a fallback when Python is blocked (publish mode).
 */
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const [outPath, reference, dateStr, description] = process.argv.slice(2);

if (!outPath || !reference) {
  console.error('Usage: node gen_excel_js.js <output> <reference> [date] [description]');
  process.exit(1);
}

// Parse date
let dateDisplay = dateStr || new Date().toISOString().slice(0, 10);
try {
  const dt = new Date(dateDisplay + 'T00:00:00');
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  dateDisplay = `${dd}/${mm}/${yyyy}`;
} catch {}

// Create workbook
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet(reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal', {
  views: [{ showGridLines: false }],
});

// === Column widths (A-I) ===
const colWidths = {
  A: 1.29, B: 8.71, C: 20.29, D: 15.14, E: 5.29,
  F: 20.86, G: 8.86, H: 15.14, I: 10.0,
};
Object.entries(colWidths).forEach(([col, width]) => {
  ws.getColumn(col).width = width;
});

// === Styles ===
const thinBorder = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};
const centerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
const leftAlign = { horizontal: 'left', vertical: 'middle', wrapText: true };
const boldFont = { name: 'Calibri', size: 11, bold: true };
const normalFont = { name: 'Calibri', size: 11 };

// === Header section (rows 2-13) ===
// Row 2: Title
ws.mergeCells('B2:I2');
ws.getCell('B2').value = '       SABAH ALSALEM SOUTH HEALTH CENTER';
ws.getCell('B2').font = boldFont;
ws.getCell('B2').alignment = centerAlign;

// Row 3: Transmittal No + Rev
ws.mergeCells('G3:H3');
ws.getCell('G3').value = `Transmittal No:${reference}`;
ws.getCell('G3').font = boldFont;
ws.getCell('G3').alignment = centerAlign;
ws.getCell('I3').value = 'Rev.00';
ws.getCell('I3').font = boldFont;
ws.getCell('I3').alignment = centerAlign;
ws.getCell('I3').border = thinBorder;

// Row 4: Date
ws.mergeCells('G4:H4');
ws.getCell('G4').value = `Date :${dateDisplay}`;
ws.getCell('G4').font = boldFont;
ws.getCell('G4').alignment = centerAlign;

// Row 5: Contractor + SUBMITTED FOR header
ws.mergeCells('B5:F5');
ws.getCell('B5').value = 'CONTRACTOR: ';
ws.getCell('B5').font = boldFont;
ws.getCell('B5').alignment = leftAlign;
ws.mergeCells('G5:H5');
ws.getCell('G5').value = 'SUBMITTED FOR';
ws.getCell('G5').font = boldFont;
ws.getCell('G5').alignment = centerAlign;
ws.getCell('G5').border = thinBorder;
ws.getCell('H5').border = thinBorder;
ws.getCell('I5').value = 'CODE';
ws.getCell('I5').font = boldFont;
ws.getCell('I5').alignment = centerAlign;
ws.getCell('I5').border = thinBorder;

// Row 6: Transmission description + APPROVAL
ws.mergeCells('B6:F6');
ws.getCell('B6').value = 'TRANSMISSION OF DRAWINGS, DOCUMENTS, SAMPLES ETC.';
ws.getCell('B6').font = normalFont;
ws.getCell('B6').alignment = leftAlign;
ws.mergeCells('G6:H6');
ws.getCell('G6').value = 'APPROVAL';
ws.getCell('G6').font = boldFont;
ws.getCell('G6').alignment = centerAlign;
ws.getCell('G6').border = thinBorder;
ws.getCell('H6').border = thinBorder;
ws.getCell('I6').value = 1;
ws.getCell('I6').alignment = centerAlign;
ws.getCell('I6').border = thinBorder;

// Row 7: YOUR INFORMATION
ws.mergeCells('G7:H7');
ws.getCell('G7').value = 'YOUR INFORMATION';
ws.getCell('G7').font = boldFont;
ws.getCell('G7').alignment = centerAlign;
ws.getCell('G7').border = thinBorder;
ws.getCell('H7').border = thinBorder;
ws.getCell('I7').value = 2;
ws.getCell('I7').alignment = centerAlign;
ws.getCell('I7').border = thinBorder;

// Row 8: RE: CONTRACT + ACTION header
ws.getCell('B8').value = 'RE: CONTRACT';
ws.getCell('B8').font = boldFont;
ws.mergeCells('G8:H8');
ws.getCell('G8').value = 'ACTION';
ws.getCell('G8').font = boldFont;
ws.getCell('G8').alignment = centerAlign;
ws.getCell('G8').border = thinBorder;
ws.getCell('H8').border = thinBorder;

// Row 9: CLOVER 2 - BID PACKAGE 2 + APPROVED
ws.getCell('B9').value = 'CLOVER 2 - BID PACKAGE 2';
ws.getCell('B9').font = normalFont;
ws.getCell('G9').value = 'APPROVED';
ws.getCell('G9').font = normalFont;
ws.getCell('G9').alignment = centerAlign;
ws.getCell('G9').border = thinBorder;
ws.getCell('I9').value = 'A';
ws.getCell('I9').alignment = centerAlign;
ws.getCell('I9').border = thinBorder;

// Row 10: TO: + Resident Engineer + C.C: + MREC + APPROVED AS NOTED + B
ws.getCell('B10').value = 'TO:';
ws.getCell('B10').font = boldFont;
ws.getCell('C10').value = 'RESIDENT ENGINEER';
ws.getCell('C10').font = normalFont;
ws.getCell('E10').value = 'C.C:';
ws.getCell('E10').font = boldFont;
ws.getCell('F10').value = 'MREC';
ws.getCell('F10').font = normalFont;
ws.getCell('G10').value = 'APPROVED AS NOTED';
ws.getCell('G10').font = normalFont;
ws.getCell('G10').alignment = centerAlign;
ws.getCell('G10').border = thinBorder;
ws.getCell('I10').value = 'B';
ws.getCell('I10').alignment = centerAlign;
ws.getCell('I10').border = thinBorder;

// Row 11: Soor Engineering Bureau + APPROVED AS NOTED&RESUBMIT + C
ws.getCell('C11').value = 'Soor Engineering Bureau';
ws.getCell('C11').font = normalFont;
ws.mergeCells('G11:H11');
ws.getCell('G11').value = 'APPROVED AS NOTED&RESUBMIT';
ws.getCell('G11').font = normalFont;
ws.getCell('G11').alignment = centerAlign;
ws.getCell('G11').border = thinBorder;
ws.getCell('H11').border = thinBorder;
ws.getCell('I11').value = 'C';
ws.getCell('I11').alignment = centerAlign;
ws.getCell('I11').border = thinBorder;

// Row 12: WE ARE SENDING... + NOT APPROVED + D
ws.mergeCells('B12:F12');
ws.getCell('B12').value = 'WE ARE SENDING HEREWITH / UNDER SEPARATE COVER, THE DRAWINGS / ';
ws.getCell('B12').font = normalFont;
ws.getCell('B12').alignment = leftAlign;
ws.mergeCells('G12:H12');
ws.getCell('G12').value = 'NOT APPROVED';
ws.getCell('G12').font = normalFont;
ws.getCell('G12').alignment = centerAlign;
ws.getCell('G12').border = thinBorder;
ws.getCell('H12').border = thinBorder;
ws.getCell('I12').value = 'D';
ws.getCell('I12').alignment = centerAlign;
ws.getCell('I12').border = thinBorder;

// Row 13: DOCUMENTS / SAMPLES... + FOR INFORMATION + E
ws.getCell('B13').value = 'DOCUMENTS / SAMPLES LISTED BELOW. (DELETE AS NECESSARY)';
ws.getCell('B13').font = normalFont;
ws.mergeCells('G13:H13');
ws.getCell('G13').value = 'FOR INFORMATION / MORE INFO. REQUIRED';
ws.getCell('G13').font = normalFont;
ws.getCell('G13').alignment = centerAlign;
ws.getCell('G13').border = thinBorder;
ws.getCell('H13').border = thinBorder;
ws.getCell('I13').value = 'E';
ws.getCell('I13').alignment = centerAlign;
ws.getCell('I13').border = thinBorder;

// === Table header (rows 14-15) ===
// Row 14
ws.getCell('B14').value = 'QTY';
ws.getCell('B14').font = boldFont;
ws.getCell('B14').alignment = centerAlign;
ws.getCell('B14').border = thinBorder;
ws.getCell('C14').value = 'DRWS. SPEC. O';
ws.getCell('C14').font = boldFont;
ws.getCell('C14').alignment = centerAlign;
ws.getCell('C14').border = thinBorder;
ws.getCell('D14').value = 'ITEM SEQ';
ws.getCell('D14').font = boldFont;
ws.getCell('D14').alignment = centerAlign;
ws.getCell('D14').border = thinBorder;
ws.mergeCells('E14:F15');
ws.getCell('E14').value = 'DESCRIPTION';
ws.getCell('E14').font = boldFont;
ws.getCell('E14').alignment = centerAlign;
ws.getCell('E14').border = thinBorder;
ws.getCell('F14').border = thinBorder;
ws.getCell('F15').border = thinBorder;
ws.getCell('E15').border = thinBorder;
ws.getCell('G14').value = '(+)TYP';
ws.getCell('G14').font = boldFont;
ws.getCell('G14').alignment = centerAlign;
ws.getCell('G14').border = thinBorder;
ws.mergeCells('H14:I14');
ws.getCell('H14').value = 'CODE';
ws.getCell('H14').font = boldFont;
ws.getCell('H14').alignment = centerAlign;
ws.getCell('H14').border = thinBorder;
ws.getCell('I14').border = thinBorder;

// Row 15
ws.getCell('C15').value = 'BOQ. REF.';
ws.getCell('C15').font = normalFont;
ws.getCell('C15').alignment = centerAlign;
ws.getCell('C15').border = thinBorder;
ws.getCell('D15').value = 'NUMBER';
ws.getCell('D15').font = normalFont;
ws.getCell('D15').alignment = centerAlign;
ws.getCell('D15').border = thinBorder;
ws.getCell('G15').border = thinBorder;
ws.getCell('H15').value = 'Submittal*';
ws.getCell('H15').font = normalFont;
ws.getCell('H15').alignment = centerAlign;
ws.getCell('H15').border = thinBorder;
ws.getCell('I15').value = 'Action**';
ws.getCell('I15').font = normalFont;
ws.getCell('I15').alignment = centerAlign;
ws.getCell('I15').border = thinBorder;

// === Data rows (16-26) with borders ===
// Fill description into item rows
if (description) {
  const parts = description
    .split(/\s*[&/]\s*|\n|,(?=\s)/)
    .map(p => p.trim())
    .filter(Boolean);
  const maxRows = 11;
  parts.slice(0, maxRows).forEach((part, i) => {
    const row = 16 + i;
    ws.getCell(`E${row}`).value = part;
    ws.getCell(`E${row}`).font = normalFont;
    ws.getCell(`E${row}`).alignment = leftAlign;
  });
}

// Apply borders to all cells in rows 16-26, columns B-I
for (let r = 16; r <= 26; r++) {
  for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
    ws.getCell(`${col}${r}`).border = thinBorder;
  }
}

// === Footer rows ===
// Row 28: Signature line
ws.mergeCells('G28:I28');
ws.getCell('G28').value = 'Signature';
ws.getCell('G28').font = boldFont;
ws.getCell('G28').alignment = centerAlign;
ws.getCell('G28').border = thinBorder;

// Row 31: Date
ws.mergeCells('D31:E31');
ws.getCell('D31').value = 'Date';
ws.getCell('D31').font = boldFont;
ws.getCell('D31').alignment = centerAlign;
ws.getCell('D31').border = thinBorder;

// Rows 32: Remarks
ws.mergeCells('B32:I32');
ws.getCell('B32').value = 'REMARKS:';
ws.getCell('B32').font = boldFont;
ws.getCell('B32').alignment = leftAlign;

// Row 56: bottom signature
ws.mergeCells('B56:I56');
ws.getCell('B56').value = 'CONTRACTOR';
ws.getCell('B56').font = boldFont;
ws.getCell('B56').alignment = centerAlign;

// Save
wb.xlsx.writeFile(outPath).then(() => {
  const stats = fs.statSync(outPath);
  console.log(JSON.stringify({ ok: true, size: stats.size, sheet: wb.worksheets[0].name }));
}).catch(e => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
