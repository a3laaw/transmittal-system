import { NextResponse } from 'next/server';
import { getStorageRoot } from '@/lib/paths';
export const dynamic = 'force-dynamic';
export async function GET() {
  const root = getStorageRoot();
  return NextResponse.json({ path: root + '/uploads', structure: '{categoryCode}/{disciplineCode}/{transmittalId}/' });
}
