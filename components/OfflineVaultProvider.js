'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createOfflineRecordId,
  deleteOfflineVaultRecord,
  getOfflineMediaFileObject,
  getOfflineMediaFileSize,
  getOfflineVaultCapabilities,
  makeOfflineIdentity,
  OFFLINE_CHUNK_BYTES,
  openOfflineVaultDatabase,
  readOfflineVaultRecords,
  removeOfflineMediaFile,
  writeOfflineVaultRecord
} from '../lib/offline-vault';

const OfflineVaultContext = createContext(null);
const isPlayableMime = (value) => /^video\/[a-z0-9.+-]+$/i.test(String(value || '').split(';')[0].trim());
const isStrongEtag = (value) => typeof value === 'string' && /^"[^"\r\n]*"$/.test(value.trim());
const isSeriesTitle = (title) => /series|tv|show/i.test(String(title?.type || ''));
const toPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

function readableError(error, fallback = 'The offline operation could not be completed.') {
  if (error?.name === 'QuotaExceededError') return 'The browser reported that this site exceeded its storage quota. Your device’s free disk space is not measured here.';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'The browser denied access to local offline storage. Check this site’s storage permissions.';
  if (error?.name === 'AbortError') return 'The offline operation was aborted.';
  return typeof error?.message === 'string' && error.message ? error.message : fallback;
}

function safeCoverUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate, typeof location === 'undefined' ? 'https://invalid.local' : location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if ([...url.searchParams.keys()].some((key) => /token|sig(nature)?|auth|key|expires?|credential/i.test(key))) return '';
    return candidate.slice(0, 2000);
  } catch {
    return '';
  }
}

function titleSourceFromToken(detailPath) {
  const parts = String(detailPath || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'bf') return '';
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = typeof atob === 'function' ? atob(base64) : '';
    const payload = JSON.parse(decodeURIComponent(Array.from(bytes, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
    return String(payload?.source || '').toLowerCase();
  } catch {
    return '';
  }
}

function safeIdentityTitle(input, fallbackDetailPath = '') {
  const title = input && typeof input === 'object' ? input : {};
  const detailPath = String(title.detailPath || fallbackDetailPath || '').trim();
  if (String(title.source || '').toLowerCase() !== 'moviebox' || (titleSourceFromToken(detailPath) && titleSourceFromToken(detailPath) !== 'moviebox')) {
    throw new Error('Offline saving is available only for supported, verified titles.');
  }
  if (!detailPath || detailPath.length > 4096) throw new Error('A valid title detail path is required to save offline.');
  return title;
}

function parsePreparedMetadata(payload) {
  const totalBytes = toPositiveInteger(payload?.totalBytes);
  const contentType = String(payload?.contentType || '').trim();
  const strongEtag = isStrongEtag(payload?.strongEtag) ? payload.strongEtag.trim() : '';
  if (!totalBytes) throw new Error('The offline preparation route did not return a valid total byte count.');
  if (!isPlayableMime(contentType)) throw new Error('The prepared file does not advertise a playable video MIME type.');
  return { totalBytes, contentType, strongEtag, rangeSupported: payload?.rangeSupported === true };
}

async function readRouteError(response, routeName) {
  // Do not retain arbitrary route payloads; they must never smuggle a media URL into local metadata.
  return new Error(`${routeName} request failed (HTTP ${response.status}).`);
}

async function getPreparedMetadata(record, signal) {
  const params = new URLSearchParams({ slug: record.detailPath, quality: record.quality });
  if (record.season != null && record.episode != null) {
    params.set('se', String(record.season));
    params.set('ep', String(record.episode));
  }
  const response = await fetch(`/api/offline/prepare?${params.toString()}`, { cache: 'no-store', signal });
  if (!response.ok) throw await readRouteError(response, 'Offline prepare');
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The offline preparation route returned invalid JSON.');
  }
  // Deliberately select only documented fields; unknown fields (including URLs) are discarded.
  return parsePreparedMetadata({
    totalBytes: payload?.totalBytes,
    contentType: payload?.contentType,
    strongEtag: payload?.strongEtag,
    rangeSupported: payload?.rangeSupported
  });
}

function parseContentRange(value) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(String(value || '').trim());
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) };
}

