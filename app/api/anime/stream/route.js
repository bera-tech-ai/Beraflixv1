import { NextResponse } from 'next/server';
import { getAnimePlayerLink } from '../../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug') || '';
  const episodeId = params.get('episodeId') || '';
  const track = params.get('track') || '';
  const providerId = params.get('providerId') || '';
  if (!slug || !episodeId || !track) return NextResponse.json({ error: 'Choose a title, episode, and track.' }, { status: 400 });
  try {
    const player = await getAnimePlayerLink({ slug, episodeId, track, providerId });
    return NextResponse.json(player, {
      headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'strict-origin-when-cross-origin' }
    });
  } catch (error) {
    const message = String(error?.message || '');
    const status = /select|available|unavailable/i.test(message) ? 422 : 502;
    console.error('Anime player link unavailable:', message || 'Unknown error');
    return NextResponse.json({ error: status === 422 ? message : 'The player link could not be prepared.' }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
