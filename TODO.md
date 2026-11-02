# BERAFLIX outcome checklist

## 1. Screenshot-led identity, accessible layout, and navigation — complete

- [x] Maintain one consistent BERAFLIX visual identity across all screens; brand it as **BERAFLIX — BY BERA TECH**.
- [x] Match the attached design specification: primary background `#08090D`, secondary background `#101116`, card background `#171920`, primary accent `#F01436`, secondary accent `#B50929`, white primary text, and `#A1A3AD` secondary text. Use no yellow or gold, avoid excessive red backgrounds, and keep gradients and borders restrained.
- [x] Use cinematic movie posters and backdrop artwork, rounded cards, subtle shadows, restrained crimson glows, layered dark surfaces, and smooth transitions. Keep the interface premium and atmospheric; avoid plain, flat designs, excessive bright colors, clutter, and generic templates.
- [x] Use consistent typography, spacing, iconography, button styles, and card layouts across every screen.
- [x] Keep the header compact with the red angular BERAFLIX mark, a wordmark with “FLIX” highlighted in crimson, the “BY BERA TECH” signature, an accessible search action, and a circular Profile avatar action.
- [x] Create five primary destinations: Discover, Explore, My Shelf, Downloads, and Profile.
- [x] On mobile, use a fixed bottom navigation bar with recognizable icons and text labels. Highlight the active destination in red. Ensure it does not cover content and works across mobile sizes.
- [x] Prevent overlapping controls, broken layouts, and horizontal overflow. Remove all loading spinners and animated loading indicators; use static status text or stable non-animated placeholders. Keep only brief interaction transitions, readable controls, a visible keyboard focus, and the Skip to main content link.

## 2. Discover, Explore, and supported media catalog — complete
- [x] Filter the existing movie/series discovery and search to its supported catalog source; do not surface unsupported-source records in details, playback, downloads, or saved-library lists.

- [x] Discover features BERAFLIX branding, a large featured movie banner with cinematic artwork, title and available basic information, short description, Play and Details buttons where applicable, and an option to add a title to the user's library.
- [x] Discover includes horizontally scrolling movie poster sections and Trending, popular, recent, and recommended content sections where available.
- [x] Discover includes Continue Watching when the user has viewing progress.
- [x] Movie posters are visually prominent, with rounded corners and elegant interactions.
- [x] Explore has a search bar, movie poster grid, documented category/genre filters, static non-animated pending states, clear empty/error states, smooth scrolling, and responsive layouts consistent with the screenshot-led BERAFLIX design.
- [x] Explore provides sort options for title, release year, or rating using only values returned by the catalog; sorting preserves the active mode, query, category, and genre filters. Do not infer missing metadata.
- [x] Keep upstream REST requests server-side; use the already-configured protected key, send the authorized public BERAFLIX origin required by the key restriction, and never expose or log the key.
- [x] Normalize catalog and search records without exposing source-brand labels; retain canonical content IDs separately from lookup IDs; issue HMAC-signed, source-neutral title routes. Discovery/search records must explicitly identify a supported source. HMAC-signed routes may accept a missing source marker only from a fixed MovieBox detail endpoint after token verification; reject explicit conflicting markers. Resolve an unsigned legacy route only when that fixed detail response explicitly identifies MovieBox and returns a matching canonical `contentId` or `subjectId`. Cache public catalog metadata for 600 seconds and use only matching cached titles.
- [x] Provide the same-origin `/api/home` normalized catalog and `/api/search?q=` title-search routes. Browser code does not call the upstream API directly.
- [x] Keep artwork loading stable and remote image handling configured without exposing upstream labels.
- [x] Integrate the documented MovieBox `/v1/categories`, `/v1/genres`, and `/v1/movies/upcoming` routes through server-only helpers; display category/genre choices and upcoming titles only when response data is validated.
- [x] Preserve MovieBox-only source support and improve search so a successful search—including a valid empty result—does not wait for the complete five-route catalog fetch. Use the cached catalog only if the search request fails, use bounded caching for public metadata, and never cache signed playback/download URLs.
- [x] Add a Channels browse mode in Explore using the server-loaded directory and same-origin schedule handler for Channel 9 and directory-listed channels. Show only schedule names, status, and supplied time strings; keep the schedule-only experience separate from playback, omit a day selector because the accepted day format is undocumented, and state that the timezone is unspecified.

