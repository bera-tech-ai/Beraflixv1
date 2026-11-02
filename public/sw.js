/* BERAFLIX's small same-origin shell cache. Never cache APIs, media, or signed links. */
const SHELL_CACHE = 'beraflix-shell-v1';
const STATIC_CACHE = 'beraflix-static-v1';
const SHELL_PATHS = new Set(['/', '/downloads', '/downloads/', '/shelf', '/shelf/', '/profile', '/profile/', '/explore', '/explore/']);
const STATIC_EXTENSIONS = /\.(?:css|js|mjs|svg|png|jpe?g|webp|avif|ico|woff2?|ttf|otf|webmanifest)$/i;
const MEDIA_EXTENSIONS = /\.(?:mp4|m4v|mov|webm|mkv|m3u8|mpd|ts|m4s|mp3|m4a|aac|ogg|wav)$/i;
const SIGNED_QUERY_KEYS = /^(?:token|sig|signature|auth|authorization|key|expires?|credential)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('beraflix-') && ![SHELL_CACHE, STATIC_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isEligibleStaticAsset(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (request.destination === 'video' || request.destination === 'audio' || MEDIA_EXTENSIONS.test(url.pathname)) return false;
  if ([...url.searchParams.keys()].some((key) => SIGNED_QUERY_KEYS.test(key))) return false;
  return url.pathname.startsWith('/_next/static/') || STATIC_EXTENSIONS.test(url.pathname);
}

function isCacheableResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response) && response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (saved) return saved;
    // No synthetic or invented offline page: if this shell was never fetched and cached, fail normally.
    throw error;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const saved = await cache.match(request);
  if (saved) {
    fetch(request).then((response) => {
      if (isCacheableResponse(response)) return cache.put(request, response.clone());
      return undefined;
    }).catch(() => {});
    return saved;
  }
  const response = await fetch(request);
  if (isCacheableResponse(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.destination === 'video' || request.destination === 'audio' || MEDIA_EXTENSIONS.test(url.pathname)) return;
  if ([...url.searchParams.keys()].some((key) => SIGNED_QUERY_KEYS.test(key))) return;

  if (request.mode === 'navigate') {
    if (!SHELL_PATHS.has(url.pathname)) return;
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (!isEligibleStaticAsset(url, request)) return;
  event.respondWith(cacheFirstStatic(request));
});
