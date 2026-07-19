import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'download', 'nova-edms-final.zip');
    const fileBuffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="nova-edms-final.zip"',
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
