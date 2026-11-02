import { getApiBaseUrl } from "@/constants/oauth";

export type PlaybackRequest = {
  detailPath: string;
  quality: "auto" | "360p" | "480p" | "720p" | "1080p";
  season?: number;
  episode?: number;
};

export type PreparedPlayback = {
  uri: string;
  downloadUri: string | null;
  relayHandle: string | null;
  contentType: "video/mp4" | "video/webm" | null;
  totalBytes: number;
  quality: PlaybackRequest["quality"];
  expiresAt: string | null;
  expiresIn: number;
};

type StreamResponse = {
  url?: unknown;
  expiresAt?: unknown;
  expiresIn?: unknown;
};

type OfflinePrepareResponse = {
  totalBytes?: unknown;
  contentType?: unknown;
  strongEtag?: unknown;
  rangeSupported?: unknown;
};

function isTrustedMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "wolvarex.com" || url.hostname.endsWith(".wolvarex.com")) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function positiveEpisode(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value > 0 && value <= 999 ? value : undefined;
}

function requestParams(request: PlaybackRequest): URLSearchParams {
  const params = new URLSearchParams({ slug: request.detailPath, quality: request.quality });
  const season = positiveEpisode(request.season);
  const episode = positiveEpisode(request.episode);
  if (season !== undefined && episode !== undefined) {
    params.set("se", String(season));
    params.set("ep", String(episode));
  }
  return params;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, credentials: "omit", signal });
  if (!response.ok) throw new Error(`Secure media request failed with HTTP ${response.status}.`);
  return await response.json() as T;
}

export async function preparePlayback(
  request: PlaybackRequest,
  signal?: AbortSignal,
  options: { includeOffline?: boolean } = {},
): Promise<PreparedPlayback> {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  if (!baseUrl || !request.detailPath || request.detailPath.length > 2048) {
    throw new Error("Secure playback is not configured for this title.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const params = requestParams(request);
    const stream = await getJson<StreamResponse>(`${baseUrl}/api/stream?${params.toString()}`, controller.signal);
    if (!isTrustedMediaUrl(stream.url)) throw new Error("The stream service returned an invalid media URL.");

    const expiresIn = Number(stream.expiresIn);
    const expiresAt = typeof stream.expiresAt === "string" ? stream.expiresAt : null;
    if (!Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 600 || !expiresAt) {
      throw new Error("The stream service returned an invalid expiry.");
    }

    let downloadUri: string | null = null;
    let contentType: "video/mp4" | "video/webm" | null = null;
    let totalBytes = 0;
    if (options.includeOffline) {
      const offline = await getJson<OfflinePrepareResponse>(`${baseUrl}/api/offline/prepare?${params.toString()}`, controller.signal);
      const candidateType = typeof offline.contentType === "string" ? offline.contentType.split(";")[0].trim().toLowerCase() : "";
      if ((candidateType !== "video/mp4" && candidateType !== "video/webm") || offline.rangeSupported !== true) {
        throw new Error("This title does not have a verified offline format.");
      }
      if (typeof offline.totalBytes !== "number" || !Number.isSafeInteger(offline.totalBytes) || offline.totalBytes < 1) {
        throw new Error("The offline media size could not be verified.");
      }
      const fileParams = new URLSearchParams(params);
      fileParams.set("total", String(offline.totalBytes));
      if (typeof offline.strongEtag === "string" && offline.strongEtag.length <= 200) fileParams.set("etag", offline.strongEtag);
      downloadUri = `${baseUrl}/api/offline/file?${fileParams.toString()}`;
      contentType = candidateType;
      totalBytes = offline.totalBytes;
    }

    return { uri: stream.url, downloadUri, relayHandle: null, contentType, totalBytes, quality: request.quality, expiresAt, expiresIn };
  } catch (error) {
    if (signal?.aborted) throw new Error("Playback preparation was cancelled.");
    if (error instanceof Error && error.message.includes("verified offline")) throw error;
    throw new Error("Secure playback is not available for this title right now.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