## 3. Details and player — complete

- [x] Increase streaming speed/responsiveness by verifying the signed canonical title token already carried by the same-origin playback request instead of making an unnecessary upstream detail request to issue a stream link.
- [x] Remove verbose “connecting” or “requesting a playback link” messages and every animated spinner from the player display; retain a concise static accessible status and retry state.
- [x] Title details resolve catalog-issued HMAC-signed links when the fixed MovieBox detail response omits its source field, while rejecting any explicit conflicting marker. Resolve an unsigned legacy route only when the fixed detail response explicitly identifies MovieBox and returns the same canonical `contentId` or `subjectId`.

- [x] A title detail screen displays a large cinematic backdrop, movie poster, title and available metadata, description, and Play button where playback is available.
- [x] Title actions include Add to Watchlist, Add to Favorites, Like or Unlike, and Mark as Watched.
- [x] The player supports Play and Pause, playback progress bar, current time and duration where available, fullscreen where available, landscape-friendly mobile layout, clear loading/error indicators, and resume from saved progress where supported.
- [x] Keep the API key server-side; the browser may receive only a short-lived signed media URL needed for playback. Before returning one, require a parseable future `expiresAt`, an `expiresIn` value from 1 through 600 seconds, a remaining lifetime no greater than 600 seconds, and agreement between the two expiry values. Preserve media Range requests and do not persist signed URLs.
- [x] On signed-link/media expiry, request a fresh URL, restore the saved/current position, and resume only if playback was active.
- [x] For supported source series, allow positive season and episode selection using `se` and `ep` parameters, and preserve resume/watched state for the selected episode.
- [x] For MovieBox streams, show only real zero-delay subtitle tracks returned by FrameX. Fetch the selected SRT through a same-origin no-store handler, validate the exact `cacdn.hakunaymatata.com` host and a 512 KiB maximum, convert the content to WebVTT, and provide an accessible Off/language selector. Never expose or persist the temporary upstream subtitle URL. Keep AnimeX subtitle controls hidden, and do not fabricate audio/source choices: the verified stream response contains one signed URL and no `processedSources` or `processedSubtitles` arrays.

## 4. My Shelf and personal-library actions — complete for device-local vault files

- [x] Watchlist: view saved titles; add titles; remove titles.
- [x] Favorites: view favorite movies and series; add titles; remove titles.
- [x] Continue Watching: display movies/episodes started, show viewing progress, and resume from the saved position where supported.
- [x] Downloaded Content: display verified device-local vault files and their actual status; play completed local files and delete vault-owned files. Browser-managed Downloads remain separate and are not exposed as local vault files.
- [x] Liked Movies: display liked movies; allow like/unlike.
- [x] Custom Collections: create collections; add/remove titles; rename/delete collections; open and browse each collection.
- [x] Mark as Watched: mark a movie/episode as watched and change watched status where appropriate.
- [x] Removing a title from Watchlist must not unintentionally remove it from other library categories.
- [x] Clear History must ask for confirmation and must not delete downloads, Favorites, Watchlist items, Likes, or Custom Collections.
- [x] Every category and action is functional, not merely decorative. Downloaded Content covers completed vault-owned files; arbitrary browser Downloads remain outside the website because the browser does not expose them.
- [x] Keep Downloads and My Shelf synchronized so supported changes appear consistently; link-request records appear in both, while neither claims they are completed local files.
- [x] Keep personal-library records on this device and state that cross-device synchronization is unavailable when no account/sync functionality is enabled.
- [x] Do not surface legacy saved records from unsupported catalog sources in the user-facing shelf.

## 5. Downloads manager and platform limits — complete for local vault and honest browser handoff

