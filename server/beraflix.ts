import { randomBytes } from "node:crypto";
import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";

const CONTENT_ORIGIN = "https://beraflix-2ti9bgcn.manus.space";
const PLAYABLE_TYPES = new Set(["video/mp4", "video/webm"]);
const QUALITIES = new Set(["auto", "360p", "480p", "720p", "1080p"]);
const MAX_MEDIA_BYTES = 12 * 1024 * 1024 * 1024;
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 200;
const RANGE_CHUNK_BYTES = 4 * 1024 * 1024;

type PlaybackSession = {
  slug: string;
  quality: string;
  season: number | null;
  episode: number | null;
  totalBytes: number;
  contentType: string;
  strongEtag: string;
  expiresAt: number;
};

const sessions = new Map<string, PlaybackSession>();
const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function sendError(response: ExpressResponse, status: number, message: string) {
  response.status(status).set(noStore).json({ error: message });
}

function optionalEpisode(value: unknown): number | null | false {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 999) return false;
  return number;
}

function removeExpiredSessions() {
  const now = Date.now();
  for (const [handle, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(handle);
  }
}

function getSession(handle: string): PlaybackSession | null {
  removeExpiredSessions();
  const session = sessions.get(handle);
  if (!session) return null;
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function mapUpstreamStatus(status: number): number {
  if (status === 400 || status === 404 || status === 403 || status === 415) return status;
  if (status === 416) return 416;
  return 503;
}

function validateRange(value: string | undefined, totalBytes: number): { range: string; start: number; end: number | null } | null {
  const selected = value || `bytes=0-${Math.min(totalBytes - 1, 1_048_575)}`;
  const match = selected.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || start < 0 || start >= totalBytes) return null;
  if (end !== null && (!Number.isSafeInteger(end) || end < start || end >= totalBytes)) return null;
  return { range: selected, start, end };
}

function parseContentRange(value: string | null): { start: number; end: number; total: number } | null {
  const match = String(value || "").match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(total) || start < 0 || end < start || total <= end || total > MAX_MEDIA_BYTES) return null;
  return { start, end, total };
}

function attachAbort(request: ExpressRequest, response: ExpressResponse, controller: AbortController) {
  const abort = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.on("aborted", abort);
  response.on("close", abort);
  return () => {
    request.off("aborted", abort);
    response.off("close", abort);
  };
}

