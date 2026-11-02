import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import type { CatalogTitle } from "@/lib/beraflix/types";
import { searchTitles } from "@/lib/beraflix/api";
import { preparePlayback, type PlaybackRequest } from "@/lib/beraflix/playback";
import { getRememberedTitle } from "@/lib/beraflix/title-cache";

const STORAGE_KEY = "beraflix.device-downloads.v1";
const ALLOWED_QUALITIES = ["auto", "360p", "480p", "720p", "1080p"] as const;
const RESERVE_BYTES = 64 * 1024 * 1024;
const MAX_DOWNLOADS = 500;

export type DownloadStatus = "preparing" | "downloading" | "paused" | "complete" | "error";
export type DeviceTitle = Omit<CatalogTitle, "detailPath"> & { detailPath: "" };

export type DownloadRecord = {
  id: string;
  titleId: string;
  title: DeviceTitle;
  season: number | null;
  episode: number | null;
  quality: PlaybackRequest["quality"];
  contentType: "video/mp4" | "video/webm" | null;
  expectedBytes: number;
  bytesWritten: number;
  fileUri: string;
  relayHandle: string | null;
  downloadUri: string | null;
  resumeData: string | null;
  status: DownloadStatus;
  message: string;
  createdAt: number;
  updatedAt: number;
};

type DownloadContextValue = {
  records: DownloadRecord[];
  hydrated: boolean;
  addDownload: (title: CatalogTitle, quality: PlaybackRequest["quality"], season?: number, episode?: number) => Promise<string | null>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  deleteDownload: (id: string) => Promise<void>;
  verifyDownload: (id: string) => Promise<boolean>;
};