- [x] Downloads screen uses the dark cinematic palette and includes a Downloads header, verified local-file cards with poster artwork, actual vault status/byte progress, filters and management actions; separate browser link-request records from files and never fabricate hidden browser transfer progress.
- [x] Use only the protected attachment flow; create a fresh signed URL for every attempt, do not store or reuse expired links, and keep the API key server-side.
- [x] Implement episode-by-episode download selection with quality options (e.g., 360p, 480p, 720p, 1080p) per episode. Until the upstream source supplies a documented episode list, allow entry of positive season/episode numbers rather than inventing an episode catalog.
- [x] Pass the selected quality to the protected download-link request and store the selected episode and quality in the device-local download-request record.
- [x] Handle signed-link expiry by requesting a new URL for each attempt and display relevant expiration information where known. The upstream service controls any title/file expiration not included in its response.
- [x] Notify users when link requests fail and provide a retry option that requests a fresh URL. A link-issuance failure is kept distinct from an unobservable browser transfer failure.
- [x] Detect incomplete vault transfers from the actual local file and validated byte ranges; never mark a vault file complete until its verified total size is committed. Browser-managed transfer completion remains unknown when the browser does not expose it.
- [x] Resume interrupted vault transfers from the reconciled local file size with a fresh authorized link and matching byte ranges; otherwise restart safely. Browser-managed transfers remain controlled by the device Downloads manager.
- [x] Play completed vault-owned local files where the browser supports their media type, and delete only files stored by this vault. The site cannot inspect or control browser-managed Downloads.
- [x] Provide an explicit device-local cleanup preference for incomplete vault files and partial records older than 30 days, with a clear warning; completed vault files and browser-managed files are never auto-deleted.
- [x] Provide pause, resume, cancel, retry, and delete for vault-owned files where supported. For separate browser-managed transfers, explain that the browser/device owns the actual transfer and file.
- [x] Include download preferences and storage information only when the platform exposes them. Preferences are device-local; browser quota estimates are shown only when the browser provides them and are not represented as disk capacity.
- [x] Clearly distinguish downloading, paused, completed, failed, interrupted, and expired states when verifiable. Vault statuses use actual local transfer state; separate link requests show prepared, handed-off, failed, or expired without pretending to know hidden browser transfer states.
- [x] Prevent duplicate download-link requests for the same content, episode, and quality where BERAFLIX can observe the request; do not invent duplicate-job prevention for transfers hidden in the browser manager. Warn before preparing another link when an identical request is prepared or handed off.
- [x] Explain that arbitrary folders, SD cards, and background downloads depend on the device/browser and whether the app is a PWA or native app. Communicate unsupported capabilities rather than pretending they work.
- [x] Downloaded content must be authorized for offline use. Use only the protected attachment endpoint and only when it issues an authorized signed URL; do not simulate progress.
- [x] Do not display fabricated download progress, storage capacity, or library statistics. Warn users that provider files can be several GB and to check data and storage before starting.

## 6. Profile and preferences — complete

- [x] Profile displays avatar and display name where available; account-related options where supported; appearance and playback preferences where available; a download settings shortcut; a My Shelf shortcut; About BERAFLIX; and BY BERA TECH branding.
- [x] Keep the Profile screen simple, organized, and consistent with the rest of the app.

## 7. Runtime quality, documentation, and scope — complete
- [x] Remove all references to the upstream provider brand and unsupported catalog source from the UI, metadata, and project documentation. Describe backend details generically and retain only the protected runtime configuration needed by the server; suppress brand-spam embedded in catalog display text.
- [x] Maintain the **BERAFLIX — BY BERA TECH** branding and match the attached specification’s `#08090D`, `#101116`, `#171920`, `#F01436`, and `#B50929` identity without yellow/gold or excessive red surfaces.

- [x] Use clear static pending, empty, success, and error states; readable text and accessible controls; no loading spinners/shimmers/pulses; and responsive mobile-first layouts.
- [x] Implement only the screens, design elements, and features explicitly described in the specification.
- [x] Do not add an admin dashboard, payment systems, subscriptions, social features, or unrelated functionality.

