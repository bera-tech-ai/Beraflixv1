import { NextResponse } from 'next/server';
import { getMovieCaptionFile, getPlayableTargetFromDetailPath } from '../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readBoundedBody(response, maxBytes) {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new Error('Subtitle file is too large.');
  if (!response.body) {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > maxBytes) throw new Error('Subtitle file is too large.');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Subtitle file is too large.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function toWebVtt(srt) {
  const normalized = srt.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const timestampPattern = /\d{2,}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2,}:\d{2}:\d{2},\d{3}/;
  if (!timestampPattern.test(normalized)) throw new Error('Subtitle file format is invalid.');
  const cues = normalized.replace(/(\d{2,}:\d{2}:\d{2}),(\d{3})(\s+-->\s+)(\d{2,}:\d{2}:\d{2}),(\d{3})/g, '$1.$2$3$4.$5');
  return `WEBVTT\n\n${cues.trim()}\n`;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  try {
    const movie = await getPlayableTargetFromDetailPath(params.get('slug') || '');
    if (!movie || movie.source !== 'moviebox' || !movie.hasResource) {
      return NextResponse.json({ error: 'This subtitle track is unavailable.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const options = { quality: params.get('quality') || 'auto', season: params.get('se') || undefined, episode: params.get('ep') || undefined };
    const file = await getMovieCaptionFile(movie, params.get('id') || '', options);
    const response = await fetch(file.url, {
      headers: { Accept: 'application/x-subrip, text/plain;q=0.9, application/octet-stream;q=0.8' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Subtitle file could not be retrieved.');
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && !['application/x-subrip', 'text/plain', 'application/octet-stream', 'application/srt', 'text/srt'].includes(contentType)) {
      throw new Error('Subtitle file format is unsupported.');
    }
    const bytes = await readBoundedBody(response, file.maxBytes);
    const srt = new TextDecoder('utf-8').decode(bytes);
    const webvtt = toWebVtt(srt);
    return new Response(webvtt, { status: 200, headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Content-Disposition': 'inline; filename="beraflix-subtitles.vtt"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch {
    return NextResponse.json({ error: 'This subtitle track is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
