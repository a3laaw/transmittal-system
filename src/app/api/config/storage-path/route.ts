import { NextResponse } from 'next/server';
import { getStorageRoot } from '@/lib/paths';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ path: getStorageRoot() + '/uploads' }); }
