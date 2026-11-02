import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

import type { CatalogTitle } from "@/lib/beraflix/types";

const STORAGE_KEY = "beraflix.device-library.v1";
const LIST_NAMES = ["watchlist", "favorites", "liked", "watched"] as const;

export type LibraryListName = (typeof LIST_NAMES)[number];
export type LibraryItem = CatalogTitle;
export type PlaybackPreferences = {
  quality: "auto" | "360p" | "480p" | "720p" | "1080p";
  subtitlesEnabled: boolean;
  subtitleLanguage: string;
};
export type LocalCollection = { id: string; name: string; itemIds: string[] };
export type PlaybackProgress = { positionSeconds: number; durationSeconds: number; updatedAt: number };
export type LocalLibraryState = {
  items: Record<string, LibraryItem>;
  lists: Record<LibraryListName, string[]>;
  history: string[];
  progress: Record<string, PlaybackProgress>;
  collections: LocalCollection[];
  preferences: PlaybackPreferences;
};

type LibraryContextValue = {
  state: LocalLibraryState;
  hydrated: boolean;
  toggleList: (list: LibraryListName, item: LibraryItem) => void;
  markWatched: (item: LibraryItem) => void;
  recordProgress: (item: LibraryItem, positionSeconds: number, durationSeconds: number) => void;
  createCollection: (name: string) => string | null;
  toggleCollectionItem: (collectionId: string, item: LibraryItem) => void;
  updatePreferences: (preferences: Partial<PlaybackPreferences>) => void;
};