## 8. Reference-inspired detail hierarchy and playback adjustments — complete

- [x] Adapt the observed image-led home/detail information hierarchy without copying third-party logos, artwork, or text; retain the BERAFLIX — BY BERA TECH identity and five primary destinations, and use the supplied screenshot's charcoal/black, white, and red palette.
- [x] Organize title details around the available backdrop/poster, title, year, genres, rating, synopsis, and primary actions; provide anchor access to available episode and related-title sections. Render cast or other metadata only when the source actually supplies it; do not fabricate missing cast, runtime, or episode-list data.
- [x] Add a keyboard-accessible picture-brightness slider to playback that dims or brightens the video image. State clearly that this does not change the phone's hardware screen brightness.
- [x] Add an accessible 0–100% volume control for native HTML video, including mute at 0% and a value the user can see.
- [x] Keep picture brightness available for embedded video where supported; do not claim BERAFLIX can control volume inside a cross-origin embedded player. Explain that users must use the embedded player or device volume controls there.
- [x] Keep adjustment controls usable in fullscreen and on narrow mobile displays without covering core playback controls or creating horizontal overflow.

## 9. Anime and Sports integration — complete with conditional live-media availability

- [x] Add an Anime mode inside Explore; search via a same-origin server route; display normalized Anime title cards without exposing upstream source names or credentials.
- [x] Load Anime title metadata and the actual `/v1/anime/episodes` or distinct AnimeX `/v1/animev2/episodes` list using the title's canonical content ID; let viewers select a returned episode ID and show only the dub/subtitle tracks advertised for that episode.
- [x] Request an authenticated player link using the selected episode ID and track; verify that episode IDs belong to the selected title, allow only safe HTTPS embed/proxy hosts, require a parseable future expiry and a consistent lifetime no greater than 600 seconds, keep API credentials server-side, and do not persist short-lived links.
- [x] Do not show a Download action for Anime unless an authorized download/attachment endpoint is available.
- [x] Add a Sports mode inside Explore using the live aggregate, ongoing-match, and replay routes, initially with the documented football sport type; show aggregate recent-match scores/status, live-match scores/status, highlights, and replay offers with fresh-enough live data.
- [x] Keep Sports API calls server-side and do not turn odds metadata into betting actions or expose upstream source labels in the UI.
- [x] When Sports media fails, show a clear retry state rather than raw response text or fabricated success. Highlights and a replay returned HTTP 206 `video/mp4` in probes.
- [x] Live-match media remains conditional: sampled relay requests returned HTTP 502. The app shows a retry state and does not claim the upstream live stream is playable.

## 10. Screenshot-led browse, search, and detail hierarchy — complete

- [x] Use the user's supplied BERAFLIX screenshot and attached design specification for the information hierarchy across Discover, browse/search, title details, episodes, and playback, while preserving BERAFLIX's own wordmark, BERA TECH signature, and catalog artwork. Use the exact charcoal/black and crimson palette with no yellow/gold. Do not copy third-party logos, text, assets, advertisements, or user-generated reviews.
- [x] Keep the five primary destinations—Discover, Explore, My Shelf, Downloads, and Profile—and make the updated shell responsive with desktop side navigation and a mobile safe-area-aware bottom bar.
- [x] Make shared search and clear category entry points easy to reach. Add distinct Movies, Series, Anime, and Sports browse modes while preserving existing search, genre filters, Anime episode/track data, and Sports feed behavior.
- [x] Make Discover content-first with a compact image-led featured carousel, accessible carousel controls, and source-backed horizontal catalog shelves visible sooner; avoid a tall slogan-only hero that pushes browsing below the fold.
- [x] Organize details around the real backdrop/poster, available title metadata, primary actions, and anchors for Overview, actual Episodes when available, and Related titles. Render cast/review fields only when the source actually supplies them; do not fabricate metadata or episode lists. On mobile, season and episode selection uses tap-to-select controls rather than requiring keyboard entry.

