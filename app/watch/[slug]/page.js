import { notFound, redirect } from 'next/navigation';
import PlayerScreen from '../../../components/PlayerScreen';
import { getMovieBySlug } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 999 ? number : fallback;
}

function allowedAnimeTrack(source, track) {
  const allowed = source === 'animex' ? ['sub', 'dub'] : ['hard_sub', 'soft_sub', 'dub'];
  return typeof track === 'string' && allowed.includes(track);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const movie = await getMovieBySlug(slug);
    return { title: movie ? `Now playing: ${movie.title}` : 'Player' };
  } catch { return { title: 'Player' }; }
}

export default async function WatchPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  let movie;
  try { movie = await getMovieBySlug(slug); }
  catch (error) { console.error('Player title lookup failed:', error?.message || 'Unknown error'); return <PlayerScreen error />; }
  if (!movie) notFound();
  const isAnime = ['anime', 'animex'].includes(movie.source);
  if (movie.detailPath !== slug) {
    const episodeQuery = isAnime
      ? new URLSearchParams({
          ...(typeof query?.animeEpisodeId === 'string' && query.animeEpisodeId.length <= 200 ? { animeEpisodeId: query.animeEpisodeId } : {}),
          ...(allowedAnimeTrack(movie.source, query?.track) ? { track: query.track } : {})
        })
      : new URLSearchParams({ se: String(positiveInteger(query?.se)), ep: String(positiveInteger(query?.ep)) });
    redirect(`/watch/${encodeURIComponent(movie.detailPath)}?${episodeQuery.toString()}`);
  }
  return <PlayerScreen
    movie={movie}
    initialSeason={positiveInteger(query?.se)}
    initialEpisode={positiveInteger(query?.ep)}
    initialAnimeEpisodeId={isAnime && typeof query?.animeEpisodeId === 'string' ? query.animeEpisodeId.slice(0, 200) : ''}
    initialAnimeTrack={isAnime && allowedAnimeTrack(movie.source, query?.track) ? query.track : ''}
  />;
}
