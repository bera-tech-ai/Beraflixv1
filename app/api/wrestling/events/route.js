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

function partLabel(part) {
  const raw = part && typeof part === 'object' ? part.part : part;
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  const label = displayText(String(raw), 120);
  if (!label || /(?:^|\s)(?:https?:\/\/|www\.)/i.test(label)) return '';
  return label;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const catalog = params.get('catalog') || 'official';
  const pageValue = params.get('page') || '1';
  if (catalog !== 'official' || !/^[1-9]\d{0,3}$/.test(pageValue)) {
    return NextResponse.json({ error: 'Invalid wrestling listing request.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const result = await frameXJson(`/v1/wrestling/events?catalog=official&page=${pageValue}`, { cache: 'wrestling' });
    const rawEvents = result?.data?.events;
    const events = Array.isArray(rawEvents) ? rawEvents.map((event) => ({
      title: displayText(event?.title, 240),
      description: displayText(event?.description),
      parts: Array.isArray(event?.parts) ? event.parts.map(partLabel).filter(Boolean) : []
    })).filter((event) => event.title) : [];
    return NextResponse.json({ events }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=180, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ error: 'Wrestling events are temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
