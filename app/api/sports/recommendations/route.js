import { NextResponse } from 'next/server';
import { getSportsRecommendations } from '../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const requestedType = (new URL(request.url).searchParams.get('sportType') || 'football').trim().toLowerCase();
  if (requestedType !== 'football') {
    return NextResponse.json({ error: 'This sports category is unavailable.', highlights: [], news: [] }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
  try {
    const recommendations = await getSportsRecommendations(requestedType);
    return NextResponse.json(recommendations, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' }
    });
  } catch {
    return NextResponse.json({ error: 'Sports recommendations are temporarily unavailable.', highlights: [], news: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
