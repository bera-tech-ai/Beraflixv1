'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'beraflix.shelf.v1';
const emptyState = {
  version: 1,
  watchlist: [],
  favorites: [],
  liked: [],
  watched: [],
  history: [],
  continueWatching: [],
  collections: [],
  downloads: [],
  profile: { displayName: '' },
  preferences: { quality: 'auto', saveProgress: true, autoplay: false, autoCleanup: false }
};

const identity = (item) => {
  const path = item?.detailPath || '';
  if (!path) return '';
  const season = Number(item?.season);
  const episode = Number(item?.episode);
  return Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0 ? `${path}::S${season}E${episode}` : path;
};

const compact = (item) => ({
  title: item.title,
  genre: item.genre || '',
  cover: item.cover || null,
  backdrop: item.backdrop || null,
  imdbRatingValue: item.imdbRatingValue || '',
  detailPath: item.detailPath,
  description: item.description || '',
  releaseDate: item.releaseDate || '',
  duration: Number(item.duration) || 0,
  countryName: item.countryName || '',
  subjectId: item.subjectId || item.contentId || '',
  contentId: item.contentId || item.subjectId || '',
  lookupId: item.lookupId || '',
  source: item.source || '',
  sourceLabel: item.sourceLabel || '',
  type: item.type || 'movie',
  hasResource: Boolean(item.hasResource),
  ...(Number(item.season) > 0 ? { season: Number(item.season) } : {}),
  ...(Number(item.episode) > 0 ? { episode: Number(item.episode) } : {})
});

function normalizeState(value) {
  if (!value || typeof value !== 'object') return emptyState;
  const supportedTitles = (items) => Array.isArray(items) ? items.filter((item) => ['moviebox', 'anime'].includes(String(item?.source || '').toLowerCase())) : [];
  const movieBoxDownloads = (items) => Array.isArray(items) ? items.filter((item) => String(item?.source || '').toLowerCase() === 'moviebox') : [];
  return {
    ...emptyState,
    ...value,
    profile: { ...emptyState.profile, ...(value.profile || {}) },
    preferences: { ...emptyState.preferences, ...(value.preferences || {}) },
    watchlist: supportedTitles(value.watchlist),
    favorites: supportedTitles(value.favorites),
    liked: supportedTitles(value.liked),
    watched: supportedTitles(value.watched),
    history: supportedTitles(value.history),
    continueWatching: supportedTitles(value.continueWatching),
    collections: Array.isArray(value.collections) ? value.collections.map((collection) => ({ ...collection, items: supportedTitles(collection.items) })) : [],
    downloads: movieBoxDownloads(value.downloads)
  };
}

const ShelfContext = createContext(null);

