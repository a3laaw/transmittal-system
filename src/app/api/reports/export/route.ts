import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Format a date string/Date as DD/MM/YYYY. */
function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '';
  try {
    const d = typeof s === 'string' ? new Date(s) : s;
    if (isNaN(d.getTime())) return String(s);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return String(s);
  }
}

/** Format action code to Arabic. */
function fmtAction(a: string | null | undefined): string {
  if (!a) return '';
  const s = a.toLowerCase().trim();
  if (s === 'approved') return 'معتمد';
  if (s === 'rejected') return 'مرفوض';
  if (s === 'withdrawn') return 'مسحوب';
  if (s === 'pending') return 'بانتظار';
  return s;
}

/** Convert approvalType code to letter A-E. */
function fmtApprovalLetter(at: string | null | undefined): string {
  const mapping: Record<string, string> = {
    APPROVED: 'A',
    APPROVED_AS_NOTED: 'B',
    APPROVED_AS_NOTED_RESUBMIT: 'C',
    NOT_APPROVED: 'D',
    FOR_INFORMATION: 'E',
  };
  return mapping[at || ''] || '';
}

/** Get fill color (ARGB) based on action + approvalType. */
function getActionFill(action: string | null | undefined, approvalType: string | null | undefined): string | null {
  if (!action) return null;
  const a = action.toLowerCase().trim();
  if (a === 'approved') {
    if (approvalType === 'NOT_APPROVED') return 'FFFFC7CE'; // red
    if (approvalType === 'FOR_INFORMATION' || approvalType === 'APPROVED_AS_NOTED_RESUBMIT') return 'FFFFEB9C'; // yellow/orange
    return 'FFC6EFCE'; // green
  }
  if (a === 'rejected') return 'FFFFC7CE'; // red
  if (a === 'withdrawn') return 'FFE7E6E6'; // gray
  if (a === 'pending') return 'FFFFEB9C'; // yellow
  return null;
}

