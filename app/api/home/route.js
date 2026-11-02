import { NextResponse } from 'next/server';
import { getCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' }
    });
  } catch (error) {
    console.error('Catalog proxy failed:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'The movie catalog is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
