import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { findPython } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/import
 * Body: FormData with file = LOG_Final.xlsm
 *
 * Uses the Python script (openpyxl) to read the Excel file.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 });
  }

  // Save uploaded file to temp
  const tmpDir = path.join(os.tmpdir(), 'transmittal-import');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const uploadPath = path.join(tmpDir, `upload-${Date.now()}.xlsm`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(uploadPath, buffer);

  // Output JSON path
  const outPath = path.join(tmpDir, `extracted-${Date.now()}.json`);

  // Run Python extractor
  const projectRoot = '/home/z/my-project';
  const scriptCandidates = [
    path.join(projectRoot, 'scripts', 'import_log.py'),
    path.join(process.cwd(), 'scripts', 'import_log.py'),
    path.join(process.cwd(), '..', '..', 'scripts', 'import_log.py'),
  ];
  const scriptPath = scriptCandidates.find(p => existsSync(p)) || scriptCandidates[0];
  const pythonBin = findPython();
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: `السكريبت غير موجود: ${scriptPath}` }, { status: 500 });
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const py = spawn(pythonBin, [scriptPath, uploadPath, outPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
      let stderr = '';
      let stdout = '';
      py.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
      py.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
      py.on('error', err => reject(new Error(`فشل تشغيل Python: ${err.message}`)));
      py.on('close', code => {
        if (code !== 0) reject(new Error(`Python failed (exit ${code}): ${stderr || stdout}`));
        else resolve();
      });
    });
  } catch (e: any) {
    return NextResponse.json({ error: `فشل الاستيراد: ${e.message}` }, { status: 500 });
  }

  // Read extracted JSON
  const extracted = JSON.parse(await readFile(outPath, 'utf-8'));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Clear DB
  await db.review.deleteMany();
  await db.revision.deleteMany();
  await db.transmittal.deleteMany();

  // Insert extracted records
  for (const item of extracted) {
    try {
      if (!item.reference && !item.description) {
        skipped++;
        continue;
      }
      if (!item.description || !item.description.trim()) {
        skipped++;
        continue;
      }

      await db.transmittal.create({
        data: {
          reference: item.reference,
          discipline: item.discipline,
          disciplineCode: item.discipline,
          category: 'TRANSMITTAL',
          type: item.type || null,
          description: item.description,
          revisions: {
            create: item.revisions.filter((r: any) => r.submitDate || r.action).map((r: any) => ({
              revNumber: r.revNumber,
              submitDate: r.submitDate ? new Date(r.submitDate) : null,
              replyDate: r.replyDate ? new Date(r.replyDate) : null,
              action: r.action || null,
              approvalType: r.action === 'approved' ? (r.approvalType || null) : null,
            })),
          },
          reviews: {
            create: [
              ...(item.consultantStatus ? [{ party: 'CONSULTANT', status: item.consultantStatus }] : []),
              ...(item.mohStatus ? [{ party: 'MOH', status: item.mohStatus }] : []),
            ],
          },
        },
      });
      imported++;
    } catch (e: any) {
      errors.push(`${item.reference || '(no ref)'}: ${e.message}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.slice(0, 20),
    totalExtracted: extracted.length,
  });
}
