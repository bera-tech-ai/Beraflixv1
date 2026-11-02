# Beraflix Native Android — Plan

## Approved scope and implementation approach

The active Webdev Mobile project is the Expo Router / React Native / TypeScript starter at `/home/ubuntu/beraflix`. Continue in this already-bound managed workspace. Build native Android UI with Expo Router, React Native components, NativeWind, and the SDK-matched Expo Video, FileSystem, and Brightness modules; do not replace the template or wrap the website in a WebView. The Mobile template provisions a managed database, but the app will not create tables, run user-library queries, or store preferences, viewing history, or offline files there.

The app shell will have five bottom destinations: Discover, Explore, My Shelf, Downloads, and Profile. Detail, player, Channel 9 schedule, collection, and search flows live in native stack routes above those tabs. Shared components keep the portrait layout one-handed and consistent. API integration is limited to audited public metadata routes; only response fields required for the UI may be exposed to screens. Provider credentials remain on the existing server. Media-address-bearing endpoints are not called directly from a device. Playback uses an explicit server-mediated stream contract after endpoint behaviors and range semantics are confirmed. The client must never receive or persist an upstream signed URL as its playback source.

Device library metadata and preferences use native local persistence. Downloaded bytes use app-private native file storage, with metadata pointing to verified local files. A download is complete only after the response, byte count, and file are verified; unsupported sources remain unavailable rather than showing invented progress. Pause/resume/retry behavior must use real HTTP range and task semantics, and any source returning an authorization or range error must be reported as not downloadable.

The backend folder is the template's Express/tRPC application, not the original movie site. It can host carefully scoped server-mediated routes without database calls. The existing deployed content API origin is `https://beraflix-vdieblyc.manus.space`; the exact allowlisted routes and response shapes are recorded after the source/API audit in `API-AUDIT.md`. Do not read `.env.local`, embed a provider credential in `EXPO_PUBLIC_*` values, or expose provider names in UI copy. The added playback/download relay remains on the managed Mobile server; it has not been deployed to the existing public website, which is intentionally left unchanged. Media playback and offline transfer therefore remain source/backend-limited until a safe, durable relay host is available.

## Project structure

- `app/(tabs)/_layout.tsx` — five native bottom tabs and their icon/label treatment.
- `app/(tabs)/index.tsx` — Discover landing page, featured title, continue-watching and editorial content rails.
- `app/(tabs)/explore.tsx` — Explore modes for movies, series, Anime, Sports, TV Channels, Books, and Wrestling, with search and directory variants.
- `app/(tabs)/shelf.tsx` — device-local watchlist, favorites, likes, watched status, history, continue-watching, and collections.
- `app/(tabs)/downloads.tsx` — locally stored downloads with real pause/resume/retry/delete actions and verified offline status.
- `app/(tabs)/profile.tsx` — device-local playback, subtitle, quality, and storage preferences plus BERAFLIX — BY BERA TECH identity.
- `app/title/[id].tsx` — native title detail and saved-state actions.
- `app/player/[id].tsx` — native Expo Video player surface with season/episode, quality, captions, volume, and brightness affordances only when supported.
- `app/offline/[id].tsx` — local-file player that verifies app-private bytes before playback and stores viewing progress on-device.
- `app/channels/channel9.tsx` — Channel 9 schedule and channel-directory entry flow.
- `app/collections/[id].tsx` and `app/collections/create.tsx` — device-local collection viewing and creation.
- `components/beraflix/` — branded headers, section headings, media cards, category controls, empty states, and static skeletons.
- `constants/beraflix-theme.ts` — palette, typography roles, and mode labels.
- `lib/beraflix/api.ts` — typed, allowlisted metadata calls after the audit; never sends media URLs into UI state.
- `lib/beraflix/title-cache.ts` — transient in-memory title lookup and exact-ID re-resolution for saved items; lookup tokens are never persisted.
- `lib/beraflix/library.tsx` — device-only watch state, preferences, collections, and playback history.
- `lib/beraflix/downloads.tsx` — AsyncStorage-only transfer records, Expo FileSystem resumable tasks, byte-count/file verification, and local-file lookup; signed title lookup tokens are not persisted.
- `server/beraflix.ts` — server-mediated playback and other strictly allowlisted relays, with no database dependency.
- `assets/images/` — distinct Beraflix launcher, splash, adaptive, monochrome, and favicon assets before checkpointing.
- `app.config.ts` — existing native identifiers and public runtime config plus the linked EAS project ID; no provider or build credential is embedded.
- `eas.json` — the `preview` profile produces an internal Android APK and fixes the public API base to the stable existing Beraflix origin, not a temporary sandbox host.
- `.easignore` — inherits standard project ignores and explicitly excludes `.env` and `.env.*` from EAS uploads.

