import { NextResponse } from 'next/server';
import { getPlayableTargetFromDetailPath, getSignedMediaUrl } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_QUALITIES = new Set(['auto', '360p', '480p', '720p', '1080p']);
const NO_STORE = { 'Cache-Control': 'private, no-store' };
const isSeries = (type) => /series|tv|show/i.test(String(type || ''));

function parseEpisode(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 999 ? number : NaN;
}

export async function GET(request) {
  const incoming = new URL(request.url);
  const slug = incoming.searchParams.get('slug') || '';
  if (!slug) return NextResponse.json({ error: 'A title slug is required.' }, { status: 400, headers: NO_STORE });
  const quality = incoming.searchParams.get('quality') || 'auto';
  if (!ALLOWED_QUALITIES.has(quality)) return NextResponse.json({ error: 'That streaming quality is not supported.' }, { status: 400, headers: NO_STORE });

  try {
    const movie = await getPlayableTargetFromDetailPath(slug);
    if (!movie) return NextResponse.json({ error: 'This title is unavailable.' }, { status: 404, headers: NO_STORE });
    if (!movie.hasResource) return NextResponse.json({ error: 'Playback is not available for this title.' }, { status: 404, headers: NO_STORE });

    const season = parseEpisode(incoming.searchParams.get('se'));
    const episode = parseEpisode(incoming.searchParams.get('ep'));
    if (Number.isNaN(season) || Number.isNaN(episode) || Boolean(season) !== Boolean(episode)) {
      return NextResponse.json({ error: 'Enter a valid positive season and episode number.' }, { status: 400, headers: NO_STORE });
    }
    if (isSeries(movie.type) && (!season || !episode)) {
      return NextResponse.json({ error: 'Choose a season and episode before requesting series playback.' }, { status: 400, headers: NO_STORE });
    }

    const signed = await getSignedMediaUrl(movie, { quality, season, episode });
    return NextResponse.json(signed, { headers: NO_STORE });
  } catch (error) {
    console.error('Stream URL request failed:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'A playback link could not be prepared. Check title availability and try again.' }, { status: 502, headers: NO_STORE });
  }
}
