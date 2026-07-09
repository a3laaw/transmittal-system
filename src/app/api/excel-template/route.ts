import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { findExcelScript, findExcelTemplate, findPython } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 *
 * Uses the original Python script (openpyxl) to generate Excel from the template.
 * This preserves ALL formatting, merged cells, borders, and column widths.
 *
 * Path resolution is robust: works in both `next dev` and standalone production
 * mode (where process.cwd() may differ from the project root).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  const templatePath = findExcelTemplate();
  const scriptPath = findExcelScript();
  const pythonBin = findPython();

  if (!existsSync(templatePath)) {
    return NextResponse.json(
      { error: `القالب غير موجود: ${templatePath}` },
      { status: 500 },
    );
  }
  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      { error: `السكريبت غير موجود: ${scriptPath}` },
      { status: 500 },
    );
  }
  if (!existsSync(pythonBin)) {
    return NextResponse.json(
      { error: `Python غير موجود: ${pythonBin}` },
      { status: 500 },
    );
  }

  const tmpDir = path.join(os.tmpdir(), 'excel-gen');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `Transmittal-${reference}-${Date.now()}.xlsx`);

  try {
    await new Promise<void>((resolve, reject) => {
      const py = spawn(pythonBin, [
        scriptPath,
        templatePath,
        outPath,
        reference,
        date,
        description,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Ensure Python can find its modules
          PYTHONPATH: process.env.PYTHONPATH || '',
          PYTHONUNBUFFERED: '1',
        },
      });
      let stderr = '';
      let stdout = '';
      py.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
      py.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });
      py.on('error', (err) => {
        reject(new Error(`فشل تشغيل Python: ${err.message}`));
      });
      py.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python failed (exit ${code}): ${stderr || stdout}`));
        } else {
          resolve();
        }
      });
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `فشل توليد الملف: ${e.message}` },
      { status: 500 },
    );
  }

  // Verify the output file exists
  if (!existsSync(outPath)) {
    return NextResponse.json(
      { error: 'لم يتم إنشاء الملف' },
      { status: 500 },
    );
  }

  const buffer = await readFile(outPath);
  const filename = `Transmittal-${reference}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
