import 'server-only';
import { getPlayableTargetFromDetailPath, getSignedMediaUrl, isTrustedFrameXMediaUrl } from './catalog';

const ALLOWED_QUALITIES = new Set(['auto', '360p', '480p', '720p', '1080p']);
const MAX_MEDIA_BYTES = 12 * 1024 * 1024 * 1024;
const PLAYABLE_TYPES = new Set(['video/mp4', 'video/webm']);

export class OfflineTransferError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'OfflineTransferError';
    this.status = status;
  }
}

function isSeries(type) {
  return /series|tv|show/i.test(String(type || ''));
}

function parseEpisode(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new OfflineTransferError(`Enter a valid ${label} number.`, 400);
  return number;
}

function normalizeSpec(searchParams) {
  const slug = String(searchParams.get('slug') || '').trim();
  const quality = String(searchParams.get('quality') || 'auto').trim();
  const season = parseEpisode(searchParams.get('se'), 'season');
  const episode = parseEpisode(searchParams.get('ep'), 'episode');
  if (!slug || slug.length > 2048) throw new OfflineTransferError('A valid title selection is required.', 400);
  if (!ALLOWED_QUALITIES.has(quality)) throw new OfflineTransferError('That quality is not supported.', 400);
  if (Boolean(season) !== Boolean(episode)) throw new OfflineTransferError('Select both a season and episode.', 400);
  return { slug, quality, season, episode };
}

async function resolveAuthorizedTarget(searchParams) {
  const spec = normalizeSpec(searchParams);
  const movie = await getPlayableTargetFromDetailPath(spec.slug);
  if (!movie) throw new OfflineTransferError('This title is unavailable.', 404);
  if (movie.source !== 'moviebox' || !movie.contentId || !movie.hasResource) throw new OfflineTransferError('Offline saving is not available for this title.', 404);
  if (isSeries(movie.type) && (!spec.season || !spec.episode)) throw new OfflineTransferError('Choose a season and episode first.', 400);
  if (!isSeries(movie.type) && (spec.season || spec.episode)) throw new OfflineTransferError('Episodes are not available for this title.', 400);
  // The attachment variant can omit Range support; the device-local vault needs the tested stream variant.
  const signed = await getSignedMediaUrl(movie, {
    quality: spec.quality,
    download: false,
    season: spec.season,
    episode: spec.episode
  });
  if (!isTrustedFrameXMediaUrl(signed?.url)) throw new OfflineTransferError('The protected media source is unavailable.', 502);
  return { spec, signed };
}

function mediaReferer() {
  const origin = new URL(process.env.FRAMEX_SITE_ORIGIN || 'https://beraflix-vdieblyc.manus.space').origin;
  if (new URL(origin).protocol !== 'https:') throw new OfflineTransferError('The media request is unavailable.', 502);
  return `${origin}/`;
}

async function fetchTrustedRange(startUrl, range, expectedEtag, signal) {
  let current = startUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isTrustedFrameXMediaUrl(current)) throw new OfflineTransferError('The protected media source is unavailable.', 502);
    let response;
    try {
      response = await fetch(current, {
        method: 'GET',
        headers: {
          Accept: 'video/mp4, video/webm',
          Range: range,
          Referer: mediaReferer(),
          ...(expectedEtag ? { 'If-Range': expectedEtag } : {})
        },
        cache: 'no-store',
        redirect: 'manual',
        signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new OfflineTransferError('The protected media transfer could not be reached.', 502);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location || redirectCount === 3) throw new OfflineTransferError('The protected media source redirected unexpectedly.', 502);
      let next;
      try { next = new URL(location, current).toString(); } catch { throw new OfflineTransferError('The protected media source redirected unexpectedly.', 502); }
      if (!isTrustedFrameXMediaUrl(next)) throw new OfflineTransferError('The protected media source redirected outside the trusted media domain.', 502);
      current = next;
      continue;
    }
    return response;
  }
  throw new OfflineTransferError('The protected media source redirected unexpectedly.', 502);
}

