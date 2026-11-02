'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CirclePlay, Clock3, Star } from 'lucide-react';
import { useShelf } from './ShelfProvider';
import TitleActions from './TitleActions';
import DownloadButton from './DownloadButton';
import SeriesEpisodeQueue from './SeriesEpisodeQueue';
import NoticeCard from './NoticeCard';
import AnimeEpisodePicker from './AnimeEpisodePicker';
import TitleCard from './TitleCard';
import { formatRating, formatYear } from '../lib/format';

const EPISODE_NUMBER_OPTIONS = Array.from({ length: 999 }, (_, index) => index + 1);

function runtime(seconds) {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}

export default function MovieDetailScreen({ movie, relatedItems = [], error = false }) {
  const { addHistory } = useShelf();
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('1');
  const [seriesQueueActive, setSeriesQueueActive] = useState(false);
  const [animeSelection, setAnimeSelection] = useState({ episodeId: '', track: '', number: 0, label: '' });
  const onAnimeSelection = useCallback((value) => setAnimeSelection(value), []);
  useEffect(() => { if (movie) addHistory(movie); }, [movie?.detailPath, addHistory]);
  if (error) return <main className="page-inner screen-page"><NoticeCard title="Title details unavailable" error>We couldn't retrieve this title right now. Return to Discover and try again.</NoticeCard><Link className="text-link back-link" href="/">Back to Discover</Link></main>;
  if (!movie) return null;
  const rating = formatRating(movie.imdbRatingValue);
  const info = [formatYear(movie.releaseDate), movie.countryName, runtime(movie.duration)].filter(Boolean);
  const backdropUrl = movie.backdrop?.url || movie.cover?.url;
  const isAnime = ['anime', 'animex'].includes(movie.source);
  const isSeries = !isAnime && /series|tv|show/i.test(String(movie.type || ''));
  const canPlay = isAnime || movie.hasResource;
  const animeWatchHref = animeSelection.episodeId && animeSelection.track
    ? `/watch/${encodeURIComponent(movie.detailPath)}?${new URLSearchParams({ animeEpisodeId: animeSelection.episodeId, track: animeSelection.track }).toString()}`
    : '';
  const watchHref = `/watch/${encodeURIComponent(movie.detailPath)}${isSeries ? `?${new URLSearchParams({ se: season, ep: episode }).toString()}` : ''}`;

  return <main className="detail-page">
    <section className="detail-backdrop" aria-hidden="true">
      {backdropUrl && <Image src={backdropUrl} alt="" fill priority sizes="100vw" className="detail-backdrop-image" />}
      <div className="detail-backdrop-shade" />
    </section>
    <div className="page-inner detail-content">
      <Link href="/" className="back-link"><ArrowLeft size={16} /> Discover</Link>
      <nav className="detail-section-nav" aria-label="Title sections"><a href="#overview">Overview</a>{(isAnime || isSeries) && <a href="#episodes">Episodes</a>}{relatedItems.length > 0 && <a href="#related">More like this</a>}</nav>
      <section className="detail-layout" id="overview" aria-labelledby="detail-title">
        <div className="detail-poster">{movie.cover?.url ? <Image src={movie.cover.url} alt={`${movie.title} poster`} fill priority sizes="(max-width: 760px) 75vw, 300px" className="poster-image" /> : <div className="poster-missing"><span>BF</span></div>}</div>
        <div className="detail-copy">
          <span className="section-kicker">{isAnime ? 'ANIME' : isSeries ? 'SERIES' : 'MOVIE'} · TITLE DETAILS</span>
          <h1 id="detail-title">{movie.title}</h1>
          <div className="detail-meta">
            {info.map((value) => <span key={value}>{value}</span>)}
            {rating && <span className="rating-emphasis"><Star size={15} fill="currentColor" /> {rating.toFixed(1)} rating</span>}
          </div>
          {movie.genre && <div className="genre-tags">{movie.genre.split(',').map((name) => <span key={name}>{name.trim()}</span>)}</div>}
          {movie.description && <p className="detail-description">{movie.description}</p>}
          {isAnime && <div className="detail-anime-picker" id="episodes"><span className="section-kicker">CHOOSE AN EPISODE</span><AnimeEpisodePicker slug={movie.detailPath} episodeId={animeSelection.episodeId} track={animeSelection.track} episodeNumber={animeSelection.number} episodeLabel={animeSelection.label} onChange={onAnimeSelection} /></div>}
          <div className="detail-primary-actions">
            {canPlay ? <>
              {isAnime ? animeWatchHref ? <Link href={animeWatchHref} className="button button-hot"><CirclePlay size={19} fill="currentColor" /> Play selected episode</Link> : <span className="button button-disabled"><CirclePlay size={19} /> Choose an episode first</span> : <Link href={watchHref} className="button button-hot"><CirclePlay size={19} fill="currentColor" /> Watch online</Link>}
              {!isAnime && !isSeries && <DownloadButton movie={movie} />}
            </> : <span className="button button-disabled"><CirclePlay size={18} /> Playback unavailable</span>}
          </div>
          {canPlay && <p className="availability-note"><Clock3 size={14} /> {isAnime ? 'Episode playback opens in an online player; Anime downloads are not available here.' : 'Playback links are temporary; download transfer status is managed by your browser.'}</p>}
          {!isAnime && movie.hasResource && isSeries && <div className="detail-episode-download" id="episodes"><span className="section-kicker">SERIES EPISODES</span><p>Episode listings are unavailable here; choose a season and episode number.</p><label>Season<select value={season} onChange={(event) => setSeason(event.target.value)} disabled={seriesQueueActive} aria-label="Season number">{EPISODE_NUMBER_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label>Episode<select value={episode} onChange={(event) => setEpisode(event.target.value)} disabled={seriesQueueActive} aria-label="Starting episode number">{EPISODE_NUMBER_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><SeriesEpisodeQueue movie={movie} season={season} startEpisode={episode} onQueueStateChange={setSeriesQueueActive} /></div>}
          <TitleActions movie={movie} />
        </div>
      </section>
      {relatedItems.length > 0 && <section className="catalog-shelf detail-related" id="related"><div className="section-heading"><div><span className="section-kicker">KEEP DISCOVERING</span><h2>More like this</h2></div><Link href="/explore" className="text-link">Explore all <ArrowRight size={15} /></Link></div><div className="horizontal-rail">{relatedItems.map((item) => <div className="rail-item" key={item.detailPath}><TitleCard movie={item} /></div>)}</div></section>}
    </div>
  </main>;
}
