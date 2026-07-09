/**
 * Standalone Node.js script to generate an Excel transmittal file from the template.
 * Run via: node gen_excel.js <template_path> <output_path> <reference> <date> <description>
 */
const XLSX = require('xlsx');
const fs = require('fs');

const [templatePath, outPath, reference, dateStr, description] = process.argv.slice(2);

if (!templatePath || !outPath || !reference) {
  console.error('Usage: node gen_excel.js <template> <output> <reference> [date] [description]');
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

// Load template
const templateBuf = fs.readFileSync(templatePath);
const wb = XLSX.read(templateBuf, { cellDates: true });
const wsName = wb.SheetNames[0];
const ws = wb.Sheets[wsName];

// Set header cells — modify .v ONLY (this is what works in direct tests)
ws['G3'].v = `Transmittal No:${reference}`;
ws['I3'].v = 'Rev.00';
ws['G4'].v = `Date :${dateDisplay}`;

// Detect DESCRIPTION column
let descCol = 5;
for (let r = 14; r <= 15; r++) {
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

// Fill description
if (description) {
  const parts = description
    .split(/\s*[&/]\s*|\n|,(?=\s)/)
    .map(p => p.trim())
    .filter(Boolean);
  const maxRows = 11;
  parts.slice(0, maxRows).forEach((part, i) => {
    const row = 16 + i;
    const addr = XLSX.utils.encode_cell({ r: row - 1, c: descCol - 1 });
    if (ws[addr]) {
      ws[addr].v = part;
    } else {
      ws[addr] = { t: 's', v: part };
    }
  });
}

// Rename sheet — must use book_new + book_append_sheet (just updating SheetNames[0]
// causes XLSX.write to produce empty output in SheetJS 0.18.5)
const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal';
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, ws, sheetName);

// Write to file
XLSX.writeFile(newWb, outPath, { cellDates: true });

// Verify
const verifyBuf = fs.readFileSync(outPath);
const wb2 = XLSX.read(verifyBuf, { cellDates: true });
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
console.log(JSON.stringify({
  ok: true,
  sheet: wb2.SheetNames[0],
  ref: ws2['!ref'],
  merges: (ws2['!merges'] || []).length,
  G3: ws2['G3']?.v,
  I3: ws2['I3']?.v,
  G4: ws2['G4']?.v,
  size: verifyBuf.length,
}));