async function openRangeResponse(record, offset, prepared, signal) {
  const params = new URLSearchParams({ slug: record.detailPath, quality: record.quality });
  if (record.season != null && record.episode != null) {
    params.set('se', String(record.season));
    params.set('ep', String(record.episode));
  }
  const response = await fetch(`/api/offline/file?${params.toString()}`, {
    method: 'GET',
    headers: { Range: `bytes=${offset}-` },
    cache: 'no-store',
    signal
  });
  if (!response.ok && response.status !== 206 && !(offset > 0 && response.status === 416)) throw await readRouteError(response, 'Offline file');
  const range = parseContentRange(response.headers.get('Content-Range'));
  const responseEtag = response.headers.get('ETag') || '';
  const responseMime = String(response.headers.get('Content-Type') || '').split(';')[0].trim();
  const versionMatches = response.status === 206 && range?.start === offset && range.end === prepared.totalBytes - 1 && range.total === prepared.totalBytes &&
    isPlayableMime(responseMime) && responseMime.toLowerCase() === prepared.contentType.split(';')[0].trim().toLowerCase() &&
    (!prepared.strongEtag || responseEtag === prepared.strongEtag);
  return { response, range, responseEtag, responseMime, versionMatches };
}

function makeProgressBuffer() {
  return { bytes: new Uint8Array(OFFLINE_CHUNK_BYTES), length: 0 };
}

function putRecordInList(records, record) {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index < 0) return [record, ...records];
  const next = records.slice();
  next[index] = record;
  return next;
}

/**
 * Device-local offline provider. Only small metadata is written to IndexedDB; OPFS holds media bytes.
 * openFile() returns a temporary blob: URL for a completed local media file; callers own its lifecycle.
 */
