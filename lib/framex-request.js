import 'server-only';
import { unstable_cache } from 'next/cache';

const DEFAULT_API_BASE = 'https://framex.wolvarex.com/api';
const DEFAULT_SITE_ORIGIN = 'https://beraflix-vdieblyc.manus.space';
const MAX_JSON_BYTES = 8 * 1024 * 1024;

function configuration() {
  const apiKey = process.env.FRAMEX_API_KEY;
  if (!apiKey) throw new Error('Protected FrameX server configuration is unavailable.');
  const apiBase = (process.env.FRAMEX_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
  const siteOrigin = new URL(process.env.FRAMEX_SITE_ORIGIN || DEFAULT_SITE_ORIGIN).origin;
  const base = new URL(apiBase);
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('The upstream API base is not valid.');
  if (new URL(siteOrigin).protocol !== 'https:') throw new Error('The configured site origin must use HTTPS.');
  return { apiKey, apiBase, apiBasePath: base.pathname.replace(/\/+$/, ''), apiOrigin: base.origin, siteOrigin };
}

function validateRelativeV1Path(path, apiOrigin, apiBasePath) {
  if (typeof path !== 'string' || path.length > 2048 || !path.startsWith('/v1/') || path.includes('\\')) {
    throw new Error('The requested upstream operation is not supported.');
  }
  const target = new URL(`${apiOrigin}${apiBasePath}${path}`);
  const requiredPrefix = `${apiBasePath}/v1/`.replace(/\/+/g, '/');
  if (target.origin !== apiOrigin || !target.pathname.startsWith(requiredPrefix) || target.username || target.password || target.hash) {
    throw new Error('The requested upstream operation is not supported.');
  }
  return `${target.pathname.slice(apiBasePath.length)}${target.search}`;
}

async function boundedText(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new Error('The upstream response is too large.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error('The upstream response is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function requestJson(apiBase, siteOrigin, path) {
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
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`Upstream request returned HTTP ${response.status}.`);
  }
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('json')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('The upstream response was not JSON.');
  }
  const raw = await boundedText(response);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('The upstream response could not be read.');
  }
}

const cached600 = unstable_cache(
  async (apiBase, siteOrigin, path) => requestJson(apiBase, siteOrigin, path),
  ['framex-extra-catalog-v1'],
  { revalidate: 600, tags: ['framex-catalog'] }
);
const cached300 = unstable_cache(
  async (apiBase, siteOrigin, path) => requestJson(apiBase, siteOrigin, path),
  ['framex-extra-directory-v1'],
  { revalidate: 300, tags: ['framex-directory'] }
);
const cached180 = unstable_cache(
  async (apiBase, siteOrigin, path) => requestJson(apiBase, siteOrigin, path),
  ['framex-extra-wrestling-v1'],
  { revalidate: 180, tags: ['framex-wrestling'] }
);
const cached30 = unstable_cache(
  async (apiBase, siteOrigin, path) => requestJson(apiBase, siteOrigin, path),
  ['framex-extra-sports-v1'],
  { revalidate: 30, tags: ['framex-sports'] }
);

/** Server-only, fixed-origin GET for documented FrameX v1 routes. */
export async function frameXJson(path, { cache = 'none' } = {}) {
  const config = configuration();
  const safePath = validateRelativeV1Path(path, config.apiOrigin, config.apiBasePath);
  const args = [config.apiBase, config.siteOrigin, safePath];
  if (cache === 'catalog') return cached600(...args);
  if (cache === 'directory') return cached300(...args);
  if (cache === 'wrestling') return cached180(...args);
  if (cache === 'sports') return cached30(...args);
  if (cache !== 'none') throw new Error('The requested cache policy is not supported.');
  return requestJson(...args);
}
