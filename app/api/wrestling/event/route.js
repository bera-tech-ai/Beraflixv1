import { NextResponse } from 'next/server';
import { frameXJson } from '../../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function displayText(value, maxLength = 4000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function validEventUrl(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 2048 || value.includes('#')) return null;
  const authority = value.match(/^https:\/\/([^/?#]*)/i)?.[1];
  if (!authority || authority.toLowerCase() !== 'www.wwe.com') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.wwe.com' || parsed.username || parsed.password || parsed.port || parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function partLabel(part) {
  const raw = part && typeof part === 'object' ? part.part : part;
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  return displayText(String(raw), 120);
}

export async function GET(request) {
  const eventUrl = validEventUrl(new URL(request.url).searchParams.get('url'));
  if (!eventUrl) {
    return NextResponse.json({ error: 'A valid WWE event page is required.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const result = await frameXJson(`/v1/wrestling/event?url=${encodeURIComponent(eventUrl)}&resolve=0`, { cache: 'wrestling' });
    const rawEvent = result?.data?.event || result?.data;
    const event = {
      title: displayText(rawEvent?.title, 240),
      description: displayText(rawEvent?.description),
      parts: Array.isArray(rawEvent?.parts) ? rawEvent.parts.map(partLabel).filter(Boolean) : []
    };
    return NextResponse.json({ event }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=180, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ error: 'Wrestling event details are temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