## 11. Anime details and actual episode playback — complete

- [x] A valid Anime search result must open details and load its real episode list even when the search record does not contain an episode count. Do not use a missing count alone to mark Anime playback unavailable.
- [x] Show only real returned episode IDs and each episode's advertised audio/subtitle tracks; selection updates to the chosen episode and track.
- [x] The player requests an authenticated, short-lived embed link for the selected episode and track; the server verifies the episode belongs to the title, allows only the approved HTTPS embed host, requires a future expiry no longer than 600 seconds, and does not persist the link.
- [x] Show a concise static accessible link-preparation state (no spinner or loading animation) and a retryable error when Anime link issuance or embedding fails. Do not show an Anime download action without an authorized attachment endpoint, or claim BERAFLIX can control cross-origin player volume. The embedded player's own timeline and 10-second backward/forward controls remain available.

## 12. Movie/Series playback responsiveness and honest availability — complete

- [x] Verify playback through the actual BERAFLIX player UI, not only by checking link issuance. Preserve native video Range requests, resume state, fullscreen, brightness, and volume behavior. Verity playback progressed in the native player; another title was rejected by the media host.
- [x] Add an accessible in-player quality selector for Auto, 360p, 480p, 720p, and 1080p. Use the existing server-side quality parameter; when the user changes quality, request a fresh link and restore the current time and playing/paused state where the media supports it.
- [x] Show a concise static playback-pending status with no spinner/animation and a retry action. Distinguish a valid issued link from an unavailable media response; when the host rejects a stream, tell the user it may be unavailable for the current region/network or title without displaying raw upstream errors.
- [x] Do not route requests through a proxy/VPN or otherwise evade geographic restrictions. Offer a truthful explanation and another available title instead.
- [x] During buffering, show immediate status and one `Play once when ready` action so a single tap queues playback rather than requiring repeat taps. Use browser-managed preloading and do not promise instant delivery when the media host or network is slow.

## 13. Canonical live update for the current redesign — in progress

- [ ] Push this screenshot-led redesign and documented API integrations to canonical `main` without rewriting history; rely only on the already-enabled automatic publication, then confirm the public Beraflix domain serves the updated design and routes.

## 14. Series episode-range download handoff — complete

- [x] For a supported regular Series, allow the user to select a season, starting episode, and ending episode with tap-to-select controls. The source provides no season episode list/count, so the user must choose the last episode; do not invent an episode count or claim the range is an automatically verified entire season.
- [x] Use the selected season and episode for Watch online. Allow a user-controlled episode-range queue, prepare a fresh authorized link for only one episode at a time, and require the user's deliberate action before moving to the next episode.
- [x] Keep the selected download quality across the range and retain per-episode duplicate warnings, link-expiration handling, and retryable failures. Browser handoff is not proof of file transfer or completion; never launch multiple downloads automatically or report fabricated progress.
- [x] Anime can show its real episodes and available tracks for streaming, but remains ineligible for downloads or a season download queue until an authorized download attachment endpoint exists.

## 15. Install and device-file behavior — complete for web/PWA capabilities

- [x] Add a visible Install BERAFLIX control that invokes the browser's install prompt when available; hide or change the control when the app is already installed.
- [x] When no prompt is available, explain the install steps for Android/Chrome and iOS/Safari; reuse the standalone manifest and icons and preserve the BERAFLIX mobile layout.
- [x] Explain that the installed PWA streams while online, can reopen cached shell/library pages, and can play verified vault-owned files offline; browser-managed Downloads and arbitrary folders remain outside BERAFLIX control.
- [x] Explain that users may open browser-managed downloads with the device's file manager/player; BERAFLIX does not scan arbitrary folders, while its own completed vault files can be played in-app offline when supported.

## 16. Static loading states and first-paint performance — complete

