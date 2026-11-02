import { NextResponse } from 'next/server';
import { getMovieCaptionTracks, getPlayableTargetFromDetailPath } from '../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug') || '';
  try {
    const movie = await getPlayableTargetFromDetailPath(slug);
    if (!movie || movie.source !== 'moviebox' || !movie.hasResource) {
      return NextResponse.json({ error: 'Subtitles are unavailable for this title.', tracks: [] }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const options = { quality: params.get('quality') || 'auto', season: params.get('se') || undefined, episode: params.get('ep') || undefined };
    const tracks = await getMovieCaptionTracks(movie, options);
    return NextResponse.json({ tracks: tracks.map((track) => {
      const fileParams = new URLSearchParams({ slug, id: track.id });
      if (options.quality !== 'auto') fileParams.set('quality', options.quality);
      if (options.season && options.episode) {
        fileParams.set('se', options.season);
        fileParams.set('ep', options.episode);
      }
      return { id: track.id, language: track.language || 'und', label: track.label, src: `/api/captions/file?${fileParams.toString()}` };
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Subtitle metadata unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Subtitle tracks are temporarily unavailable.', tracks: [] }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
