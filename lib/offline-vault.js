/**
 * Device-local offline vault primitives.
 * IndexedDB is intentionally limited to small JSON metadata; media bytes belong in OPFS.
 */
export const OFFLINE_DB_NAME = 'beraflix-offline-vault';
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_RECORDS_STORE = 'records';
export const OFFLINE_OPFS_DIRECTORY = 'beraflix-offline-vault';
export const OFFLINE_CHUNK_BYTES = 8 * 1024 * 1024;

const text = (value) => (value == null ? '' : String(value).trim());

/** Stable duplicate identity: title detail path + quality + episode (if any). */
export function makeOfflineIdentity({ detailPath, quality, season, episode } = {}) {
  const path = text(detailPath);
  const selectedQuality = text(quality || '720p').toLowerCase();
  if (!path) return '';
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const hasEpisode = Number.isInteger(seasonNumber) && seasonNumber > 0 && Number.isInteger(episodeNumber) && episodeNumber > 0;
  return `${path}::${selectedQuality}::${hasEpisode ? `S${seasonNumber}E${episodeNumber}` : 'movie'}`;
}

/** Feature detection only; quota figures are not device-free-space measurements. */
export function getOfflineVaultCapabilities() {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
  return {
    indexedDB: typeof indexedDB !== 'undefined',
    opfs: Boolean(storage && typeof storage.getDirectory === 'function'),
    readableStreams: typeof ReadableStream !== 'undefined' && typeof Response !== 'undefined' && 'body' in Response.prototype,
    fetch: typeof fetch === 'function',
    persistenceRequest: Boolean(storage && typeof storage.persist === 'function'),
    quotaEstimate: Boolean(storage && typeof storage.estimate === 'function')
  };
}

/** Open the metadata-only database. No media blobs or temporary URLs are stored here. */
export function openOfflineVaultDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not supported in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OFFLINE_RECORDS_STORE)) {
        database.createObjectStore(OFFLINE_RECORDS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the local offline metadata database.'));
    request.onblocked = () => reject(new Error('The local offline database upgrade is blocked by another open tab.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The local offline metadata request failed.'));
  });
}

/** Return a copy of small metadata records from IndexedDB. */
export async function readOfflineVaultRecords(database) {
  const transaction = database.transaction(OFFLINE_RECORDS_STORE, 'readonly');
  return requestResult(transaction.objectStore(OFFLINE_RECORDS_STORE).getAll());
}

/** Persist a metadata-only record. Caller must not add media blobs or signed URLs. */
export async function writeOfflineVaultRecord(database, record) {
  const transaction = database.transaction(OFFLINE_RECORDS_STORE, 'readwrite');
  const done = new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save offline metadata.'));
    transaction.onabort = () => reject(transaction.error || new Error('Saving offline metadata was aborted.'));
  });
  transaction.objectStore(OFFLINE_RECORDS_STORE).put(record);
  await done;
  return record;
}

/** Remove metadata by record id. */
export async function deleteOfflineVaultRecord(database, id) {
  const transaction = database.transaction(OFFLINE_RECORDS_STORE, 'readwrite');
  const done = new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove offline metadata.'));
    transaction.onabort = () => reject(transaction.error || new Error('Removing offline metadata was aborted.'));
  });
  transaction.objectStore(OFFLINE_RECORDS_STORE).delete(id);
  await done;
}

/** Create a collision-resistant, path-safe local record/file id. */
export function createOfflineRecordId() {
  return globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Resolve this vault's OPFS directory, creating it only on explicit save. */
export async function getOfflineVaultDirectory({ create = false } = {}) {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
  if (!storage || typeof storage.getDirectory !== 'function') throw new Error('Origin Private File System (OPFS) is not supported in this browser.');
  const root = await storage.getDirectory();
  if (!create) return root.getDirectoryHandle(OFFLINE_OPFS_DIRECTORY, { create: false });
  return root.getDirectoryHandle(OFFLINE_OPFS_DIRECTORY, { create: true });
}

/** Obtain the OPFS media file handle for a vault record. */
export async function getOfflineMediaFile(id, { create = false } = {}) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(String(id || ''))) throw new Error('Invalid local offline record id.');
  const directory = await getOfflineVaultDirectory({ create });
  return directory.getFileHandle(`${id}.media`, { create });
}

/** Find current committed file size; returns null when the OPFS file is absent. */
export async function getOfflineMediaFileSize(id) {
  try {
    const handle = await getOfflineMediaFile(id);
    return (await handle.getFile()).size;
  } catch (error) {
    if (error?.name === 'NotFoundError') return null;
    throw error;
  }
}

/** Delete OPFS bytes for an id, ignoring an already-missing file. */
export async function removeOfflineMediaFile(id) {
  try {
    const directory = await getOfflineVaultDirectory();
    await directory.removeEntry(`${id}.media`);
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error;
  }
}

/** Return a local File only; it is never copied into IndexedDB or localStorage. */
export async function getOfflineMediaFileObject(id) {
  const handle = await getOfflineMediaFile(id);
  return handle.getFile();
}