/** Excel column letter from 1-based index. */
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * GET /api/reports/export?discipline=...&category=...&type=...&from=...&to=...&q=...
 *
 * Generates a horizontal timeline Excel report using ExcelJS (pure JavaScript — no Python).
 * Each transmittal = one row, each revision (REV.0..REV.N) = column group
 * (Submit Date / Reply Date / Action / Approval Letter).
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

  // Compute max rev number
  let maxRev = 0;
  for (const item of filtered) {
    for (const k of Object.keys(item.revisions)) {
      const n = parseInt(k, 10);
      if (!isNaN(n) && n > maxRev) maxRev = n;
    }
  }
  const numRevs = maxRev + 1;

  // Create workbook
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Timeline Report', {
    views: [{ showGridLines: false, rightToLeft: true }],
  });

  // Styles
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  const groupFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  const subHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  const subHeaderFont = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E78' } };
  const dataFont = { name: 'Calibri', size: 10 };
  const centerAlign: ExcelJS.Alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const leftAlign: ExcelJS.Alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
    left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
    bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
    right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  };

  // Column positions
  const fixedColsCount = 5;
  const revStartCols: number[] = [];
  let colIdx = fixedColsCount + 1;
  for (let r = 0; r < numRevs; r++) {
    revStartCols.push(colIdx);
    colIdx += 4;
  }
  const consultantCol = colIdx;
  const mohSubmitCol = colIdx + 1;
  const mohReplyCol = colIdx + 2;
  const mohStatusCol = colIdx + 3;
  const totalDaysCol = colIdx + 4;
  const lastCol = totalDaysCol;

  // Title row (row 1)
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `تقرير الجدول الزمني للترانسميتالات - Timeline Report (${filtered.length} عنصر · REV.0 - REV.${maxRev})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E78' } };
  titleCell.alignment = centerAlign;
  ws.getRow(1).height = 30;

  // Group header row (row 2)
  const fixedLabels = ['المرجع', 'القسم الرئيسي', 'التخصص', 'النوع', 'الوصف'];
  for (let i = 0; i < fixedLabels.length; i++) {
    ws.mergeCells(2, i + 1, 3, i + 1); // merge rows 2-3 for fixed cols
    const cell = ws.getCell(2, i + 1);
    cell.value = fixedLabels[i];
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
    // also border row 3
    ws.getCell(3, i + 1).border = thinBorder;
    ws.getCell(3, i + 1).fill = headerFill;
  }

  // REV group headers (merge 4 cols each in row 2)
  for (let r = 0; r < numRevs; r++) {
    const start = revStartCols[r];
    const end = start + 3;
    ws.mergeCells(2, start, 2, end);
    const cell = ws.getCell(2, start);
    cell.value = `REV.${r}`;
    cell.font = headerFont;
    cell.fill = groupFill;
    cell.alignment = centerAlign;
    for (let c = start; c <= end; c++) {
      ws.getCell(2, c).border = thinBorder;
      ws.getCell(2, c).fill = groupFill;
    }
  }

  // Consultant header (merge rows 2-3)
  ws.mergeCells(2, consultantCol, 3, consultantCol);
  const consCell = ws.getCell(2, consultantCol);
  consCell.value = 'الاستشاري';
  consCell.font = headerFont;
  consCell.fill = groupFill;
  consCell.alignment = centerAlign;
  consCell.border = thinBorder;
  ws.getCell(3, consultantCol).border = thinBorder;
  ws.getCell(3, consultantCol).fill = groupFill;

  // MOH header (merge 3 cols in row 2)
  ws.mergeCells(2, mohSubmitCol, 2, mohStatusCol);
  const mohCell = ws.getCell(2, mohSubmitCol);
  mohCell.value = 'الوزارة';
  mohCell.font = headerFont;
  mohCell.fill = groupFill;
  mohCell.alignment = centerAlign;
  for (let c = mohSubmitCol; c <= mohStatusCol; c++) {
    ws.getCell(2, c).border = thinBorder;
    ws.getCell(2, c).fill = groupFill;
  }

  // Total Days header (merge rows 2-3)
  ws.mergeCells(2, totalDaysCol, 3, totalDaysCol);
  const tdCell = ws.getCell(2, totalDaysCol);
  tdCell.value = 'إجمالي الأيام';
  tdCell.font = headerFont;
  tdCell.fill = groupFill;
  tdCell.alignment = centerAlign;
  tdCell.border = thinBorder;
  ws.getCell(3, totalDaysCol).border = thinBorder;
  ws.getCell(3, totalDaysCol).fill = groupFill;

  // Sub-header row (row 3) for REV groups
  const subLabels = ['تقديم', 'رد', 'إجراء', 'نوع'];
  for (let r = 0; r < numRevs; r++) {
    const start = revStartCols[r];
    for (let i = 0; i < subLabels.length; i++) {
      const cell = ws.getCell(3, start + i);
      cell.value = subLabels[i];
      cell.font = subHeaderFont;
      cell.fill = subHeaderFill;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    }
  }

  // MOH sub-headers
  const mohLabels = ['إرسال', 'رد', 'الحالة'];
  for (let i = 0; i < mohLabels.length; i++) {
    const cell = ws.getCell(3, mohSubmitCol + i);
    cell.value = mohLabels[i];
    cell.font = subHeaderFont;
    cell.fill = subHeaderFill;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  }

  // Data rows (starting row 4)
  for (let idx = 0; idx < filtered.length; idx++) {
    const item = filtered[idx];
    const row = idx + 4;
    // Fixed cols
    ws.getCell(row, 1).value = item.reference;
    ws.getCell(row, 2).value = item.category || '';
    ws.getCell(row, 3).value = item.discipline || '';
    ws.getCell(row, 4).value = item.type || '';
    ws.getCell(row, 5).value = item.description || '';

    // REV columns
    for (let r = 0; r < numRevs; r++) {
      const start = revStartCols[r];
      const revData = item.revisions[r];
      if (revData) {
        ws.getCell(row, start).value = fmtDate(revData.submitDate);
        ws.getCell(row, start + 1).value = fmtDate(revData.replyDate);
        ws.getCell(row, start + 2).value = fmtAction(revData.action);
        const fill = getActionFill(revData.action, revData.approvalType);
        if (fill) {
          ws.getCell(row, start + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } } as ExcelJS.Fill;
        }
        ws.getCell(row, start + 3).value = revData.action === 'approved' ? fmtApprovalLetter(revData.approvalType) : '';
      }
    }

    // Consultant
    ws.getCell(row, consultantCol).value = item.consultantStatus || '';

    // MOH
    ws.getCell(row, mohSubmitCol).value = fmtDate(item.mohSubmitDate);
    ws.getCell(row, mohReplyCol).value = fmtDate(item.mohReviewDate);
    ws.getCell(row, mohStatusCol).value = item.mohStatus || '';

    // Total days
    ws.getCell(row, totalDaysCol).value = item.totalDays || 0;

    // Format all cells in row
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(row, c);
      cell.font = dataFont;
      cell.border = thinBorder;
      if (c === 1) {
        cell.alignment = centerAlign;
        cell.font = { name: 'Calibri', size: 10, bold: true };
      } else if (c === 5) {
        cell.alignment = leftAlign;
      } else {
        cell.alignment = centerAlign;
      }
    }
  }

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 40;
  for (let r = 0; r < numRevs; r++) {
    const start = revStartCols[r];
    const widths = [12, 12, 10, 6];
    for (let i = 0; i < widths.length; i++) {
      ws.getColumn(start + i).width = widths[i];
    }
  }
  ws.getColumn(consultantCol).width = 14;
  ws.getColumn(mohSubmitCol).width = 12;
  ws.getColumn(mohReplyCol).width = 12;
  ws.getColumn(mohStatusCol).width = 14;
  ws.getColumn(totalDaysCol).width = 10;

  // Freeze panes
  ws.views = [{ showGridLines: false, rightToLeft: true, xSplit: 5, ySplit: 3, topLeftCell: 'F4', activeCell: 'F4' }];

  // Write to buffer
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `Transmittal-Timeline-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(buffer.byteLength),
    },
  });
}
