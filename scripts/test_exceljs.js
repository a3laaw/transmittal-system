// Test: Can ExcelJS load the original TRANSIMITALS_template.xlsx?
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

(async () => {
  const templatePath = path.join('/home/z/my-project', 'public', 'templates', 'TRANSIMITALS_template.xlsx');
  console.log('Template exists:', fs.existsSync(templatePath));
  console.log('Template size:', fs.statSync(templatePath).size, 'bytes');

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    console.log('✅ Loaded successfully!');
    console.log('Sheets:', wb.worksheets.map(ws => ({ name: ws.title, rows: ws.rowCount, cols: ws.columnCount })));

    const ws = wb.worksheets[0];
    console.log('\n--- Header cells ---');
    console.log('G3 (Transmittal No):', ws.getCell('G3').value);
    console.log('I3 (Rev):', ws.getCell('I3').value);
    console.log('G4 (Date):', ws.getCell('G4').value);

    console.log('\n--- Column headers (row 14) ---');
    for (let c = 1; c <= 10; c++) {
      const v = ws.getCell(14, c).value;
      if (v) console.log(`  R14C${c}:`, JSON.stringify(v));
    }

    console.log('\n--- Merged cells ---');
    const merged = ws.model.merges || [];
    console.log('Merged ranges:', merged.length);
    merged.slice(0, 10).forEach(m => console.log('  ', m));

    console.log('\n--- Column widths ---');
    const cols = ws.model.columns || [];
    cols.forEach((col, i) => {
      if (col && col.width) console.log(`  Col ${i+1}: width=${col.width}`);
    });

    // Count bordered cells in table area
    let borderedCount = 0;
    for (let r = 14; r <= 26; r++) {
      for (let c = 2; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        const b = cell.border || {};
        if ((b.left && b.left.style) || (b.right && b.right.style) || (b.top && b.top.style) || (b.bottom && b.bottom.style)) {
          borderedCount++;
        }
      }
    }
    console.log('\n--- Bordered cells in table area (R14-26, C2-8):', borderedCount);

    // Now test modifying and saving
    ws.getCell('G3').value = 'Transmittal No:TEST-001';
    ws.getCell('I3').value = 'Rev.00';
    ws.getCell('G4').value = 'Date :10/07/2026';

    const outPath = '/tmp/test-exceljs.xlsx';
    await wb.xlsx.writeFile(outPath);
    console.log('\n✅ Saved to:', outPath, '(', fs.statSync(outPath).size, 'bytes)');

    // Reload to verify
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(outPath);
    const ws2 = wb2.worksheets[0];
    console.log('G3 after reload:', ws2.getCell('G3').value);
    console.log('I3 after reload:', ws2.getCell('I3').value);
    console.log('G4 after reload:', ws2.getCell('G4').value);

    // Check borders preserved
    let borderedCount2 = 0;
    for (let r = 14; r <= 26; r++) {
      for (let c = 2; c <= 8; c++) {
        const cell = ws2.getCell(r, c);
        const b = cell.border || {};
        if ((b.left && b.left.style) || (b.right && b.right.style) || (b.top && b.top.style) || (b.bottom && b.bottom.style)) {
          borderedCount2++;
        }
      }
    }
    console.log('Bordered cells after reload:', borderedCount2);

  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  }
})();
