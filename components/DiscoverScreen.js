'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bookmark, CirclePlay, Film, Sparkles, Star, Trophy, Tv, Clapperboard } from 'lucide-react';
import TitleCard from './TitleCard';
import NoticeCard from './NoticeCard';
import { useShelf } from './ShelfProvider';
import { formatRating, formatYear } from '../lib/format';

const browseModes = [
  { label: 'Movies', href: '/explore?mode=movies', Icon: Film },
  { label: 'Series', href: '/explore?mode=series', Icon: Tv },
  { label: 'Anime', href: '/explore?mode=anime', Icon: Sparkles },
  { label: 'Sports', href: '/explore?mode=sports', Icon: Trophy }
];

function watchHref(item) {
  const path = `/watch/${encodeURIComponent(item.detailPath)}`;
  return item.season && item.episode ? `${path}?${new URLSearchParams({ se: String(item.season), ep: String(item.episode) }).toString()}` : path;
}

function ContinueCard({ item }) {
  const episode = item.season && item.episode ? ` · S${item.season} E${item.episode}` : '';
  return <Link href={watchHref(item)} className="continue-card">
    <span className="continue-art">{item.cover?.url && <Image src={item.cover.url} alt="" fill sizes="160px" className="poster-image" />}</span>
    <span className="continue-copy"><b>{item.title}</b><small>Continue watching{episode} · {Math.round(item.percent || 0)}% watched</small><span className="progress-track"><i style={{ width: `${Math.max(2, Math.min(100, item.percent || 0))}%` }} /></span></span>
    <CirclePlay className="continue-play" size={20} />
  </Link>;
}

function Shelf({ title, kicker, movies }) {
  if (!movies?.length) return null;
  return <section className="catalog-shelf">
    <div className="section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><Link href="/explore" className="text-link">See all <ArrowRight size={15} /></Link></div>
    <div className="horizontal-rail">{movies.slice(0, 14).map((movie) => <div className="rail-item" key={movie.detailPath}><TitleCard movie={movie} /></div>)}</div>
  </section>;
}

