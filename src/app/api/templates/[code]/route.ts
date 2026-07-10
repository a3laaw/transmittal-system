import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/[code]
 * Serves a category-specific Excel template file.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: 'الكود مطلوب' }, { status: 400 });
    }

    const storageRoot = getStorageRoot();
    const templatePath = path.join(storageRoot, 'templates', `${code}.xlsx`);

    if (!existsSync(templatePath)) {
      return NextResponse.json({ error: 'القالب غير موجود' }, { status: 404 });
    }

    const buffer = await readFile(templatePath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${code}_template.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('[templates] Error:', e.message);
    return NextResponse.json({ error: 'تعذّر قراءة القالب' }, { status: 500 });
  }
}
