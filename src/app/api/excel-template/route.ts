import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { findExcelTemplate } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/excel-template?reference=CIV-172&description=...&date=2026-07-09
 *
 * Generates a new Excel transmittal file from the template using SheetJS.
 *
 * Runs a standalone Node.js script (scripts/gen_excel.js) as a child process
 * to avoid webpack bundling issues with the xlsx module in production mode.
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
  if (!existsSync(templatePath)) {
    return NextResponse.json(
      { error: `القالب غير موجود: ${templatePath}` },
      { status: 500 },
    );
  }

  // Create temp output path
  const tmpDir = path.join(os.tmpdir(), 'excel-gen');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `Transmittal-${reference}-${Date.now()}.xlsx`);

  try {
    // Use spawn with shell=true to avoid Turbopack path analysis
    // Build the command string at runtime (not statically analyzable)
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const scriptRel = path.join('scripts', 'gen_excel.js');
    const scriptPath = existsSync(path.join(projectRoot, scriptRel))
      ? path.join(projectRoot, scriptRel)
      : path.join(projectRoot, '..', '..', scriptRel);

    if (!existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `السكريبت غير موجود: ${scriptPath}` },
        { status: 500 },
      );
    }

    const nodeBin = process.execPath || 'node';
    const args = [
      scriptPath,
      templatePath,
      outPath,
      reference,
      date,
      description || '',
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(nodeBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_PATH: path.join(projectRoot, 'node_modules') },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => reject(new Error(`فشل تشغيل السكريبت: ${err.message}`)));
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script failed (exit ${code}): ${stderr || stdout}`));
        } else {
          console.log('[excel-template] Script output:', stdout.trim());
          resolve();
        }
      });
    });

    if (!existsSync(outPath)) {
      return NextResponse.json(
        { error: 'لم يتم إنشاء الملف' },
        { status: 500 },
      );
    }

    const outBuf = await readFile(outPath);
    console.log('[excel-template] Output size:', outBuf.length);

    const filename = `Transmittal-${reference}.xlsx`;
    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(outBuf.length),
      },
    });
  } catch (e: any) {
    console.error('[excel-template] Error:', e.message);
    return NextResponse.json(
      { error: `فشل توليد الملف: ${e.message}` },
      { status: 500 },
    );
  }
}

