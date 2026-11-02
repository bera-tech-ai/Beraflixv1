import type { CatalogTitle, ChannelRecord, ChannelStream, CountryRecord, ExploreContent, HomeFeed, ScheduleProgram } from "@/lib/beraflix/types";

const API_ORIGIN = "https://beraflix-2ti9bgcn.manus.space";
const VALID_SECTIONS = new Set(["trending", "popularMovies", "popularSeries", "latestMovies", "latestSeries"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, limit = 1000): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
}

function safeImageUrl(value: unknown): string | null {
  const record = asRecord(value);
  const candidate = typeof value === "string" ? value : record?.url;
  if (typeof candidate !== "string" || candidate.length > 4096) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mapCatalogTitle(value: unknown): CatalogTitle | null {
  const item = asRecord(value);
  if (!item) return null;
  const id = text(item.id || item.lookupId || item.contentId, 200);
  const title = text(item.title, 240);
  if (!id || !title) return null;
  return {
    id,
    title,
    genre: text(item.genre, 160),
    description: text(item.description, 2400),
    releaseDate: text(item.releaseDate, 80),
    duration: typeof item.duration === "number" && Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0,
    rating: text(item.imdbRatingValue, 24),
    coverUrl: safeImageUrl(item.cover),
    backdropUrl: safeImageUrl(item.backdrop),
    detailPath: text(item.detailPath, 2048),
    type: text(item.type, 80),
    section: text(item.section, 80),
    hasResource: item.hasResource === true,
  };
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Catalogue request failed");
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function queryPath(path: string, values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).length > 0) query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function getHomeFeed(): Promise<HomeFeed> {
  const data = asRecord(await getJson("/api/home"));
  const items = Array.isArray(data?.items) ? data.items.map(mapCatalogTitle).filter((item): item is CatalogTitle => item !== null) : [];
  const sections = Array.isArray(data?.sections) ? data.sections.map((item) => text(item, 80)).filter(Boolean) : [];
  return { items, sections };
}

export async function searchTitles(query: string, mode: "all" | "movies" | "series" | "anime" = "all", page = 1): Promise<CatalogTitle[]> {
  const trimmed = query.trim().slice(0, 100);
  if (!trimmed) return [];
  const data = asRecord(await getJson(queryPath("/api/search", { q: trimmed, mode, page })));
  return Array.isArray(data?.items) ? data.items.map(mapCatalogTitle).filter((item): item is CatalogTitle => item !== null) : [];
}

export async function browseCatalog(section: string, page = 1): Promise<CatalogTitle[]> {
  if (!VALID_SECTIONS.has(section)) throw new Error("Unsupported catalogue section");
  const data = asRecord(await getJson(queryPath("/api/catalog/browse", { section, page })));
  return Array.isArray(data?.items) ? data.items.map(mapCatalogTitle).filter((item): item is CatalogTitle => item !== null) : [];
}

export async function getCountries(): Promise<CountryRecord[]> {
  const data = asRecord(await getJson("/api/channels-v2/countries"));
  if (!Array.isArray(data?.countries)) return [];
  return data.countries.flatMap((value) => {
    const item = asRecord(value);
    const code = text(item?.code, 2).toLowerCase();
    const name = text(item?.name, 100);
    if (!/^[a-z]{2}$/.test(code) || !name) return [];
    return [{ code, name, channelCount: typeof item?.channelCount === "number" ? Math.max(0, item.channelCount) : 0, timeZone: text(item?.timeZone, 100) }];
  });
}

export async function getChannels(country: string): Promise<ChannelRecord[]> {
  const code = country.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return [];
  const data = asRecord(await getJson(queryPath("/api/channels-v2", { country: code })));
  if (!Array.isArray(data?.channels)) return [];
  return data.channels.flatMap((value) => {
    const item = asRecord(value);
    const id = text(item?.id, 128);
    const name = text(item?.name, 180);
    if (!id || !name) return [];
    const languages = Array.isArray(item?.languages) ? item.languages.map((language) => text(language, 80)).filter(Boolean).slice(0, 20) : [];
    return [{ id, name, country: text(item?.country, 80), languages, isGeoBlocked: item?.isGeoBlocked === true, streamType: text(item?.streamType, 80) }];
  });
}

export async function getChannelStream(country: string, channelId: string): Promise<ChannelStream> {
  const code = country.trim().toLowerCase();
  const id = channelId.trim();
  if (!/^[a-z]{2}$/.test(code) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("This channel is unavailable.");
  const data = asRecord(await getJson(queryPath("/api/channels-v2/stream", { country: code, channelId: id })));
  const kind = data?.kind === "hls" || data?.kind === "embed" ? data.kind : null;
  const url = typeof data?.url === "string" ? data.url : "";
  const name = text(data?.name, 180) || "Live channel";
  if (!kind || !url || !url.startsWith("https://")) throw new Error(text(data?.error, 180) || "This channel has no supported live stream.");
  return { kind, url, name, expiresAt: typeof data?.expiresAt === "string" ? data.expiresAt : null };
}

export async function getChannelSchedule(channelId: number): Promise<ScheduleProgram[]> {
  if (!Number.isInteger(channelId) || channelId < 1 || channelId > 99_999) return [];
  const data = asRecord(await getJson(`/api/channels/${channelId}/schedule`));
  if (!Array.isArray(data?.programs)) return [];
  return data.programs.flatMap((value, index) => {
    const item = asRecord(value);
    const title = text(item?.title, 240);
    if (!title) return [];
    const presenters = Array.isArray(item?.presenters) ? item.presenters.map((entry) => text(entry, 120)).filter(Boolean).slice(0, 8) : [];
    return [{
      id: text(item?.id, 128) || `${channelId}-${index}`,
      title,
      description: text(item?.description, 1000),
      slogan: text(item?.slogan, 240),
      status: text(item?.status, 80),
      startTime: text(item?.startTime, 80),
      endTime: text(item?.endTime, 80),
      schedule: text(item?.schedule, 240),
      presenters,
    }];
  });
}

export async function getNovelHome(): Promise<ExploreContent[]> {
  const data = asRecord(await getJson("/api/novels?action=home&page=1&size=20"));
  if (!Array.isArray(data?.items)) return [];
  return data.items.flatMap((value) => {
    const item = asRecord(value);
    const id = text(item?.novelId, 128);
    const title = text(item?.title, 240);
    if (!id || !title) return [];
    return [{ id, title, description: text(item?.summary, 1000), subtitle: text(item?.author, 160), coverUrl: null, kind: "novel" as const }];
  });
}

export async function getSportsMatches(): Promise<ExploreContent[]> {
  const data = asRecord(await getJson("/api/sports/matches"));
  if (!Array.isArray(data?.matches)) return [];
  return data.matches.flatMap((value) => {
    const item = asRecord(value);
    const team1 = asRecord(item?.team1);
    const team2 = asRecord(item?.team2);
    const first = text(team1?.name, 100);
    const second = text(team2?.name, 100);
    const id = text(item?.id || item?.matchId, 128);
    if (!id || !first || !second) return [];
    return [{ id, title: `${first} vs ${second}`, description: text(item?.league, 160), subtitle: text(item?.status || item?.time, 80), coverUrl: null, kind: "sports" as const }];
  });
}

export async function getWrestlingEvents(): Promise<ExploreContent[]> {
  const data = asRecord(await getJson("/api/wrestling/events?catalog=official&page=1"));
  if (!Array.isArray(data?.events)) return [];
  return data.events.flatMap((value, index) => {
    const item = asRecord(value);
    const title = text(item?.title, 240);
    if (!title) return [];
    const parts = Array.isArray(item?.parts) ? item.parts.map((part) => text(part, 120)).filter(Boolean).join(" · ") : "";
    return [{ id: `wrestling-${index}`, title, description: text(item?.description, 1000), subtitle: parts, coverUrl: null, kind: "wrestling" as const }];
  });
}
