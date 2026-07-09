import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/reports/export?category=...&discipline=...&type=...&from=...&to=...&q=...
 *
 * Generates an Excel report with revisions pivoted horizontally.
 * Each transmittal = one row, each revision = column group (Submit / Reply / Action / Days).
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

  // Save filtered data to JSON for the python script to consume
  const tmpDir = path.join(os.tmpdir(), 'reports-export');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const jsonPath = path.join(tmpDir, `report-${Date.now()}.json`);
  const outPath = path.join(tmpDir, `report-${Date.now()}.xlsx`);

  // Serialize dates as ISO strings
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

  // Run python generator
  const scriptPath = path.join(process.cwd(), 'scripts', 'gen_timeline_report.py');
  // Use the venv python explicitly (where openpyxl is installed)
  const pythonPath = '/home/z/.venv/bin/python3';
  try {
    await new Promise<void>((resolve, reject) => {
      const py = spawn(pythonPath, [scriptPath, jsonPath, outPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      py.stdout.on('data', d => process.stdout.write(d));
      py.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
      py.on('close', code => {
        if (code !== 0) reject(new Error(`Python failed: ${stderr}`));
        else resolve();
      });
    });
  } catch (e: any) {
    return NextResponse.json({ error: `فشل توليد التقرير: ${e.message}` }, { status: 500 });
  }

  const buffer = await readFile(outPath);
  const filename = `Transmittal-Timeline-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
