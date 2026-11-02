import { NextResponse } from 'next/server';
import { frameXJson } from '../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function displayText(value, maxLength = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

export async function GET(request) {
  const country = new URL(request.url).searchParams.get('country') || '';
  if (!/^[a-z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'A lower-case ISO country code is required.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const result = await frameXJson(`/v1/channels-v2/channels?country=${country}`, { cache: 'directory' });
    const rawChannels = result?.data?.channels ?? result?.data;
    const channels = Array.isArray(rawChannels) ? rawChannels.flatMap((channel) => {
      if (!channel || typeof channel !== 'object') return [];
      const id = typeof channel.id === 'string' || typeof channel.id === 'number' ? String(channel.id) : '';
      if (!id || id.length > 128) return [];
      const languages = Array.isArray(channel.languages)
        ? channel.languages.map((language) => displayText(language, 80)).filter(Boolean).slice(0, 20)
        : [];
      return [{
        id,
        name: displayText(channel.name, 240),
        country: displayText(channel.country, 120),
        languages,
        isGeoBlocked: channel.isGeoBlocked === true,
        streamType: displayText(channel.streamType, 80)
      }].filter((item) => item.name);
    }) : [];
    return NextResponse.json({ channels }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ error: 'Channels are temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
