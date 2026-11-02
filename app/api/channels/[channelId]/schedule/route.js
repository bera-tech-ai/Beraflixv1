import { NextResponse } from 'next/server';
import { getChannelSchedule } from '../../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { channelId } = await params;
  try {
    const data = await getChannelSchedule(channelId);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' }
    });
  } catch {
    return NextResponse.json({ error: 'This channel schedule is temporarily unavailable.', programs: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
