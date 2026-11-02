# BERAFLIX — BY BERA TECH

A mobile-first cinematic catalog and personal media library built with Next.js 15 App Router. The application keeps protected catalog and media requests on the server and presents provider-neutral status in the interface.

## Features

- Discover and Explore movies and series with search, sorting, categories, genre filters, and source-backed artwork.
- Separate Anime, Sports, live TV channel schedules, a regional channel directory, Books, and Wrestling browsing modes.
- Movie and series detail pages with episode selectors, saved-library actions, and a player with brightness, volume, quality, captions, resume, and fullscreen controls where supported.
- A device-local offline vault using OPFS for media bytes and IndexedDB for small metadata. The vault is not a cloud database and does not sync media across devices.
- A PWA install experience with an offline app shell and local playback for files the vault has fully verified and saved.

## Development

Use Node.js 22.13 or newer with pnpm 11.25.0. Copy `.env.example` to `.env.local` only when developing outside the managed environment, and provide protected credentials through a server-only environment. Never commit secret values or expose them through `NEXT_PUBLIC_*` variables.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

The application sends its configured public origin with authenticated server-side requests. If the app moves to another custom domain, update the server-side origin configuration and its allowed-domain settings.

## Playback and availability

Media availability depends on the title, source, region, network, and device. BERAFLIX does not bypass provider restrictions. A title being listed does not guarantee that every stream, replay, live event, or download is available. The app displays retryable errors and does not claim success for a link request or transfer it cannot verify.

The native video player includes a 50–150% picture-brightness control and a 0–100% volume control. Brightness changes the media image, not the phone's hardware screen brightness. Some mobile browsers restrict web-controlled volume; cross-origin embedded players keep their own controls.

Series playback and download requests accept positive season and episode numbers. Where a source does not provide a verified episode list or season count, the viewer chooses the episode range; BERAFLIX does not invent an episode catalog or claim an unverified range is a complete season. Browser-managed file transfers remain separate from the local vault and are not shown as completed unless the browser exposes that state.

## Offline files and personal library

The vault stores media bytes in this browser origin's private storage and keeps small records in IndexedDB. Completed files can be played or removed from BERAFLIX on the same device. Storage quotas and eviction are controlled by the browser; quota estimates are not device free space. Clearing site data can remove local files. BERAFLIX cannot browse arbitrary folders, SD cards, or the browser's Downloads folder, and offline saving is available only when the upstream source returns a verifiable authorized media transfer.

Watchlist, Favorites, Likes, watched state, Continue Watching, Viewing History, custom collections, and request history stay in this browser. They synchronize across open tabs in the same browser, not across devices; account sign-in and cross-device synchronization are not configured.

## Install

Use the **Install** control when the browser offers an install prompt. Otherwise, on Android/Chrome use the browser menu to install or add the app to the Home screen; on iOS/Safari use **Share → Add to Home Screen**. This repository delivers a PWA, not a signed Android APK package.

## Routes

Discover `/`, Explore `/explore`, My Shelf `/shelf`, Downloads `/downloads`, Profile `/profile`, title details `/movie/[slug]`, and player `/watch/[slug]`.
