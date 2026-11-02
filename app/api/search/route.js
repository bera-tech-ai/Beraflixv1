import { NextResponse } from 'next/server';
import { getCatalog, searchAnimeCatalog, searchCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isSeries = (item) => /series|tv|show/i.test(String(item?.type || ''));

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') || '').trim().slice(0, 100);
  const requestedMode = params.get('mode') || 'all';
  const mode = ['anime', 'movies', 'series'].includes(requestedMode) ? requestedMode : 'all';
  const page = Math.max(1, Math.min(100, Number.parseInt(params.get('page') || '1', 10) || 1));
  try {
    const results = mode === 'anime'
      ? (query ? await searchAnimeCatalog(query) : [])
      : (query ? await searchCatalog(query, page) : (await getCatalog()).items);
    const items = mode === 'series' ? results.filter(isSeries) : mode === 'movies' ? results.filter((item) => !isSeries(item)) : results;
    return NextResponse.json({ query, mode, page, count: items.length, items }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' }
    });
  } catch (error) {
    console.error('Catalog search failed:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
