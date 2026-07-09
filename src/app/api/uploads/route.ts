import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { getImUploadDir } from '@/lib/paths';

export const dynamic = 'force-dynamic';

/**
 * GET /api/uploads
 *
 * Lists all files in the IM gateway upload directory (/home/z/my-project/upload).
 * Used by the attachment picker UI to let users reference existing pasted images.
 *
 * Returns: { items: [{ name, size, mtime, contentType }] }
 */
export async function GET() {
  const dir = getImUploadDir();
  if (!dir) {
    return NextResponse.json({ items: [], error: 'دليل الرفع غير موجود' }, { status: 404 });
  }
  try {
    const entries = await readdir(dir);
    const items = [];
    for (const name of entries) {
      const full = path.join(dir, name);
      try {
        const stat = statSync(full);
        if (!stat.isFile()) continue;
        // Determine content type from extension
        const ext = path.extname(name).toLowerCase();
        const extMimes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.bmp': 'image/bmp',
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain',
          '.csv': 'text/csv',
          '.zip': 'application/zip',
        };
        items.push({
          name,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          contentType: extMimes[ext] || 'application/octet-stream',
        });
      } catch { /* skip unreadable */ }
    }
    // Sort newest first
    items.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e.message }, { status: 500 });
  }
}