export function ShelfProvider({ children }) {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(normalizeState(JSON.parse(saved)));
    } catch {
      setStorageWarning('This browser could not read the saved shelf. Changes may not persist.');
    }
    setReady(true);

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        setState(event.newValue ? normalizeState(JSON.parse(event.newValue)) : emptyState);
      } catch {
        setStorageWarning('A shelf update from another tab could not be loaded.');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageWarning('');
    } catch {
      setStorageWarning('Browser storage is full or unavailable. Your latest change may not persist.');
    }
  }, [state, ready]);

  const has = useCallback((list, item) => (state[list] || []).some((entry) => identity(entry) === identity(item)), [state]);
  const toggle = useCallback((list, item) => {
    if (!identity(item)) return;
    const saved = compact(item);
    setState((current) => {
      const entries = current[list] || [];
      const exists = entries.some((entry) => identity(entry) === identity(saved));
      const nextEntries = exists ? entries.filter((entry) => identity(entry) !== identity(saved)) : [saved, ...entries];
      const next = { ...current, [list]: nextEntries };
      if (list === 'watched' && !exists) next.continueWatching = current.continueWatching.filter((entry) => identity(entry) !== identity(saved));
      return next;
    });
  }, []);

  const addHistory = useCallback((item) => {
    if (!identity(item)) return;
    const entry = { ...compact(item), openedAt: Date.now() };
    setState((current) => ({ ...current, history: [entry, ...current.history.filter((saved) => identity(saved) !== identity(entry))].slice(0, 200) }));
  }, []);

  const removeHistory = useCallback((target) => {
    const key = typeof target === 'string' ? target : identity(target);
    if (!key) return;
    setState((current) => ({ ...current, history: current.history.filter((item) => identity(item) !== key && !(typeof target === 'string' && item.detailPath === target)) }));
  }, []);

  const removeProgress = useCallback((target) => {
    const key = typeof target === 'string' ? target : identity(target);
    if (!key) return;
    setState((current) => ({ ...current, continueWatching: current.continueWatching.filter((item) => identity(item) !== key && !(typeof target === 'string' && item.detailPath === target)) }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((current) => ({ ...current, history: [] }));
  }, []);

  const saveProgress = useCallback((item, position, duration) => {
    if (!identity(item) || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
    const percent = Math.max(0, Math.min(100, (position / duration) * 100));
    const saved = { ...compact(item), position, duration, percent, updatedAt: Date.now() };
    const episodeKey = identity(saved);
    setState((current) => {
      const historyEntry = { ...compact(item), openedAt: Date.now() };
      const history = [historyEntry, ...current.history.filter((entry) => identity(entry) !== episodeKey)].slice(0, 200);
      if (percent >= 96) {
        const watched = current.watched.some((entry) => identity(entry) === episodeKey) ? current.watched : [compact(item), ...current.watched];
        return { ...current, history, watched, continueWatching: current.continueWatching.filter((entry) => identity(entry) !== episodeKey) };
      }
      const continueWatching = [saved, ...current.continueWatching.filter((entry) => identity(entry) !== episodeKey)].slice(0, 50);
      return { ...current, history, continueWatching };
    });
  }, []);

  const addDownloadRequest = useCallback((item, options = {}) => {
    if (!identity(item) || !item.hasResource) return '';
    const id = options.id || globalThis.crypto?.randomUUID?.() || `download-${Date.now()}`;
    const record = {
      ...compact({ ...item, season: options.season ?? item.season, episode: options.episode ?? item.episode }),
      id,
      status: options.status || 'prepared',
      requestedAt: Date.now(),
      expiresAt: options.expiresAt || '',
      quality: options.quality || 'auto',
      errorMessage: options.errorMessage || ''
    };
    setState((current) => ({ ...current, downloads: [record, ...current.downloads.filter((entry) => entry.id !== id)].slice(0, 100) }));
    return id;
  }, []);

  const updateDownloadRequest = useCallback((id, status) => {
    const allowed = new Set(['prepared', 'handed-off', 'failed', 'expired']);
    if (!id || !allowed.has(status)) return;
    setState((current) => ({ ...current, downloads: current.downloads.map((entry) => entry.id === id ? { ...entry, status, updatedAt: Date.now() } : entry) }));
  }, []);

  const removeDownloadRequest = useCallback((id) => {
    setState((current) => ({ ...current, downloads: current.downloads.filter((entry) => entry.id !== id) }));
  }, []);

  const clearDownloadRequests = useCallback(() => {
    setState((current) => ({ ...current, downloads: [] }));
  }, []);

  const createCollection = useCallback((name) => {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return false;
    setState((current) => {
      if (current.collections.some((collection) => collection.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return current;
      const id = globalThis.crypto?.randomUUID?.() || `collection-${Date.now()}`;
      return { ...current, collections: [...current.collections, { id, name: clean, items: [] }] };
    });
    return true;
  }, []);

  const renameCollection = useCallback((id, name) => {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return;
    setState((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === id ? { ...collection, name: clean } : collection) }));
  }, []);

  const deleteCollection = useCallback((id) => {
    setState((current) => ({ ...current, collections: current.collections.filter((collection) => collection.id !== id) }));
  }, []);

  const toggleCollectionItem = useCallback((id, item) => {
    if (!identity(item)) return;
    const saved = compact(item);
    setState((current) => ({
      ...current,
      collections: current.collections.map((collection) => {
        if (collection.id !== id) return collection;
        const exists = collection.items.some((entry) => identity(entry) === identity(saved));
        return { ...collection, items: exists ? collection.items.filter((entry) => identity(entry) !== identity(saved)) : [saved, ...collection.items] };
      })
    }));
  }, []);

  const setProfile = useCallback((patch) => {
    setState((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  }, []);

  const setPreference = useCallback((key, value) => {
    setState((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  }, []);

  const value = useMemo(() => ({
    state, ready, storageWarning, has, toggle, addHistory, removeHistory, removeProgress, clearHistory, saveProgress,
    addDownloadRequest, updateDownloadRequest, removeDownloadRequest, clearDownloadRequests,
    createCollection, renameCollection, deleteCollection, toggleCollectionItem, setProfile, setPreference
  }), [state, ready, storageWarning, has, toggle, addHistory, removeHistory, removeProgress, clearHistory, saveProgress, addDownloadRequest, updateDownloadRequest, removeDownloadRequest, clearDownloadRequests, createCollection, renameCollection, deleteCollection, toggleCollectionItem, setProfile, setPreference]);

  return <ShelfContext.Provider value={value}>{children}</ShelfContext.Provider>;
}

export function useShelf() {
  const value = useContext(ShelfContext);
  if (!value) throw new Error('useShelf must be used inside ShelfProvider');
  return value;
}