- [x] Remove every loading spinner and animated loading indicator, including rotating icons, shimmer, pulsing skeletons, and animated loading text. Replace pending states with concise static text or stable non-animated placeholders; do not display fabricated progress.
- [x] Render the shared app shell and useful page structure before waiting for slower upstream catalog responses. Defer nonessential catalog rows and category/genre data until needed.
- [x] Optimize search so a successful supported title-search response does not wait for the full catalog fetch; use the cached catalog only when the search request fails.
- [x] Cache public catalog/category/genre metadata for a bounded period and keep live sports metadata on a shorter freshness window. Never cache signed playback, embed, caption, or download URLs.
- [x] Preserve retryable errors and honest pending, empty, unavailable, and playback states while keeping the interface responsive on desktop and mobile.

## 17. Documented API integrations and media-source limits — complete with provider availability caveats

- [x] Add server-side integration for documented MovieBox `GET /v1/categories`, `GET /v1/genres`, and `GET /v1/movies/upcoming`; validate actual response shapes before rendering categories, genres, or upcoming titles. In the live probe, each metadata route returned 11 labels, but all 10 non-Upcoming slugs in each family returned zero titles; the Upcoming route returned 20. Keep those empty states honest.
- [x] Continue using only the supported MovieBox source for regular movies and series. Do not re-add Showbox. Use documented MovieBox series discovery/detail routes where appropriate, but do not invent a regular-series season or episode listing; retain numeric season/episode selectors and sequential one-at-a-time download-link handoff. Reject the sampled latest endpoint's Showbox-only items instead of relabeling them.
- [x] Add the documented AnimeX `/v1/animev2/*` route family after validating live search, episode, provider/server, and HLS response shapes. Keep AnimeX distinct from the existing `/v1/anime/*` integration, preserve canonical content IDs and source validation, and show only documented sub/dub choices. Do not promise unsupported AnimeX caption tracks or downloads.
- [x] Extend the existing Sports experience with documented recommendations/resources only where real response fields normalize safely. Keep media availability conditional and do not claim that a listed live/replay item plays unless playback is actually available. Keep Channels separate from the Sports feed.
- [x] Add subtitle selection only from verified `/v1/captions` metadata. Proxy only the selected SRT through a same-origin no-store handler, validate the observed host and a 512 KiB payload cap, and convert to WebVTT. Keep subtitle-file controls hidden for anime routes that do not document such tracks; do not expose or persist temporary caption URLs.
- [x] Do not add a searchable music library or MP3-download feature without a separately authorized, documented music provider. FrameX's public documentation does not list music/MP3 endpoints; OmniSave's visible MP3 claim is URL-based conversion, not a searchable music catalog. Do not integrate its private or undocumented backend routes.
- [x] Describe documented FrameX routes as current/available, not newly released, unless a dated public changelog confirms their release date. Keep the FrameX credential server-side and preserve the authorized origin restriction.

## 18. FrameX TV channel programme schedules — complete

- [x] Add a separate Channels mode within Explore that loads the channel directory from server-only FrameX `GET /v1/channels` and programme data from `GET /v1/channels/:channelId/schedule` through same-origin routes. Keep the existing five primary destinations unchanged and do not make the movie catalog wait for channel data.
- [x] Show the live directory's four supported channels (IDs 14, 15, 19, and 31) using only returned channel names, logos, and live-state metadata. Also allow the user-supplied schedule-only ID 9, which is absent from the directory; label it exactly “Channel 9” and do not invent its brand or logo.
- [x] Display only programme fields returned by the schedule endpoint, including programme title, status, start/end time strings, description, or presenters when present. Preserve the source time strings because no timezone was documented. For valid empty schedules, state that no programme data was returned; do not fabricate entries.
- [x] Use the endpoint's default schedule response. Do not add a day selector until FrameX documents the `day` query format; the tested date-formatted query returned an empty schedule.
- [x] Keep any directory `streamUrl` server-side and out of browser responses. This update adds programme schedules only; do not imply channel playback is available or add direct HLS/YouTube streaming.
- [x] Use a concise static loading state, clear retryable errors, and an honest empty state. Cache public directory/schedule metadata briefly without delaying Discover or displaying animated loading indicators.


## 19. Remaining FrameX Playground families — complete

