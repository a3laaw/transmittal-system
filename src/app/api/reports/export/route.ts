import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ExcelJS from 'exceljs';
import { computeOverallStatus, computeConsultantStatus, computeMohStatus, getApprovalTypeLetter } from '@/lib/status';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/reports/export?discipline=...&category=...&type=...&from=...&to=...&q=...
 *
 * Generates an Excel timeline report using ExcelJS (JavaScript, Vercel-compatible).
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

  // Build timeline data
  const items = transmittals.map(t => {
    const consultant = t.reviews.find(r => r.party === 'CONSULTANT');
    const moh = t.reviews.find(r => r.party === 'MOH');
    const revsMap: Record<number, any> = {};
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
    }
    return {
      reference: t.reference,
      discipline: t.discipline,
      category: t.category,
      type: t.type || '',
      description: t.description || '',
      consultantStatus: consultant?.status || '',
      mohStatus: moh?.status || '',
      mohSubmitDate: moh?.submitDate,
      mohReviewDate: moh?.reviewDate,
      revisions: revsMap,
      totalDays,
    };
  });

  // Compute max rev number
  let maxRev = 0;
  for (const item of items) {
    for (const k of Object.keys(item.revisions)) {
      const n = parseInt(k);
      if (n > maxRev) maxRev = n;
    }
  }
  const NUM_REVS = maxRev + 1;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Timeline Report', {
    views: [{ rightToLeft: true }],
  });
  ws.views = [{ showGridLines: false, zoomScale: 100 }];

  // Column positions
  const fixedCols = 5;
  let colIdx = fixedCols + 1;
  const revStartCols: number[] = [];
  for (let r = 0; r < NUM_REVS; r++) {
    revStartCols[r] = colIdx;
    colIdx += 4;
  }
  const consultantCol = colIdx;
  const mohSubmitCol = colIdx + 1;
  const mohReplyCol = colIdx + 2;
  const mohStatusCol = colIdx + 3;
  const totalDaysCol = colIdx + 4;

  // Title
  ws.mergeCells(1, 1, 1, totalDaysCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `تقرير الجدول الزمني للترانسميتالات - Timeline Report (${items.length} عنصر · REV.0 - REV.${maxRev})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1F4E78' } };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 30;

  // Group headers (row 2)
  const headers = ['المرجع', 'القسم الرئيسي', 'التخصص', 'النوع', 'الوصف'];
  const groupFill = { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: '2E75B6' } };
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  const centerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
  const thinBorder = {
    left: { style: 'thin' as const, color: { argb: 'B0B0B0' } },
    right: { style: 'thin' as const, color: { argb: 'B0B0B0' } },
    top: { style: 'thin' as const, color: { argb: 'B0B0B0' } },
    bottom: { style: 'thin' as const, color: { argb: 'B0B0B0' } },
  };

  for (let i = 0; i < headers.length; i++) {
    const cell = ws.getCell(2, i + 1);
    cell.value = headers[i];
    cell.font = headerFont;
    cell.fill = groupFill;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  }

  for (let r = 0; r < NUM_REVS; r++) {
    const start = revStartCols[r];
    ws.mergeCells(2, start, 2, start + 3);
    const cell = ws.getCell(2, start);
    cell.value = `REV.${r}`;
    cell.font = headerFont;
    cell.fill = groupFill;
    cell.alignment = centerAlign;
    for (let c = start; c < start + 4; c++) {
      ws.getCell(2, c).border = thinBorder;
      ws.getCell(2, c).fill = groupFill;
    }
  }

  ws.getCell(2, consultantCol).value = 'الاستشاري';
  ws.getCell(2, mohSubmitCol).value = 'الوزارة';
  ws.mergeCells(2, mohSubmitCol, 2, mohStatusCol);
  ws.getCell(2, consultantCol).font = headerFont;
  ws.getCell(2, consultantCol).fill = groupFill;
  ws.getCell(2, consultantCol).alignment = centerAlign;
  for (let c = mohSubmitCol; c <= mohStatusCol; c++) {
    ws.getCell(2, c).font = headerFont;
    ws.getCell(2, c).fill = groupFill;
    ws.getCell(2, c).border = thinBorder;
  }
  ws.getCell(2, totalDaysCol).value = 'إجمالي الأيام';
  ws.getCell(2, totalDaysCol).font = headerFont;
  ws.getCell(2, totalDaysCol).fill = groupFill;
  ws.getCell(2, totalDaysCol).alignment = centerAlign;
  ws.getCell(2, totalDaysCol).border = thinBorder;

  // Sub-headers (row 3)
  const subFill = { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: 'D6E4F0' } };
  const subFont = { name: 'Calibri', size: 10, bold: true, color: { argb: '1F4E78' } };
  const subLabels = ['تقديم', 'رد', 'إجراء', 'نوع'];
  for (let r = 0; r < NUM_REVS; r++) {
    const start = revStartCols[r];
    for (let i = 0; i < subLabels.length; i++) {
      const cell = ws.getCell(3, start + i);
      cell.value = subLabels[i];
      cell.font = subFont;
      cell.fill = subFill;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    }
  }
  ws.getCell(3, consultantCol).value = 'الحالة';
  ws.getCell(3, consultantCol).font = subFont;
  ws.getCell(3, consultantCol).fill = subFill;
  ws.getCell(3, consultantCol).alignment = centerAlign;
  ws.getCell(3, consultantCol).border = thinBorder;
  const mohLabels = ['إرسال', 'رد', 'الحالة'];
  for (let i = 0; i < mohLabels.length; i++) {
    const cell = ws.getCell(3, mohSubmitCol + i);
    cell.value = mohLabels[i];
    cell.font = subFont;
    cell.fill = subFill;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  }
  ws.getCell(3, totalDaysCol).value = 'يوم';
  ws.getCell(3, totalDaysCol).font = subFont;
  ws.getCell(3, totalDaysCol).fill = subFill;
  ws.getCell(3, totalDaysCol).alignment = centerAlign;
  ws.getCell(3, totalDaysCol).border = thinBorder;

  // Data rows
  const fmtDate = (d: Date | null | undefined) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  };

  const dataFont = { name: 'Calibri', size: 10 };
  const actionFills: Record<string, any> = {
    approved: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: 'C6EFCE' } },
    rejected: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: 'FFC7CE' } },
    withdrawn: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: 'E7E6E6' } },
    pending: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: 'FFEB9C' } },
  };

  items.forEach((item, idx) => {
    const row = 4 + idx;
    ws.getCell(row, 1).value = item.reference;
    ws.getCell(row, 2).value = item.category;
    ws.getCell(row, 3).value = item.discipline;
    ws.getCell(row, 4).value = item.type;
    ws.getCell(row, 5).value = item.description;

    for (let r = 0; r < NUM_REVS; r++) {
      const revData = item.revisions[r];
      const start = revStartCols[r];
      if (revData) {
        ws.getCell(row, start).value = fmtDate(revData.submitDate);
        ws.getCell(row, start + 1).value = fmtDate(revData.replyDate);
        const action = revData.action || '';
        ws.getCell(row, start + 2).value = action === 'approved' ? 'معتمد' : action === 'rejected' ? 'مرفوض' : action === 'withdrawn' ? 'مسحوب' : action;
        const fill = actionFills[action.toLowerCase()];
        if (fill) ws.getCell(row, start + 2).fill = fill;
        ws.getCell(row, start + 3).value = action === 'approved' ? getApprovalTypeLetter(revData.approvalType) : '';
      }
    }

    ws.getCell(row, consultantCol).value = item.consultantStatus;
    ws.getCell(row, mohSubmitCol).value = fmtDate(item.mohSubmitDate);
    ws.getCell(row, mohReplyCol).value = fmtDate(item.mohReviewDate);
    ws.getCell(row, mohStatusCol).value = item.mohStatus;
    ws.getCell(row, totalDaysCol).value = item.totalDays;

    // Apply formatting
    for (let c = 1; c <= totalDaysCol; c++) {
      const cell = ws.getCell(row, c);
      cell.font = dataFont;
      cell.border = thinBorder;
      if (c === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true };
      } else if (c === 5) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = centerAlign;
      }
    }
  });

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 40;
  for (let r = 0; r < NUM_REVS; r++) {
    const start = revStartCols[r];
    ws.getColumn(start).width = 12;
    ws.getColumn(start + 1).width = 12;
    ws.getColumn(start + 2).width = 10;
    ws.getColumn(start + 3).width = 6;
  }
  ws.getColumn(consultantCol).width = 14;
  ws.getColumn(mohSubmitCol).width = 12;
  ws.getColumn(mohReplyCol).width = 12;
  ws.getColumn(mohStatusCol).width = 14;
  ws.getColumn(totalDaysCol).width = 10;

  // Freeze panes
  ws.views = [{ showGridLines: false, zoomScale: 100 }];
  ws.views[0].state = 'frozen';
  ws.views[0].xSplit = fixedCols;
  ws.views[0].ySplit = 3;

  const outputBuffer = await workbook.xlsx.writeBuffer();
  const filename = `Transmittal-Timeline-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(outputBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
