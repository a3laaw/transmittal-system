import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { getStorageRoot } from '@/lib/paths';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/[code]
 * Serves a category-specific template file (any type: xlsx, docx, pdf, etc.)
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

    // Get template type from DB
    const cat = await db.category.findUnique({
      where: { code },
      select: { templateType: true, templatePath: true },
    });

    if (!cat?.templatePath) {
      return NextResponse.json({ error: 'لا يوجد قالب لهذا القسم' }, { status: 404 });
    }

    const storageRoot = getStorageRoot();
    const templatesDir = path.join(storageRoot, 'templates');

    // Find the template file (any extension)
    let templateFile: string | null = null;
    if (existsSync(templatesDir)) {
      const files = readdirSync(templatesDir);
      templateFile = files.find(f => f.startsWith(`${code}.`)) || null;
    }

    if (!templateFile) {
      return NextResponse.json({ error: 'القالب غير موجود على القرص' }, { status: 404 });
    }

    const templatePath = path.join(templatesDir, templateFile);
    const buffer = await readFile(templatePath);
    const ext = path.extname(templateFile).toLowerCase().replace('.', '');

    // Determine MIME type
    const mimeTypes: Record<string, string> = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'pdf': 'application/pdf',
      'txt': 'text/plain; charset=utf-8',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${templateFile}"`,
        'Cache-Control': 'no-store',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e: any) {
    console.error('[templates] Error:', e.message);
    return NextResponse.json({ error: 'تعذّر قراءة القالب' }, { status: 500 });
  }
}