## Design direction

**Design Movement:** Neo-noir streaming editorial—cinematic black surfaces, sharp red accents, and restrained information hierarchy.

**Core Principles:** Put the next action within thumb reach; let film artwork lead; keep metadata concise; make privacy and offline state clear without visual clutter.

**Color Philosophy:** `#08090D` is the near-black canvas and `#101116` the elevated surface. `#F01436` is the unmistakable action/signal red; `#B50929` provides depth. White carries titles and primary actions, while muted gray carries secondary metadata. Gold and yellow are excluded entirely.

**Layout Paradigm:** A portrait-first vertical editorial feed with edge-to-edge feature moments, horizontally browsable poster rails, and a persistent five-tab bottom bar; avoid a dense centered grid.

**Signature Elements:** A narrow red signal slash beside section labels; poster tiles with a fine dark-red edge; compact uppercase metadata chips separated from large title typography.

**Interaction Philosophy:** Native tap targets, one-handed reach, meaningful haptics, and direct controls. Use real state changes and clear labels instead of decorative motion.

**Animation:** No loading spinner or loading animation. Use static skeleton blocks or plain status labels. Keep screen changes and content stable; allow only subtle press feedback and optional haptics, not autoplay or animated loading effects.

**Typography System:** Use the platform sans family (Roboto on Android; system sans elsewhere). Set the wordmark and hero titles in heavy uppercase, section names in compact semibold type, and metadata in regular muted text; keep labels legible at native sizes.

**Brand Essence:** A cinematic discovery and personal watch space for Beraflix viewers, distinguished by a private, on-device shelf. Personality: bold, focused, dependable.

**Brand Voice:** Short, confident, editorial. Example lines: “Your next watch starts here.” “Pick up where the story paused.”

**Wordmark & Logo:** A custom uppercase BERAFLIX wordmark paired with a forward-cut red play signal; “BY BERA TECH” sits as a small tracked signature beneath or beside it. Launcher art is a distinct square monogram without baked rounded corners.

**Signature Brand Color:** Beraflix signal red `#F01436`.

## Delivery constraints and result

The user explicitly requested a remote EAS Android build with `eas build --platform android --profile preview`, using an Expo token supplied through secure project input. The Expo project is linked under `@beratechs-team/beraflix`; the `preview` profile produces an internal APK. The build completed successfully as version `1.0.0` (version code `1`, SDK `57.0.0`) from source commit `6196f98`, with build ID `ac011d69-fa9b-41a7-a317-a43de358f98c`. The direct Expo artifact is available at <https://expo.dev/artifacts/eas/m39IAznqQhkokDj-NpVYw9TZ9dl6qd5QztPzfsfm7mE.apk>. Do not run local Gradle or use a resident EAS build process. The one-time EAS token declaration was withdrawn after completion. No GitHub Release asset was published.

TypeScript, lint, and tests passed. Canonical `main` push succeeded at `6196f98`, and the public `beraflix-native` branch was fast-forwarded to the same commit; existing `main` and `beraflix-nextjs` refs were not changed. The Dashboard session expired before the structured Version history/checkpoint receipt could be independently verified, so report the successful canonical push without claiming a confirmed receipt. The native playback/download relay remains undeployed to the existing public origin; playback and downloads are not yet guaranteed by the installable client.
