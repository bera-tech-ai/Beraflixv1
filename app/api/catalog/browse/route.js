import { NextResponse } from 'next/server';
import { getCatalogByFacet, getCatalogPage, getUpcomingMovies } from '../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const kind = (params.get('kind') || '').trim().toLowerCase();
  const slug = (params.get('slug') || '').trim().toLowerCase();
  const section = (params.get('section') || '').trim();
  const page = Math.max(1, Math.min(100, Number.parseInt(params.get('page') || '1', 10) || 1));
  if (section) {
    if (!['trending', 'popularMovies', 'popularSeries', 'latestMovies', 'latestSeries'].includes(section)) {
      return NextResponse.json({ error: 'Choose a valid catalog section.', items: [] }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
    try {
      const items = await getCatalogPage(section, page);
      return NextResponse.json({ section, page, count: items.length, items }, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' }
      });
    } catch {
      return NextResponse.json({ error: 'This catalog page is temporarily unavailable.', items: [] }, {
        status: 502,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }
  }
  if (!['categories', 'genres'].includes(kind) || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: 'Choose a valid catalog filter.', items: [] }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
  try {
    const items = kind === 'categories' && slug === 'upcoming'
      ? await getUpcomingMovies()
      : await getCatalogByFacet(kind, slug, page);
    return NextResponse.json({ kind, slug, page, count: items.length, items }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' }
    });
  } catch {
    return NextResponse.json({ error: 'This catalog list is temporarily unavailable.', items: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