const DownloadContext = createContext<DownloadContextValue | null>(null);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeImage(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeTitle(value: unknown): DeviceTitle | null {
  const item = asRecord(value);
  if (!item || typeof item.id !== "string" || typeof item.title !== "string") return null;
  return {
    id: item.id.slice(0, 200),
    title: item.title.slice(0, 240),
    genre: typeof item.genre === "string" ? item.genre.slice(0, 160) : "",
    description: typeof item.description === "string" ? item.description.slice(0, 2400) : "",
    releaseDate: typeof item.releaseDate === "string" ? item.releaseDate.slice(0, 80) : "",
    duration: typeof item.duration === "number" && Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0,
    rating: typeof item.rating === "string" ? item.rating.slice(0, 24) : "",
    coverUrl: safeImage(item.coverUrl),
    backdropUrl: safeImage(item.backdropUrl),
    detailPath: "",
    type: typeof item.type === "string" ? item.type.slice(0, 80) : "",
    section: typeof item.section === "string" ? item.section.slice(0, 80) : "",
    hasResource: item.hasResource === true,
  };
}

function privateDownloadDirectory(): string {
  const root = FileSystem.documentDirectory;
  return root ? `${root}beraflix-downloads/` : "";
}

function normalizeDownload(value: unknown): DownloadRecord | null {
  const item = asRecord(value);
  const title = safeTitle(item?.title);
  if (!item || !title || typeof item.id !== "string" || typeof item.titleId !== "string") return null;
  const statuses: DownloadStatus[] = ["preparing", "downloading", "paused", "complete", "error"];
  const status = statuses.find((candidate) => candidate === item.status) ?? "error";
  const root = privateDownloadDirectory();
  const fileUri = typeof item.fileUri === "string" && root && item.fileUri.startsWith(root) ? item.fileUri : "";
  const quality = ALLOWED_QUALITIES.find((candidate) => candidate === item.quality) ?? "auto";
  const expectedBytes = typeof item.expectedBytes === "number" && Number.isSafeInteger(item.expectedBytes) && item.expectedBytes > 0 ? item.expectedBytes : 0;
  const bytesWritten = typeof item.bytesWritten === "number" && Number.isFinite(item.bytesWritten) ? Math.max(0, Math.min(expectedBytes || Number.MAX_SAFE_INTEGER, item.bytesWritten)) : 0;
  const contentType = item.contentType === "video/mp4" || item.contentType === "video/webm" ? item.contentType : null;
  const relayHandle = typeof item.relayHandle === "string" && /^[A-Za-z0-9_-]{32}$/.test(item.relayHandle) ? item.relayHandle : null;
  const downloadUri = typeof item.downloadUri === "string" && item.downloadUri.length <= 8192 && item.downloadUri.startsWith("https://") ? item.downloadUri : null;
  const resumeData = typeof item.resumeData === "string" && item.resumeData.length <= 100_000 ? item.resumeData : null;
  const episodeNumber = (entry: unknown) => typeof entry === "number" && Number.isInteger(entry) && entry >= 1 && entry <= 999 ? entry : null;
  return {
    id: item.id.slice(0, 240),
    titleId: item.titleId.slice(0, 200),
    title,
    season: episodeNumber(item.season),
    episode: episodeNumber(item.episode),
    quality,
    contentType,
    expectedBytes,
    bytesWritten,
    fileUri,
    relayHandle,
    downloadUri,
    resumeData,
    status,
    message: typeof item.message === "string" ? item.message.slice(0, 180) : "",
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
  };
}

function isSeries(title: CatalogTitle): boolean {
  return /series|tv|show/i.test(title.type);
}

function searchMode(title: CatalogTitle): "all" | "movies" | "series" | "anime" {
  if (/anime/i.test(title.type)) return "anime";
  if (isSeries(title)) return "series";
  return "movies";
}

class DownloadHttpError extends Error {
  constructor(readonly status: number) {
    super("Offline transfer returned an unavailable status.");
  }
}

function safeTransferMessage(error: unknown): string {
  if (error instanceof DownloadHttpError) {
    if (error.status === 403 || error.status === 415) return "Offline saving is not available for this title.";
    if (error.status === 404 || error.status === 416) return "The secure transfer expired or changed. Retry to prepare a fresh file.";
    return error.status >= 500 ? "The secure offline transfer is temporarily unavailable." : "This title could not be saved offline.";
  }
  if (error instanceof Error && error.message === "Not enough free space on this device.") return error.message;
  if (error instanceof Error && error.message === "Offline saving is available in the native Android app.") return error.message;
  if (error instanceof Error && error.message === "Open the title from the catalogue to refresh its secure offline request.") return error.message;
  if (error instanceof Error && error.message === "Choose both a season and episode before saving this series.") return error.message;
  return "Offline saving is not available for this title right now.";
}

export function DownloadProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const recordsRef = useRef(new Map<string, DownloadRecord>());
  const activeTasks = useRef(new Map<string, FileSystem.DownloadResumable>());
  const preparingControllers = useRef(new Map<string, AbortController>());
  const pausing = useRef(new Set<string>());
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const publishRecords = useCallback(() => {
    setRecords([...recordsRef.current.values()].sort((first, second) => second.createdAt - first.createdAt));
  }, []);

  const updateRecord = useCallback((id: string, patch: Partial<DownloadRecord>): DownloadRecord | null => {
    const current = recordsRef.current.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    recordsRef.current.set(id, next);
    publishRecords();
    return next;
  }, [publishRecords]);

  const insertRecord = useCallback((record: DownloadRecord) => {
    recordsRef.current.set(record.id, record);
    publishRecords();
  }, [publishRecords]);

  useEffect(() => {
    let active = true;
    if (Platform.OS === "web") {
      setHydrated(true);
      return () => { active = false; };
    }
    AsyncStorage.getItem(STORAGE_KEY).then(async (stored) => {
      if (!stored) return [] as DownloadRecord[];
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [] as DownloadRecord[];
      const normalized = parsed.slice(0, MAX_DOWNLOADS).flatMap((entry) => {
        const record = normalizeDownload(entry);
        return record ? [record] : [];
      });
      return Promise.all(normalized.map(async (record) => {
        if (record.status === "complete") {
          try {
            const info = record.fileUri ? await FileSystem.getInfoAsync(record.fileUri) : null;
            if (!info?.exists || info.isDirectory || info.size !== record.expectedBytes) {
              return { ...record, status: "error" as const, message: "The saved file is no longer available. Retry or delete it." };
            }
          } catch {
            return { ...record, status: "error" as const, message: "The saved file could not be verified. Retry or delete it." };
          }
          return record;
        }
        if (record.status === "preparing" || record.status === "downloading") {
          return record.resumeData
            ? { ...record, status: "paused" as const, message: "Paused on this device. Resume when ready." }
            : { ...record, status: "error" as const, message: "The transfer stopped before it could be paused. Retry to start again." };
        }
        if (record.status === "paused" && !record.resumeData) {
          return { ...record, status: "error" as const, message: "This transfer cannot resume. Retry to start again." };
        }
        return record;
      }));
    }).then((loaded) => {
      if (!active) return;
      recordsRef.current = new Map(loaded.map((record) => [record.id, record]));
      setRecords(loaded.sort((first, second) => second.createdAt - first.createdAt));
    }).catch(() => {
      if (active) {
        recordsRef.current = new Map();
        setRecords([]);
      }
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || Platform.OS === "web") return;
    const timer = setTimeout(() => {
      const snapshot = records.map((record) => ({ ...record, title: { ...record.title, detailPath: "" } }));
      writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))).catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [records, hydrated]);

  const progressCallback = useCallback((id: string, fileUri: string, expectedBytes: number) => {
    let lastStatAt = 0;
    return (_progress: FileSystem.DownloadProgressData) => {
      const now = Date.now();
      if (now - lastStatAt < 700) return;
      lastStatAt = now;
      void FileSystem.getInfoAsync(fileUri).then((info) => {
        if (!activeTasks.current.has(id) || !info.exists || info.isDirectory) return;
        const total = expectedBytes || (_progress.totalBytesExpectedToWrite > 0 ? _progress.totalBytesExpectedToWrite : info.size);
        updateRecord(id, { expectedBytes: total, bytesWritten: Math.min(info.size, total || info.size) });
      }).catch(() => undefined);
    };
  }, [updateRecord]);

  const makeTask = useCallback((id: string, uri: string, fileUri: string, expectedBytes: number, resumeData?: string) => (
    FileSystem.createDownloadResumable(
      uri,
      fileUri,
      { sessionType: FileSystem.FileSystemSessionType.BACKGROUND },
      progressCallback(id, fileUri, expectedBytes),
      resumeData,
    )
  ), [progressCallback]);

  const runTask = useCallback(async (id: string, task: FileSystem.DownloadResumable) => {
    try {
      const result = await task.downloadAsync();
      if (activeTasks.current.get(id) !== task) return;
      if (!result) throw new Error("The transfer was cancelled.");
      if (result.status !== 200 && result.status !== 206) throw new DownloadHttpError(result.status);
      const current = recordsRef.current.get(id);
      if (!current || !current.fileUri) return;
      const responseType = String(result.mimeType || result.headers["Content-Type"] || result.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const contentType = responseType === "video/mp4" || responseType === "video/webm" ? responseType : current.contentType || "video/mp4";
      if (responseType && !["video/mp4", "video/webm"].includes(responseType)) throw new Error("The saved media type could not be verified.");
      const info = await FileSystem.getInfoAsync(current.fileUri);
      if (!info.exists || info.isDirectory || info.size < 1) throw new Error("The saved byte count could not be verified.");
      updateRecord(id, {
        status: "complete",
        contentType,
        expectedBytes: info.size,
        bytesWritten: info.size,
        relayHandle: null,
        resumeData: null,
        message: "Saved and verified for offline playback.",
      });
    } catch (error) {
      if (pausing.current.has(id) || activeTasks.current.get(id) !== task) return;
      updateRecord(id, { status: "error", resumeData: null, message: safeTransferMessage(error) });
    } finally {
      if (activeTasks.current.get(id) === task) activeTasks.current.delete(id);
    }
  }, [updateRecord]);

  const resolveTitle = useCallback(async (record: DownloadRecord, preferred?: CatalogTitle): Promise<CatalogTitle> => {
    const remembered = getRememberedTitle(record.titleId);
    const current = preferred?.id === record.titleId && preferred.detailPath ? preferred : remembered?.detailPath ? remembered : null;
    if (current) return current;
    const results = await searchTitles(record.title.title, searchMode(record.title), 1);
    const match = results.find((title) => title.id === record.titleId && title.detailPath);
    if (match) return match;
    throw new Error("Open the title from the catalogue to refresh its secure offline request.");
  }, []);

  const beginTransfer = useCallback(async (record: DownloadRecord, preferred?: CatalogTitle) => {
    if (Platform.OS === "web") {
      updateRecord(record.id, { status: "error", message: "Offline saving is available in the native Android app." });
      return;
    }
    const controller = new AbortController();
    preparingControllers.current.set(record.id, controller);
      updateRecord(record.id, { status: "preparing", message: "Checking the download…", bytesWritten: 0 });
    try {
      const title = await resolveTitle(record, preferred);
      if (controller.signal.aborted || !recordsRef.current.has(record.id)) return;
      if (!title.hasResource || !title.detailPath) throw new Error("Offline saving is not available for this title.");
      if (isSeries(title) && (!record.season || !record.episode)) throw new Error("Choose both a season and episode before saving this series.");
      const request: PlaybackRequest = {
        detailPath: title.detailPath,
        quality: record.quality,
        ...(record.season && record.episode ? { season: record.season, episode: record.episode } : {}),
      };
      const prepared = await preparePlayback(request, controller.signal, { includeOffline: true });
      if (controller.signal.aborted || !recordsRef.current.has(record.id)) return;
      if (!prepared.downloadUri) throw new Error("Download is not available for this title.");
      if (prepared.totalBytes > 0) {
        const freeBytes = await FileSystem.getFreeDiskStorageAsync();
        if (freeBytes < prepared.totalBytes + RESERVE_BYTES) throw new Error("Not enough free space on this device.");
      }
      const directory = privateDownloadDirectory();
      if (!directory) throw new Error("Offline storage is unavailable on this device.");
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      if (controller.signal.aborted || !recordsRef.current.has(record.id)) return;
      const extension = prepared.contentType === "video/webm" ? "webm" : "mp4";
      const fileUri = `${directory}beraflix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
      const next = updateRecord(record.id, {
        status: "downloading",
        message: "Downloading…",
        contentType: prepared.contentType,
        expectedBytes: prepared.totalBytes,
        bytesWritten: 0,
        fileUri,
        relayHandle: prepared.relayHandle,
        downloadUri: prepared.downloadUri,
        resumeData: null,
      });
      if (!next) return;
      const task = makeTask(record.id, prepared.downloadUri, fileUri, prepared.totalBytes);
      activeTasks.current.set(record.id, task);
      await runTask(record.id, task);
    } catch (error) {
      if (!controller.signal.aborted && recordsRef.current.has(record.id)) {
        updateRecord(record.id, { status: "error", message: safeTransferMessage(error) });
      }
    } finally {
      if (preparingControllers.current.get(record.id) === controller) preparingControllers.current.delete(record.id);
    }
  }, [makeTask, resolveTitle, runTask, updateRecord]);

  const addDownload = useCallback(async (title: CatalogTitle, quality: PlaybackRequest["quality"], season?: number, episode?: number): Promise<string | null> => {
    if (!hydrated || Platform.OS === "web" || !title.hasResource) return null;
    if (recordsRef.current.size >= MAX_DOWNLOADS) return null;
    const series = isSeries(title);
    if (series && (!Number.isInteger(season) || !Number.isInteger(episode) || !season || !episode || season > 999 || episode > 999)) return null;
    if ([...recordsRef.current.values()].some((record) => record.status === "preparing" || record.status === "downloading")) return null;
    const existing = [...recordsRef.current.values()].find((record) => record.titleId === title.id && record.season === (series ? season : null) && record.episode === (series ? episode : null) && record.status === "complete");
    if (existing) return existing.id;
    const id = `download-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const item: DownloadRecord = {
      id,
      titleId: title.id,
      title: { ...title, detailPath: "" },
      season: series ? season ?? null : null,
      episode: series ? episode ?? null : null,
      quality,
      contentType: null,
      expectedBytes: 0,
      bytesWritten: 0,
      fileUri: "",
      relayHandle: null,
      downloadUri: null,
      resumeData: null,
      status: "preparing",
      message: "Checking source and device storage…",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    insertRecord(item);
    void beginTransfer(item, title);
    return id;
  }, [beginTransfer, hydrated, insertRecord]);

  const pauseDownload = useCallback(async (id: string) => {
    const task = activeTasks.current.get(id);
    if (!task) return;
    pausing.current.add(id);
    try {
      const saved = await task.pauseAsync();
      if (activeTasks.current.get(id) === task) activeTasks.current.delete(id);
      const current = recordsRef.current.get(id);
      if (!current) return;
      const info = current.fileUri ? await FileSystem.getInfoAsync(current.fileUri).catch(() => null) : null;
      updateRecord(id, {
        status: saved.resumeData ? "paused" : "error",
        resumeData: saved.resumeData ?? null,
        bytesWritten: info?.exists ? Math.min(info.size, current.expectedBytes) : current.bytesWritten,
        message: saved.resumeData ? "Paused on this device. Resume when ready." : "This transfer could not be paused. Retry to start again.",
      });
    } catch {
      if (activeTasks.current.get(id) === task) activeTasks.current.delete(id);
      updateRecord(id, { status: "error", message: "This transfer could not be paused. Retry to start again." });
    } finally {
      pausing.current.delete(id);
    }
  }, [updateRecord]);

  const resumeDownload = useCallback(async (id: string) => {
    const record = recordsRef.current.get(id);
    if (!record || record.status !== "paused" || !record.resumeData || !record.downloadUri || !record.fileUri || Platform.OS === "web") return;
    if ([...recordsRef.current.values()].some((item) => item.id !== id && (item.status === "preparing" || item.status === "downloading"))) return;
    const directory = privateDownloadDirectory();
    if (!directory) {
      updateRecord(id, { status: "error", message: "App-private storage is unavailable on this device." });
      return;
    }
    const task = makeTask(id, record.downloadUri, record.fileUri, record.expectedBytes, record.resumeData);
    activeTasks.current.set(id, task);
      updateRecord(id, { status: "downloading", message: "Resuming download…" });
    await runTask(id, task);
  }, [makeTask, runTask, updateRecord]);

  const retryDownload = useCallback(async (id: string) => {
    const record = recordsRef.current.get(id);
    if (!record || record.status === "preparing" || record.status === "downloading") return;
    if ([...recordsRef.current.values()].some((item) => item.id !== id && (item.status === "preparing" || item.status === "downloading"))) return;
    if (record.fileUri) await FileSystem.deleteAsync(record.fileUri, { idempotent: true }).catch(() => undefined);
    const reset = updateRecord(id, {
      status: "preparing",
      message: "Preparing a fresh download…",
      expectedBytes: 0,
      bytesWritten: 0,
      fileUri: "",
      relayHandle: null,
      downloadUri: null,
      resumeData: null,
      contentType: null,
    });
    if (!reset) return;
    void beginTransfer(reset, getRememberedTitle(record.titleId) ?? undefined);
  }, [beginTransfer, updateRecord]);

  const deleteDownload = useCallback(async (id: string) => {
    preparingControllers.current.get(id)?.abort();
    preparingControllers.current.delete(id);
    const task = activeTasks.current.get(id);
    if (task) {
      activeTasks.current.delete(id);
      await task.cancelAsync().catch(() => undefined);
    }
    const record = recordsRef.current.get(id);
    if (record?.fileUri) await FileSystem.deleteAsync(record.fileUri, { idempotent: true }).catch(() => undefined);
    recordsRef.current.delete(id);
    publishRecords();
  }, [publishRecords]);

  const verifyDownload = useCallback(async (id: string): Promise<boolean> => {
    const record = recordsRef.current.get(id);
    if (!record || record.status !== "complete" || !record.fileUri || record.expectedBytes < 1) return false;
    try {
      const info = await FileSystem.getInfoAsync(record.fileUri);
      if (info.exists && !info.isDirectory && info.size === record.expectedBytes) return true;
    } catch {
      // A missing or inaccessible local file is handled the same as an incomplete file.
    }
    updateRecord(id, { status: "error", message: "The saved file is no longer available. Retry or delete it." });
    return false;
  }, [updateRecord]);

  return (
    <DownloadContext.Provider value={{ records, hydrated, addDownload, pauseDownload, resumeDownload, retryDownload, deleteDownload, verifyDownload }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads(): DownloadContextValue {
  const value = useContext(DownloadContext);
  if (!value) throw new Error("useDownloads must be used within DownloadProvider");
  return value;
}
