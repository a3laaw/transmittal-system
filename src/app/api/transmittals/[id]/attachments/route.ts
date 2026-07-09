import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transmittals/[id]/attachments — list all attachments for a transmittal
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.attachment.findMany({
    where: { transmittalId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ items });
}

/**
 * DELETE /api/transmittals/[id]/attachments?attId=xxx — delete an attachment
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const attId = searchParams.get('attId');
  if (!attId) return NextResponse.json({ error: 'attId required' }, { status: 400 });

  await db.attachment.delete({
    where: { id: attId, transmittalId: id },
  });
  return NextResponse.json({ ok: true });
}
