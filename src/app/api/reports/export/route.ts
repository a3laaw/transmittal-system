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
 * GET /api/reports/export?discipline=...&category=...&type=...&from=...&to=...&q=...
 *
 * Uses the Python script (openpyxl) to generate the timeline report.
 * Preserves ALL formatting, merged cells, borders, colors.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const discipline = searchParams.get('discipline') || '';
  const type = searchParams.get('type') || '';
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const where: any = {};
  if (category) where.category = category;
  if (discipline) where.discipline = discipline;
  if (type) where.type = type;
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { description: { contains: q } },
      { type: { contains: q } },
    ];
  }

  const transmittals = await db.transmittal.findMany({
    where,
    include: {
      revisions: { orderBy: { revNumber: 'asc' } },
      reviews: true,
    },
    orderBy: { reference: 'asc' },
  });

  // Build the timeline data
  const items = transmittals.map(t => {
    const consultant = t.reviews.find(r => r.party === 'CONSULTANT');
    const moh = t.reviews.find(r => r.party === 'MOH');
    const revsMap: Record<number, any> = {};
    let lastSubmitDate: Date | null = null;
    let lastReplyDate: Date | null = null;
    let totalDays = 0;
    for (const rev of t.revisions) {
      let daysOpen: number | null = null;
      if (rev.submitDate) {
        const end = rev.replyDate ? new Date(rev.replyDate) : new Date();
        daysOpen = Math.floor((end.getTime() - new Date(rev.submitDate).getTime()) / (1000 * 60 * 60 * 24));
        totalDays += daysOpen;
      }
      revsMap[rev.revNumber] = {
        submitDate: rev.submitDate,
        replyDate: rev.replyDate,
        action: rev.action,
        approvalType: rev.approvalType,
        daysOpen,
      };
      if (rev.submitDate && (!lastSubmitDate || new Date(rev.submitDate) > new Date(lastSubmitDate))) {
        lastSubmitDate = new Date(rev.submitDate);
      }
      if (rev.replyDate && (!lastReplyDate || new Date(rev.replyDate) > new Date(lastReplyDate))) {
        lastReplyDate = new Date(rev.replyDate);
      }
    }
    let inDateRange = true;
    if (from && lastSubmitDate) inDateRange = inDateRange && new Date(lastSubmitDate) >= new Date(from);
    if (to && lastSubmitDate) inDateRange = inDateRange && new Date(lastSubmitDate) <= new Date(to);
    if ((from || to) && !lastSubmitDate) inDateRange = false;
    return {
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      type: t.type || '',
      description: t.description || '',
      consultantStatus: consultant?.status || '',
      mohStatus: moh?.status || '',
      mohSubmitDate: moh?.submitDate,
      mohSubmitRev: moh?.submitRev,
      mohReviewDate: moh?.reviewDate,
      revisions: revsMap,
      revisionsCount: t.revisions.length,
      lastSubmitDate,
      lastReplyDate,
      totalDays,
      _inDateRange: inDateRange,
    };
  });

  const filtered = items.filter(i => i._inDateRange);

  // Save data as JSON for the Python script
  const tmpDir = path.join(os.tmpdir(), 'reports-export');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const jsonPath = path.join(tmpDir, `report-${Date.now()}.json`);
  const outPath = path.join(tmpDir, `report-${Date.now()}.xlsx`);

  const serializable = filtered.map(i => ({
    ...i,
    lastSubmitDate: i.lastSubmitDate ? i.lastSubmitDate.toISOString() : null,
    lastReplyDate: i.lastReplyDate ? i.lastReplyDate.toISOString() : null,
    mohSubmitDate: i.mohSubmitDate ? i.mohSubmitDate.toISOString() : null,
    mohReviewDate: i.mohReviewDate ? i.mohReviewDate.toISOString() : null,
    revisions: Object.fromEntries(
      Object.entries(i.revisions).map(([k, v]: [string, any]) => [k, {
        submitDate: v.submitDate ? v.submitDate.toISOString() : null,
        replyDate: v.replyDate ? v.replyDate.toISOString() : null,
        action: v.action,
        approvalType: v.approvalType || null,
        daysOpen: v.daysOpen,
      }])
    ),
  }));

  await writeFile(jsonPath, JSON.stringify(serializable, null, 2));

  // Find the Python script
  const projectRoot = '/home/z/my-project';
  const scriptCandidates = [
    path.join(projectRoot, 'scripts', 'gen_timeline_report.py'),
    path.join(process.cwd(), 'scripts', 'gen_timeline_report.py'),
    path.join(process.cwd(), '..', '..', 'scripts', 'gen_timeline_report.py'),
  ];
  const scriptPath = scriptCandidates.find(p => existsSync(p)) || scriptCandidates[0];
  const pythonBin = findPython();
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: `السكريبت غير موجود: ${scriptPath}` }, { status: 500 });
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const py = spawn(pythonBin, [scriptPath, jsonPath, outPath], {
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
    return NextResponse.json({ error: `فشل توليد التقرير: ${e.message}` }, { status: 500 });
  }

  if (!existsSync(outPath)) {
    return NextResponse.json({ error: 'لم يتم إنشاء ملف التقرير' }, { status: 500 });
  }

  const buffer = await readFile(outPath);
  const filename = `Transmittal-Timeline-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
