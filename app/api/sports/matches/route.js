import { NextResponse } from 'next/server';
import { getSportsMatches } from '../../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const payload = await getSportsMatches();
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' } });
  } catch (error) {
    console.error('Sports match list unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'The match list is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