export function OfflineVaultProvider({ children }) {
  const [records, setRecords] = useState([]);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [support, setSupport] = useState(null);
  const [error, setError] = useState('');
  const databaseRef = useRef(null);
  const recordsRef = useRef([]);
  const jobsRef = useRef(new Map());
  const initPromiseRef = useRef(null);

  const publish = useCallback((record) => {
    recordsRef.current = putRecordInList(recordsRef.current, record);
    setRecords(recordsRef.current);
  }, []);

  const saveMetadata = useCallback(async (record) => {
    if (!databaseRef.current) throw new Error('The local offline metadata database is not ready.');
    await writeOfflineVaultRecord(databaseRef.current, record);
    publish(record);
    return record;
  }, [publish]);

  const refresh = useCallback(async () => {
    if (!databaseRef.current) return [];
    const saved = await readOfflineVaultRecords(databaseRef.current);
    recordsRef.current = saved.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    setRecords(recordsRef.current);
    return recordsRef.current;
  }, []);

  const reconcileStaleTransfers = useCallback(async (savedRecords) => {
    for (const original of savedRecords) {
      if (original.status !== 'downloading') continue;
      let size = null;
      try {
        size = await getOfflineMediaFileSize(original.id);
      } catch (cause) {
        const reconciled = { ...original, status: 'paused', error: readableError(cause), updatedAt: Date.now() };
        await writeOfflineVaultRecord(databaseRef.current, reconciled).catch(() => {});
        continue;
      }
      const complete = size === original.totalBytes && toPositiveInteger(original.totalBytes) === size && isPlayableMime(original.contentType);
      if (complete) {
        const reconciled = { ...original, status: 'complete', receivedBytes: size, committedBytes: size, error: '', updatedAt: Date.now() };
        await writeOfflineVaultRecord(databaseRef.current, reconciled);
        continue;
      }
      if (size != null && size > Number(original.totalBytes || 0)) {
        await removeOfflineMediaFile(original.id).catch(() => {});
        size = 0;
      }
      const actualSize = size || 0;
      const reconciled = {
        ...original,
        status: 'paused',
        receivedBytes: actualSize,
        committedBytes: actualSize,
        error: 'A previous transfer stopped before all verified bytes were committed. Resume to continue, or the app will restart if it cannot safely verify the partial file.',
        updatedAt: Date.now()
      };
      await writeOfflineVaultRecord(databaseRef.current, reconciled);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const capabilities = getOfflineVaultCapabilities();
    const capabilitiesSupported = capabilities.indexedDB && capabilities.opfs && capabilities.readableStreams && capabilities.fetch;
    setSupport(capabilities);
    setSupported(capabilitiesSupported);
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        if (!capabilitiesSupported) {
          throw new Error('Offline saving is unsupported: this browser needs IndexedDB, OPFS, fetch, and readable response streams.');
        }
        databaseRef.current = await openOfflineVaultDatabase();
        const saved = await readOfflineVaultRecords(databaseRef.current);
        await reconcileStaleTransfers(saved);
        return readOfflineVaultRecords(databaseRef.current);
      })();
    }
    initPromiseRef.current.then((current) => {
      if (!alive) return;
      recordsRef.current = current.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
      setRecords(recordsRef.current);
      setError('');
      setReady(true);
    }).catch((cause) => {
      if (alive) {
        setError(readableError(cause, 'The local offline vault could not be opened.'));
        setReady(true);
      }
    });
    return () => { alive = false; };
  }, [reconcileStaleTransfers]);

  const assertReady = useCallback(() => {
    if (!supported || !databaseRef.current) throw new Error(error || 'The local offline vault is not supported or ready in this browser.');
  }, [supported, error]);

  const requestPersistentStorage = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function') await navigator.storage.persist();
    } catch {
      // Persistence is best effort; the browser may still evict site data.
    }
  }, []);

  const checkOriginQuota = useCallback(async (neededBytes) => {
    try {
      const estimate = await navigator.storage.estimate();
      if (Number.isFinite(estimate?.quota) && Number.isFinite(estimate?.usage)) {
        const estimatedAvailable = Math.max(0, estimate.quota - estimate.usage);
        if (neededBytes > estimatedAvailable) {
          throw new Error('The browser-reported estimate for this site origin is below the required file size. This is only an origin-quota estimate, not your device’s free disk space.');
        }
      }
    } catch (cause) {
      if (cause?.message?.includes('origin is below')) throw cause;
      // An estimate is optional and must not block saving in browsers that do not expose it.
    }
  }, []);

  const performTransfer = useCallback(async (startingRecord, job) => {
    let record = { ...startingRecord };
    let writer = null;
    let receivedBytes = Number(record.committedBytes) || 0;
    let committedBytes = receivedBytes;
    let progressBuffer = makeProgressBuffer();
    let quotaChecked = false;

    const updateLive = (patch) => {
      record = { ...record, ...patch, updatedAt: Date.now() };
      publish(record);
    };
    const persistProgress = async () => {
      record = { ...record, receivedBytes, committedBytes, updatedAt: Date.now() };
      await saveMetadata(record);
    };
    const commitChunk = async (buffer) => {
      if (!buffer.length) return;
      if (!writer) throw new Error('The local media file writer is unavailable.');
      await writer.write(buffer);
      committedBytes += buffer.byteLength;
      record = { ...record, receivedBytes, committedBytes, updatedAt: Date.now() };
      await saveMetadata(record);
    };
    const resetPartial = async (message) => {
      if (writer) {
        try { await writer.close(); } catch { /* the underlying file is replaced below */ }
        writer = null;
      }
      await removeOfflineMediaFile(record.id);
      receivedBytes = 0;
      committedBytes = 0;
      progressBuffer = makeProgressBuffer();
      updateLive({ receivedBytes: 0, committedBytes: 0, status: 'downloading', message, error: '' });
      await saveMetadata(record);
    };
    const appendBytes = async (bytes) => {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const available = OFFLINE_CHUNK_BYTES - progressBuffer.length;
        const count = Math.min(available, bytes.byteLength - offset);
        progressBuffer.bytes.set(bytes.subarray(offset, offset + count), progressBuffer.length);
        progressBuffer.length += count;
        offset += count;
        if (progressBuffer.length === OFFLINE_CHUNK_BYTES) {
          const chunk = progressBuffer.bytes;
          progressBuffer = makeProgressBuffer();
          await commitChunk(chunk);
        }
      }
    };

    try {
      updateLive({ status: 'downloading', error: '', updatedAt: Date.now() });
      await saveMetadata(record);
      const prepared = await getPreparedMetadata(record, job.controller.signal);
      const confirmedBytes = toPositiveInteger(record.confirmedBytes);
      if (confirmedBytes && prepared.totalBytes > confirmedBytes) {
        throw new Error('The file size increased after confirmation. Nothing larger was saved; review the new size and confirm again.');
      }
      if (!quotaChecked) {
        const onDisk = await getOfflineMediaFileSize(record.id);
        await checkOriginQuota(Math.max(0, prepared.totalBytes - (onDisk || 0)));
        quotaChecked = true;
      }
      await requestPersistentStorage();

      let fileSize = await getOfflineMediaFileSize(record.id);
      const recordHasMatchingVersion = record.strongEtag && prepared.strongEtag && record.strongEtag === prepared.strongEtag &&
        Number(record.totalBytes) === prepared.totalBytes && prepared.rangeSupported;
      let canResume = recordHasMatchingVersion && fileSize > 0 && fileSize < prepared.totalBytes && fileSize === Number(record.committedBytes);
      let resumeMessage = '';
      if (fileSize === prepared.totalBytes && isPlayableMime(prepared.contentType)) {
        record = { ...record, status: 'complete', totalBytes: prepared.totalBytes, contentType: prepared.contentType, strongEtag: prepared.strongEtag, receivedBytes: fileSize, committedBytes: fileSize, error: '', message: 'The verified local file was already complete.', updatedAt: Date.now() };
        await saveMetadata(record);
        return record;
      }
      if (fileSize > 0 && !canResume) {
        resumeMessage = 'This partial file could not be safely resumed because a matching strong ETag, total size, or byte range was unavailable. The partial bytes were removed and the transfer restarted from the beginning.';
        await resetPartial(resumeMessage);
        await checkOriginQuota(prepared.totalBytes);
        fileSize = 0;
      }
      if (fileSize == null) fileSize = 0;

      // Resume is allowed only with a matching strong validator, total size, and Range support.
      let offset = canResume ? fileSize : 0;
      let opened = await openRangeResponse(record, offset, prepared, job.controller.signal);
      if (!opened.versionMatches && offset > 0) {
        try { await opened.response.body?.cancel(); } catch { /* discard an untrusted response body */ }
        const message = 'The server’s range response no longer matched the saved file validator and total size. The partial file was safely removed and restarted from byte zero.';
        await resetPartial(message);
        await checkOriginQuota(prepared.totalBytes);
        offset = 0;
        opened = await openRangeResponse(record, 0, prepared, job.controller.signal);
      }
      if (!opened.versionMatches) {
        try { await opened.response.body?.cancel(); } catch { /* discard an invalid body */ }
        throw new Error('The offline file response did not match the prepared MIME type, byte range, total size, or ETag. No unverified bytes were committed.');
      }
      if (!quotaChecked && offset === 0) await checkOriginQuota(prepared.totalBytes);

      const fileHandle = await getOfflineMediaFile(record.id, { create: true });
      writer = await fileHandle.createWritable(offset > 0 ? { keepExistingData: true } : { keepExistingData: false });
      if (offset > 0) await writer.seek(offset);
      receivedBytes = offset;
      committedBytes = offset;
      record = {
        ...record,
        status: 'downloading',
        totalBytes: prepared.totalBytes,
        contentType: prepared.contentType,
        strongEtag: prepared.strongEtag,
        rangeSupported: prepared.rangeSupported,
        receivedBytes,
        committedBytes,
        error: '',
        message: resumeMessage || (offset ? 'Resumed from the last committed OPFS byte using a matching strong ETag and total size.' : ''),
        updatedAt: Date.now()
      };
      await saveMetadata(record);

      const reader = opened.response.body?.getReader();
      if (!reader) throw new Error('The offline file response has no readable streaming body.');
      try {
        while (true) {
          if (job.action) throw new DOMException('Transfer stopped by the user.', 'AbortError');
          const { value, done } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          receivedBytes += value.byteLength;
          if (receivedBytes > prepared.totalBytes) throw new Error('The offline stream exceeded its validated total size; extra bytes were discarded.');
          await appendBytes(value);
          updateLive({ receivedBytes, committedBytes, status: 'downloading' });
        }
      } finally {
        try { reader.releaseLock(); } catch { /* lock may already be released */ }
      }
      if (progressBuffer.length) {
        const finalChunk = progressBuffer.bytes.slice(0, progressBuffer.length);
        progressBuffer = makeProgressBuffer();
        await commitChunk(finalChunk);
      }
      if (job.action) throw new DOMException('Transfer stopped by the user.', 'AbortError');
      if (receivedBytes !== prepared.totalBytes || committedBytes !== prepared.totalBytes) {
        throw new Error(`The stream ended at ${committedBytes} committed of ${prepared.totalBytes} validated bytes. The partial file remains available only for a verified resume.`);
      }
      if (!isPlayableMime(prepared.contentType)) throw new Error('The saved file MIME type is not playable.');
      if (writer) {
        await writer.close();
        writer = null;
      }
      const savedSize = await getOfflineMediaFileSize(record.id);
      if (savedSize !== prepared.totalBytes) throw new Error('The OPFS file size did not match the validated total after writing; it was not marked complete.');
      record = { ...record, status: 'complete', receivedBytes: savedSize, committedBytes: savedSize, totalBytes: prepared.totalBytes, error: '', message: 'Offline file saved on this device in this browser profile.', updatedAt: Date.now() };
      await saveMetadata(record);
      setError('');
      return record;
    } catch (cause) {
      if (writer) {
        try { await writer.close(); } catch { /* close may fail after quota or abort */ }
        writer = null;
      }
      const action = job.action;
      if (action === 'cancel') {
        await removeOfflineMediaFile(record.id).catch(() => {});
        record = { ...record, status: 'cancelled', receivedBytes: 0, committedBytes: 0, error: '', message: 'Transfer cancelled; partial local media bytes were deleted.', updatedAt: Date.now() };
        await saveMetadata(record).catch(() => {});
        return record;
      }
      if (action === 'pause') {
        const size = await getOfflineMediaFileSize(record.id).catch(() => null);
        const durableBytes = size || 0;
        record = { ...record, status: 'paused', receivedBytes: durableBytes, committedBytes: durableBytes, error: '', message: 'Transfer paused. Only committed OPFS bytes are retained.', updatedAt: Date.now() };
        await saveMetadata(record).catch(() => {});
        return record;
      }
      const message = readableError(cause, 'The offline transfer failed.');
      const size = await getOfflineMediaFileSize(record.id).catch(() => null);
      const durableBytes = size || 0;
      const recoverable = durableBytes > 0 && cause?.name !== 'QuotaExceededError';
      record = {
        ...record,
        status: recoverable ? 'paused' : 'failed',
        receivedBytes: durableBytes,
        committedBytes: durableBytes,
        error: message,
        message: cause?.name === 'QuotaExceededError' ? 'Storage quota was reached. The saved OPFS chunks were retained; free site storage or delete files before trying again.' : '',
        updatedAt: Date.now()
      };
      await saveMetadata(record).catch(() => {});
      setError(message);
      throw new Error(message);
    }
  }, [checkOriginQuota, publish, requestPersistentStorage, saveMetadata]);

  const startTransfer = useCallback((record) => {
    const existing = jobsRef.current.get(record.id);
    if (existing) return existing.task;
    const job = { controller: new AbortController(), action: '', task: null };
    const task = Promise.resolve().then(() => performTransfer(record, job));
    job.task = task;
    jobsRef.current.set(record.id, job);
    task.finally(() => {
      if (jobsRef.current.get(record.id) === job) jobsRef.current.delete(record.id);
    }).catch(() => {});
    return task;
  }, [performTransfer]);

  const saveOffline = useCallback(async ({ title, detailPath, coverUrl, quality = '720p', season, episode, confirmedBytes } = {}) => {
    assertReady();
    const input = safeIdentityTitle(title, detailPath);
    const path = String(detailPath || input.detailPath || '').trim();
    if (!path || path !== String(input.detailPath || path).trim()) throw new Error('The supplied title details could not be verified.');
    const series = isSeriesTitle(input);
    const seasonNumber = season == null ? null : Number(season);
    const episodeNumber = episode == null ? null : Number(episode);
    if (series && (!Number.isInteger(seasonNumber) || seasonNumber <= 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0)) {
      throw new Error('Saving a series requires a positive season and episode number.');
    }
    if (!series && ((seasonNumber != null && (!Number.isInteger(seasonNumber) || seasonNumber <= 0)) || (episodeNumber != null && (!Number.isInteger(episodeNumber) || episodeNumber <= 0)))) {
      throw new Error('Season and episode values must be positive integers.');
    }
    if ((seasonNumber == null) !== (episodeNumber == null)) throw new Error('Season and episode must be provided together.');
    const selectedQuality = String(quality || '720p').trim().slice(0, 24);
    if (!selectedQuality) throw new Error('A download quality is required.');
    const confirmedSize = confirmedBytes == null ? 0 : toPositiveInteger(confirmedBytes);
    if (confirmedBytes != null && !confirmedSize) throw new Error('The confirmed media size is invalid.');
    const identity = makeOfflineIdentity({ detailPath: path, quality: selectedQuality, season: seasonNumber, episode: episodeNumber });
    const existing = recordsRef.current.find((record) => record.identity === identity);
    if (existing?.status === 'complete' || existing?.status === 'downloading') return existing?.status === 'downloading' ? (jobsRef.current.get(existing.id)?.task || existing) : existing;
    const now = Date.now();
    const record = {
      ...(existing || {}),
      id: existing?.id || createOfflineRecordId(),
      identity,
      title: String(input.title || input.name || 'Untitled').trim().slice(0, 300),
      detailPath: path,
      coverUrl: safeCoverUrl(coverUrl || input.coverUrl || input.cover?.url || input.cover),
      source: 'moviebox',
      type: String(input.type || 'movie').slice(0, 40),
      quality: selectedQuality,
      confirmedBytes: confirmedSize || Number(existing?.confirmedBytes) || 0,
      season: seasonNumber,
      episode: episodeNumber,
      status: 'downloading',
      totalBytes: Number(existing?.totalBytes) || 0,
      contentType: String(existing?.contentType || ''),
      strongEtag: String(existing?.strongEtag || ''),
      rangeSupported: Boolean(existing?.rangeSupported),
      receivedBytes: Number(existing?.committedBytes) || 0,
      committedBytes: Number(existing?.committedBytes) || 0,
      error: '',
      message: '',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await saveMetadata(record);
    return startTransfer(record);
  }, [assertReady, saveMetadata, startTransfer]);

  const pause = useCallback(async (id) => {
    const job = jobsRef.current.get(id);
    if (job) {
      job.action = 'pause';
      job.controller.abort();
      return job.task;
    }
    const record = recordsRef.current.find((entry) => entry.id === id);
    if (!record) throw new Error('Offline record not found.');
    const size = await getOfflineMediaFileSize(id).catch(() => null);
    const paused = { ...record, status: 'paused', receivedBytes: size || 0, committedBytes: size || 0, updatedAt: Date.now(), message: 'Transfer paused. Only committed OPFS bytes are retained.' };
    return saveMetadata(paused);
  }, [saveMetadata]);

  const resume = useCallback(async (id) => {
    assertReady();
    const record = recordsRef.current.find((entry) => entry.id === id);
    if (!record) throw new Error('Offline record not found.');
    if (record.status === 'complete') return record;
    if (record.status === 'downloading') return jobsRef.current.get(id)?.task || record;
    return startTransfer({ ...record, status: 'downloading', error: '' });
  }, [assertReady, startTransfer]);

  const cancel = useCallback(async (id) => {
    const job = jobsRef.current.get(id);
    if (job) {
      job.action = 'cancel';
      job.controller.abort();
      await job.task.catch(() => {});
    }
    const record = recordsRef.current.find((entry) => entry.id === id);
    if (!record) return false;
    await removeOfflineMediaFile(id);
    await saveMetadata({ ...record, status: 'cancelled', receivedBytes: 0, committedBytes: 0, error: '', message: 'Transfer cancelled; partial local media bytes were deleted.', updatedAt: Date.now() });
    return true;
  }, [saveMetadata]);

  const deleteRecord = useCallback(async (id) => {
    const job = jobsRef.current.get(id);
    if (job) {
      job.action = 'cancel';
      job.controller.abort();
      await job.task.catch(() => {});
    }
    await removeOfflineMediaFile(id);
    if (databaseRef.current) await deleteOfflineVaultRecord(databaseRef.current, id);
    recordsRef.current = recordsRef.current.filter((record) => record.id !== id);
    setRecords(recordsRef.current);
    return true;
  }, []);

  const openFile = useCallback(async (id) => {
    assertReady();
    const record = recordsRef.current.find((entry) => entry.id === id);
    if (!record || record.status !== 'complete' || !isPlayableMime(record.contentType)) throw new Error('Only a completed, playable offline video can be opened.');
    const file = await getOfflineMediaFileObject(id);
    if (file.size !== Number(record.totalBytes)) throw new Error('The local file size no longer matches its validated total; refresh the offline library before opening it.');
    return URL.createObjectURL(file);
  }, [assertReady]);

  const value = useMemo(() => ({
    records,
    ready,
    supported,
    support,
    error,
    saveOffline,
    pause,
    resume,
    cancel,
    delete: deleteRecord,
    deleteRecord,
    openFile,
    refresh
  }), [records, ready, supported, support, error, saveOffline, pause, resume, cancel, deleteRecord, openFile, refresh]);

  return <OfflineVaultContext.Provider value={value}>{children}</OfflineVaultContext.Provider>;
}

/** Access the local offline-vault context. */
export function useOfflineVault() {
  const value = useContext(OfflineVaultContext);
  if (!value) throw new Error('useOfflineVault must be used inside OfflineVaultProvider.');
  return value;
}
