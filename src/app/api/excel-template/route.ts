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
  const revParam = searchParams.get('rev');

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  // Format rev number as "Rev.00", "Rev.01", "Rev.02", etc.
  // If no rev specified, default to Rev.00
  const revNumber = revParam !== null ? parseInt(revParam, 10) : 0;
  const safeRev = isNaN(revNumber) || revNumber < 0 ? 0 : revNumber;
  const revLabel = `Rev.${String(safeRev).padStart(2, '0')}`;

  // Find the template to use:
  // 1. If category is specified and has a custom uploaded template (templatePath), use it
  // 2. Otherwise, use the default category-specific template file (MIR_template.xlsx, CHECKLIST_template.xlsx, etc.)
  // 3. Final fallback: TRANSIMITALS_template.xlsx
  let templatePath = findExcelTemplate(category);
  let templateType = 'xlsx'; // default

  if (category) {
    try {
      const cat = await db.category.findUnique({
        where: { code: category },
        select: { templatePath: true, templateType: true }
      });
      if (cat?.templatePath) {
        // Find the template file (any extension) in the custom upload dir
        const storageRoot = getStorageRoot();
        const templatesDir = path.join(storageRoot, 'templates');
        if (existsSync(templatesDir)) {
          const { readdirSync } = require('fs');
          const files = readdirSync(templatesDir);
          const templateFile = files.find((f: string) => f.startsWith(`${category}.`));
          if (templateFile) {
            templatePath = path.join(templatesDir, templateFile);
            templateType = cat.templateType || path.extname(templateFile).replace('.', '');
            console.log('[excel-template] Using custom uploaded template for category:', category, 'type:', templateType);
          }
        }
      }
    } catch (e: any) {
      console.log('[excel-template] Error looking up category template:', e.message);
    }
  }

  if (!existsSync(templatePath)) {
    return NextResponse.json({ error: `القالب غير موجود: ${templatePath}` }, { status: 500 });
  }

  try {
    // Read the template file as a buffer
    const templateBuf = await readFile(templatePath);

    // For non-Excel templates (Word, PDF, etc.), just return the template as-is
    // with the reference and date in the filename
    if (templateType !== 'xlsx' && templateType !== 'xlsm') {
      const ext = templateType;
      const filename = `${reference}.${ext}`;
      const mimeTypes: Record<string, string> = {
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'pdf': 'application/pdf',
        'txt': 'text/plain; charset=utf-8',
      };
      return new NextResponse(new Uint8Array(templateBuf), {
        status: 200,
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Content-Length': String(templateBuf.length),
        },
      });
    }

    // For Excel templates, modify cell values using JSZip
    // Load as ZIP
    const zip = await JSZip.loadAsync(templateBuf);

    // Read the sheet XML
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');

    // Replace header cell values.
    // Different templates have different cell layouts, so we use pattern-based
    // replacement on the sharedStrings.xml (which holds all text values).
    const dateDisplay = fmtDate(date);
    let modifiedXml = sheetXml;

    // Read shared strings to find and replace header values
    let sharedStringsXml = '';
    try {
      sharedStringsXml = await zip.file('xl/sharedStrings.xml')!.async('string');
    } catch {
      // Some templates may not have sharedStrings — fall back to direct cell replacement
    }

    if (sharedStringsXml) {
      // Pattern-based replacement: find any string containing the pattern and replace.
      // This works across TRANSMITTAL, MIR, and CHECKLIST templates.

      // 1. Replace reference number (e.g., "Transmittal No:-119" → "Transmittal No:CIV-001")
      //    Also handles "MIR No.         " → "MIR No. CIV-001" and "CHECK LIST No." → "CHECK LIST No. CIV-001"
      sharedStringsXml = sharedStringsXml.replace(
        /(<t[^>]*>)\s*(Transmittal No[.:]*\s*-?)([^<]*)(<\/t>)/gi,
        (_, pre, label, _old, post) => `${pre}${label}${reference}${post}`
      );
      sharedStringsXml = sharedStringsXml.replace(
        /(<t[^>]*>)\s*(MIR No[\.:]*\s*)([^<]*)(<\/t>)/gi,
        (_, pre, label, _old, post) => `${pre}${label}${reference}${post}`
      );
      sharedStringsXml = sharedStringsXml.replace(
        /(<t[^>]*>)\s*(CHECK LIST No[\.:]*\s*)([^<]*)(<\/t>)/gi,
        (_, pre, label, _old, post) => `${pre}${label}${reference}${post}`
      );

      // 2. Replace Rev.XX value (e.g., "Rev.00" → "Rev.01")
      //    Match exact "Rev.XX" pattern (2 digits)
      sharedStringsXml = sharedStringsXml.replace(
        /(<t[^>]*>)\s*(Rev\.\d{2})\s*(<\/t>)/gi,
        (_, pre, _old, post) => `${pre}${revLabel}${post}`
      );

      // 3. Replace Date (e.g., "Date :10/06/2026" → "Date :21/07/2026")
      //    Match "Date :" followed by DD/MM/YYYY
      sharedStringsXml = sharedStringsXml.replace(
        /(<t[^>]*>)(\s*Date\s*:?\s*)(\d{1,2}\/\d{1,2}\/\d{4})([^<]*)(<\/t>)/gi,
        (_, pre, label, _old, suffix, post) => `${pre}${label}${dateDisplay}${suffix}${post}`
      );
      // Also handle "DATE        " (just the label, no value) — leave as is, just match if there's a date value nearby

      // Write modified sharedStrings back
      zip.file('xl/sharedStrings.xml', sharedStringsXml);
    }

    // Also do direct cell replacements for the known TRANSIMITALS template layout (G3/I3/G4)
    // This is a fallback in case sharedStrings approach doesn't catch everything
    modifiedXml = replaceCellValue(modifiedXml, 'G3', `Transmittal No:${reference}`);
    modifiedXml = replaceCellValue(modifiedXml, 'I3', revLabel);
    modifiedXml = replaceCellValue(modifiedXml, 'G4', `Date :${dateDisplay}`);

    // Fill description into item rows (16-26), column E — only for TRANSMITTAL template
    const templateFileName = path.basename(templatePath).toUpperCase();
    if (templateFileName.includes('TRANSIMITALS') || templateFileName.includes('TRANSMITTAL')) {
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
    }

    // Write modified sheet XML back to the ZIP
    zip.file('xl/worksheets/sheet1.xml', modifiedXml);

    // Also update the sheet name in workbook.xml
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
    const sheetName = reference.replace(/[^\w\-]/g, '').slice(0, 31) || 'Document';
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

    console.log('[excel-template] Generated Excel:', outBuf.length, 'bytes, sheet:', sheetName, 'template:', templateFileName);

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
