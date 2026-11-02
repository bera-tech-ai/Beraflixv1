import ExploreScreen from '../../components/ExploreScreen';
import { getCatalog, getChannelDirectory, getSportsOverview, searchAnimeCatalog, searchCatalog } from '../../lib/catalog';

export const metadata = { title: 'Explore' };
export const dynamic = 'force-dynamic';

const isSeries = (item) => /series|tv|show/i.test(String(item?.type || ''));

export default async function ExplorePage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const mode = ['movies', 'series', 'anime', 'sports', 'channels', 'books', 'wrestling', 'channels-v2'].includes(params?.mode) ? params.mode : 'all';
  try {
    if (mode === 'channels') return <ExploreScreen mode={mode} channels={await getChannelDirectory()} />;
    if (mode === 'sports') return <ExploreScreen mode={mode} sports={await getSportsOverview('football')} />;
    if (['books', 'wrestling', 'channels-v2'].includes(mode)) return <ExploreScreen mode={mode} />;
    if (mode === 'anime') return <ExploreScreen mode={mode} movies={query ? await searchAnimeCatalog(query) : []} query={query} />;
    const catalog = query ? await searchCatalog(query) : [...new Map((await getCatalog()).items.map((item) => [item.detailPath, item])).values()];
    const movies = mode === 'series' ? catalog.filter(isSeries) : mode === 'movies' ? catalog.filter((item) => !isSeries(item)) : catalog;
    return <ExploreScreen mode={mode} movies={movies} query={query} />;
  } catch (error) {
    if (mode === 'channels') return <ExploreScreen mode={mode} channels={[{ id: '9', name: 'Channel 9', status: '', slogan: '' }]} directoryError />;
    console.error('Explore search failed:', error?.message || 'Unknown error');
    return <ExploreScreen mode={mode} movies={[]} query={query} error />;
  }
}
