import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { unstable_cache } from 'next/cache';

const REVALIDATE_SECONDS = 600;
const DEFAULT_API_BASE = 'https://framex.wolvarex.com/api';
const DEFAULT_SITE_ORIGIN = 'https://beraflix-vdieblyc.manus.space';
const text = (value) => (value == null ? '' : String(value).trim());
const publicCopy = (value) => {
  const result = text(value);
  return /\b(?:framex|showbox|moviebox(?:online)?|wolvarex|aoneroom)\b/i.test(result) ? '' : result;
};

function configuration() {
  const apiKey = process.env.FRAMEX_API_KEY;
  if (!apiKey) throw new Error('FRAMEX_API_KEY is not configured for this server environment.');

  const apiBase = (process.env.FRAMEX_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
  const siteOrigin = new URL(process.env.FRAMEX_SITE_ORIGIN || DEFAULT_SITE_ORIGIN).origin;
  if (new URL(siteOrigin).protocol !== 'https:') throw new Error('FRAMEX_SITE_ORIGIN must use HTTPS.');
  return { apiKey, apiBase, siteOrigin };
}

async function requestFrameXJson(apiBase, siteOrigin, path) {
  const { apiKey } = configuration();
  const response = await fetch(`${apiBase}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
      Origin: siteOrigin,
      Referer: `${siteOrigin}/`
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`FrameX API returned HTTP ${response.status}.`);
  return response.json();
}

const getCachedFrameXJson = unstable_cache(
  async (apiBase, siteOrigin, path) => requestFrameXJson(apiBase, siteOrigin, path),
  ['framex-json-v2'],
  { revalidate: REVALIDATE_SECONDS, tags: ['framex-catalog'] }
);

async function cachedFrameXJson(path) {
  const { apiBase, siteOrigin } = configuration();
  return getCachedFrameXJson(apiBase, siteOrigin, path);
}

function resultsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload?.results, payload?.items, payload?.movies, payload?.subjects, payload?.episodes, payload?.episodeList, payload?.data?.results, payload?.data?.items, payload?.data?.episodes, payload?.data?.episodeList, payload?.data?.animeList, payload?.data?.animes]) {
    if (Array.isArray(candidate)) return candidate;
  }
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function detailPathFor(source, type, lookupId, contentId) {
  if (!['moviebox', 'anime', 'animex'].includes(source)) throw new Error('Unsupported catalog source.');
  const secret = process.env.FRAMEX_API_KEY;
  if (!secret) throw new Error('The protected server credential is not configured.');
  const payload = Buffer.from(JSON.stringify({ v: 1, source, type, lookupId, contentId })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `bf.${payload}.${signature}`;
}

function imageUrl(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return text(value.url || value.src || value.thumbnail);
  return '';
}

function normalizeItem(raw, section = '') {
  if (!raw || typeof raw !== 'object') return null;
  const title = publicCopy(raw.title || raw.name);
  const source = text(raw.source).toLowerCase();
  if (source !== 'moviebox') return null;
  const contentId = text(raw.contentId || raw.subjectId || raw.id || raw.slug);
  const lookupId = text(raw.slug || raw.id || raw.contentId || raw.subjectId);
  const type = text(raw.type || 'movie').toLowerCase();
  if (!title || !contentId || !lookupId) return null;

  const poster = imageUrl(raw.poster || raw.cover || raw.image);
  const backdrop = imageUrl(raw.backdrop || raw.background || raw.still);
  const genres = Array.isArray(raw.genres) ? raw.genres.map(publicCopy).filter(Boolean).join(', ') : publicCopy(raw.genre || raw.genres);
  const year = publicCopy(raw.year || raw.releaseDate || raw.releaseYear);
  const detailPath = detailPathFor(source, type, lookupId, contentId);
  const hasResource = source === 'moviebox' && raw.hasResource !== false && raw.playable !== false;

  return {
    id: text(raw.id || lookupId),
    lookupId,
    title,
    genre: genres,
    cover: poster ? { url: poster } : null,
    backdrop: backdrop ? { url: backdrop } : null,
    imdbRatingValue: publicCopy(raw.rating || raw.imdbRatingValue || raw.imdbRating),
    detailPath,
    description: publicCopy(raw.description || raw.overview || raw.plot),
    releaseDate: year,
    duration: Number(raw.duration) || 0,
    countryName: publicCopy(raw.countryName || raw.country),
    source,
    contentId,
    subjectId: contentId,
    type,
    hasResource,
    section: text(section)
  };
}

function normalizeMovieBoxEndpointItem(raw, section = '', fallbackType = '') {
  if (!raw || typeof raw !== 'object') return null;
  const returnedSource = text(raw.source).toLowerCase();
  if (returnedSource !== 'moviebox') return null;
  return normalizeItem({ ...raw, ...(fallbackType && !raw.type ? { type: fallbackType } : {}) }, section);
}

function normalizeAnimeItem(raw, section = 'Anime') {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.source && text(raw.source).toLowerCase() !== 'anime') return null;
  const title = publicCopy(raw.name || raw.title);
  const contentId = text(raw.contentId || raw.subjectId || raw.id);
  if (!title || !contentId || contentId.length > 200) return null;
  const poster = imageUrl(raw.posterUrl || raw.poster || raw.cover);
  const backdrop = imageUrl(raw.backdropUrl || raw.bannerUrl || raw.backdrop);
  const episodesCount = Number(raw.episodes) || (Array.isArray(raw.episodes) ? raw.episodes.length : 0);
  return {
    id: contentId,
    lookupId: contentId,
    title,
    genre: publicCopy(raw.format || 'Anime'),
    cover: poster ? { url: poster } : null,
    backdrop: backdrop ? { url: backdrop } : null,
    imdbRatingValue: publicCopy(raw.score),
    detailPath: detailPathFor('anime', 'anime', contentId, contentId),
    description: publicCopy(raw.synopsis || raw.description || raw.overview),
    releaseDate: publicCopy(raw.year),
    duration: 0,
    countryName: '',
    source: 'anime',
    contentId,
    subjectId: contentId,
    type: 'anime',
    // Search/detail records may omit an episode count; the actual episode endpoint validates availability.
    hasResource: true,
    episodesCount,
    ageRating: publicCopy(raw.ageRating),
    section: text(section)
  };
}

function normalizeAnimeXItem(raw, query = '', section = 'Anime') {
  if (!raw || typeof raw !== 'object') return null;
  const returnedSource = text(raw.source).toLowerCase();
  if (returnedSource && !['animex', 'animev2', 'anime'].includes(returnedSource)) return null;
  const contentId = text(raw.contentId || raw.id);
  const title = publicCopy(raw.titleEnglish || raw.title || raw.titleRomaji);
  const lookupId = text(query).slice(0, 100);
  if (!contentId || contentId.length > 200 || !title || !lookupId) return null;
  const genres = Array.isArray(raw.genres) ? raw.genres.map(publicCopy).filter(Boolean).join(', ') : '';
  const poster = imageUrl(raw.coverImage || raw.poster || raw.cover);
  const backdrop = imageUrl(raw.bannerImage || raw.backdrop);
  return {
    id: contentId,
    lookupId,
    title,
    genre: genres || publicCopy(raw.format) || 'Anime',
    cover: poster ? { url: poster } : null,
    backdrop: backdrop ? { url: backdrop } : null,
    imdbRatingValue: publicCopy(raw.score),
    detailPath: detailPathFor('animex', 'anime', lookupId, contentId),
    description: publicCopy(raw.synopsis || raw.description || raw.overview),
    releaseDate: publicCopy(raw.seasonYear || raw.year),
    duration: 0,
    countryName: '',
    source: 'animex',
    contentId,
    subjectId: contentId,
    type: 'anime',
    hasResource: true,
    episodesCount: Number(raw.episodeCount) || 0,
    section: text(section)
  };
}

function unwrapDetail(payload) {
  return payload?.movie || payload?.item || payload?.result || payload?.data || payload;
}

const discoveryRoutes = [
  { id: 'trending', path: '/v1/movies/trending', section: 'Trending', type: 'movie' },
  { id: 'popularMovies', path: '/v1/movies/popular', section: 'Popular Movies', type: 'movie' },
  { id: 'popularSeries', path: '/v1/series/popular', section: 'Popular Series', type: 'series' },
  { id: 'latestMovies', path: '/v1/movies/latest', section: 'Latest Movies', type: 'movie' },
  { id: 'latestSeries', path: '/v1/series/latest', section: 'Latest Series', type: 'series' }
];

export async function getCatalog() {
  const settled = await Promise.allSettled(discoveryRoutes.map(async (route) => {
    const payload = await cachedFrameXJson(`${route.path}?page=1`);
    return resultsFrom(payload).map((raw) => normalizeMovieBoxEndpointItem(raw, route.section, route.type)).filter(Boolean);
  }));
  const items = [];
  const sections = [];
  settled.forEach((result, index) => {
    if (result.status !== 'fulfilled' || result.value.length === 0) return;
    sections.push(discoveryRoutes[index].section);
    items.push(...result.value);
  });
  if (!items.length) throw new Error('The catalog service returned no supported titles.');
  return { items, sections, fetchedAt: new Date().toISOString() };
}

export async function getCatalogPage(sectionId, page = 1) {
  const route = discoveryRoutes.find((item) => item.id === text(sectionId));
  const safePage = Math.max(1, Math.min(100, Number.parseInt(page, 10) || 1));
  if (!route) throw new Error('This catalog page is unavailable.');
  const payload = await cachedFrameXJson(`${route.path}?page=${safePage}`);
  return resultsFrom(payload).map((raw) => normalizeMovieBoxEndpointItem(raw, route.section, route.type)).filter(Boolean);
}

function normalizeFacet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = publicCopy(raw.name || raw.title);
  const slug = text(raw.slug).toLowerCase();
  if (!name || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const itemCount = Number(raw.itemCount);
  return { id: text(raw.id || slug), name, slug, itemCount: Number.isFinite(itemCount) && itemCount > 0 ? itemCount : null };
}

async function getFacetList(kind) {
  const payload = await cachedFrameXJson(`/v1/${kind}`);
  return resultsFrom(payload).map(normalizeFacet).filter(Boolean);
}

export async function getCatalogFacets() {
  const [categoriesResult, genresResult] = await Promise.allSettled([getFacetList('categories'), getFacetList('genres')]);
  return {
    categories: categoriesResult.status === 'fulfilled' ? categoriesResult.value : [],
    genres: genresResult.status === 'fulfilled' ? genresResult.value : []
  };
}

export async function getCatalogByFacet(kind, slug, page = 1) {
  const safeKind = text(kind).toLowerCase();
  const safeSlug = text(slug).toLowerCase();
  if (!['categories', 'genres'].includes(safeKind) || !/^[a-z0-9-]{1,80}$/.test(safeSlug)) throw new Error('This catalog filter is unavailable.');
  const safePage = Math.max(1, Math.min(100, Number.parseInt(page, 10) || 1));
  const query = safeKind === 'genres' ? `?page=${safePage}` : '';
  const payload = await cachedFrameXJson(`/v1/${safeKind}/${encodeURIComponent(safeSlug)}${query}`);
  return resultsFrom(payload).map((raw) => normalizeMovieBoxEndpointItem(raw, `Filtered ${safeKind}`)).filter(Boolean);
}

export async function getUpcomingMovies() {
  const payload = await cachedFrameXJson('/v1/movies/upcoming');
  return resultsFrom(payload).map((raw) => normalizeMovieBoxEndpointItem(raw, 'Upcoming', 'movie')).filter(Boolean);
}

export async function searchCatalog(query, page = 1) {
  const normalizedQuery = text(query).slice(0, 100);
  if (!normalizedQuery) return [];
  const safePage = Math.max(1, Math.min(100, Number.parseInt(page, 10) || 1));
  const queryString = new URLSearchParams({ q: normalizedQuery, page: String(safePage) }).toString();
  let searchFailed = false;
  let searchItems = [];
  try {
    const payload = await cachedFrameXJson(`/v1/search?${queryString}`);
    searchItems = resultsFrom(payload).map((raw) => normalizeItem(raw, 'Search results', '')).filter(Boolean);
  } catch {
    searchFailed = true;
  }
  const results = new Map(searchItems.map((item) => [item.detailPath, item]));
  if (!searchFailed) return [...results.values()];
  const catalog = await getCatalog().catch(() => null);
  if (catalog) {
    const needle = normalizedQuery.toLocaleLowerCase();
    for (const item of catalog.items) {
      if (item.title.toLocaleLowerCase().includes(needle)) results.set(item.detailPath, item);
    }
  }
  if (!results.size) throw new Error('Search is temporarily unavailable.');
  return [...results.values()];
}

function parseDetailPath(slug) {
  const value = text(slug);
  const tokenParts = value.split('.');
  if (tokenParts.length === 3 && tokenParts[0] === 'bf') {
    try {
      const secret = process.env.FRAMEX_API_KEY;
      if (!secret) return null;
      const expected = createHmac('sha256', secret).update(tokenParts[1]).digest();
      const actual = Buffer.from(tokenParts[2], 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
      if (payload?.v !== 1 || !payload.lookupId || !payload.contentId) return null;
      const source = payload.source || 'moviebox';
      if (!['moviebox', 'anime', 'animex'].includes(source)) return null;
      return { source, type: payload.type || (source === 'anime' ? 'anime' : 'movie'), lookupId: payload.lookupId, contentId: payload.contentId, verified: true };
    } catch {
      return null;
    }
  }

  // Resolve previously issued source-tagged URLs through the detail route before allowing playback.
  const parts = text(slug).split('~');
  if (parts.length !== 5 || parts[0] !== 'fx') return null;
  try {
    const [source, type, lookupId, contentId] = parts.slice(1).map(decodeURIComponent);
    if (source !== 'moviebox' || !lookupId || !contentId) return null;
    return { source, type: type || 'movie', lookupId, contentId, verified: false };
  } catch {
    return null;
  }
}

export async function getMovieBySlug(slug) {
  const parsed = parseDetailPath(slug);
  if (!parsed) {
    const legacyContentId = text(slug);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(legacyContentId)) return null;
    const payload = unwrapDetail(await cachedFrameXJson(`/v1/movies/${encodeURIComponent(legacyContentId)}`));
    const returnedSource = text(payload?.source).toLowerCase();
    const returnedContentId = text(payload?.contentId || payload?.subjectId);
    if (returnedSource !== 'moviebox' || !returnedContentId || returnedContentId !== legacyContentId) return null;
    const movie = normalizeItem({
      ...payload,
      id: payload?.id || legacyContentId,
      slug: payload?.slug || legacyContentId,
      contentId: returnedContentId,
      source: 'moviebox',
      type: payload?.type || 'movie'
    });
    if (!movie) return null;
    return { ...movie, detailPath: detailPathFor('moviebox', movie.type, legacyContentId, returnedContentId) };
  }

  if (parsed.source === 'animex') {
    const matches = await searchAnimeXCatalog(parsed.lookupId, 100);
    const anime = matches.find((item) => item.contentId === parsed.contentId);
    return anime ? { ...anime, detailPath: detailPathFor('animex', 'anime', parsed.lookupId, anime.contentId) } : null;
  }

  if (parsed.source === 'anime') {
    const params = new URLSearchParams({ contentId: parsed.contentId });
    const payload = await cachedFrameXJson(`/v1/anime/detail?${params.toString()}`);
    const detail = unwrapDetail(payload);
    if (detail?.source && text(detail.source).toLowerCase() !== 'anime') return null;
    const anime = normalizeAnimeItem({ ...detail, contentId: detail?.contentId || parsed.contentId, source: 'anime' });
    if (!anime || anime.contentId !== parsed.contentId) return null;
    return { ...anime, detailPath: detailPathFor('anime', 'anime', parsed.lookupId, anime.contentId) };
  }

  const encodedLookupId = encodeURIComponent(parsed.lookupId);
  const path = `/v1/movies/${encodedLookupId}`;
  const payload = unwrapDetail(await cachedFrameXJson(path));
  const returnedSource = text(payload?.source).toLowerCase();
  if (returnedSource && returnedSource !== 'moviebox') return null;
  if (!parsed.verified && returnedSource !== 'moviebox') return null;
  const returnedContentId = text(payload?.contentId || payload?.subjectId);
  if (returnedContentId && returnedContentId !== parsed.contentId) return null;
  if (!parsed.verified && (!returnedContentId || returnedContentId !== parsed.contentId)) return null;
  const contentId = returnedContentId || (parsed.verified ? parsed.contentId : '');
  if (!contentId) return null;
  const movie = normalizeItem({
    ...payload,
    id: payload?.id || parsed.lookupId,
    slug: payload?.slug || parsed.lookupId,
    contentId,
    source: parsed.source,
    type: parsed.type || payload?.type || 'movie'
  });
  if (!movie) return null;
  return { ...movie, detailPath: detailPathFor(parsed.source, parsed.type || movie.type, parsed.lookupId, contentId) };
}

async function searchLegacyAnimeCatalog(query, limit = 36) {
  const normalizedQuery = text(query).slice(0, 100);
  if (!normalizedQuery) return [];
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 36));
  const params = new URLSearchParams({ q: normalizedQuery, limit: String(safeLimit) });
  const payload = await cachedFrameXJson(`/v1/anime/search?${params.toString()}`);
  return resultsFrom(payload).map((raw) => normalizeAnimeItem(raw, 'Anime search')).filter(Boolean);
}

export async function searchAnimeXCatalog(query, limit = 36) {
  const normalizedQuery = text(query).slice(0, 100);
  if (!normalizedQuery) return [];
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 36));
  const params = new URLSearchParams({ q: normalizedQuery, limit: String(safeLimit) });
  const payload = await cachedFrameXJson(`/v1/animev2/search?${params.toString()}`);
  return resultsFrom(payload).slice(0, safeLimit).map((raw) => normalizeAnimeXItem(raw, normalizedQuery, 'Anime search')).filter(Boolean);
}

export async function searchAnimeCatalog(query, limit = 36) {
  const normalizedQuery = text(query).slice(0, 100);
  if (!normalizedQuery) return [];
  const settled = await Promise.allSettled([searchLegacyAnimeCatalog(normalizedQuery, limit), searchAnimeXCatalog(normalizedQuery, limit)]);
  if (settled.every((result) => result.status === 'rejected')) throw new Error('Anime search is temporarily unavailable.');
  const titles = new Set();
  const unique = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      const titleKey = item.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (!titleKey || titles.has(titleKey)) continue;
      titles.add(titleKey);
      unique.push(item);
    }
  }
  return unique;
}

function verifiedAnimeTarget(slug) {
  const parsed = parseDetailPath(slug);
  if (!parsed?.verified || !['anime', 'animex'].includes(parsed.source)) return null;
  return { detailPath: text(slug), source: parsed.source, contentId: parsed.contentId, type: 'anime', hasResource: true };
}

function episodeTracks(raw) {
  const truthy = (value) => value === true || value === 1 || String(value).toLowerCase() === 'true';
  return [
    ...(truthy(raw.hasHardSub) ? ['hard_sub'] : []),
    ...(truthy(raw.hasSoftSub) ? ['soft_sub'] : []),
    ...(truthy(raw.hasDub) ? ['dub'] : [])
  ];
}

async function getAnimeEpisodesForContent(contentId) {
  const id = text(contentId);
  if (!id || id.length > 200) return [];
  const params = new URLSearchParams({ contentId: id });
  const payload = await cachedFrameXJson(`/v1/anime/episodes?${params.toString()}`);
  return resultsFrom(payload).map((raw, index) => {
    const episodeId = text(raw?.episodeId || raw?.id);
    if (!episodeId || episodeId.length > 200) return null;
    const number = Number(raw.number || raw.episodeNumber) || index + 1;
    return {
      episodeId,
      number,
      title: publicCopy(raw.title || raw.name || raw.label),
      label: publicCopy(raw.label),
      thumbnailUrl: imageUrl(raw.thumbnailUrl || raw.thumbnail),
      tracks: episodeTracks(raw)
    };
  }).filter(Boolean);
}

export async function getAnimeEpisodesBySlug(slug) {
  const target = verifiedAnimeTarget(slug);
  if (!target) return null;
  return target.source === 'animex' ? getAnimeXEpisodesForContent(target.contentId) : getAnimeEpisodesForContent(target.contentId);
}

async function getAnimeXEpisodesForContent(contentId) {
  const id = text(contentId);
  if (!id || id.length > 200) return [];
  const params = new URLSearchParams({ contentId: id });
  const payload = await cachedFrameXJson(`/v1/animev2/episodes?${params.toString()}`);
  const truthy = (value) => value === true || value === 1 || String(value).toLowerCase() === 'true';
  return resultsFrom(payload).map((raw, index) => {
    const number = Number(raw?.number);
    if (!Number.isInteger(number) || number < 1 || number > 10000) return null;
    const tracks = [...(truthy(raw.hasSub) ? ['sub'] : []), ...(truthy(raw.hasDub) ? ['dub'] : [])];
    return {
      episodeId: String(number),
      number,
      title: publicCopy(raw.title || raw.name),
      label: publicCopy(raw.title) || `Episode ${number || index + 1}`,
      thumbnailUrl: imageUrl(raw.image || raw.thumbnail),
      tracks
    };
  }).filter(Boolean);
}

export async function getAnimeXProvidersBySlug({ slug, episodeId, track } = {}) {
  const target = verifiedAnimeTarget(slug);
  if (!target || target.source !== 'animex') return null;
  const safeEpisodeId = text(episodeId);
  const selectedTrack = text(track).toLowerCase();
  if (!safeEpisodeId || safeEpisodeId.length > 200 || !['sub', 'dub'].includes(selectedTrack)) throw new Error('Select a valid AnimeX episode and track.');
  const episodes = await getAnimeXEpisodesForContent(target.contentId);
  const episode = episodes.find((item) => item.episodeId === safeEpisodeId);
  if (!episode || !episode.tracks.includes(selectedTrack)) throw new Error('That episode or track is not available for this title.');
  const params = new URLSearchParams({ contentId: target.contentId, episode: String(episode.number) });
  const payload = await cachedFrameXJson(`/v1/animev2/providers?${params.toString()}`);
  const data = payload?.data || payload;
  const rows = Array.isArray(data?.[selectedTrack]) ? data[selectedTrack] : [];
  return rows.slice(0, 50).map((raw) => {
    const id = text(raw?.id);
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id)) return null;
    return {
      id,
      label: publicCopy(raw?.tip || raw?.name || raw?.title) || `Provider ${id}`,
      isDefault: raw?.default === true || raw?.default === 1 || String(raw?.default).toLowerCase() === 'true'
    };
  }).filter(Boolean);
}

function safeHttpsUrl(value, hosts) {
  try {
    const parsed = new URL(text(value));
    if (parsed.protocol !== 'https:') return '';
    const hostname = parsed.hostname.toLowerCase();
    if (!hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isTrustedFrameXMediaUrl(value) {
  return Boolean(safeHttpsUrl(value, ['wolvarex.com']));
}

export async function getAnimePlayerLink({ slug, episodeId, track, providerId = '' }) {
  const target = verifiedAnimeTarget(slug);
  if (!target) throw new Error('This Anime title is unavailable.');
  const safeEpisodeId = text(episodeId);
  if (!safeEpisodeId || safeEpisodeId.length > 200) throw new Error('Select a valid episode.');
  const selectedTrack = text(track);
  if (target.source === 'animex') {
    if (!['sub', 'dub'].includes(selectedTrack)) throw new Error('Select an available Anime audio track.');
    const episodes = await getAnimeXEpisodesForContent(target.contentId);
    const episode = episodes.find((item) => item.episodeId === safeEpisodeId);
    if (!episode || !episode.tracks.includes(selectedTrack)) throw new Error('That episode or track is not available for this title.');
    const params = new URLSearchParams({ contentId: target.contentId, episode: String(episode.number), type: selectedTrack });
    const selectedProviderId = text(providerId);
    if (selectedProviderId) {
      const providers = await getAnimeXProvidersBySlug({ slug, episodeId: safeEpisodeId, track: selectedTrack });
      if (!providers?.some((item) => item.id === selectedProviderId)) throw new Error('That provider is not available for this episode and track.');
      params.set('providerId', selectedProviderId);
    }
    const { apiBase, siteOrigin } = configuration();
    const payload = await requestFrameXJson(apiBase, siteOrigin, `/v1/animev2/stream?${params.toString()}`);
    const data = payload?.data || payload;
    const proxyUrl = safeHttpsUrl(data?.proxyUrl, ['wolvarex.com']);
    const embedUrl = safeHttpsUrl(data?.embedUrl, ['plyr.animex.one']);
    if (!proxyUrl || !embedUrl || text(data?.contentId) !== target.contentId || Number(data?.episode) !== episode.number || text(data?.type).toLowerCase() !== selectedTrack) throw new Error('The Anime player link is unavailable.');
    const expiresAtMs = Date.parse(text(data?.expiresAt));
    const expiresIn = Number(data?.expiresIn);
    const remainingSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 600 || remainingSeconds <= 0 || remainingSeconds > 600 || Math.abs(remainingSeconds - expiresIn) > 30) throw new Error('The Anime player link is unavailable.');
    return { url: embedUrl, expiresAt: new Date(expiresAtMs).toISOString(), expiresIn: remainingSeconds };
  }
  if (!['hard_sub', 'soft_sub', 'dub'].includes(selectedTrack)) throw new Error('Select an available audio or subtitle track.');
  const episodes = await getAnimeEpisodesForContent(target.contentId);
  const episode = episodes.find((item) => item.episodeId === safeEpisodeId);
  if (!episode || !episode.tracks.includes(selectedTrack)) throw new Error('That episode or track is not available for this title.');
  const params = new URLSearchParams({ episodeId: safeEpisodeId, type: selectedTrack });
  const { apiBase, siteOrigin } = configuration();
  const payload = await requestFrameXJson(apiBase, siteOrigin, `/v1/anime/stream?${params.toString()}`);
  const data = payload?.data || payload;
  const url = safeHttpsUrl(data?.embedUrl, ['gotakudl.top']);
  if (!url) throw new Error('The Anime player link is unavailable.');
  const expiresAtMs = Date.parse(text(data?.expiresAt));
  const expiresIn = Number(data?.expiresIn);
  const remainingSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 600 || remainingSeconds <= 0 || remainingSeconds > 600 || Math.abs(remainingSeconds - expiresIn) > 30) {
    throw new Error('The Anime player link is unavailable.');
  }
  return { url, expiresAt: new Date(expiresAtMs).toISOString(), expiresIn: remainingSeconds };
}

const getCachedSportsJson = unstable_cache(
  async (apiBase, siteOrigin, path) => requestFrameXJson(apiBase, siteOrigin, path),
  ['sports-feed-v1'],
  { revalidate: 30, tags: ['sports-feed'] }
);

function sportsRows(payload, key) {
  const data = payload?.data || payload || {};
  return Array.isArray(data[key]) ? data[key] : [];
}

function sportsProxyUrl(value, apiBase) {
  const host = new URL(apiBase).hostname.toLowerCase();
  return safeHttpsUrl(value, [host]);
}

function normalizeTeam(team) {
  return {
    name: publicCopy(team?.name || team?.nameI18n || team?.abbreviation) || 'TBD',
    score: team?.score == null ? '' : publicCopy(team.score),
    avatar: imageUrl(team?.avatar)
  };
}

function normalizeSportsMatch(match, apiBase) {
  if (!match || typeof match !== 'object') return null;
  const media = Array.isArray(match.media)
    ? match.media
    : match.media && typeof match.media === 'object'
      ? Object.values(match.media)
      : match.media ? [match.media] : [];
  const mediaUrl = media.map((item) => sportsProxyUrl(typeof item === 'string' ? item : item?.proxyUrl || item?.url, apiBase)).find(Boolean) || '';
  const league = typeof match.league === 'string' ? match.league : match.league?.name || match.league?.title;
  const leagueId = text(match.leagueId || match.league?.id || match.league?.leagueId);
  const replayOffers = Array.isArray(match.replayOffers) ? match.replayOffers.map((offer) => ({
    type: publicCopy(offer?.type),
    url: sportsProxyUrl(offer?.proxyUrl, apiBase)
  })).filter((offer) => offer.url) : [];
  const matchId = text(match.matchId || match.id);
  return {
    id: matchId,
    matchId,
    leagueId,
    team1: normalizeTeam(match.team1),
    team2: normalizeTeam(match.team2),
    status: publicCopy(match.timeDesc || match.status || match.type),
    score: publicCopy(match.score),
    league: publicCopy(league),
    mediaUrl,
    replayOffers
  };
}

function normalizeSportsClip(clip) {
  return {
    id: text(clip?.id || clip?.videoId),
    title: publicCopy(clip?.title || clip?.titleI18n || 'Sports highlight'),
    cover: safeHttpsUrl(clip?.cover, ['aoneroom.com']),
    duration: publicCopy(clip?.duration),
    url: safeHttpsUrl(clip?.path, ['aoneroom.com'])
  };
}

export async function getSportsOverview(sportType = 'football') {
  const type = text(sportType).toLowerCase();
  if (type !== 'football') throw new Error('This sports category is unavailable.');
  const { apiBase, siteOrigin } = configuration();
  const request = (path) => getCachedSportsJson(apiBase, siteOrigin, path);
  const results = await Promise.allSettled([
    request(`/v1/sports/aggregate?sportType=${encodeURIComponent(type)}`),
    request(`/v1/sports/ongoing?sportType=${encodeURIComponent(type)}`),
    request(`/v1/sports/replays?sportType=${encodeURIComponent(type)}`)
  ]);
  if (results.every((result) => result.status === 'rejected')) throw new Error('The sports feed is temporarily unavailable.');
  const aggregate = results[0].status === 'fulfilled' ? results[0].value?.data || {} : {};
  const ongoing = results[1].status === 'fulfilled' ? results[1].value : {};
  const replays = results[2].status === 'fulfilled' ? results[2].value : {};
  const matchList = (rows) => rows.map((match) => normalizeSportsMatch(match, apiBase)).filter(Boolean);
  return {
    sportType: type,
    highlights: Array.isArray(aggregate.highlightList) ? aggregate.highlightList.map(normalizeSportsClip).filter((item) => item.url) : [],
    latestMatches: matchList(Array.isArray(aggregate.latestMatchList) ? aggregate.latestMatchList : []),
    ongoingMatches: matchList(sportsRows(ongoing, 'matches')),
    replayMatches: matchList(sportsRows(replays, 'matches'))
  };
}

export async function getSportsRecommendations(sportType = 'football') {
  const type = text(sportType).toLowerCase();
  if (type !== 'football') throw new Error('This sports category is unavailable.');
  const { apiBase, siteOrigin } = configuration();
  const payload = await getCachedSportsJson(apiBase, siteOrigin, `/v1/sports/recommendations?sportType=${encodeURIComponent(type)}`);
  const data = payload?.data || payload || {};
  const highlights = Array.isArray(data.highlightList) ? data.highlightList.map(normalizeSportsClip).filter((item) => item.id && item.url) : [];
  const news = Array.isArray(data.newsList) ? data.newsList.map((item) => ({
    id: text(item?.id),
    title: publicCopy(item?.title),
    summary: publicCopy(item?.summary),
    category: publicCopy(item?.category)
  })).filter((item) => item.id && item.title) : [];
  return { highlights, news };
}

function normalizeSportsFixture(match) {
  if (!match || typeof match !== 'object') return null;
  const matchId = text(match.matchId || match.id);
  if (!/^\d{1,32}$/.test(matchId) || /^0+$/.test(matchId)) return null;
  const team = (value) => {
    const normalized = normalizeTeam(value);
    return { name: normalized.name, score: normalized.score };
  };
  const league = typeof match.league === 'string' ? match.league : match.league?.name || match.league?.title;
  return {
    id: matchId,
    matchId,
    leagueId: text(match.leagueId || match.league?.id || match.league?.leagueId),
    team1: team(match.team1),
    team2: team(match.team2),
    league: publicCopy(league),
    status: publicCopy(match.timeDesc || match.status || match.type) || 'Scheduled',
    time: publicCopy(match.startTime || match.matchTime || match.startAt || match.time)
  };
}

export async function getSportsMatches() {
  const { apiBase, siteOrigin } = configuration();
  const windowStart = Math.floor(Date.now() / 86_400_000) * 86_400;
  const windowEnd = windowStart + 7 * 86_400;
  const params = new URLSearchParams({ startTime: String(windowStart), endTime: String(windowEnd) });
  const payload = await getCachedSportsJson(apiBase, siteOrigin, `/v1/sports/matches?${params.toString()}`);
  const matches = sportsRows(payload, 'list').slice(0, 100).map(normalizeSportsFixture).filter(Boolean);
  return { matches, windowStart, windowEnd };
}

const getCachedChannelJson = unstable_cache(
  async (apiBase, siteOrigin, path) => requestFrameXJson(apiBase, siteOrigin, path),
  ['framex-channels-v1'],
  { revalidate: 30, tags: ['framex-channels'] }
);

const CAPTION_MAX_BYTES = 512 * 1024;

function channelRows(payload, keys) {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    for (const candidate of [data?.[key], payload?.[key]]) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

function normalizeChannel(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.channelId || raw.channel_id || raw.id);
  if (!/^\d{1,5}$/.test(id) || id === '9') return null;
  const name = publicCopy(raw.name || raw.channelName || raw.title);
  if (!name) return null;
  const liveValue = raw.isLive ?? raw.live;
  const isLive = liveValue == null ? null : typeof liveValue === 'boolean' ? liveValue : /^(?:true|1|live|yes|on)$/i.test(text(liveValue));
  const status = publicCopy(raw.status || raw.liveStatus);
  const logoUrl = safeHttpsUrl(imageUrl(raw.logo || raw.logoUrl || raw.logo_url), ['cms-assets.citizen.digital']);
  const logo = logoUrl && new URL(logoUrl).hostname.toLowerCase() === 'cms-assets.citizen.digital' ? logoUrl : '';
  return { id, name, status, isLive, logo, slogan: publicCopy(raw.slogan) };
}

export async function getChannelDirectory() {
  const { apiBase, siteOrigin } = configuration();
  const payload = await getCachedChannelJson(apiBase, siteOrigin, '/v1/channels');
  const channels = channelRows(payload, ['channels', 'items', 'results'])
    .map(normalizeChannel)
    .filter(Boolean);
  const unique = new Map(channels.map((channel) => [channel.id, channel]));
  return [
    { id: '9', name: 'Channel 9', status: '', isLive: null, logo: '', slogan: '' },
    ...[...unique.values()].filter((channel) => channel.id !== '9')
  ];
}

function normalizeScheduleItem(raw, index, channelId) {
  if (!raw || typeof raw !== 'object') return null;
  const scheduleText = typeof raw.schedule === 'string' ? publicCopy(raw.schedule) : '';
  const title = publicCopy(raw.name || raw.title || raw.program || scheduleText);
  if (!title) return null;
  const presenters = Array.isArray(raw.presenters)
    ? raw.presenters.map((item) => publicCopy(typeof item === 'string' ? item : item?.name || item?.title)).filter(Boolean).slice(0, 8)
    : publicCopy(raw.presenters) ? [publicCopy(raw.presenters)] : [];
  return {
    id: text(raw.id) || `${channelId}-${index + 1}`,
    title,
    description: publicCopy(raw.description),
    slogan: publicCopy(raw.slogan),
    status: publicCopy(raw.status),
    startTime: publicCopy(raw.start_time || raw.startTime),
    endTime: publicCopy(raw.end_time || raw.endTime),
    schedule: scheduleText,
    presenters
  };
}

export async function getChannelSchedule(rawChannelId) {
  const channelId = text(rawChannelId);
  if (!/^\d{1,5}$/.test(channelId)) throw new Error('This channel schedule is unavailable.');
  if (channelId !== '9') {
    const directory = await getChannelDirectory();
    if (!directory.some((channel) => channel.id === channelId && channel.id !== '9')) throw new Error('This channel schedule is unavailable.');
  }
  const { apiBase, siteOrigin } = configuration();
  const payload = await getCachedChannelJson(apiBase, siteOrigin, `/v1/channels/${encodeURIComponent(channelId)}/schedule`);
  const programs = channelRows(payload, ['schedule', 'programs', 'items', 'results'])
    .map((item, index) => normalizeScheduleItem(item, index, channelId))
    .filter(Boolean);
  return { channelId, programs };
}

function normalizeCaptionTrack(raw, expectedContentId) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id || raw.streamId);
  const url = safeHttpsUrl(raw.url, ['cacdn.hakunaymatata.com']);
  const delay = Number(raw.delay ?? 0);
  const size = Number(raw.size);
  const trackContentId = text(raw.subjectId || raw.contentId);
  const parsedUrl = url ? new URL(url) : null;
  if (!id || id.length > 200 || !parsedUrl || parsedUrl.hostname.toLowerCase() !== 'cacdn.hakunaymatata.com' || parsedUrl.username || parsedUrl.password || !/\.srt$/i.test(parsedUrl.pathname) || delay !== 0) return null;
  if (Number.isFinite(size) && size > CAPTION_MAX_BYTES) return null;
  if (trackContentId && trackContentId !== expectedContentId) return null;
  const rawLanguage = text(raw.lan || raw.language || raw.lang).slice(0, 48);
  const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(rawLanguage) ? rawLanguage : 'und';
  return {
    id,
    language,
    label: publicCopy(raw.lanName || raw.languageName || raw.label || raw.lan || 'Subtitles'),
    url
  };
}

async function getMovieCaptionMetadata(movie, { quality = 'auto', season, episode } = {}) {
  if (!movie?.contentId || movie.source !== 'moviebox') throw new Error('Subtitles are unavailable for this title.');
  const params = new URLSearchParams({ subjectId: text(movie.contentId) });
  const resolution = text(quality).replace(/p$/i, '');
  if (resolution && resolution !== 'auto' && ['360', '480', '720', '1080'].includes(resolution)) params.set('resolution', resolution);
  const seasonNumber = positiveNumber(season, 'Season');
  const episodeNumber = positiveNumber(episode, 'Episode');
  if ((seasonNumber && !episodeNumber) || (!seasonNumber && episodeNumber)) throw new Error('Season and episode must be provided together.');
  if (seasonNumber && episodeNumber) {
    params.set('se', String(seasonNumber));
    params.set('ep', String(episodeNumber));
  }
  const { apiBase, siteOrigin } = configuration();
  const payload = await requestFrameXJson(apiBase, siteOrigin, `/v1/captions?${params.toString()}`);
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const returnedSubjectId = text(data?.subjectId || data?.contentId);
  if (returnedSubjectId && returnedSubjectId !== text(movie.contentId)) throw new Error('Subtitle metadata did not match this title.');
  const tracks = Array.isArray(data?.subtitles) ? data.subtitles : Array.isArray(payload?.subtitles) ? payload.subtitles : [];
  return tracks.map((track) => normalizeCaptionTrack(track, text(movie.contentId))).filter(Boolean);
}

export async function getMovieCaptionTracks(movie, options) {
  return (await getMovieCaptionMetadata(movie, options)).map(({ id, language, label }) => ({ id, language, label }));
}

export async function getMovieCaptionFile(movie, trackId, options) {
  const wantedId = text(trackId);
  if (!wantedId || wantedId.length > 200) throw new Error('Select an available subtitle track.');
  const track = (await getMovieCaptionMetadata(movie, options)).find((item) => item.id === wantedId);
  if (!track) throw new Error('This subtitle track is no longer available.');
  return { url: track.url, maxBytes: CAPTION_MAX_BYTES };
}

export async function getPlayableTargetFromDetailPath(slug) {
  let parsed = parseDetailPath(slug);
  if (!parsed || parsed.source !== 'moviebox') return null;
  if (!parsed.verified) {
    const resolved = await getMovieBySlug(slug);
    if (!resolved || resolved.source !== 'moviebox') return null;
    parsed = parseDetailPath(resolved.detailPath);
    if (!parsed?.verified) return null;
  }
  return {
    detailPath: text(slug),
    source: 'moviebox',
    type: parsed.type || 'movie',
    contentId: parsed.contentId,
    subjectId: parsed.contentId,
    hasResource: true
  };
}

function positiveNumber(value, label) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function parseExpiryTimestamp(value) {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function validatedMediaExpiry(payload) {
  const expiresAtMs = parseExpiryTimestamp(payload?.expiresAt);
  const expiresIn = Number(payload?.expiresIn);
  const remaining = expiresAtMs == null ? NaN : (expiresAtMs - Date.now()) / 1000;
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 600 || remaining <= 0 || remaining > 600 || Math.abs(remaining - expiresIn) > 30) {
    throw new Error('The signed media URL expiry is invalid.');
  }
  return { expiresAt: new Date(expiresAtMs).toISOString(), expiresIn: Math.max(1, Math.floor(Math.min(expiresIn, remaining))) };
}

export async function getSignedMediaUrl(movie, { quality = 'auto', download = false, season, episode } = {}) {
  if (!movie?.contentId || movie.source !== 'moviebox') {
    throw new Error('A supported stream is not available for this title.');
  }
  const params = new URLSearchParams({ subjectId: movie.contentId });
  const resolution = text(quality).replace(/p$/i, '');
  if (resolution && resolution !== 'auto' && ['360', '480', '720', '1080'].includes(resolution)) params.set('resolution', resolution);
  const seasonNumber = positiveNumber(season, 'Season');
  const episodeNumber = positiveNumber(episode, 'Episode');
  if ((seasonNumber && !episodeNumber) || (!seasonNumber && episodeNumber)) throw new Error('Season and episode must be provided together.');
  if (seasonNumber && episodeNumber) {
    params.set('se', String(seasonNumber));
    params.set('ep', String(episodeNumber));
  }
  if (download) params.set('download', '1');

  const { apiBase, siteOrigin } = configuration();
  const payload = unwrapDetail(await requestFrameXJson(apiBase, siteOrigin, `/v1/stream-url?${params.toString()}`));
  const signedUrl = text(payload?.url);
  if (!signedUrl) throw new Error('The service did not return a signed media URL.');
  const parsedUrl = new URL(signedUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('The service returned a non-HTTPS media URL.');
  if (parsedUrl.hostname.toLowerCase() !== 'wolvarex.com' && !parsedUrl.hostname.toLowerCase().endsWith('.wolvarex.com')) throw new Error('The signed media URL is outside the trusted domain.');
  const expiry = validatedMediaExpiry(payload);
  return {
    url: parsedUrl.toString(),
    ...expiry
  };
}
