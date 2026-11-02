# Beraflix API contract audit

## Sources and scope

The route handlers were inspected from the public `beraflix-nextjs` branch at commit `b58abc66fdd9a0ffea68d628c6bef7f1cf0d45f3`, including the directly called server-side catalog helpers. No `.env.local` or other environment file was inspected. No signed media URL or provider credential was printed. Live requests used GET only and summarized response shapes rather than URL values. [1] [2]

## Verified metadata routes

- **Home — `GET /api/home`.** No query or body is read. Success returns `{items, sections, fetchedAt}`. Each item is normalized catalogue metadata, including title, genre, cover/backdrop image URL fields, rating, release date, duration, content IDs, type, and `detailPath`. `detailPath` is an opaque signed lookup identifier; do not display it or treat it as a playable media URL. The `source` field should be ignored in user-facing UI. The helper currently assembles the feed from fixed discovery sections and only returns supported MovieBox records. If all feed sources fail, the route returns 502. [1] [2]

- **Search — `GET /api/search`.** Optional `q` is trimmed and limited to 100 characters. `mode` accepts `all`, `anime`, `movies`, or `series` and otherwise falls back to `all`. `page` defaults to 1 and is clamped to 1–100. Success returns `{query, mode, page, count, items}`. Anime mode uses its own server helper. Returned item metadata follows the home normalizers. Search failures return 502. [1] [2]

- **Catalog — `GET /api/catalog/browse` and `GET /api/catalog/facets`.** There is no `/api/catalog/movies` or `/api/catalog/series` handler. Browse either uses one of the case-sensitive `section` values `trending`, `popularMovies`, `popularSeries`, `latestMovies`, `latestSeries`, or uses `kind=categories|genres` plus a validated `slug`; page defaults to 1 and is clamped to 1–100. Success returns either `{section,page,count,items}` or `{kind,slug,page,count,items}`. Facets returns `{categories,genres}`. Browse/facets items contain normalized catalogue fields and externally hosted cover/backdrop URL values. Treat those image URLs as remote display assets, not playback authorization or durable download URLs. [1] [2]

- **Anime metadata — `GET /api/anime/episodes` and `GET /api/anime/providers`.** Episodes requires `slug`; providers requires `slug`, `episodeId`, and `track=sub|dub`. These routes accept a verified signed detail lookup path and return normalized episode/provider metadata. Episode records include `episodeId`, number, title/label, thumbnail and track availability; providers return provider IDs/labels. Keep the signed lookup token out of logs and user-facing copy. These are metadata routes only; see the playback restrictions below. [1] [2]

- **Sports — `/api/sports*`.** `GET /api/sports` returns highlights and match groups, including fields such as `url`, `mediaUrl`, and `replayOffers` that may contain media locations. Do not call the root sports feed directly from the native client. `GET /api/sports/matches` returns normalized match metadata without those media fields; `GET /api/sports/resources` recursively strips URL/media-like fields; recommendations include highlight URL fields and should also remain behind a server-side filter/relay. Dynamic sports actions have bounded numeric IDs and are sanitized, but should still be consumed only after field-level review. [1] [2]

- **TV channels and schedule — `GET /api/channels-v2`, `/api/channels-v2/countries`, and `GET /api/channels/[channelId]/schedule`.** The directory requires `country` matching two lowercase ASCII letters; the route does not validate membership in the ISO country list despite its error wording. The countries route returns normalized country codes, names, counts, and time zones. Schedule uses a numeric channel ID path parameter; `9` is explicitly accepted without checking the directory. Schedule records return text fields such as title, description, start/end, and presenters. Render these as text only. `GET /api/channels-v2/stream` returns an HLS relay URL or an embed URL; the HLS URL is signed/token-bearing and must not be sent to the app as-is. [1] [2]

- **Books — `GET /api/novels`.** The `action` query is required. Supported actions are `home`, `search`, `genres`, `suggestions`, `recommendations`, `operations`, `rank-groups`, `detail`, `chapters`, and `chapter`. Search needs `keyword`; detail/chapters use a bounded `novelId`, `contentId`, or `id`; chapter needs `chapterId`. Pagination and size are action-dependent. Success uses `{ok:true,action,...}` and normalized novel/chapter fields; validation errors are 400 and upstream failures are 502. [1] [2]

