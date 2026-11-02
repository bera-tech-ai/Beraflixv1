import { NextResponse } from 'next/server';
import { getAnimeEpisodesBySlug } from '../../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!slug) return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
  try {
    const items = await getAnimeEpisodesBySlug(slug);
    if (!items) return NextResponse.json({ error: 'This title is unavailable.' }, { status: 404 });
    return NextResponse.json({ count: items.length, items }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' }
    });
  } catch (error) {
    console.error('Anime episode list unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Episodes are temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
