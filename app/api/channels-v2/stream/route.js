import { NextResponse } from 'next/server';
import { frameXJson } from '../../../../lib/framex-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function displayText(value, maxLength = 180) {
  if (typeof value !== 'string') return '';
  return value.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function validatedProxyUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return '';
  try {
    const proxy = new URL(value);
    const apiBase = new URL(process.env.FRAMEX_API_BASE || 'https://framex.wolvarex.com/api');
    const tokens = proxy.searchParams.getAll('stream_token');
    const sources = proxy.searchParams.getAll('url');
    if (proxy.protocol !== 'https:' || proxy.hostname !== apiBase.hostname || proxy.port || proxy.username || proxy.password || proxy.hash) return '';
    if (proxy.pathname !== '/api/v1/proxy/relay' || proxy.searchParams.size !== 2 || tokens.length !== 1 || sources.length !== 1) return '';
    if (tokens[0].length < 16 || tokens[0].length > 4096 || sources[0].length > 4096) return '';
    if (!sources[0] || /[\u0000-\u001f\u007f]/.test(sources[0])) return '';
    return proxy.toString();
  } catch {
    return '';
  }
}

function validatedEmbedUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    const allowedHosts = new Set(['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com']);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password || url.hash) return '';
    if (!/^\/embed\/[A-Za-z0-9_-]{6,64}$/.test(url.pathname)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function json(payload, status) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request) {
  const search = new URL(request.url).searchParams;
  const country = (search.get('country') || '').toLowerCase();
  const channelId = search.get('channelId') || '';
  if (!/^[a-z]{2}$/.test(country) || !/^[A-Za-z0-9_-]{1,128}$/.test(channelId)) {
    return json({ error: 'A valid country and channel are required.' }, 400);
  }

  try {
    const params = new URLSearchParams({ country, channelId });
    const result = await frameXJson(`/v1/channels-v2/stream?${params.toString()}`);
    const data = result?.data && typeof result.data === 'object' ? result.data : result;
    if (!data || String(data.id || data.channelId || '') !== channelId) return json({ error: 'This channel stream is unavailable.' }, 502);
    if (data.isGeoBlocked === true) return json({ error: 'This channel is restricted in the current region.' }, 403);

    const name = displayText(data.name) || 'Live channel';
    const proxyUrl = validatedProxyUrl(data.proxyUrl);
    if (proxyUrl) {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return json({ kind: 'hls', url: proxyUrl, name, expiresAt }, 200);
    }

    const embedUrl = validatedEmbedUrl(data.embedUrl);
    if (embedUrl) return json({ kind: 'embed', url: embedUrl, name }, 200);
    return json({ error: 'A supported live player is not available for this channel.' }, 404);
  } catch (error) {
    console.error('Channel playback unavailable:', error?.message || 'Unknown error');
    return json({ error: 'Live playback is temporarily unavailable.' }, 502);
  }
}
