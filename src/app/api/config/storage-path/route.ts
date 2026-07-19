import { NextResponse } from 'next/server';
import { getStorageRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

// GET /api/config/storage-path — returns the storage path and structure
export async function GET() {
  const root = getStorageRoot();
  const path = root + '/uploads';
  return NextResponse.json({
    path,
    structure: '{categoryCode}/{disciplineCode}/{transmittalId}/',
    example: 'TRANSMITTAL/CIV/CIV-001/',
  });
}