- **Captions — `GET /api/captions` and `GET /api/captions/file`.** Captions requires `slug`; optional `quality` defaults to `auto`; `se` and `ep` must be supplied together and be integers 1–999. Success returns `{tracks:[{id,language,label,src}]}`. `src` is a same-origin `/api/captions/file` proxy path, not a provider subtitle URL. The file endpoint returns WebVTT text, with a 512 KiB cap, redirect rejection, private/no-store caching, and format validation. The selected live captions request was blocked at the public edge with 502, so live subtitle availability remains unconfirmed. [1] [2]

- **Wrestling — `GET /api/wrestling/events` and `GET /api/wrestling/event`.** Events accepts the `official` catalog and bounded page; event lookup requires a validated HTTPS URL on the configured WWE hostname. Responses project only sanitized title, description, and parts, not media URLs. These are metadata-only contracts. [1] [2]

## Playback and offline safety

`GET /api/stream` and `GET /api/download` return `{url,expiresAt,expiresIn}` where `url` is a short-lived signed media URL (up to 600 seconds). `GET /api/anime/stream` likewise returns a short-lived embed URL, and `GET /api/channels-v2/stream` returns stream URL data. These routes are not safe to use as native-client playback APIs because the response exposes upstream playback material. Keep those calls server-side and implement a separate playback contract that relays media bytes and Range responses without returning the upstream URL. Do not log, persist, or emit signed URLs to analytics/crash reporting. [1] [2]

The offline routes are `GET /api/offline/prepare` and `GET /api/offline/file`. Preparation asks upstream for a one-byte range and accepts only supported MP4/WebM media with a valid `206 Content-Range`; it returns total size, content type, validator, range support, quality, and episode context. The file route requires one explicit byte range, rejects suffix/multiple ranges, and caps a file at 12 GiB. It validates the upstream partial response, media type, validator, and length, then streams bytes. Source-level implementation is not proof that each provider permits downloading or that native pause/resume succeeds.

During this run, one feed item marked `hasResource=true` was used internally for a read-only offline-preparation attempt; the public origin returned an edge-level 502 envelope before a usable preparation result could be confirmed. The earlier task brief also records a sampled offline Range relay response of HTTP 403; I did not reproduce that 403 in this run. Treat offline support as unavailable until a permitted source completes both preparation and a verified native file transfer. Never show simulated progress or promise every title can be saved.

The native backend's health route returned HTTP 200 and an empty playback-preparation request returned the expected HTTP 400 validation error. A later authorized end-to-end attempt was blocked before a title lookup was sent because the public home-feed request itself returned HTTP 403; no lookup token was printed, and no media bytes were transferred. Real source preparation and the byte-range relay therefore remain unverified for this session.

## Live response samples

The following are observations from GET requests to the deployed API origin, not guarantees of future availability. `GET /api/home` returned 200 JSON with 96 items, sections, and `fetchedAt`. `GET /api/search?q=batman` returned 200 JSON with an empty item list. `GET /api/catalog/browse?section=trending` returned 200 with 20 items, and `/api/catalog/facets` returned 200 with 11 categories and 11 genres. `/api/channels-v2/countries` returned 200 with 246 country records; `/api/channels-v2?country=us` returned 200 with 1,397 channel records. A novels home request returned 200 JSON. Sports matches and resources returned 200 with empty lists at sample time.

Path probes confirmed that `/api/catalog/movies`, `/api/catalog/series`, `/api/anime`, and `/api/channels` returned HTML 404 responses. Calling `/api/channels-v2` without country returned JSON 400; calling `/api/novels` without action returned JSON 400. Those errors are consistent with the route source and show why guessed paths should not be shipped.

## Native integration decision

Use an allowlist for metadata calls and map response objects into app-owned types. Drop `source`, signed `detailPath` from user-visible state, and all URL/media-like fields before data reaches general UI components. Use safe catalogue, country, subtitle, and schedule metadata only after their route parameters are constructed according to the source contract. Keep user shelves, preferences, history, collections, and files entirely in native on-device storage; never use the provisioned managed database for them. Playback must use a separately reviewed server-side byte relay, and download controls must reflect actual native transfer state and verified local files.

## References

[1]: https://github.com/bera-tech-ai/Beraflixv1/tree/b58abc66fdd9a0ffea68d628c6bef7f1cf0d45f3/app/api "Beraflix API route handlers at the audited public source revision"
[2]: https://github.com/bera-tech-ai/Beraflixv1/tree/b58abc66fdd9a0ffea68d628c6bef7f1cf0d45f3/lib "Beraflix server-side API helpers at the audited public source revision"
[3]: https://beraflix-2ti9bgcn.manus.space "Deployed Beraflix API origin"
