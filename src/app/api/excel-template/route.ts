import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

/**
 * GET /api/excel-template?reference=CIV-172&discipline=CIV&description=...
 *
 * Generates a new Excel file based on TRANSIMITALS.xlsx template,
 * with the new Transmittal No and Rev.00 filled in.
 * Returns the file as a download.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const discipline = searchParams.get('discipline') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'TRANSIMITALS_template.xlsx');
  if (!existsSync(templatePath)) {
    return NextResponse.json({ error: 'القالب غير موجود' }, { status: 500 });
  }

  const tmpDir = path.join(os.tmpdir(), 'excel-gen');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `Transmittal-${reference}-${Date.now()}.xlsx`);

  const scriptPath = path.join(process.cwd(), 'scripts', 'gen_excel_template.py');
  try {
    await new Promise<void>((resolve, reject) => {
      const py = spawn('/home/z/.venv/bin/python3', [
        scriptPath,
        templatePath,
        outPath,
        reference,
        date,
        description,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      py.stdout.on('data', d => process.stdout.write(d));
      py.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
      py.on('close', code => {
        if (code !== 0) reject(new Error(`Python failed: ${stderr}`));
        else resolve();
      });
    });
  } catch (e: any) {
    return NextResponse.json({ error: `فشل توليد الملف: ${e.message}` }, { status: 500 });
  }

  const buffer = await readFile(outPath);
  const filename = `Transmittal-${reference}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
