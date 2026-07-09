// Test: Can SheetJS (xlsx) load the original template and preserve formatting?
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const templatePath = path.join('/home/z/my-project', 'public', 'templates', 'TRANSIMITALS_template.xlsx');
console.log('Template size:', fs.statSync(templatePath).size, 'bytes');

// Read as buffer
const buf = fs.readFileSync(templatePath);

// Read with cellStyles: true to preserve styles, cellDates: true
const wb = XLSX.read(buf, { cellStyles: true, cellDates: true });
console.log('✅ Loaded!');
console.log('SheetNames:', wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];
console.log('\n--- Header cells ---');
console.log('G3:', ws['G3']?.v);
console.log('I3:', ws['I3']?.v);
console.log('G4:', ws['G4']?.v);

// Check merges
console.log('\n--- Merges ---');
console.log('Count:', (ws['!merges'] || []).length);
(ws['!merges'] || []).slice(0, 10).forEach(m => {
  console.log(`  ${XLSX.utils.encode_range(m)}`);
});

// Check column widths
console.log('\n--- Cols ---');
console.log('!cols:', JSON.stringify(ws['!cols']?.slice(0, 12)));

// Modify cells
ws['G3'] = { t: 's', v: 'Transmittal No:TEST-001' };
ws['I3'] = { t: 's', v: 'Rev.00' };
ws['G4'] = { t: 's', v: 'Date :10/07/2026' };

// Save with cellStyles
const outBuf = XLSX.write(wb, { type: 'buffer', cellStyles: true, cellDates: true });
const outPath = '/tmp/test-sheetjs.xlsx';
fs.writeFileSync(outPath, outBuf);
console.log('\n✅ Saved:', outPath, '(', outBuf.length, 'bytes)');

// Reload to verify
const wb2 = XLSX.read(fs.readFileSync(outPath), { cellStyles: true, cellDates: true });
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
console.log('G3 after reload:', ws2['G3']?.v);
console.log('I3 after reload:', ws2['I3']?.v);
console.log('G4 after reload:', ws2['G4']?.v);
console.log('Merges preserved:', (ws2['!merges'] || []).length);
console.log('Cols preserved:', (ws2['!cols'] || []).length);
