import { NextResponse } from 'next/server';
import { frameXJson } from '../../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS = new Set([
  'detail',
  'replay',
  'rankings',
  'h2h',
  'stats',
  'events',
  'lineups',
  'match-flow',
  'match-flow-has-new'
]);
const SAFE_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' };
const NO_CACHE = { 'Cache-Control': 'private, no-store' };
const OMIT_KEY = /(?:media|play|path|url|uri|proxy|redirect|stream|source|odds|hls|m3u8|playlist|manifest|link|embed|image|cover|logo|poster|thumb|video|audio|src|file|cdn|referer|token|sign)/i;

function clean(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (typeof value === 'string') {
    const text = value.slice(0, 500);
    if (/(?:https?:)?\/\/|\bwww\.|\.m3u8|\b(?:blob|rtmp|rtsp|udp|data|javascript):/i.test(text)) return undefined;
    return text;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => clean(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  const result = {};
  for (const [key, entry] of Object.entries(value).slice(0, 80)) {
    if (OMIT_KEY.test(key)) continue;
    const safe = clean(entry, depth + 1);
    if (safe !== undefined) result[key.slice(0, 100)] = safe;
  }
  return result;
}

function objectData(response) {
  return response && typeof response === 'object' && response.data && typeof response.data === 'object'
    ? response.data
    : response;
}

function valueAt(response, key, fallback) {
  const data = objectData(response);
  const value = data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
  return clean(value);
}

function identifier(params, name, required = true) {
  const value = params.get(name);
  if (value == null || value === '') return required ? null : '';
  if (!/^\d{1,32}$/.test(value) || /^0+$/.test(value)) return null;
  return value;
}

function normalize(action, response) {
  switch (action) {
    case 'detail':
      return { action, match: valueAt(response, 'match', null) ?? null };
    case 'replay':
      return {
        action,
        available: valueAt(response, 'available', false) === true,
        match: valueAt(response, 'match', null) ?? null,
        replayOffers: Array.isArray(valueAt(response, 'replayOffers', [])) ? valueAt(response, 'replayOffers', []).slice(0, 30) : []
      };
    case 'h2h':
      return { action, items: Array.isArray(valueAt(response, 'items', [])) ? valueAt(response, 'items', []).slice(0, 100) : [] };
    case 'stats':
      return { action, periods: Array.isArray(valueAt(response, 'periods', [])) ? valueAt(response, 'periods', []).slice(0, 50) : [] };
    case 'events':
      return { action, events: Array.isArray(valueAt(response, 'events', [])) ? valueAt(response, 'events', []).slice(0, 100) : [] };
    case 'lineups':
      return {
        action,
        home: valueAt(response, 'home', null) ?? null,
        away: valueAt(response, 'away', null) ?? null,
        status: valueAt(response, 'status', null) ?? null
      };
    case 'rankings':
      return {
        action,
        needDivide: valueAt(response, 'needDivide', false) === true,
        rankingList: Array.isArray(valueAt(response, 'rankingList', [])) ? valueAt(response, 'rankingList', []).slice(0, 100) : [],
        season: valueAt(response, 'season', null) ?? null
      };
    case 'match-flow':
      return {
        action,
        hasMore: valueAt(response, 'hasMore', false) === true,
        lastSort: valueAt(response, 'lastSort', null) ?? null,
        list: Array.isArray(valueAt(response, 'list', [])) ? valueAt(response, 'list', []).slice(0, 100) : []
      };
    case 'match-flow-has-new':
      return {
        action,
        hasNew: valueAt(response, 'hasNew', false) === true,
        list: Array.isArray(valueAt(response, 'list', [])) ? valueAt(response, 'list', []).slice(0, 100) : []
      };
    default:
      return null;
  }
}

export async function GET(request, { params }) {
  const { action } = await params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'This match detail action is not available.' }, { status: 404, headers: NO_CACHE });
  }

  const paramsIn = new URL(request.url).searchParams;
  const needsLeague = action === 'rankings';
  const idName = needsLeague ? 'leagueId' : 'matchId';
  const id = identifier(paramsIn, idName);
  if (!id) return NextResponse.json({ error: `A valid ${idName} is required.` }, { status: 400, headers: NO_CACHE });

  const query = new URLSearchParams([[idName, id]]);
  if (action === 'match-flow') {
    const rawSize = paramsIn.get('pageSize');
    let pageSize = 20;
    if (rawSize != null) {
      if (!/^\d{1,3}$/.test(rawSize) || Number(rawSize) < 1 || Number(rawSize) > 100) {
        return NextResponse.json({ error: 'Page size must be a whole number from 1 to 100.' }, { status: 400, headers: NO_CACHE });
      }
      pageSize = Number(rawSize);
    }
    query.set('pageSize', String(pageSize));
    const lastSort = paramsIn.get('lastSort');
    if (lastSort != null && lastSort !== '') {
      if (lastSort.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(lastSort)) {
        return NextResponse.json({ error: 'The match-flow cursor is invalid.' }, { status: 400, headers: NO_CACHE });
      }
      query.set('lastSort', lastSort);
    }
  }
  if (action === 'match-flow-has-new') {
    const sort = paramsIn.get('sort');
    if (sort != null && sort !== '') {
      if (sort.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(sort)) {
        return NextResponse.json({ error: 'The match-flow cursor is invalid.' }, { status: 400, headers: NO_CACHE });
      }
      query.set('sort', sort);
    }
  }

  // Keep upstream paths closed over this route allowlist; caller input only supplies validated identifiers/cursors.
  const upstreamAction = action === 'match-flow-has-new' ? 'match-flow/has-new' : action;
  const upstreamPath = `/v1/sports/${upstreamAction}?${query.toString()}`;
  try {
    const response = await frameXJson(upstreamPath, { cache: 'sports' });
    const payload = normalize(action, response);
    return NextResponse.json(payload, { headers: SAFE_CACHE });
  } catch (error) {
    console.error('Sports match detail unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Match details are temporarily unavailable.' }, { status: 502, headers: NO_CACHE });
  }
}
