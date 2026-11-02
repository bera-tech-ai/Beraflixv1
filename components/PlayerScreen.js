'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CircleAlert, Maximize2, Play } from 'lucide-react';
import { useShelf } from './ShelfProvider';
import NoticeCard from './NoticeCard';
import DownloadButton from './DownloadButton';
import AnimeEpisodePicker from './AnimeEpisodePicker';
import PlaybackAdjustments from './PlaybackAdjustments';

const EPISODE_NUMBER_OPTIONS = Array.from({ length: 999 }, (_, index) => index + 1);

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 999 ? number : fallback;
}

function AnimePlayer({ movie, initialAnimeEpisodeId = '', initialAnimeTrack = '' }) {
  const router = useRouter();
  const [selection, setSelection] = useState({ episodeId: initialAnimeEpisodeId, track: initialAnimeTrack, providerId: '' });
  const [brightness, setBrightness] = useState(100);
  const [playerUrl, setPlayerUrl] = useState('');
  const [loading, setLoading] = useState(Boolean(initialAnimeEpisodeId && initialAnimeTrack));
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const onSelection = useCallback((value) => {
    setSelection((current) => ({ ...current, ...value }));
    if (value.episodeId && value.track) {
      const query = new URLSearchParams({ animeEpisodeId: value.episodeId, track: value.track });
      router.replace(`/watch/${encodeURIComponent(movie.detailPath)}?${query.toString()}`, { scroll: false });
    }
  }, [movie.detailPath, router]);
  const onProviderChange = useCallback((providerId) => {
    setSelection((current) => ({ ...current, providerId: String(providerId || '') }));
  }, []);

  useEffect(() => {
    if (!selection.episodeId || !selection.track) {
      setPlayerUrl('');
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setPlayerUrl('');
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ slug: movie.detailPath, episodeId: selection.episodeId, track: selection.track });
    if (selection.providerId) params.set('providerId', selection.providerId);
    fetch(`/api/anime/stream?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || 'A player link could not be prepared.');
        return data.url;
      })
      .then((url) => { if (!controller.signal.aborted) setPlayerUrl(url); })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setError(requestError?.message || 'A player link could not be prepared.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [movie?.detailPath, selection.episodeId, selection.track, selection.providerId, retry]);

  return <main className="page-inner screen-page player-page">
    <div className="player-topline"><Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="back-link"><ArrowLeft size={16} /> Details</Link><span className="player-quality">ANIME · ONLINE PLAYER</span></div>
    <AnimeEpisodePicker slug={movie.detailPath} source={movie.source} episodeId={selection.episodeId} track={selection.track} episodeNumber={selection.number} episodeLabel={selection.label} providerId={selection.providerId} onProviderChange={onProviderChange} onChange={onSelection} />
    <div className="player-frame">
      {playerUrl && <iframe className="anime-player-embed" style={{ filter: `brightness(${brightness / 100})` }} src={playerUrl} title={`${movie.title} episode player`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setPlayerUrl(''); setError('The embedded player could not be opened. It may be blocked or temporarily unavailable.'); }} />}
      {loading && <div className="player-loading" role="status" aria-label="Preparing episode player"><Play size={18} fill="currentColor" /><span className="player-loading-copy">Preparing episode player…</span></div>}
      {!selection.episodeId && !loading && <div className="player-unavailable"><CircleAlert size={27} /><b>Choose an episode and an available track.</b></div>}
      {error && <div className="player-error" role="alert"><CircleAlert size={26} /><b>The player could not start</b><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Request a fresh player link</button></div>}
      <PlaybackAdjustments brightness={brightness} onBrightnessChange={setBrightness} volumeAvailable={false} />
    </div>
    <div className="player-caption"><div><span className="section-kicker">NOW PLAYING</span><h1>{movie.title}</h1><p>{movie.genre || 'Anime'}{selection.number ? ` · Episode ${selection.number}` : ''}{selection.label ? ` · ${selection.label}` : ''}</p></div><Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="player-detail-link">View details <Play size={14} /></Link></div>
    <p className="player-disclaimer">Use the embedded player’s timeline and 10-second skip controls to pause or seek. Playback needs an internet connection. Volume is controlled by the embed or your device, and BERAFLIX cannot read files saved by the browser.</p>
  </main>;
}

export default function PlayerScreen({ movie, error = false, initialSeason = 1, initialEpisode = 1, initialAnimeEpisodeId = '', initialAnimeTrack = '' }) {
  const router = useRouter();
  const { state, addHistory, saveProgress, has, toggle, setPreference } = useShelf();
  const videoRef = useRef(null);
  const controllerRef = useRef(null);
  const requestGeneration = useRef(0);
  const retryCount = useRef(0);
  const pendingRestore = useRef(null);
  const lastSaved = useRef(0);
  const isSeries = /series|tv|show/i.test(String(movie?.type || ''));
  const [season, setSeason] = useState(positiveNumber(initialSeason));
  const [episode, setEpisode] = useState(positiveNumber(initialEpisode));
  const [seasonInput, setSeasonInput] = useState(String(positiveNumber(initialSeason)));
  const [episodeInput, setEpisodeInput] = useState(String(positiveNumber(initialEpisode)));
  const [streamUrl, setStreamUrl] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(100);
  const [playError, setPlayError] = useState('');
  const [playNotice, setPlayNotice] = useState('');
  const [captionTracks, setCaptionTracks] = useState([]);
  const [captionStatus, setCaptionStatus] = useState('idle');
  const [selectedCaption, setSelectedCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playQueued, setPlayQueued] = useState(false);
  const quality = state.preferences.quality || 'auto';
  const streamContext = useRef({ detailPath: movie?.detailPath, quality, season, episode });
  const episodeItem = useMemo(() => movie && isSeries ? { ...movie, season, episode } : movie, [movie, isSeries, season, episode]);
  const resume = movie ? (state.continueWatching || []).find((item) => item.detailPath === movie.detailPath && (isSeries ? Number(item.season) === season && Number(item.episode) === episode : !item.season && !item.episode)) : null;
  const episodeWatched = isSeries && has('watched', episodeItem);

  const requestStream = useCallback(async (preservePosition = false) => {
    if (!movie?.hasResource || ['anime', 'animex'].includes(movie.source)) return;
    const video = videoRef.current;
    if (preservePosition && video) pendingRestore.current = { position: video.currentTime || 0, wasPlaying: !video.paused };
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const generation = ++requestGeneration.current;
    const params = new URLSearchParams({ slug: movie.detailPath });
    if (quality !== 'auto') params.set('quality', quality);
    if (isSeries) {
      params.set('se', String(season));
      params.set('ep', String(episode));
    }
    setLoading(true);
    setPlayError('');
    try {
      const response = await fetch(`/api/stream?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'A playback link could not be prepared.');
      if (generation === requestGeneration.current) setStreamUrl(data.url);
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return;
      if (generation === requestGeneration.current) {
        setLoading(false);
        setPlayError(requestError?.message || 'A playback link could not be prepared. Check title availability and try again.');
      }
    }
  }, [movie?.detailPath, movie?.hasResource, quality, isSeries, season, episode]);

  useEffect(() => {
    const nextSeason = positiveNumber(initialSeason);
    const nextEpisode = positiveNumber(initialEpisode);
    setSeason(nextSeason);
    setEpisode(nextEpisode);
    setSeasonInput(String(nextSeason));
    setEpisodeInput(String(nextEpisode));
  }, [movie?.detailPath, initialSeason, initialEpisode]);

  useEffect(() => {
    if (episodeItem) addHistory(episodeItem);
  }, [episodeItem, addHistory]);

  useEffect(() => {
    const previousContext = streamContext.current;
    const qualityOnlyChange = previousContext.detailPath === movie?.detailPath && previousContext.quality !== quality && previousContext.season === season && previousContext.episode === episode;
    streamContext.current = { detailPath: movie?.detailPath, quality, season, episode };
    retryCount.current = 0;
    if (qualityOnlyChange && videoRef.current) pendingRestore.current = { position: videoRef.current.currentTime || 0, wasPlaying: !videoRef.current.paused };
    else pendingRestore.current = null;
    lastSaved.current = 0;
    setResumed(false);
    setIsPlaying(false);
    setStreamUrl('');
    setPlayError('');
    const usesAnimePlayer = ['anime', 'animex'].includes(movie?.source);
    setLoading(Boolean(movie?.hasResource && !usesAnimePlayer));
    if (movie?.hasResource && !usesAnimePlayer) requestStream(false);
    return () => {
      requestGeneration.current += 1;
      controllerRef.current?.abort();
    };
  }, [movie?.detailPath, movie?.hasResource, requestStream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.volume = volume / 100;
      video.muted = volume === 0;
    } catch {
      // Some mobile browsers reserve volume for the device's hardware buttons.
    }
  }, [volume]);

  useEffect(() => {
    if (movie?.source !== 'moviebox' || !movie?.hasResource) {
      setCaptionTracks([]);
      setCaptionStatus('idle');
      setSelectedCaption('');
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ slug: movie.detailPath, quality });
    if (isSeries) {
      params.set('se', String(season));
      params.set('ep', String(episode));
    }
    setCaptionTracks([]);
    setSelectedCaption('');
    setCaptionStatus('loading');
    fetch(`/api/captions?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Subtitle tracks are unavailable.');
        return Array.isArray(data.tracks) ? data.tracks : [];
      })
      .then((tracks) => {
        if (controller.signal.aborted) return;
        setCaptionTracks(tracks);
        setCaptionStatus('ready');
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setCaptionStatus('error');
      });
    return () => controller.abort();
  }, [movie?.detailPath, movie?.source, movie?.hasResource, quality, isSeries, season, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    Array.from(video.textTracks || []).forEach((track, index) => {
      track.mode = captionTracks[index]?.id === selectedCaption ? 'showing' : 'disabled';
    });
  }, [captionTracks, selectedCaption, streamUrl]);

  if (error) return <main className="page-inner screen-page"><NoticeCard title="Player unavailable" error>We couldn't load the title details needed to start playback.</NoticeCard><Link href="/" className="text-link back-link">Back to Discover</Link></main>;
  if (!movie) return null;
  if (['anime', 'animex'].includes(movie.source)) return <AnimePlayer movie={movie} initialAnimeEpisodeId={initialAnimeEpisodeId} initialAnimeTrack={initialAnimeTrack} />;

  function applyResume(video = videoRef.current) {
    if (resumed || !resume?.position || !video || !Number.isFinite(video.duration)) return;
    if (resume.position > 10 && resume.position < video.duration - 2) video.currentTime = resume.position;
    setResumed(true);
  }

  function onLoadedMetadata() {
    const video = videoRef.current;
    setLoading(false);
    if (!video) return;
    if (pendingRestore.current) {
      const restore = pendingRestore.current;
      pendingRestore.current = null;
      if (restore.position > 0 && restore.position < video.duration - 2) video.currentTime = restore.position;
      if (restore.wasPlaying) video.play().catch(() => {});
      setResumed(true);
      return;
    }
    applyResume(video);
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video || !state.preferences.saveProgress || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const now = Date.now();
    if (now - lastSaved.current < 10000 && video.currentTime < video.duration * .96) return;
    lastSaved.current = now;
    saveProgress(episodeItem, video.currentTime, video.duration);
  }

  function onMediaError() {
    if (!streamUrl) return;
    if (retryCount.current === 0) {
      retryCount.current = 1;
      requestStream(true);
      return;
    }
    setLoading(false);
    setPlayError('The stream could not be served to this browser or network. It may be region-limited or temporarily unavailable; try another title.');
  }

  function retryPlayback() {
    retryCount.current = 0;
    requestStream(true);
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    setPlayNotice('');
    setPlayQueued(true);
    video.play().then(() => setPlayQueued(false)).catch((playRequestError) => {
      setPlayQueued(false);
      if (playRequestError?.name !== 'AbortError') setPlayNotice('If playback stays paused, use Play in the video controls once the stream is ready.');
    });
  }

  function applyVolume(value) {
    const next = Math.max(0, Math.min(100, Number(value) || 0));
    setVolume(next);
    const video = videoRef.current;
    if (!video) return;
    try {
      video.volume = next / 100;
      video.muted = next === 0;
    } catch {
      // The displayed control remains available; device controls may be required.
    }
  }

  function applyEpisode(event) {
    event.preventDefault();
    const nextSeason = positiveNumber(seasonInput);
    const nextEpisode = positiveNumber(episodeInput);
    setSeason(nextSeason);
    setEpisode(nextEpisode);
    setResumed(false);
    const query = new URLSearchParams({ se: String(nextSeason), ep: String(nextEpisode) });
    router.replace(`/watch/${encodeURIComponent(movie.detailPath)}?${query.toString()}`, { scroll: false });
  }

  function fullscreen() {
    const node = videoRef.current;
    if (!node) return;
    const target = node.parentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else target?.requestFullscreen?.();
  }

  return <main className="page-inner screen-page player-page">
    <div className="player-topline"><Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="back-link"><ArrowLeft size={16} /> Details</Link><label className="player-quality-control"><span>QUALITY</span><select aria-label="Streaming quality" value={quality} onChange={(event) => setPreference('quality', event.target.value)}><option value="auto">Auto</option><option value="360p">360p</option><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label></div>
    {movie.hasResource && isSeries && <form className="episode-picker" onSubmit={applyEpisode}>
      <div><label htmlFor="season-number">Season</label><select id="season-number" value={seasonInput} onChange={(event) => setSeasonInput(event.target.value)}>{EPISODE_NUMBER_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
      <div><label htmlFor="episode-number">Episode</label><select id="episode-number" value={episodeInput} onChange={(event) => setEpisodeInput(event.target.value)}>{EPISODE_NUMBER_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
      <button type="submit" className="button button-outline">Load episode</button>
      <span>Enter a positive season and episode number.</span>
    </form>}
    <div className="player-frame">
      {movie.hasResource ? <>
        <video ref={videoRef} src={streamUrl || undefined} controls playsInline autoPlay={Boolean(state.preferences.autoplay) || playQueued} preload="auto" poster={movie.cover?.url || undefined} style={{ filter: `brightness(${brightness / 100})` }} onLoadedMetadata={onLoadedMetadata} onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onPlaying={() => { setLoading(false); setIsPlaying(true); setPlayQueued(false); setPlayNotice(''); retryCount.current = 0; }} onTimeUpdate={onTimeUpdate} onEnded={() => { setIsPlaying(false); if (videoRef.current?.duration) saveProgress(episodeItem, videoRef.current.duration, videoRef.current.duration); }} onVolumeChange={(event) => { const media = event.currentTarget; const next = media.muted ? 0 : Math.round(media.volume * 100); setVolume((current) => current === next ? current : next); }} onError={onMediaError} aria-label={`Play ${movie.title}${isSeries ? ` season ${season}, episode ${episode}` : ''}`}>
          {captionTracks.map((track) => <track key={track.id} kind="subtitles" srcLang={track.language || 'und'} label={track.label} src={track.src} />)}
        </video>
        {loading && !playError && <div className="player-loading" role="status" aria-label="Loading video"><Play size={18} fill="currentColor" /><span className="player-loading-copy">{playQueued || isPlaying ? 'Starting playback…' : streamUrl ? 'Video is loading…' : 'Preparing your stream…'}</span>{streamUrl && !playQueued && !isPlaying && <button type="button" className="player-play-pending" onClick={startPlayback}><Play size={16} fill="currentColor" /> Play once when ready</button>}</div>}
        {!loading && playQueued && !playError && !isPlaying && <div className="player-loading" role="status" aria-label="Starting playback"><Play size={18} fill="currentColor" /><span className="player-loading-copy">Starting playback…</span></div>}
        {streamUrl && !loading && !playError && !isPlaying && !playQueued && <button type="button" className="player-play-overlay" onClick={startPlayback} aria-label="Play video"><Play size={27} fill="currentColor" /><span>Play</span></button>}
        {playError && <div className="player-error"><CircleAlert size={26} /><b>Playback could not start</b><p>{playError}</p><button type="button" onClick={retryPlayback}>Request a fresh link</button></div>}
        <button type="button" className="fullscreen-button" aria-label="Toggle fullscreen" onClick={fullscreen}><Maximize2 size={17} /></button>
        <PlaybackAdjustments brightness={brightness} onBrightnessChange={setBrightness} volume={volume} onVolumeChange={applyVolume} />
      </> : <div className="player-unavailable"><CircleAlert size={27} /><b>Playback isn’t available for this title.</b></div>}
    </div>
    {movie.source === 'moviebox' && movie.hasResource && <div className="subtitle-controls">
      <label htmlFor="subtitle-track">Subtitles</label>
      <select id="subtitle-track" value={selectedCaption} onChange={(event) => setSelectedCaption(event.target.value)} disabled={captionStatus === 'loading' || captionTracks.length === 0}>
        <option value="">Off</option>
        {captionTracks.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
      </select>
      <span role="status">{captionStatus === 'loading' ? 'Checking available subtitle tracks.' : captionStatus === 'error' ? 'Subtitle tracks are temporarily unavailable.' : captionTracks.length ? `${captionTracks.length} subtitle ${captionTracks.length === 1 ? 'track' : 'tracks'} available.` : 'No subtitles listed for this title.'}</span>
    </div>}
    <div className="player-caption">
      <div>
        <span className="section-kicker">NOW PLAYING</span>
        <h1>{movie.title}</h1>
        {(movie.genre || isSeries) && <p>{movie.genre}{isSeries && `${movie.genre ? ' · ' : ''}S${season} E${episode}`}</p>}
      </div>
      <div className="player-caption-actions">
        {isSeries && movie.hasResource && <button type="button" className="mini-action" onClick={() => toggle('watched', episodeItem)} aria-pressed={episodeWatched}>{episodeWatched ? 'Mark episode unwatched' : 'Mark this episode as watched'}</button>}
        {movie.hasResource && <DownloadButton movie={episodeItem} season={isSeries ? season : undefined} episode={isSeries ? episode : undefined} compact />}
        <Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="player-detail-link">View details <Play size={14} /></Link>
      </div>
    </div>
    {resume?.position > 10 && !resumed && <p className="resume-note" role="status">Resume point available{isSeries ? ` for S${season} E${episode}` : ''} at {Math.floor(resume.position / 60)}:{String(Math.floor(resume.position % 60)).padStart(2, '0')} — it will restore when the stream is ready.</p>}
    {playNotice && <p className="player-play-notice" role="status">{playNotice}</p>}
    <p className="player-disclaimer">Playback links are temporary. BERAFLIX refreshes a link after a media error and does not save the video file.</p>
  </main>;
}
