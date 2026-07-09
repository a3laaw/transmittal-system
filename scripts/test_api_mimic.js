// Mimic exactly what the API route does
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const templatePath = '/home/z/my-project/public/templates/TRANSIMITALS_template.xlsx';
const reference = 'TEST001';
const description = 'Hello';
const date = '2026-07-10';

// Parse date
let dateDisplay = date;
try {
  const dt = new Date(date + 'T00:00:00');
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  dateDisplay = `${dd}/${mm}/${yyyy}`;
} catch {}

const templateBuf = fs.readFileSync(templatePath);
console.log('Template buffer size:', templateBuf.length, 'bytes');

const wb = XLSX.read(templateBuf, { cellStyles: true, cellDates: true });
console.log('Sheet names:', wb.SheetNames);
const wsName = wb.SheetNames[0];
const ws = wb.Sheets[wsName];

// Check existing cells
console.log('G3 before:', JSON.stringify(ws['G3']));
console.log('I3 before:', JSON.stringify(ws['I3']));
console.log('G4 before:', JSON.stringify(ws['G4']));

// Set header cells — PRESERVE style
const g3 = ws['G3'] || {};
ws['G3'] = { ...g3, t: 's', v: `Transmittal No:${reference}` };

const i3 = ws['I3'] || {};
ws['I3'] = { ...i3, t: 's', v: 'Rev.00' };

const g4 = ws['G4'] || {};
ws['G4'] = { ...g4, t: 's', v: `Date :${dateDisplay}` };

// Detect DESCRIPTION column
let descCol = 5;
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
console.log('Description column:', descCol);

// Fill description
if (description) {
  const parts = description.split(/\s*[&/]\s*|\n|,(?=\s)/).map(p => p.trim()).filter(Boolean);
  console.log('Description parts:', parts);
  const maxRows = 11;
  parts.slice(0, maxRows).forEach((part, i) => {
    const row = 16 + i;
    const addr = XLSX.utils.encode_cell({ r: row - 1, c: descCol - 1 });
    const existing = ws[addr] || {};
    ws[addr] = { ...existing, t: 's', v: part };
    console.log(`  Set ${addr} = ${part}`);
  });
}

// Rename sheet
const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal';
wb.SheetNames[0] = sheetName;
console.log('Sheet renamed to:', sheetName);

// Write — try BOTH with and without bookType
const outBuf1 = XLSX.write(wb, { type: 'buffer', cellStyles: true, cellDates: true });
fs.writeFileSync('/tmp/test-api-nobooktype.xlsx', outBuf1);
console.log('\nWithout bookType:', outBuf1.length, 'bytes');

const outBuf2 = XLSX.write(wb, { type: 'buffer', cellStyles: true, cellDates: true, bookType: 'xlsx' });
fs.writeFileSync('/tmp/test-api-booktype.xlsx', outBuf2);
console.log('With bookType:', outBuf2.length, 'bytes');

// Verify both
for (const f of ['/tmp/test-api-nobooktype.xlsx', '/tmp/test-api-booktype.xlsx']) {
  const wb2 = XLSX.read(fs.readFileSync(f), { cellStyles: true, cellDates: true });
  const ws2 = wb2.Sheets[wb2.SheetNames[0]];
  console.log(`\n${f}:`);
  console.log('  Sheet:', wb2.SheetNames[0]);
  console.log('  G3:', ws2['G3']?.v);
  console.log('  I3:', ws2['I3']?.v);
  console.log('  G4:', ws2['G4']?.v);
  console.log('  Merges:', (ws2['!merges'] || []).length);
  console.log('  Cols:', (ws2['!cols'] || []).length);
  console.log('  Ref:', ws2['!ref']);
}