function parseContentRange(value) {
  const match = String(value || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(total) || start < 0 || end < start || total <= end || total > MAX_MEDIA_BYTES) return null;
  return { start, end, total };
}

function strongEtag(response) {
  const value = String(response.headers.get('etag') || '').trim();
  return value && !/^W\//i.test(value) && value.length <= 200 ? value : '';
}

function validatePartialResponse(response, requestedStart, expectedTotal, expectedEtag) {
  if (response.status !== 206) throw new OfflineTransferError(response.status === 416 ? 'The saved file range is no longer available.' : 'The media source does not support the required byte range.', 502);
  const range = parseContentRange(response.headers.get('content-range'));
  if (!range || range.start !== requestedStart || (expectedTotal && range.total !== expectedTotal)) throw new OfflineTransferError('The media byte range did not match the saved file.', 409);
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!PLAYABLE_TYPES.has(contentType)) throw new OfflineTransferError('This media format cannot be saved for offline playback.', 415);
  const etag = strongEtag(response);
  if (expectedEtag && (!etag || etag !== expectedEtag)) throw new OfflineTransferError('The media file changed since the saved transfer; restart it safely.', 409);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > 0 && length !== range.end - range.start + 1) throw new OfflineTransferError('The media byte length did not match its range.', 502);
  return { range, contentType, etag };
}

export async function prepareOfflineTransfer(searchParams, signal) {
  const { spec, signed } = await resolveAuthorizedTarget(searchParams);
  const response = await fetchTrustedRange(signed.url, 'bytes=0-0', '', signal);
  try {
    const validated = validatePartialResponse(response, 0, null, '');
    if (validated.range.end !== 0 || validated.range.total < 1) throw new OfflineTransferError('The media size could not be verified.', 502);
    return {
      totalBytes: validated.range.total,
      contentType: validated.contentType,
      strongEtag: validated.etag,
      rangeSupported: true,
      quality: spec.quality,
      season: spec.season,
      episode: spec.episode
    };
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

export async function openOfflineTransfer(searchParams, rangeHeader, signal) {
  const { spec, signed } = await resolveAuthorizedTarget(searchParams);
  const match = String(rangeHeader || '').match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) throw new OfflineTransferError('A single byte range is required.', 400);
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || start < 0 || start > MAX_MEDIA_BYTES || (end != null && (!Number.isSafeInteger(end) || end < start || end > MAX_MEDIA_BYTES))) {
    throw new OfflineTransferError('The requested byte range is invalid.', 400);
  }
  const expectedTotalRaw = searchParams.get('total');
  const expectedTotal = expectedTotalRaw ? Number(expectedTotalRaw) : null;
  if (expectedTotal != null && (!Number.isSafeInteger(expectedTotal) || expectedTotal <= 0 || expectedTotal > MAX_MEDIA_BYTES)) throw new OfflineTransferError('The saved file size is invalid.', 400);
  const expectedEtag = String(searchParams.get('etag') || '').trim();
  if (expectedEtag.length > 200 || /^W\//i.test(expectedEtag)) throw new OfflineTransferError('The saved file validator is invalid.', 400);
  const response = await fetchTrustedRange(signed.url, rangeHeader, expectedEtag, signal);
  let validated;
  try {
    validated = validatePartialResponse(response, start, expectedTotal, expectedEtag);
  } catch (error) {
    await response.body?.cancel().catch(() => {});
    throw error;
  }
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Type': validated.contentType,
    'Content-Range': `bytes ${validated.range.start}-${validated.range.end}/${validated.range.total}`,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Range'
  });
  const contentLength = response.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);
  if (validated.etag) headers.set('ETag', validated.etag);
  return { response, headers, contentRange: validated.range, etag: validated.etag, spec };
}
