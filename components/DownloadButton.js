'use client';

import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { useShelf } from './ShelfProvider';
import { useOfflineVault } from './OfflineVaultProvider';

function newId() {
  return globalThis.crypto?.randomUUID?.() || `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DownloadButton({ movie, compact = false, season, episode, qualityValue, onQualityChange, hideQualityControl = false, onReadyChange, onHandOff }) {
  const { state, addDownloadRequest, updateDownloadRequest } = useShelf();
  const { records: offlineRecords, ready: vaultReady, supported: vaultSupported, saveOffline } = useOfflineVault();
  const [busy, setBusy] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [ready, setReady] = useState(null);
  const [message, setMessage] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [localQuality, setLocalQuality] = useState('720p');
  const quality = qualityValue ?? localQuality;
  const selectedSeason = season ?? movie?.season;
  const selectedEpisode = episode ?? movie?.episode;
  const isSeries = /series|tv|show/i.test(String(movie?.type || ''));
  const validEpisode = !isSeries || (Number.isInteger(Number(selectedSeason)) && Number(selectedSeason) > 0 && Number.isInteger(Number(selectedEpisode)) && Number(selectedEpisode) > 0);

  async function saveToDevice() {
    if (offlineBusy || busy || !movie?.hasResource) return;
    if (!vaultReady || !vaultSupported) {
      setOfflineMessage('This browser does not expose the local storage needed for offline video. The regular browser download link remains separate.');
      return;
    }
    if (!validEpisode) {
      setOfflineMessage('Select a positive season and episode number first.');
      return;
    }
    const existing = offlineRecords.find((record) => record.detailPath === movie.detailPath && (record.quality || '720p') === quality && Number(record.season || 0) === Number(selectedSeason || 0) && Number(record.episode || 0) === Number(selectedEpisode || 0));
    if (existing?.status === 'complete') {
      setOfflineMessage('This quality and episode are already saved in the local offline vault.');
      return;
    }
    if (existing?.status === 'downloading') {
      setOfflineMessage('This file is already being saved. Check Downloads for its current byte count.');
      return;
    }
    setOfflineBusy(true);
    setOfflineMessage('Checking the file size and preparing local storage.');
    try {
      const params = new URLSearchParams({ slug: movie.detailPath, quality });
      if (selectedSeason != null && selectedEpisode != null) {
        params.set('se', String(selectedSeason));
        params.set('ep', String(selectedEpisode));
      }
      const response = await fetch(`/api/offline/prepare?${params.toString()}`, { cache: 'no-store' });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !Number.isSafeInteger(Number(prepared.totalBytes)) || Number(prepared.totalBytes) < 1) {
        throw new Error(prepared.error || 'The video size could not be verified.');
      }
      const totalBytes = Number(prepared.totalBytes);
      const sizeLabel = totalBytes >= 1024 ** 3 ? `${(totalBytes / 1024 ** 3).toFixed(2)} GB` : `${(totalBytes / 1024 ** 2).toFixed(0)} MB`;
      if (totalBytes >= 512 * 1024 ** 2 && !window.confirm(`This file is about ${sizeLabel}. It will use this website's local storage and may take a long time. The estimate is not device free space, and the browser may still refuse or later evict it. Save this file offline?`)) {
        setOfflineMessage('Offline saving cancelled before media transfer.');
        return;
      }
      setOfflineMessage(`Saving approximately ${sizeLabel} to this browser profile. You can monitor or pause it in Downloads.`);
      const record = await saveOffline({ title: movie, detailPath: movie.detailPath, coverUrl: movie.cover?.url, quality, season: selectedSeason, episode: selectedEpisode, confirmedBytes: totalBytes });
      setOfflineMessage(record?.status === 'complete' ? 'The file is saved in this device’s local offline vault.' : 'Offline transfer started. Check Downloads for the current byte count.');
    } catch (error) {
      const reason = String(error?.message || '');
      const unsupported = /byte range|media format|transfer could not be reached/i.test(reason);
      setOfflineMessage(unsupported ? 'This title and quality could not be verified for in-app offline storage. Try another quality or use the regular browser download; it is not marked as saved.' : reason || 'The offline file could not be saved.');
    } finally {
      setOfflineBusy(false);
    }
  }

  async function prepareDownload() {
    if (busy || !movie?.hasResource) return;
    if (!validEpisode) { setMessage('Enter a positive season and episode number first.'); return; }
    const previous = (state.downloads || []).find((item) => item.detailPath === movie.detailPath && Number(item.season || 0) === Number(selectedSeason || 0) && Number(item.episode || 0) === Number(selectedEpisode || 0) && (item.quality || 'auto') === quality && ['prepared', 'handed-off'].includes(item.status));
    if (previous && !window.confirm(`A ${quality} link for this title${isSeries ? `, S${selectedSeason} E${selectedEpisode}` : ''} was already prepared or sent to your browser. Check your device Downloads first. Prepare another link anyway?`)) return;
    setBusy(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ slug: movie.detailPath });
      params.set('quality', quality);
      if (selectedSeason != null && selectedEpisode != null) {
        params.set('se', String(selectedSeason));
        params.set('ep', String(selectedEpisode));
      }
      const response = await fetch(`/api/download?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'A download link could not be prepared.');
      const signedUrl = new URL(data.url);
      if (signedUrl.protocol !== 'https:') throw new Error('The provider returned an insecure download link.');
      const id = newId();
      addDownloadRequest(movie, { id, status: 'prepared', expiresAt: data.expiresAt || '', quality, season: selectedSeason, episode: selectedEpisode });
      setReady({ id, url: signedUrl.toString(), expiresAt: data.expiresAt || '', quality });
      onReadyChange?.(true);
      setMessage(`A temporary ${quality} link is ready. Files can be large; check your data plan and free storage before handing the attachment to your browser. The link expires shortly.`);
    } catch (error) {
      const id = newId();
      addDownloadRequest(movie, { id, status: 'failed', errorMessage: error?.message || 'The download link could not be issued.', quality, season: selectedSeason, episode: selectedEpisode });
      setMessage(error?.message || 'A download link could not be prepared. Try again later.');
    } finally {
      setBusy(false);
    }
  }

  function startDownload(event) {
    if (!ready) return;
    const expiration = /^\d+$/.test(String(ready.expiresAt)) ? Number(ready.expiresAt) * 1000 : Date.parse(ready.expiresAt);
    if (Number.isFinite(expiration) && expiration > 0 && expiration <= Date.now()) {
      event.preventDefault();
      updateDownloadRequest(ready.id, 'expired');
      setReady(null);
      onReadyChange?.(false);
      setMessage('That signed link expired. Prepare a fresh link to try again.');
      return;
    }
    updateDownloadRequest(ready.id, 'handed-off');
    setReady(null);
    onReadyChange?.(false);
    setMessage('The attachment was handed to your browser. BERAFLIX cannot see transfer progress or completion; check your device Downloads.');
    onHandOff?.({ season: selectedSeason, episode: selectedEpisode, quality: ready.quality });
  }

  return <div className={`download-control ${compact ? 'download-control-compact' : ''}`}>
    {!hideQualityControl && <label className="download-quality-control"><span>Quality</span><select value={quality} onChange={(event) => { const value = event.target.value; if (qualityValue === undefined) setLocalQuality(value); onQualityChange?.(value); setReady(null); onReadyChange?.(false); }} disabled={busy || offlineBusy || Boolean(ready)} aria-label="Download quality"><option value="360p">360p</option><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>}
    {movie?.source === 'moviebox' && movie?.hasResource && <button type="button" className="button button-hot" onClick={saveToDevice} disabled={busy || offlineBusy || !validEpisode}>{offlineBusy ? <><Download size={16} /> Saving offline…</> : <><Download size={16} /> Save Offline</>}</button>}
    {ready ? <a className="button button-hot" href={ready.url} onClick={startDownload}><Download size={16} /> Start {ready.quality}</a> : <button type="button" className="button button-outline" onClick={prepareDownload} disabled={busy || !movie?.hasResource || !validEpisode}>{busy ? <><Download size={16} /> Preparing link…</> : <><Download size={16} /> Prepare {quality}</>}</button>}
    {offlineMessage && <p className="download-message" role="status">{offlineMessage}</p>}
    {message && <p className="download-message" role="status">{ready && <Check size={13} />}{message}</p>}
  </div>;
}
