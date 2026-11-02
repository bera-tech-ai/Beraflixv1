import { NextResponse } from 'next/server';
import { getCatalogFacets } from '../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const facets = await getCatalogFacets();
    return NextResponse.json(facets, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' }
    });
  } catch {
    return NextResponse.json({ error: 'Catalog filters are temporarily unavailable.', categories: [], genres: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
}
