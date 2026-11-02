import { NextResponse } from 'next/server';
import { getSportsOverview } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const sportType = new URL(request.url).searchParams.get('sportType') || 'football';
  try {
    const data = await getSportsOverview(sportType);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' }
    });
  } catch (error) {
    console.error('Sports feed unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Sports are temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