async function handlePrepare(request: ExpressRequest, response: ExpressResponse) {
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const slug = typeof body.detailPath === "string" ? body.detailPath.trim() : "";
  const quality = typeof body.quality === "string" ? body.quality : "auto";
  const season = optionalEpisode(body.season);
  const episode = optionalEpisode(body.episode);

  if (!slug || slug.length > 2048 || /[\u0000-\u001f\u007f]/.test(slug)) {
    sendError(response, 400, "Select a valid title before playback.");
    return;
  }
  if (!QUALITIES.has(quality) || season === false || episode === false || Boolean(season) !== Boolean(episode)) {
    sendError(response, 400, "The selected playback options are invalid.");
    return;
  }

  const params = new URLSearchParams({ slug, quality });
  if (season !== null && episode !== null) {
    params.set("se", String(season));
    params.set("ep", String(episode));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const detachAbort = attachAbort(request, response, controller);
  try {
    const upstream = await fetch(`${CONTENT_ORIGIN}/api/offline/prepare?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      sendError(response, mapUpstreamStatus(upstream.status), "Secure playback is not available for this title right now.");
      return;
    }
    const data: unknown = await upstream.json();
    const record = data !== null && typeof data === "object" ? data as Record<string, unknown> : {};
    const contentType = typeof record.contentType === "string" ? record.contentType.split(";")[0].trim().toLowerCase() : "";
    const totalBytes = typeof record.totalBytes === "number" ? record.totalBytes : Number(record.totalBytes);
    const strongEtag = typeof record.strongEtag === "string" && record.strongEtag.length <= 200 && !/^W\//i.test(record.strongEtag) ? record.strongEtag : "";
    if (!PLAYABLE_TYPES.has(contentType) || !Number.isSafeInteger(totalBytes) || totalBytes < 1 || totalBytes > MAX_MEDIA_BYTES || record.rangeSupported !== true) {
      sendError(response, 415, "This title does not have a verified playable format.");
      return;
    }

    removeExpiredSessions();
    while (sessions.size >= MAX_SESSIONS) {
      const oldestHandle = sessions.keys().next().value;
      if (!oldestHandle) break;
      sessions.delete(oldestHandle);
    }
    const handle = randomBytes(24).toString("base64url");
    const session: PlaybackSession = {
      slug,
      quality,
      season,
      episode,
      totalBytes,
      contentType,
      strongEtag,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(handle, session);
    response.status(200).set(noStore).json({
      ok: true,
      playbackPath: `/api/beraflix/playback/${handle}`,
      downloadPath: `/api/beraflix/download/${handle}`,
      contentType,
      totalBytes,
      quality,
      expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
    });
  } catch {
    if (!response.headersSent) sendError(response, 503, "Secure playback could not be prepared.");
  } finally {
    clearTimeout(timeout);
    detachAbort();
  }
}

function handleHead(request: ExpressRequest, response: ExpressResponse) {
  const handle = String(request.params.handle || "");
  const session = /^[A-Za-z0-9_-]{32}$/.test(handle) ? getSession(handle) : null;
  if (!session) {
    sendError(response, 404, "Playback session is no longer available.");
    return;
  }
  response.status(200).set({
    ...noStore,
    "Content-Type": session.contentType,
    "Content-Length": String(session.totalBytes),
    "Accept-Ranges": "bytes",
  }).end();
}

async function handleMedia(request: ExpressRequest, response: ExpressResponse) {
  const handle = String(request.params.handle || "");
  const session = /^[A-Za-z0-9_-]{32}$/.test(handle) ? getSession(handle) : null;
  if (!session) {
    sendError(response, 404, "The secure media session is no longer available.");
    return;
  }
  const hasRange = Boolean(request.header("range"));
  const requested = hasRange ? validateRange(request.header("range"), session.totalBytes) : {
    range: `bytes=0-${session.totalBytes - 1}`,
    start: 0,
    end: session.totalBytes - 1,
  };
  if (!requested || requested.end !== null && requested.end >= session.totalBytes) {
    response.status(416).set({ ...noStore, "Content-Range": `bytes */${session.totalBytes}` }).json({ error: "The requested media range is invalid." });
    return;
  }
  const finalEnd = requested.end ?? session.totalBytes - 1;
  const expectedLength = finalEnd - requested.start + 1;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const detachAbort = attachAbort(request, response, controller);
  try {
    for (let start = requested.start; start <= finalEnd; start += RANGE_CHUNK_BYTES) {
      if (request.aborted || response.destroyed) return;
      if (!getSession(handle)) {
        if (!response.headersSent) sendError(response, 404, "The secure media session is no longer available.");
        else response.destroy();
        return;
      }
      const end = Math.min(finalEnd, start + RANGE_CHUNK_BYTES - 1);
      const params = new URLSearchParams({
        slug: session.slug,
        quality: session.quality,
        total: String(session.totalBytes),
      });
      if (session.strongEtag) params.set("etag", session.strongEtag);
      if (session.season !== null && session.episode !== null) {
        params.set("se", String(session.season));
        params.set("ep", String(session.episode));
      }
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), 90_000);
      const upstream = await fetch(`${CONTENT_ORIGIN}/api/offline/file?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "video/mp4, video/webm", Range: `bytes=${start}-${end}` },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (upstream.status !== 206 || !upstream.body) {
        await upstream.body?.cancel().catch(() => undefined);
        if (!response.headersSent) sendError(response, mapUpstreamStatus(upstream.status), "The requested media range is not available.");
        else response.destroy();
        return;
      }

      const range = parseContentRange(upstream.headers.get("content-range"));
      const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const contentLengthHeader = upstream.headers.get("content-length");
      const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
      const chunkLength = end - start + 1;
      if (!range || range.start !== start || range.end !== end || range.total !== session.totalBytes || !PLAYABLE_TYPES.has(contentType) || contentType !== session.contentType || (contentLength !== null && contentLength !== chunkLength)) {
        await upstream.body.cancel().catch(() => undefined);
        if (!response.headersSent) sendError(response, 502, "The media range could not be verified.");
        else response.destroy();
        return;
      }

      if (!response.headersSent) {
        response.status(hasRange ? 206 : 200).set({
          ...noStore,
          "Content-Type": contentType,
          "Content-Length": String(expectedLength),
          "Accept-Ranges": "bytes",
          ...(hasRange ? { "Content-Range": `bytes ${requested.start}-${finalEnd}/${session.totalBytes}` } : {}),
          Vary: "Range",
        });
      }
      const reader = upstream.body.getReader();
      let written = 0;
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        if (!result.value) continue;
        const bytes = Buffer.from(result.value);
        written += bytes.length;
        if (written > chunkLength) throw new Error("Verified chunk exceeded its declared length.");
        if (!response.write(bytes)) {
          await new Promise<void>((resolve) => {
            const finish = () => {
              response.off("drain", finish);
              response.off("close", finish);
              resolve();
            };
            response.once("drain", finish);
            response.once("close", finish);
          });
        }
      }
      if (written !== chunkLength) throw new Error("Verified chunk did not match its declared length.");
    }
    response.end();
  } catch {
    controller.abort();
    if (!response.headersSent) sendError(response, 503, "The media transfer could not be completed.");
    else response.destroy();
  } finally {
    if (timeout) clearTimeout(timeout);
    detachAbort();
  }
}

export function registerBeraflixPlaybackRoutes(app: Express) {
  app.post("/api/beraflix/playback/prepare", (request, response) => {
    void handlePrepare(request, response);
  });
  app.head("/api/beraflix/playback/:handle", handleHead);
  app.head("/api/beraflix/download/:handle", handleHead);
  app.get("/api/beraflix/playback/:handle", (request, response) => {
    void handleMedia(request, response);
  });
  app.get("/api/beraflix/download/:handle", (request, response) => {
    void handleMedia(request, response);
  });
}
