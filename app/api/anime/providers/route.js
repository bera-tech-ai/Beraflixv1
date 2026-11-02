import { NextResponse } from 'next/server';
import { getAnimeXProvidersBySlug } from '../../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE = { 'Cache-Control': 'private, no-store' };
const SAFE_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=600' };

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug') || '';
  const episodeId = params.get('episodeId') || '';
  const track = (params.get('track') || '').toLowerCase();
  if (!slug || slug.length > 4096 || !episodeId || episodeId.length > 200 || !['sub', 'dub'].includes(track)) {
    return NextResponse.json({ error: 'Choose a valid title, episode, and audio track.' }, { status: 400, headers: NO_CACHE });
  }
  try {
    const providers = await getAnimeXProvidersBySlug({ slug, episodeId, track });
    if (!providers) return NextResponse.json({ error: 'Provider choices are unavailable for this title.' }, { status: 404, headers: NO_CACHE });
    return NextResponse.json({ count: providers.length, providers }, { headers: SAFE_CACHE });
  } catch (error) {
    const message = String(error?.message || '');
    const invalidSelection = /select|available|unavailable/i.test(message);
    console.error('Anime provider list unavailable:', message || 'Unknown error');
    return NextResponse.json({ error: invalidSelection ? message : 'Provider choices are temporarily unavailable.' }, {
      status: invalidSelection ? 422 : 502,
      headers: NO_CACHE
    });
  }
}
