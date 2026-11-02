import { notFound, redirect } from 'next/navigation';
import MovieDetailScreen from '../../../components/MovieDetailScreen';
import { getCatalog, getMovieBySlug } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

async function getRelatedTitles(movie) {
  if (!movie || movie.source === 'anime') return { matchingItem: null, relatedItems: [] };
  const catalog = await getCatalog().catch(() => null);
  if (!catalog?.items?.length) return { matchingItem: null, relatedItems: [] };
  const isSeries = /series|tv|show/i.test(String(movie.type || ''));
  const genres = new Set(String(movie.genre || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const matchingItem = catalog.items.find((item) => item.detailPath === movie.detailPath) || null;
  const relatedItems = catalog.items
    .filter((item) => item.detailPath !== movie.detailPath && item.source === movie.source && (/series|tv|show/i.test(String(item.type || '')) === isSeries))
    .map((item) => ({ item, score: String(item.genre || '').split(',').map((value) => value.trim().toLowerCase()).filter((value) => genres.has(value)).length }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ item }) => item);
  return { matchingItem, relatedItems };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const movie = await getMovieBySlug(slug);
    return movie ? { title: movie.title, ...(movie.description ? { description: movie.description } : {}) } : { title: 'Title not found' };
  } catch {
    return { title: 'Title details' };
  }
}

export default async function MovieDetailPage({ params }) {
  const { slug } = await params;
  let movie;
  try { movie = await getMovieBySlug(slug); }
  catch (error) { console.error('Title detail lookup failed:', error?.message || 'Unknown error'); return <MovieDetailScreen error />; }
  if (!movie) notFound();
  if (movie.detailPath !== slug) redirect(`/movie/${encodeURIComponent(movie.detailPath)}`);
  const { matchingItem, relatedItems } = await getRelatedTitles(movie);
  const displayMovie = matchingItem ? {
    ...movie,
    genre: movie.genre || matchingItem.genre,
    cover: movie.cover || matchingItem.cover,
    backdrop: movie.backdrop || matchingItem.backdrop,
    imdbRatingValue: movie.imdbRatingValue || matchingItem.imdbRatingValue,
    description: movie.description || matchingItem.description,
    releaseDate: matchingItem.releaseDate || movie.releaseDate,
    duration: movie.duration || matchingItem.duration,
    countryName: movie.countryName || matchingItem.countryName
  } : movie;
  return <MovieDetailScreen movie={displayMovie} relatedItems={relatedItems} />;
}