function UpcomingShelf() {
  const [status, setStatus] = useState('loading');
  const [items, setItems] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/catalog/browse?kind=categories&slug=upcoming', { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Upcoming titles are unavailable.');
        return Array.isArray(data.items) ? data.items : [];
      })
      .then((nextItems) => { if (!controller.signal.aborted) { setItems(nextItems); setStatus('ready'); } })
      .catch((error) => { if (error?.name !== 'AbortError' && !controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, []);

  if (status === 'loading') return <p className="sr-only" role="status" aria-live="polite">Upcoming movies are loading.</p>;
  if (status === 'ready' && items.length) return <Shelf title="Upcoming" kicker="COMING SOON" movies={items} />;
  return <section className="catalog-shelf upcoming-status"><div className="section-heading"><div><span className="section-kicker">COMING SOON</span><h2>Upcoming</h2></div></div><p role="status">{status === 'error' ? 'Upcoming titles are temporarily unavailable.' : 'No upcoming titles are listed right now.'}</p></section>;
}

export default function DiscoverScreen({ movies = [], sections = [], error = false }) {
  const { state, has, toggle } = useShelf();
  const [featureIndex, setFeatureIndex] = useState(0);
  const grouped = new Map();
  for (const item of movies) {
    if (!item.section) continue;
    const list = grouped.get(item.section) || [];
    list.push(item);
    grouped.set(item.section, list);
  }
  const apiShelves = [...grouped.entries()]
    .filter(([, items]) => items.length > 2)
    .sort(([left], [right]) => Number(!/(trending|popular|recent|latest|recommend)/i.test(left)) - Number(!/(trending|popular|recent|latest|recommend)/i.test(right)))
    .slice(0, 6);
  const displayShelves = apiShelves.length
    ? apiShelves.map(([title, items], index) => ({ title, kicker: sections.includes(title) ? `COLLECTION ${String(index + 1).padStart(2, '0')}` : 'FROM THE CATALOG', items }))
    : (movies.length ? [{ title: 'Across the catalog', kicker: 'PICK YOUR NEXT WATCH', items: movies }] : []);
  const heroItems = [...new Map(movies.filter((item) => item.backdrop?.url || item.cover?.url).map((item) => [item.detailPath, item])).values()].slice(0, 5);
  const activeIndex = heroItems.length ? featureIndex % heroItems.length : 0;
  const featured = heroItems[activeIndex] || movies[0];
  const rating = formatRating(featured?.imdbRatingValue);
  const continueItems = state.continueWatching.slice(0, 8);
  const heroImage = featured?.backdrop?.url || featured?.cover?.url;
  const movieCount = new Set(movies.map((item) => item.detailPath)).size;
  const changeFeature = (step) => setFeatureIndex((current) => (current + step + Math.max(1, heroItems.length)) % Math.max(1, heroItems.length));

  return <main className="discover-page">
    {featured && <section className="featured-hero" aria-label="Featured titles">
      {heroImage && <Image key={featured.detailPath} src={heroImage} alt="" fill priority sizes="100vw" className="featured-backdrop" />}
      <div className="hero-veil" />
      <div className="hero-grain" />
      <div className="hero-copy">
        <div className="hero-eyebrow"><span className="live-indicator" /> FEATURED ON BERAFLIX</div>
        <h1>{featured.title}</h1>
        <div className="hero-meta">
          {formatYear(featured.releaseDate) && <span>{formatYear(featured.releaseDate)}</span>}
          {featured.genre && <span>{featured.genre.split(',').slice(0, 3).join(' · ')}</span>}
          {rating && <span className="rating-emphasis"><Star size={14} fill="currentColor" /> {rating.toFixed(1)}</span>}
        </div>
        {featured.description && <p>{featured.description}</p>}
        <div className="hero-actions">
          {featured.hasResource ? <Link href={watchHref(featured)} className="button button-hot"><CirclePlay size={19} fill="currentColor" /> Watch now</Link> : <span className="button button-disabled"><CirclePlay size={19} /> Play unavailable</span>}
          <Link href={`/movie/${encodeURIComponent(featured.detailPath)}`} className="button button-quiet">Details <ArrowRight size={16} /></Link>
          <button type="button" onClick={() => toggle('watchlist', featured)} className={`button-icon ${has('watchlist', featured) ? 'is-marked' : ''}`} aria-label={has('watchlist', featured) ? 'Remove from Watchlist' : 'Add to Watchlist'} aria-pressed={has('watchlist', featured)}><Bookmark size={18} fill={has('watchlist', featured) ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      {heroItems.length > 1 && <div className="hero-carousel-controls" aria-label="Featured title carousel">
        <span className="hero-carousel-count">{String(activeIndex + 1).padStart(2, '0')} <i /> {String(heroItems.length).padStart(2, '0')}</span>
        <button type="button" className="hero-control" onClick={() => changeFeature(-1)} aria-label="Previous featured title"><ArrowLeft size={17} /></button>
        <button type="button" className="hero-control" onClick={() => changeFeature(1)} aria-label="Next featured title"><ArrowRight size={17} /></button>
      </div>}
      <div className="hero-bottom-glow" />
    </section>}

    <div className="page-inner discover-inner">
      <div className="welcome-row"><div><span className="section-kicker">BROWSE BY FORMAT</span><h2>Find your next watch</h2></div><Link href="/explore" className="button button-outline"><Clapperboard size={16} /> Explore all</Link></div>
      <nav className="discover-categories" aria-label="Browse categories">{browseModes.map(({ label, href, Icon }) => <Link key={label} href={href} className="discover-category"><Icon size={16} /><span>{label}</span><ArrowRight size={13} /></Link>)}</nav>
      {error && <NoticeCard title="Catalog temporarily unavailable" error>The movie catalog could not be reached. Try again in a little while.</NoticeCard>}
      {!error && !movies.length && <NoticeCard title="No titles are available right now">The catalog is empty at the moment. Check back soon.</NoticeCard>}
      {!error && continueItems.length > 0 && <section className="continue-section"><div className="section-heading"><div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Continue watching</h2></div></div><div className="continue-rail">{continueItems.map((item) => <ContinueCard item={item} key={`${item.detailPath}-${item.season || 0}-${item.episode || 0}`} />)}</div></section>}
      {!error && displayShelves.map((shelf) => <Shelf key={shelf.title} title={shelf.title} kicker={shelf.kicker} movies={shelf.items} />)}
      {!error && <UpcomingShelf />}
      {!error && movieCount > 0 && <section className="catalog-footnote"><span>BERAFLIX · BY BERA TECH</span><span>{movieCount} titles in the catalog</span></section>}
    </div>
  </main>;
}
