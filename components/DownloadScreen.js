'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, Download, HardDrive, Link2, Pause, Play, RotateCcw, ShieldCheck, Trash2, X, XCircle } from 'lucide-react';
import NoticeCard from './NoticeCard';
import DownloadButton from './DownloadButton';
import { useShelf } from './ShelfProvider';
import { useOfflineVault } from './OfflineVaultProvider';

const filters = ['All', 'Downloading', 'Paused', 'Completed', 'Failed'];
const requestStatusLabel = (item) => ({
  prepared: 'Link prepared · transfer not confirmed',
  'handed-off': 'Handed to browser · status not visible here',
  failed: item.errorMessage ? `Link request failed · ${item.errorMessage}` : 'Link request failed',
  expired: 'Signed link expired · prepare a fresh one'
}[item.status] || `Status: ${item.status || 'unknown'}`);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(1)} ${units[index]}`;
}

function matchesFilter(record, filter) {
  if (filter === 'All') return true;
  if (filter === 'Downloading') return record.status === 'downloading';
  if (filter === 'Paused') return ['paused', 'cancelled'].includes(record.status);
  if (filter === 'Completed') return record.status === 'complete';
  if (filter === 'Failed') return record.status === 'failed';
  return false;
}

export default function DownloadScreen() {
  const { state, ready: shelfReady, removeDownloadRequest, clearDownloadRequests } = useShelf();
  const {
    records,
    ready: vaultReady,
    supported: vaultSupported,
    error: vaultError,
    pause,
    resume,
    cancel,
    deleteRecord,
    openFile,
    refresh
  } = useOfflineVault();
  const [filter, setFilter] = useState('All');
  const [storage, setStorage] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionBusyId, setActionBusyId] = useState('');
  const [playing, setPlaying] = useState(null);
  const [autoCleanup, setAutoCleanup] = useState(false);
  const cleanupStarted = useRef(false);
  const requestRecords = state.downloads || [];

  useEffect(() => {
    let cancelled = false;
    if (navigator.storage?.estimate) navigator.storage.estimate().then((estimate) => { if (!cancelled) setStorage(estimate); }).catch(() => {});
    return () => { cancelled = true; };
  }, [records.length]);

  useEffect(() => {
    try { setAutoCleanup(window.localStorage.getItem('beraflix-offline-cleanup') === 'incomplete-30d'); } catch { setAutoCleanup(false); }
  }, []);

  useEffect(() => {
    if (!playing?.url) return undefined;
    return () => URL.revokeObjectURL(playing.url);
  }, [playing?.url]);

  const visible = useMemo(() => records.filter((record) => matchesFilter(record, filter)), [records, filter]);
  const countFor = (name) => name === 'All' ? records.length : records.filter((record) => matchesFilter(record, name)).length;
  const completedCount = records.filter((record) => record.status === 'complete').length;

  async function runAction(id, action) {
    setActionError('');
    setActionBusyId(id);
    try {
      await action();
      await refresh();
    } catch (error) {
      setActionError(error?.message || 'The local offline action could not be completed.');
    } finally {
      setActionBusyId('');
    }
  }

  async function playOffline(record) {
    setActionError('');
    setActionBusyId(record.id);
    try {
      const url = await openFile(record.id);
      setPlaying({ id: record.id, title: record.title, url });
    } catch (error) {
      setActionError(error?.message || 'This local file could not be opened.');
    } finally {
      setActionBusyId('');
    }
  }

  function clearRequests() {
    if (window.confirm('Clear BERAFLIX browser-link request records? This does not delete local offline files or files in your device Downloads.')) clearDownloadRequests();
  }

  const cleanupIncomplete = useCallback(async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const eligible = records.filter((record) => ['paused', 'failed', 'cancelled'].includes(record.status) && Number(record.updatedAt || record.createdAt || 0) < cutoff);
    for (const record of eligible) await deleteRecord(record.id);
    if (eligible.length) await refresh();
    return eligible.length;
  }, [records, deleteRecord, refresh]);

  async function toggleAutoCleanup(event) {
    const next = event.target.checked;
    if (next && !window.confirm('Enable cleanup of incomplete BERAFLIX offline files and partial records older than 30 days? Completed offline files will never be removed automatically. Files managed by the browser Downloads app are outside this setting.')) {
      event.target.checked = false;
      return;
    }
    setAutoCleanup(next);
    cleanupStarted.current = false;
    try { window.localStorage.setItem('beraflix-offline-cleanup', next ? 'incomplete-30d' : 'off'); } catch { /* local cleanup preference is best effort */ }
  }

  useEffect(() => {
    if (!autoCleanup || !vaultReady || cleanupStarted.current) return;
    cleanupStarted.current = true;
    cleanupIncomplete().catch((error) => setActionError(error?.message || 'Automatic cleanup could not finish.'));
  }, [autoCleanup, vaultReady, cleanupIncomplete]);

  return <main className="page-inner screen-page downloads-page">
    <div className="screen-heading"><div><span className="section-kicker">YOUR DEVICE · PRIVATE STORAGE</span><h1>Downloads</h1><p>Save supported titles to this browser profile for offline playback when a verified transfer is available.</p></div><span className="heading-mark"><Download size={21} /></span></div>

    <section className="settings-card offline-vault-overview" aria-label="Local offline storage status">
      <div className="settings-title"><span className="settings-icon"><HardDrive size={18} /></span><div><h2>Local offline vault</h2><p>Device-local only. No cloud movie database or cross-device file sync.</p></div></div>
      {!vaultReady && <p className="offline-vault-status" role="status">Checking this browser’s local storage support.</p>}
      {vaultReady && !vaultSupported && <p className="offline-vault-status offline-vault-warning" role="status">Offline file saving is unavailable in this browser. It needs IndexedDB, OPFS, and streaming fetch support. {vaultError}</p>}
      {vaultReady && vaultSupported && <p className="offline-vault-status" role="status">Local vault is ready · {completedCount} completed {completedCount === 1 ? 'file' : 'files'}.</p>}
      {actionError && <p className="offline-vault-error" role="alert">{actionError}</p>}
      {storage?.quota ? <div className="offline-storage-estimate"><b>Site-origin estimate</b><span>{formatBytes(storage.usage || 0)} used of {formatBytes(storage.quota)} estimated quota</span><small>This covers all site data, not just movies; it is not device free space and is not a guaranteed reservation.</small></div> : <p className="offline-storage-estimate">This browser does not provide a storage estimate.</p>}
      <label className="offline-cleanup-setting"><input type="checkbox" checked={autoCleanup} onChange={toggleAutoCleanup} /> Remove incomplete offline files and partial records older than 30 days when Downloads opens. Completed files are never auto-deleted.</label>
    </section>

    <section className="offline-vault-section" aria-labelledby="offline-vault-heading">
      <div className="download-section-heading"><div><span className="section-kicker">SAVED ON THIS DEVICE</span><h2 id="offline-vault-heading">Offline files</h2></div><span className="download-count">{records.length}</span></div>
      <div className="download-tabs" role="tablist" aria-label="Filter offline files">{filters.map((name) => <button type="button" role="tab" aria-selected={filter === name} key={name} onClick={() => setFilter(name)} className={filter === name ? 'selected' : ''}>{name}<small>{countFor(name)}</small></button>)}</div>
      {visible.length ? <div className="download-list">{visible.map((record) => <OfflineItem
        key={record.id}
        record={record}
        busy={actionBusyId === record.id}
        onPause={() => runAction(record.id, () => pause(record.id))}
        onResume={() => runAction(record.id, () => resume(record.id))}
        onCancel={() => { if (window.confirm('Cancel this transfer and delete its partial local bytes?')) runAction(record.id, () => cancel(record.id)); }}
        onDelete={() => { if (window.confirm(`Delete “${record.title}” from this device’s BERAFLIX offline vault?`)) runAction(record.id, () => deleteRecord(record.id)); }}
        onPlay={() => playOffline(record)}
      />)}</div> : <NoticeCard title={filter === 'All' ? 'No offline files saved yet' : `No ${filter.toLowerCase()} offline files`}>{filter === 'All' ? 'Open a supported title and choose Save Offline. BERAFLIX reports completion only after the verified file is committed locally.' : 'Files appear here only when their local transfer reaches this state.'}</NoticeCard>}
      <p className="offline-vault-caveat">Files stay in this browser profile and may be evicted by the browser or removed if site data is cleared. BERAFLIX cannot browse the device Downloads folder. Large transfers require a stable connection and enough site storage.</p>
    </section>

    <section className="browser-download-section" aria-labelledby="browser-link-heading">
      <div className="download-section-heading"><div><span className="section-kicker">SEPARATE FROM THE OFFLINE VAULT</span><h2 id="browser-link-heading">Browser link requests</h2><p>These records do not track browser-managed file transfer status.</p></div><span className="download-count">{requestRecords.length}</span></div>
      {requestRecords.length ? <div className="download-list">{requestRecords.map((item) => <DownloadItem key={item.id || `${item.detailPath}-${item.season || 0}-${item.episode || 0}`} item={item} onRemove={() => removeDownloadRequest(item.id)} />)}</div> : <NoticeCard title="No browser links prepared">Choose Save Offline for a local copy, or prepare a separate browser download link if you need a file in the device Downloads manager.</NoticeCard>}
      {shelfReady && requestRecords.length > 0 && <button type="button" className="text-button danger-text clear-download-history" onClick={clearRequests}><Trash2 size={15} /> Clear link-request history</button>}
    </section>

    <section className="download-honesty"><div className="honesty-icon"><ShieldCheck size={20} /></div><div><h2>What “saved offline” means</h2><p>Only verified video files saved in this browser profile appear as completed. Bytes stay on this device, not in a cloud database. OPFS quota and browser eviction rules apply; the storage estimate is not device free space. Browser Downloads are a separate device-managed location, and their transfer status and cleanup remain outside BERAFLIX.</p></div></section>

    {playing && <div className="offline-player-overlay" role="dialog" aria-modal="true" aria-label={`Play ${playing.title} offline`}>
      <div className="offline-player-dialog"><div className="offline-player-toolbar"><div><span className="section-kicker">PLAYING FROM THIS DEVICE</span><h2>{playing.title}</h2></div><button type="button" className="icon-button" onClick={() => setPlaying(null)} aria-label="Close offline player"><X size={18} /></button></div><video className="offline-player-video" src={playing.url} controls playsInline autoPlay preload="metadata" aria-label={`${playing.title} offline video`} /></div>
    </div>}

    <Link href="/explore" className="text-link downloads-browse">Browse titles <span>→</span></Link>
  </main>;
}

function OfflineItem({ record, busy, onPause, onResume, onCancel, onDelete, onPlay }) {
  const total = Number(record.totalBytes) || 0;
  const received = Math.max(0, Math.min(Number(record.committedBytes ?? record.receivedBytes) || 0, total || Infinity));
  const percent = total > 0 ? Math.max(0, Math.min(100, Math.floor((received / total) * 100))) : 0;
  const episode = record.season && record.episode ? ` · S${record.season} E${record.episode}` : '';
  const quality = record.quality ? ` · ${record.quality}` : '';
  const status = record.status === 'complete' ? 'Saved offline' : record.status === 'downloading' ? (total ? `Saving · ${formatBytes(received)} of ${formatBytes(total)}` : 'Checking the media size') : record.status === 'paused' ? 'Paused · partial local bytes retained' : record.status === 'failed' ? 'Transfer failed · retry available' : 'Cancelled · no completed file';
  return <article className={`download-item offline-file-item offline-status-${record.status}`}>
    <div className="download-item-art">{record.coverUrl && <Image src={record.coverUrl} alt="" width={52} height={75} unoptimized />}</div>
    <div className="download-item-main">
      <h3>{record.title || 'Untitled video'}{episode}{quality}</h3>
      <p>{record.status === 'complete' ? <CheckCircle2 size={14} /> : record.status === 'failed' ? <XCircle size={14} /> : <Clock3 size={14} />} {status}</p>
      {record.status === 'downloading' && total > 0 && <div className="offline-progress" role="progressbar" aria-label={`${record.title} saved bytes`} aria-valuemin="0" aria-valuemax={total} aria-valuenow={received}><i style={{ width: `${percent}%` }} /></div>}
      {record.message && <small className="download-expiry">{record.message}</small>}
      {record.error && <small className="offline-file-error">{record.error}</small>}
      <div className="download-item-actions">
        {record.status === 'complete' && <button type="button" className="mini-action" onClick={onPlay} disabled={busy}><Play size={13} /> Play offline</button>}
        {record.status === 'downloading' && <button type="button" className="mini-action" onClick={onPause} disabled={busy}><Pause size={13} /> Pause</button>}
        {['paused', 'failed'].includes(record.status) && <button type="button" className="mini-action" onClick={onResume} disabled={busy}><RotateCcw size={13} /> Resume</button>}
        {['downloading', 'paused', 'failed'].includes(record.status) && <button type="button" className="mini-action danger-text" onClick={onCancel} disabled={busy}>Discard partial</button>}
        {record.status !== 'downloading' && <button type="button" className="mini-action danger-text" onClick={onDelete} disabled={busy}><Trash2 size={13} /> Delete local file</button>}
      </div>
    </div>
  </article>;
}

function DownloadItem({ item, onRemove }) {
  const expiryTime = /^\d+$/.test(String(item.expiresAt)) ? Number(item.expiresAt) * 1000 : Date.parse(item.expiresAt);
  const expired = Number.isFinite(expiryTime) && expiryTime > 0 && expiryTime < Date.now();
  const label = expired && item.status === 'prepared' ? 'Signed link expired · prepare a fresh one' : requestStatusLabel(item);
  const StatusIcon = item.status === 'failed' ? XCircle : item.status === 'handed-off' ? CheckCircle2 : item.status === 'expired' || expired ? Clock3 : Link2;
  const episode = item.season && item.episode ? ` · S${item.season} E${item.episode}` : '';
  const quality = item.quality && item.quality !== 'auto' ? ` · ${item.quality}` : '';
  return <article className="download-item browser-request-item">
    <div className="download-item-art">{item.cover?.url && <Image src={item.cover.url} alt="" width={52} height={75} unoptimized />}</div>
    <div className="download-item-main"><h3>{item.title || 'Untitled request'}{episode}{quality}</h3><p><StatusIcon size={14} /> {label}</p>
      {item.expiresAt && Number.isFinite(expiryTime) && <small className="download-expiry">Link expiry: {new Date(expiryTime).toLocaleString()}</small>}
      <div className="download-item-actions"><Link href={`/movie/${encodeURIComponent(item.detailPath)}`} className="mini-action">Title details</Link>{item.hasResource && <DownloadButton movie={item} compact season={item.season} episode={item.episode} />}</div>
    </div>
    <button type="button" className="download-item-delete" onClick={onRemove} aria-label={`Remove ${item.title} link-request record`} title="Remove link-request record only; this does not delete a file"><Trash2 size={17} /></button>
  </article>;
}
