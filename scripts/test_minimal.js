// Minimal test: just read template and write back
const XLSX = require('xlsx');
const fs = require('fs');

const templateBuf = fs.readFileSync('/home/z/my-project/public/templates/TRANSIMITALS_template.xlsx');
const wb = XLSX.read(templateBuf, { cellStyles: true, cellDates: true });

console.log('=== After read ===');
console.log('SheetNames:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
console.log('!ref:', ws['!ref']);
console.log('!merges count:', (ws['!merges'] || []).length);
console.log('!cols count:', (ws['!cols'] || []).length);
console.log('G3:', ws['G3']?.v);

// Test 1: write with NO modifications
const out1 = XLSX.write(wb, { type: 'buffer', cellStyles: true, cellDates: true });
fs.writeFileSync('/tmp/test-passthrough.xlsx', out1);
console.log('\n=== Passthrough (no mods) ===');
console.log('Size:', out1.length);

// Verify
const wb2 = XLSX.read(out1, { cellStyles: true, cellDates: true });
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
console.log('!ref:', ws2['!ref']);
console.log('!merges:', (ws2['!merges'] || []).length);
console.log('G3:', ws2['G3']?.v);

// Test 2: only modify G3.v (don't replace the cell)
ws['G3'].v = 'Transmittal No:TEST001';
const out2 = XLSX.write(wb, { type: 'buffer', cellStyles: true, cellDates: true });
fs.writeFileSync('/tmp/test-modify-v.xlsx', out2);
console.log('\n=== Modify .v only ===');
console.log('Size:', out2.length);
const wb3 = XLSX.read(out2, { cellStyles: true, cellDates: true });
const ws3 = wb3.Sheets[wb3.SheetNames[0]];
console.log('!ref:', ws3['!ref']);
console.log('G3:', ws3['G3']?.v);

// Test 3: no cellStyles option
const wb4 = XLSX.read(templateBuf, { cellDates: true });
const ws4 = wb4.Sheets[wb4.SheetNames[0]];
ws4['G3'].v = 'Transmittal No:TEST001';
const out4 = XLSX.write(wb4, { type: 'buffer', cellDates: true });
fs.writeFileSync('/tmp/test-no-styles.xlsx', out4);
console.log('\n=== No cellStyles ===');
console.log('Size:', out4.length);
const wb5 = XLSX.read(out4, { cellDates: true });
const ws5 = wb5.Sheets[wb5.SheetNames[0]];
console.log('!ref:', ws5['!ref']);
console.log('!merges:', (ws5['!merges'] || []).length);
console.log('G3:', ws5['G3']?.v);
