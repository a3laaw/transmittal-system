import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { findExcelTemplate, getStorageRoot } from '@/lib/paths';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 *
 * Generates Excel by MODIFYING the original template file in-place.
 *
 * Approach:
 * 1. Load TRANSIMITALS_template.xlsx as a ZIP archive (xlsx = ZIP of XML files)
 * 2. Parse xl/worksheets/sheet1.xml
 * 3. Replace cell values (G3, I3, G4, description rows) using regex
 * 4. Keep ALL original formatting (styles, borders, merges, images, fonts)
 * 5. Write back the modified ZIP as a new .xlsx file
 *
 * This preserves 100% of the original formatting because we only change
 * cell VALUES, not cell STYLES. Works in ALL environments (no Python, no spawn).
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

/**
 * Replace the value of a cell in the sheet XML.
 * Handles inlineStr cells: <c r="G3" s="289" t="inlineStr"><is><t>old</t></is></c>
 */
function replaceCellValue(xml: string, cellRef: string, newValue: string): string {
  // Escape XML special characters in the new value
  const escaped = newValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Pattern: <c r="G3" ...>...</c> or <c r="G3" .../>
  // Match the cell, then replace its inner content with inlineStr
  const cellPattern = new RegExp(
    `(<c r="${cellRef}"[^>]*?)(/>|>(?:<v>[^<]*</v>|<is><t[^>]*>[^<]*</t></is>)?</c>)`,
    'g'
  );

  return xml.replace(cellPattern, (match, openTag, _rest) => {
    // Extract the style attribute (s="...") if present
    const styleMatch = openTag.match(/\ss="(\d+)"/);
    const styleAttr = styleMatch ? ` s="${styleMatch[1]}"` : '';
    // Build new cell with inlineStr type
    return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t>${escaped}</t></is></c>`;
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const category = searchParams.get('category') || '';

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  // Find the template to use:
  // 1. If category is specified and has a custom template, use it
  // 2. Otherwise, fall back to the default TRANSIMITALS_template.xlsx
  let templatePath = findExcelTemplate();

  if (category) {
    try {
      const cat = await db.category.findUnique({ where: { code: category }, select: { excelTemplate: true } });
      if (cat?.excelTemplate) {
        // Custom template path: /api/templates/{code} → storage/templates/{code}.xlsx
        const storageRoot = getStorageRoot();
        const customPath = path.join(storageRoot, 'templates', `${category}.xlsx`);
        if (existsSync(customPath)) {
          templatePath = customPath;
          console.log('[excel-template] Using custom template for category:', category);
        }
      }
    } catch (e: any) {
      console.log('[excel-template] Error looking up category template:', e.message);
    }
  }

  if (!existsSync(templatePath)) {
    return NextResponse.json({ error: `القالب غير موجود` }, { status: 500 });
  }

  try {
    // Read the template file as a buffer
    const templateBuf = await readFile(templatePath);

    // Load as ZIP
    const zip = await JSZip.loadAsync(templateBuf);

    // Read the sheet XML
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');

    // Replace header cell values
    const dateDisplay = fmtDate(date);
    let modifiedXml = sheetXml;
    modifiedXml = replaceCellValue(modifiedXml, 'G3', `Transmittal No:${reference}`);
    modifiedXml = replaceCellValue(modifiedXml, 'I3', 'Rev.00');
    modifiedXml = replaceCellValue(modifiedXml, 'G4', `Date :${dateDisplay}`);

    // Fill description into item rows (16-26), column E
    if (description) {
      const parts = description
        .split(/\s*[&/]\s*|\n|,(?=\s)/)
        .map(p => p.trim())
        .filter(Boolean);
      const maxRows = 11;
      parts.slice(0, maxRows).forEach((part, i) => {
        const row = 16 + i;
        modifiedXml = replaceCellValue(modifiedXml, `E${row}`, part);
      });
    }

    // Write modified sheet XML back to the ZIP
    zip.file('xl/worksheets/sheet1.xml', modifiedXml);

    // Also update the sheet name in workbook.xml
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
    const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Transmittal';
    const modifiedWorkbook = workbookXml.replace(
      /<sheet[^>]*name="[^"]*"[^>]*sheetId="1"[^>]*\/>/,
      (match) => match.replace(/name="[^"]*"/, `name="${sheetName}"`)
    );
    zip.file('xl/workbook.xml', modifiedWorkbook);

    // Generate the output buffer
    const outBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    console.log('[excel-template] Generated Excel:', outBuf.length, 'bytes, sheet:', sheetName);

    const filename = `Transmittal-${reference}.xlsx`;
    return new NextResponse(new Uint8Array(outBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(outBuf.length),
      },
    });
  } catch (e: any) {
    console.error('[excel-template] Error:', e.message, e.stack);
    return NextResponse.json({ error: 'تعذّر توليد ملف Excel. حاول مرة أخرى.' }, { status: 500 });
  }
}