const emptyState: LocalLibraryState = {
  items: {},
  lists: { watchlist: [], favorites: [], liked: [], watched: [] },
  history: [],
  progress: {},
  collections: [],
  preferences: { quality: "auto", subtitlesEnabled: true, subtitleLanguage: "device" },
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

function normalizeItem(value: unknown): LibraryItem | null {
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

function deviceLibraryItem(item: LibraryItem): LibraryItem {
  return { ...item, detailPath: "" };
}

function normalizeState(value: unknown): LocalLibraryState {
  const raw = asRecord(value);
  if (!raw) return emptyState;
  const itemsRaw = asRecord(raw.items) ?? {};
  const items: Record<string, LibraryItem> = {};
  for (const [key, value] of Object.entries(itemsRaw).slice(0, 1000)) {
    const item = normalizeItem(value);
    if (item) items[key.slice(0, 200)] = item;
  }
  const listsRaw = asRecord(raw.lists) ?? {};
  const lists = Object.fromEntries(LIST_NAMES.map((name) => [
    name,
    Array.isArray(listsRaw[name]) ? listsRaw[name].filter((id): id is string => typeof id === "string" && Boolean(items[id])).slice(0, 1000) : [],
  ])) as LocalLibraryState["lists"];
  const history = Array.isArray(raw.history) ? raw.history.filter((id): id is string => typeof id === "string" && Boolean(items[id])).slice(0, 100) : [];
  const progressRaw = asRecord(raw.progress) ?? {};
  const progress: Record<string, PlaybackProgress> = {};
  for (const [id, value] of Object.entries(progressRaw).slice(0, 500)) {
    const record = asRecord(value);
    if (!items[id] || !record || typeof record.positionSeconds !== "number" || typeof record.durationSeconds !== "number") continue;
    progress[id] = {
      positionSeconds: Math.max(0, record.positionSeconds),
      durationSeconds: Math.max(0, record.durationSeconds),
      updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
    };
  }
  const collectionsRaw = Array.isArray(raw.collections) ? raw.collections : [];
  const collections = collectionsRaw.flatMap((value) => {
    const item = asRecord(value);
    if (typeof item?.id !== "string" || typeof item.name !== "string") return [];
    const itemIds = Array.isArray(item.itemIds) ? item.itemIds.filter((id): id is string => typeof id === "string" && Boolean(items[id])).slice(0, 1000) : [];
    return [{ id: item.id.slice(0, 100), name: item.name.slice(0, 48), itemIds }];
  }).slice(0, 100);
  const preferencesRaw = asRecord(raw.preferences) ?? {};
  const supportedQuality = ["auto", "360p", "480p", "720p", "1080p"] as const;
  const quality = supportedQuality.find((item) => item === preferencesRaw.quality) ?? "auto";
  return {
    items,
    lists,
    history,
    progress,
    collections,
    preferences: {
      quality,
      subtitlesEnabled: preferencesRaw.subtitlesEnabled !== false,
      subtitleLanguage: typeof preferencesRaw.subtitleLanguage === "string" ? preferencesRaw.subtitleLanguage.slice(0, 35) : "device",
    },
  };
}

export function LibraryProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<LocalLibraryState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active && stored) setState(normalizeState(JSON.parse(stored)));
    }).catch(() => {
      // A corrupted or unavailable local store starts with an empty device-only library.
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))).catch(() => undefined);
  }, [state, hydrated]);

  const toggleList = useCallback((list: LibraryListName, item: LibraryItem) => {
    if (!hydrated) return;
    setState((current) => {
      const exists = current.lists[list].includes(item.id);
      return {
        ...current,
        items: { ...current.items, [item.id]: deviceLibraryItem(item) },
        lists: { ...current.lists, [list]: exists ? current.lists[list].filter((id) => id !== item.id) : [item.id, ...current.lists[list]] },
      };
    });
  }, [hydrated]);

  const markWatched = useCallback((item: LibraryItem) => {
    if (!hydrated) return;
    setState((current) => {
      const ids = [item.id, ...current.history.filter((id) => id !== item.id)].slice(0, 100);
      return {
        ...current,
        items: { ...current.items, [item.id]: deviceLibraryItem(item) },
        history: ids,
        lists: { ...current.lists, watched: current.lists.watched.includes(item.id) ? current.lists.watched : [item.id, ...current.lists.watched] },
      };
    });
  }, [hydrated]);

  const recordProgress = useCallback((item: LibraryItem, positionSeconds: number, durationSeconds: number) => {
    if (!hydrated || !Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    setState((current) => ({
      ...current,
      items: { ...current.items, [item.id]: deviceLibraryItem(item) },
      history: [item.id, ...current.history.filter((id) => id !== item.id)].slice(0, 100),
      progress: { ...current.progress, [item.id]: { positionSeconds: Math.max(0, positionSeconds), durationSeconds, updatedAt: Date.now() } },
    }));
  }, [hydrated]);

  const createCollection = useCallback((name: string) => {
    if (!hydrated) return null;
    const trimmed = name.trim().slice(0, 48);
    if (!trimmed) return null;
    const id = `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setState((current) => ({ ...current, collections: [{ id, name: trimmed, itemIds: [] }, ...current.collections].slice(0, 100) }));
    return id;
  }, [hydrated]);

  const toggleCollectionItem = useCallback((collectionId: string, item: LibraryItem) => {
    if (!hydrated) return;
    setState((current) => ({
      ...current,
      items: { ...current.items, [item.id]: deviceLibraryItem(item) },
      collections: current.collections.map((collection) => collection.id !== collectionId ? collection : {
        ...collection,
        itemIds: collection.itemIds.includes(item.id) ? collection.itemIds.filter((id) => id !== item.id) : [item.id, ...collection.itemIds],
      }),
    }));
  }, [hydrated]);

  const updatePreferences = useCallback((preferences: Partial<PlaybackPreferences>) => {
    if (!hydrated) return;
    setState((current) => ({ ...current, preferences: { ...current.preferences, ...preferences } }));
  }, [hydrated]);

  return (
    <LibraryContext.Provider value={{ state, hydrated, toggleList, markWatched, recordProgress, createCollection, toggleCollectionItem, updatePreferences }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary must be used within LibraryProvider");
  return value;
}

export function getListItems(state: LocalLibraryState, list: LibraryListName): LibraryItem[] {
  return state.lists[list].map((id) => state.items[id]).filter((item): item is LibraryItem => Boolean(item));
}

export function getHistoryItems(state: LocalLibraryState): LibraryItem[] {
  return state.history.map((id) => state.items[id]).filter((item): item is LibraryItem => Boolean(item));
}

export function getContinueItems(state: LocalLibraryState): LibraryItem[] {
  return Object.entries(state.progress)
    .sort((first, second) => second[1].updatedAt - first[1].updatedAt)
    .map(([id]) => state.items[id])
    .filter((item): item is LibraryItem => Boolean(item));
}
