'use client';

import { useEffect, useState } from 'react';

const trackLabels = {
  hard_sub: 'Original audio · hard subtitles',
  soft_sub: 'Original audio · soft subtitles',
  sub: 'Original audio · subtitles',
  dub: 'Dubbed audio'
};

export default function AnimeEpisodePicker({ slug, source = '', episodeId = '', track = '', episodeNumber = 0, episodeLabel = '', onChange, providerId = '', onProviderChange }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerError, setProviderError] = useState('');
  const isAnimeX = String(source).toLowerCase() === 'animex';

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/anime/episodes?slug=${encodeURIComponent(slug)}`, { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Episodes are unavailable.');
        return Array.isArray(data.items) ? data.items : [];
      })
      .then((items) => { if (active) setEpisodes(items); })
      .catch((requestError) => {
        if (active && requestError?.name !== 'AbortError') {
          setEpisodes([]);
          setError(requestError?.message || 'Episodes are unavailable.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [slug, reload]);

  const selected = episodes.find((item) => item.episodeId === episodeId) || episodes[0] || null;
  const selectedEpisodeId = selected?.episodeId || '';
  const availableTracks = selected?.tracks || [];

  useEffect(() => {
    if (loading || !episodes.length || !selected) return;
    const nextTrack = selected.tracks.includes(track) ? track : selected.tracks[0] || '';
    const label = selected.label || selected.title || `Episode ${selected.number}`;
    if (selected.episodeId !== episodeId || nextTrack !== track || Number(episodeNumber) !== selected.number || episodeLabel !== label) {
      onChange({ episodeId: selected.episodeId, track: nextTrack, number: selected.number, label });
    }
  }, [episodes, episodeId, track, episodeNumber, episodeLabel, loading, onChange, selected]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!isAnimeX || !selectedEpisodeId || !['sub', 'dub'].includes(track)) {
      setProviders([]);
      setProvidersLoading(false);
      setProviderError('');
      setProviderIdState('');
      return () => { active = false; controller.abort(); };
    }
    setProvidersLoading(true);
    setProviderError('');
    setProviders([]);
    setProviderIdState('');
    onProviderChange?.('');
    const params = new URLSearchParams({ slug, episodeId: selectedEpisodeId, track });
    fetch(`/api/anime/providers?${params.toString()}`, { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Provider choices are unavailable.');
        return Array.isArray(data.providers) ? data.providers : [];
      })
      .then((items) => { if (active) setProviders(items); })
      .catch((requestError) => {
        if (active && requestError?.name !== 'AbortError') {
          setProviders([]);
          setProviderError(requestError?.message || 'Provider choices are unavailable.');
        }
      })
      .finally(() => { if (active) setProvidersLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [isAnimeX, slug, selectedEpisodeId, track, onProviderChange]);

  const [selectedProviderId, setProviderIdState] = useState(providerId || '');
  useEffect(() => { setProviderIdState(providerId || ''); }, [providerId]);

  function resetProvider() {
    setProviderIdState('');
    onProviderChange?.('');
  }

  function changeEpisode(nextId) {
    const next = episodes.find((item) => item.episodeId === nextId);
    if (!next) return;
    resetProvider();
    const nextTrack = next.tracks.includes(track) ? track : next.tracks[0] || '';
    onChange({ episodeId: next.episodeId, track: nextTrack, number: next.number, label: next.label || next.title || `Episode ${next.number}` });
  }

  return <div className="anime-episode-picker" aria-busy={loading}>
    {loading ? <p className="picker-status" role="status">Loading episode guide…</p> : error ? <div className="picker-status" role="alert"><span>{error}</span><button type="button" className="text-link" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : !episodes.length ? <p className="picker-status">No episodes are listed for this title.</p> : <>
      <label className="anime-field">Episode
        <select value={selected?.episodeId || ''} onChange={(event) => changeEpisode(event.target.value)}>
          {episodes.map((item) => <option key={item.episodeId} value={item.episodeId}>{item.label || item.title || `Episode ${item.number}`}</option>)}
        </select>
      </label>
      <label className="anime-field">Audio & subtitles
        <select value={availableTracks.includes(track) ? track : ''} onChange={(event) => { resetProvider(); onChange({ episodeId: selected?.episodeId || '', track: event.target.value, number: selected?.number, label: selected?.label || selected?.title || `Episode ${selected?.number}` }); }} disabled={!availableTracks.length}>
          {availableTracks.map((item) => <option key={item} value={item}>{trackLabels[item] || item}</option>)}
          {!availableTracks.length && <option value="">No track available</option>}
        </select>
      </label>
      {isAnimeX && ['sub', 'dub'].includes(track) && <label className="anime-field">Provider
        <select value={selectedProviderId} onChange={(event) => { const nextId = event.target.value; setProviderIdState(nextId); onProviderChange?.(nextId); }} disabled={providersLoading || !providers.length}>
          <option value="">Automatic</option>
          {providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.isDefault ? ' · Default' : ''}</option>)}
        </select>
      </label>}
      {isAnimeX && ['sub', 'dub'].includes(track) && <p className="picker-status" role={providerError ? 'status' : undefined}>{providersLoading ? 'Loading provider choices…' : providerError ? `${providerError} Automatic selection remains available.` : providers.length ? `${providers.length.toLocaleString()} providers are available for this episode.` : 'Using automatic provider selection.'}</p>}
      <p className="picker-status">{episodes.length.toLocaleString()} listed episode{episodes.length === 1 ? '' : 's'} · choose an episode and available track.</p>
    </>}
  </div>;
}
