import { NextResponse } from 'next/server';
import { frameXJson } from '../../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PUBLIC_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' };
const PRIVATE_CACHE = { 'Cache-Control': 'private, no-store' };
const OMIT_KEY = /(?:media|play|path|url|uri|proxy|redirect|stream|source|odds|hls|m3u8|playlist|manifest|link|embed|image|cover|logo|poster|thumb|video|audio|src|file|cdn|referer|token|sign)/i;

function clean(value, depth = 0) {
  if (depth > 7 || value == null) return value;
  if (typeof value === 'string') {
    const text = value.slice(0, 400);
    return /(?:https?:)?\/\/|\bwww\.|\.m3u8|\b(?:blob|rtmp|rtsp|udp|data|javascript):/i.test(text) ? undefined : text;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => clean(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value !== 'object') return undefined;
  const output = {};
  for (const [key, entry] of Object.entries(value).slice(0, 60)) {
    if (OMIT_KEY.test(key)) continue;
    const sanitized = clean(entry, depth + 1);
    if (sanitized !== undefined) output[key.slice(0, 80)] = sanitized;
  }
  return output;
}

export async function GET() {
  try {
    const result = await frameXJson('/v1/sports/resources', { cache: 'sports' });
    const data = result?.data && typeof result.data === 'object' ? result.data : result;
    const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data?.resources) ? data.resources : Array.isArray(data?.list) ? data.list : [];
    const items = clean(raw) || [];
    return NextResponse.json({ items: Array.isArray(items) ? items : [] }, { headers: PUBLIC_CACHE });
  } catch (error) {
    console.error('Sports resources unavailable:', error?.message || 'Unknown error');
    return NextResponse.json({ error: 'Sports resources are temporarily unavailable.' }, { status: 502, headers: PRIVATE_CACHE });
  }
}
