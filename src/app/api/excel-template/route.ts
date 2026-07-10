import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { findExcelScript, findExcelTemplate, findPython } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Run a command and return { code, stdout, stderr }.
 */
function runCmd(bin: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env || process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: err.message }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/**
 * Try to generate Excel using Python (openpyxl) — preserves ALL formatting.
 * Falls back to JavaScript (ExcelJS) if Python fails or is blocked.
 */
async function generateExcel(reference: string, date: string, description: string): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), 'excel-gen');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `Transmittal-${reference}-${Date.now()}.xlsx`);

  // === Try Python first ===
  const templatePath = findExcelTemplate();
  const scriptPath = findExcelScript();
  const pythonBin = findPython();

  if (existsSync(templatePath) && existsSync(scriptPath) && existsSync(pythonBin)) {
    try {
      const result = await runCmd(pythonBin, [
        scriptPath, templatePath, outPath, reference, date, description,
      ], { ...process.env, PYTHONUNBUFFERED: '1' });

      if (result.code === 0 && existsSync(outPath)) {
        console.log('[excel-template] Python succeeded');
        return await readFile(outPath);
      }
      console.log('[excel-template] Python failed, trying JS fallback:', result.stderr.slice(0, 200));
    } catch (e: any) {
      console.log('[excel-template] Python error, trying JS fallback:', e.message);
    }
  }

  // === Fallback: JavaScript (ExcelJS) ===
  const jsScriptCandidates = [
    path.join('/home/z/my-project', 'scripts', 'gen_excel_js.js'),
    path.join(process.cwd(), 'scripts', 'gen_excel_js.js'),
  ];
  const jsScriptPath = jsScriptCandidates.find(p => existsSync(p)) || jsScriptCandidates[0];
  const nodeBin = process.execPath || 'node';

  if (existsSync(jsScriptPath)) {
    const result = await runCmd(nodeBin, [
      jsScriptPath, outPath, reference, date, description,
    ], { ...process.env, NODE_PATH: path.join('/home/z/my-project', 'node_modules') });

    if (result.code === 0 && existsSync(outPath)) {
      console.log('[excel-template] JS fallback succeeded');
      return await readFile(outPath);
    }
    console.error('[excel-template] JS fallback failed:', result.stderr.slice(0, 200));
  }

  throw new Error('تعذّر توليد ملف Excel');
}

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || '';
  const description = searchParams.get('description') || '';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!reference) {
    return NextResponse.json({ error: 'المرجع مطلوب' }, { status: 400 });
  }

  try {
    const buffer = await generateExcel(reference, date, description);
    const filename = `Transmittal-${reference}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e: any) {
    console.error('[excel-template] Error:', e.message);
    return NextResponse.json({ error: 'تعذّر توليد ملف Excel. حاول مرة أخرى.' }, { status: 500 });
  }
}