- [x] Keep the MovieBox source families for Discovery, Search, Details, Collections, Genres, and Streaming on their existing server-only, same-origin adapters; add genuine bounded upstream pagination only for routes that document a `page` input. Keep Showbox excluded and never route Showbox-marked shared-feed results into MovieBox playback.
- [x] Add AnimeX episode-provider selection from validated `sub[]`/`dub[]` provider records (`id`, `default`, `tip`), preserve the selected provider through the server-only embed/stream adapter, and do not add unsupported caption-file or download controls.
- [x] Add on-demand Sports match/fixture details and resources for the documented detail, match-list, replay, rankings, head-to-head, stats, events, lineups, match-flow, and has-new routes. Preserve each route's documented input names; strip media and odds URLs from the client detail payload; display empty data honestly.
- [x] Add a separate NovelHub Books mode with home/recommendation/search/genre/detail/chapter routes and a reader using the observed source-specific fields. Cap responses independently because the chapters route returned more records than requested in the live sample. Do not expose `fileUrl` values or store novel text outside the user's local reading session. Genre IDs are preserved, but an observed `genreId` response still contained genre records rather than filtered novels; do not claim a confirmed novel-content filter. Keep NovelStore groups unavailable after its 401 response.
- [x] Add a separate Wrestling events/parts metadata mode using the verified `events`, `parts`, and `stream` structure. Do not expose or play wrestling stream variants: the sampled stream request returned HTTP 502 and expiry/refresh behavior remains unverified.
- [x] Add a separate Channels V2 country/channel catalogue using its verified country map and channel fields. On explicit user action, resolve only the verified FrameX HLS relay or trusted YouTube embed through a no-store route; refresh the documented short-lived relay before expiry and never expose direct stream arrays. Preserve the existing legacy Channel 9/Channels schedule mode separately.
- [x] Keep all new FrameX credentials server-only, bound query/page inputs, use same-origin no-store routes for transient media, preserve exact source identity, and provide static pending/error/empty states without spinners.

## 20. Device-local offline media vault — implementation complete; a sampled upstream Range relay returned HTTP 403

- [x] Keep the managed cloud database disabled. Store personal-library and offline-job metadata only on this device; never use a cloud database as movie-file storage.
- [x] Use OPFS for media bytes and IndexedDB for small local metadata. Do not persist the FrameX key, signed media URLs, subtitle URLs, or complete media in localStorage/IndexedDB.
- [x] Add an authorized same-origin MovieBox Range relay that resolves only a catalog-issued title token and validated quality/episode, consumes the protected signed link on the server, validates the trusted host and `206 Content-Range`, streams rather than buffers the full file, and returns no upstream URL or redirect. The current server-side probe receives upstream HTTP 403 for sampled sources; the UI refuses to claim completion and retains the separate browser-download fallback.
- [x] Start, pause, resume, cancel, retry, and delete only vault-owned local files. Resume from the reconciled OPFS file size using a fresh protected link and matching byte ranges; never append if range start/total or content identity is inconsistent.
- [x] Mark a file complete only after its validated size is present in OPFS. Show actual vault byte progress; do not claim browser Downloads-manager state, arbitrary folder/SD-card access, or background transfer.
- [x] Play completed vault files locally when the device/browser supports the returned media type; remove files only after a clear user action. Keep downloaded files visible under My Shelf and Downloads without clearing them when viewing history is cleared.
- [x] Provide device-local automatic cleanup for incomplete files and partial records older than 30 days, with a clear warning and confirmation. Completed vault files are never automatically deleted, and browser-managed files remain outside this setting.
- [x] Feature-detect OPFS/IndexedDB/persistent storage, estimate origin quota without presenting it as device free space, handle quota/eviction/network errors honestly, and state that storage limits vary by device/browser. The sample 4.12 GB one-byte Range response is not proof that full production transfers are supported.
- [x] Register a bounded service worker that caches only the app shell/offline fallback and static assets; do not cache `/api/*`, media bytes, or signed URLs. Let the offline library open from a cached page when disconnected.
