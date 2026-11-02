import { getApiBaseUrl } from "@/constants/oauth";

export type PlaybackRequest = {
  detailPath: string;
  quality: "auto" | "360p" | "480p" | "720p" | "1080p";
  season?: number;
  episode?: number;
};

export type PreparedPlayback = {
  uri: string;
  downloadUri: string;
  relayHandle: string;
  contentType: "video/mp4" | "video/webm";
  totalBytes: number;
  quality: PlaybackRequest["quality"];
};

type PrepareResponse = {
  ok?: boolean;
  playbackPath?: string;
  downloadPath?: string;
  contentType?: string;
  totalBytes?: number;
  quality?: string;
};

export async function preparePlayback(request: PlaybackRequest, signal?: AbortSignal): Promise<PreparedPlayback> {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  if (!baseUrl || !request.detailPath || request.detailPath.length > 2048) {
    throw new Error("Secure playback is not configured for this title.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${baseUrl}/api/beraflix/playback/prepare`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(request),
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Secure playback is not available for this title right now.");
    const data = await response.json() as PrepareResponse;
    const contentType = data.contentType;
    const path = data.playbackPath;
    const downloadPath = data.downloadPath;
    if (
      data.ok !== true ||
      typeof path !== "string" || !/^\/api\/beraflix\/playback\/[A-Za-z0-9_-]{32}$/.test(path) ||
      typeof downloadPath !== "string" || !/^\/api\/beraflix\/download\/[A-Za-z0-9_-]{32}$/.test(downloadPath) ||
      (contentType !== "video/mp4" && contentType !== "video/webm") ||
      typeof data.totalBytes !== "number" || !Number.isSafeInteger(data.totalBytes) || data.totalBytes < 1 ||
      data.quality !== request.quality
    ) {
      throw new Error("The verified playback contract returned an invalid response.");
    }
    return {
      uri: `${baseUrl}${path}`,
      downloadUri: `${baseUrl}${downloadPath}`,
      relayHandle: downloadPath.split("/").pop()!,
      contentType,
      totalBytes: data.totalBytes,
      quality: request.quality,
    };
  } catch (error) {
    if (signal?.aborted) throw new Error("Playback preparation was cancelled.");
    if (error instanceof Error && error.message === "The verified playback contract returned an invalid response.") throw error;
    throw new Error("Secure playback is not available for this title right now.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
