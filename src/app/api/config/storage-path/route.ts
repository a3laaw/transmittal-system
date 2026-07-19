import { NextResponse } from 'next/server';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

// GET /api/config/storage-path — returns the absolute path where uploaded files are stored
export async function GET() {
  const path = getStorageRoot() + '/uploads';
  return NextResponse.json({ path });
}
