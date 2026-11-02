import { NextResponse } from 'next/server';
import { frameXJson } from '../../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function displayText(value, maxLength = 160) {
  if (typeof value !== 'string') return '';
  return value.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

export async function GET() {
  try {
    const result = await frameXJson('/v1/channels-v2/countries', { cache: 'directory' });
    const rawCountries = result?.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : {};
    const countries = Object.entries(rawCountries).flatMap(([rawCode, value]) => {
      const code = rawCode.toLowerCase();
      if (!/^[a-z]{2}$/.test(code) || !value || typeof value !== 'object') return [];
      const count = Number(value.channelCount);
      return [{
        code,
        name: displayText(value.country, 160),
        channelCount: Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0,
        timeZone: displayText(value.timeZone, 100)
      }].filter((country) => country.name);
    }).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ countries }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ error: 'The country directory is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
