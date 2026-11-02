'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clapperboard, Dumbbell, Film, Globe2, Radio, Search, Sparkles, Trophy, Tv, X } from 'lucide-react';
import TitleCard from './TitleCard';
import NoticeCard from './NoticeCard';
import SportsScreen from './SportsScreen';
import ChannelScheduleScreen from './ChannelScheduleScreen';
import NovelHubScreen from './NovelHubScreen';
import WrestlingScreen from './WrestlingScreen';
import ChannelsV2Screen from './ChannelsV2Screen';

const PAGE_SIZE = 36;
const modes = [
  { id: 'all', label: 'All titles', icon: Clapperboard, href: '/explore' },
  { id: 'movies', label: 'Movies', icon: Film, href: '/explore?mode=movies' },
  { id: 'series', label: 'Series', icon: Tv, href: '/explore?mode=series' },
  { id: 'anime', label: 'Anime', icon: Sparkles, href: '/explore?mode=anime' },
  { id: 'sports', label: 'Sports', icon: Trophy, href: '/explore?mode=sports' },
  { id: 'channels', label: 'Channels', icon: Radio, href: '/explore?mode=channels' },
  { id: 'books', label: 'Books', icon: BookOpen, href: '/explore?mode=books' },
  { id: 'wrestling', label: 'Wrestling', icon: Dumbbell, href: '/explore?mode=wrestling' },
  { id: 'channels-v2', label: 'Channels V2', icon: Globe2, href: '/explore?mode=channels-v2' }
];
const DISCOVERY_SECTIONS = ['trending', 'popularMovies', 'popularSeries', 'latestMovies', 'latestSeries'];

function isSeries(item) {
  return /series|tv|show/i.test(String(item?.type || ''));
}

function normalizedGenre(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function yearValue(movie) {
  const match = String(movie?.releaseDate || '').match(/\b\d{4}\b/);
  return match ? Number(match[0]) : null;
}

function ratingValue(movie) {
  const value = Number.parseFloat(String(movie?.imdbRatingValue ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function itemKey(item) {
  return String(item?.detailPath || item?.contentId || item?.title || '');
}

function appendUnique(existing = [], incoming = []) {
  const seen = new Set(existing.map(itemKey));
  return [...existing, ...incoming.filter((item) => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

export default function ExploreScreen({ movies = [], query = '', mode = 'all', sports = null, channels = [], directoryError = false, error = false }) {
  const [localGenre, setLocalGenre] = useState('All');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [sortBy, setSortBy] = useState('title');
  const [facets, setFacets] = useState({ categories: [], genres: [] });
  const [facetStatus, setFacetStatus] = useState('loading');
  const [selectedFacet, setSelectedFacet] = useState(null);
  const [remoteItems, setRemoteItems] = useState(null);
  const [pageItems, setPageItems] = useState([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [sectionPages, setSectionPages] = useState({});
  const [exhaustedSections, setExhaustedSections] = useState([]);
  const [noMoreUpstream, setNoMoreUpstream] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const requestEpoch = useRef(0);
  const requestLock = useRef(false);
  const isSports = mode === 'sports';
  const isChannels = mode === 'channels';
  const isAnime = mode === 'anime';
  const clearHref = mode === 'all' ? '/explore' : `/explore?mode=${encodeURIComponent(mode)}`;
  const currentMode = modes.some((item) => item.id === mode) ? mode : 'all';
  const scopeLabel = mode === 'movies' ? 'movie titles' : mode === 'series' ? 'series' : isAnime ? 'anime titles' : 'titles';
  const localGenres = useMemo(() => [...new Set(movies.flatMap((movie) => (movie.genre || '').split(',').map((item) => item.trim()).filter(Boolean)))].slice(0, 14), [movies]);
  const remoteGenres = useMemo(() => {
    const categories = new Set(facets.categories.map((item) => `${item.slug}:${item.name.toLocaleLowerCase()}`));
    return facets.genres.filter((item) => !categories.has(`${item.slug}:${item.name.toLocaleLowerCase()}`));
  }, [facets]);

  useEffect(() => {
    requestEpoch.current += 1;
    requestLock.current = false;
    setSelectedFacet(null);
    setRemoteItems(null);
    setPageItems([]);
    setBrowsePage(1);
    setSearchPage(1);
    setSectionPages({});
    setExhaustedSections([]);
    setNoMoreUpstream(false);
    setMoreLoading(false);
    setMoreError(false);
    setBrowseLoading(false);
    setBrowseError(false);
    setLocalGenre('All');
    setShown(PAGE_SIZE);
  }, [mode, query]);

  useEffect(() => {
    if (isAnime || isSports || isChannels || ['books', 'wrestling', 'channels-v2'].includes(mode)) {
      setFacetStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setFacetStatus('loading');
    fetch('/api/catalog/facets', { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Catalog filters are unavailable.');
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setFacets({ categories: Array.isArray(data.categories) ? data.categories : [], genres: Array.isArray(data.genres) ? data.genres : [] });
        setFacetStatus('ready');
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setFacetStatus('error');
      });
    return () => controller.abort();
  }, [isAnime, isSports, isChannels, mode]);

  useEffect(() => {
    if (!selectedFacet) {
      setRemoteItems(null);
      setBrowseLoading(false);
      setBrowseError(false);
      setBrowsePage(1);
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ kind: selectedFacet.kind, slug: selectedFacet.slug, page: '1' });
    setBrowsePage(1);
    setNoMoreUpstream(false);
    setMoreError(false);
    setBrowseLoading(true);
    setBrowseError(false);
    fetch(`/api/catalog/browse?${params.toString()}`, { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'This list is temporarily unavailable.');
        return Array.isArray(data.items) ? data.items : [];
      })
      .then((items) => { if (!controller.signal.aborted) setRemoteItems(items); })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setBrowseError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setBrowseLoading(false); });
    return () => controller.abort();
  }, [selectedFacet]);

  const localGenreMatches = selectedFacet?.kind === 'genres' && Array.isArray(remoteItems) && remoteItems.length === 0
    ? movies.filter((movie) => (movie.genre || '').split(',').some((value) => normalizedGenre(value) === normalizedGenre(selectedFacet.name)))
    : [];
  const usedLocalGenreFallback = localGenreMatches.length > 0;
  let sourceItems = selectedFacet
    ? (usedLocalGenreFallback ? localGenreMatches : remoteItems || [])
    : [...movies, ...pageItems];
  if (!selectedFacet && localGenre !== 'All') sourceItems = sourceItems.filter((movie) => (movie.genre || '').split(',').some((value) => value.trim() === localGenre));
  if (currentMode === 'series') sourceItems = sourceItems.filter(isSeries);
  if (currentMode === 'movies') sourceItems = sourceItems.filter((item) => !isSeries(item));
  const filtered = sourceItems;
  const sortedItems = useMemo(() => [...filtered].sort((left, right) => {
    if (sortBy === 'title') return String(left.title || '').localeCompare(String(right.title || ''), undefined, { sensitivity: 'base' });
    const valueOf = sortBy === 'year' ? yearValue : ratingValue;
    const leftValue = valueOf(left);
    const rightValue = valueOf(right);
    if (leftValue == null && rightValue == null) return String(left.title || '').localeCompare(String(right.title || ''), undefined, { sensitivity: 'base' });
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return rightValue - leftValue || String(left.title || '').localeCompare(String(right.title || ''), undefined, { sensitivity: 'base' });
  }), [filtered, sortBy]);
  const visible = sortedItems.slice(0, shown);
  const sectionIds = currentMode === 'movies'
    ? ['trending', 'popularMovies', 'latestMovies']
    : currentMode === 'series'
      ? ['popularSeries', 'latestSeries']
      : DISCOVERY_SECTIONS;
  const canFetchMore = !noMoreUpstream && (
    (selectedFacet?.kind === 'genres') ||
    (Boolean(query) && !isAnime) ||
    (!selectedFacet && !query && !isAnime && ['all', 'movies', 'series'].includes(currentMode))
  );

  const clearFacet = () => {
    requestEpoch.current += 1;
    requestLock.current = false;
    setSelectedFacet(null);
    setRemoteItems(null);
    setPageItems([]);
    setLocalGenre('All');
    setShown(PAGE_SIZE);
    setNoMoreUpstream(false);
    setMoreError(false);
  };

  const chooseFacet = (kind, item) => {
    requestEpoch.current += 1;
    requestLock.current = false;
    setLocalGenre('All');
    setRemoteItems(null);
    setPageItems([]);
    setBrowsePage(1);
    setBrowseError(false);
    setNoMoreUpstream(false);
    setMoreError(false);
    setShown(PAGE_SIZE);
    setSelectedFacet({ kind, slug: item.slug, name: item.name });
  };

  async function requestMore() {
    if (visible.length < sortedItems.length) {
      setShown((current) => current + PAGE_SIZE);
      return;
    }
    if (!canFetchMore || requestLock.current) return;
    requestLock.current = true;
    const epoch = requestEpoch.current;
    setMoreLoading(true);
    setMoreError(false);
    try {
      let items = [];
      if (selectedFacet?.kind === 'genres') {
        const nextPage = browsePage + 1;
        const params = new URLSearchParams({ kind: selectedFacet.kind, slug: selectedFacet.slug, page: String(nextPage) });
        const response = await fetch(`/api/catalog/browse?${params.toString()}`, { cache: 'force-cache' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'This list is temporarily unavailable.');
        items = Array.isArray(data.items) ? data.items : [];
        if (epoch !== requestEpoch.current) return;
        if (!items.length) {
          setNoMoreUpstream(true);
        } else {
          const currentItems = usedLocalGenreFallback ? localGenreMatches : (remoteItems || []);
          const merged = appendUnique(currentItems, items);
          setRemoteItems(merged);
          setBrowsePage(nextPage);
          setShown((current) => current + PAGE_SIZE);
          if (merged.length === (remoteItems || []).length) setNoMoreUpstream(true);
        }
      } else if (query && !isAnime) {
        const nextPage = searchPage + 1;
        const params = new URLSearchParams({ q: query, mode: currentMode, page: String(nextPage) });
        const response = await fetch(`/api/search?${params.toString()}`, { cache: 'force-cache' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Search is temporarily unavailable.');
        items = Array.isArray(data.items) ? data.items : [];
        if (epoch !== requestEpoch.current) return;
        if (!items.length) {
          setNoMoreUpstream(true);
        } else {
          const current = appendUnique(movies, pageItems);
          const merged = appendUnique(current, items);
          const firstPageKeys = new Set(movies.map(itemKey));
          const additional = merged.filter((item) => !firstPageKeys.has(itemKey(item)));
          setPageItems(additional);
          setSearchPage(nextPage);
          setShown((current) => current + PAGE_SIZE);
          if (!additional.length) setNoMoreUpstream(true);
        }
      } else {
        const availableSections = sectionIds.filter((section) => !exhaustedSections.includes(section));
        if (!availableSections.length) {
          setNoMoreUpstream(true);
          return;
        }
        const settled = await Promise.allSettled(availableSections.map(async (section) => {
          const nextPage = (sectionPages[section] || 1) + 1;
          const params = new URLSearchParams({ section, page: String(nextPage) });
          const response = await fetch(`/api/catalog/browse?${params.toString()}`, { cache: 'force-cache' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'This catalog page is unavailable.');
          return { section, page: nextPage, items: Array.isArray(data.items) ? data.items : [] };
        }));
        if (epoch !== requestEpoch.current) return;
        const nextPages = { ...sectionPages };
        const nextExhausted = new Set(exhaustedSections);
        let failed = false;
        for (const result of settled) {
          if (result.status !== 'fulfilled') {
            failed = true;
            continue;
          }
          const { section, page, items: sectionItems } = result.value;
          if (!sectionItems.length) nextExhausted.add(section);
          else {
            nextPages[section] = page;
            items = appendUnique(items, sectionItems);
          }
        }
        setSectionPages(nextPages);
        setExhaustedSections([...nextExhausted]);
        if (failed) setMoreError(true);
        if (items.length) {
          const current = appendUnique(movies, pageItems);
          const merged = appendUnique(current, items);
          const firstPageKeys = new Set(movies.map(itemKey));
          const additional = merged.filter((item) => !firstPageKeys.has(itemKey(item)));
          setPageItems(merged);
          setShown((current) => current + PAGE_SIZE);
          if (!additional.length && nextExhausted.size === sectionIds.length) setNoMoreUpstream(true);
        } else if (!failed && nextExhausted.size === sectionIds.length) {
          setNoMoreUpstream(true);
        }
      }
    } catch {
      if (epoch === requestEpoch.current) setMoreError(true);
    } finally {
      if (epoch === requestEpoch.current) {
        requestLock.current = false;
        setMoreLoading(false);
      }
    }
  }

  const hasLocalMore = visible.length < sortedItems.length;
  const showMoreButton = hasLocalMore || canFetchMore;

  return <main className="page-inner screen-page explore-page">
    <div className="screen-heading"><div><span className="section-kicker">THE BERAFLIX INDEX</span><h1>Explore</h1><p>Choose a format, search the catalog, and follow a genre.</p></div><span className="heading-mark"><Film size={20} /></span></div>
    <nav className="explore-modes" aria-label="Explore categories">
      {modes.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={currentMode === id ? 'page' : undefined} className={`explore-mode ${currentMode === id ? 'selected' : ''}`}><Icon size={15} />{label}</Link>)}
    </nav>

    {isSports ? <SportsScreen initialData={sports} /> : isChannels ? <ChannelScheduleScreen channels={channels} directoryError={directoryError} /> : mode === 'books' ? <NovelHubScreen /> : mode === 'wrestling' ? <WrestlingScreen /> : mode === 'channels-v2' ? <ChannelsV2Screen /> : <>
      <form action="/explore" method="get" role="search" className="catalog-search">
        {mode !== 'all' && <input type="hidden" name="mode" value={mode} />}
        <Search size={19} aria-hidden="true" />
        <input type="search" name="q" defaultValue={query} placeholder={isAnime ? 'Search anime titles' : 'Search movies and series'} aria-label={isAnime ? 'Search anime titles' : 'Search movies and series'} />
        {query && <Link href={clearHref} aria-label="Clear search" className="search-clear"><X size={16} /></Link>}
        <button type="submit">Search</button>
      </form>

      {!isAnime && !query && <div className="catalog-facet-stack" aria-label="Catalog filters">
        <div className="filter-row" aria-label="Browse collections"><span className="filter-label">COLLECTION</span><button type="button" className={`filter-chip ${!selectedFacet ? 'selected' : ''}`} onClick={clearFacet} aria-pressed={!selectedFacet}>All</button>{facets.categories.map((item) => <button type="button" key={item.slug} className={`filter-chip ${selectedFacet?.kind === 'categories' && selectedFacet.slug === item.slug ? 'selected' : ''}`} onClick={() => chooseFacet('categories', item)} aria-pressed={selectedFacet?.kind === 'categories' && selectedFacet.slug === item.slug}>{item.name}</button>)}</div>
        <div className="filter-row" aria-label="Browse genres"><span className="filter-label">GENRE</span><button type="button" className={`filter-chip ${!selectedFacet && localGenre === 'All' ? 'selected' : ''}`} onClick={clearFacet} aria-pressed={!selectedFacet && localGenre === 'All'}>All</button>{remoteGenres.length ? remoteGenres.map((item) => <button type="button" key={item.slug} className={`filter-chip ${selectedFacet?.kind === 'genres' && selectedFacet.slug === item.slug ? 'selected' : ''}`} onClick={() => chooseFacet('genres', item)} aria-pressed={selectedFacet?.kind === 'genres' && selectedFacet.slug === item.slug}>{item.name}</button>) : localGenres.map((name) => <button type="button" key={name} className={`filter-chip ${!selectedFacet && localGenre === name ? 'selected' : ''}`} onClick={() => { setSelectedFacet(null); setRemoteItems(null); setBrowseError(false); setLocalGenre(name); setShown(PAGE_SIZE); setPageItems([]); setNoMoreUpstream(false); }} aria-pressed={!selectedFacet && localGenre === name}>{name}</button>)}</div>
        {!remoteGenres.length && facetStatus === 'ready' && <p className="static-result-status" role="note">Genre suggestions are based on titles currently in the catalog.</p>}
        {facetStatus === 'loading' && <p className="static-result-status" role="status">Catalog filters are loading.</p>}
        {facetStatus === 'error' && <p className="static-result-status" role="status">Catalog filters are temporarily unavailable.</p>}
      </div>}

      {(!isAnime && query) && <div className="filter-row" aria-label="Filter loaded results by genre"><span className="filter-label">GENRE</span>{['All', ...localGenres].map((name) => <button type="button" key={name} className={`filter-chip ${localGenre === name ? 'selected' : ''}`} onClick={() => { setSelectedFacet(null); setRemoteItems(null); setLocalGenre(name); setShown(PAGE_SIZE); setPageItems([]); setSearchPage(1); setNoMoreUpstream(false); }} aria-pressed={localGenre === name}>{name}</button>)}</div>}

      <div className="results-line"><span>{selectedFacet ? <>{selectedFacet.kind === 'categories' ? 'Collection' : 'Genre'}: <b>{selectedFacet.name}</b></> : localGenre !== 'All' ? <>Genre: <b>{localGenre}</b></> : query ? <>Results for <b>“{query}”</b></> : isAnime ? 'Search Anime titles' : currentMode === 'movies' ? 'Movies' : currentMode === 'series' ? 'Series' : 'All available titles'}</span><label className="results-sort"><span>Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort titles"><option value="title">Title A–Z</option><option value="year">Newest year</option><option value="rating">Highest rating</option></select></label><span>{filtered.length} {scopeLabel}</span></div>
      {browseLoading && <p className="static-result-status" role="status">Loading {selectedFacet?.name || 'this list'}…</p>}
      {usedLocalGenreFallback && <p className="static-result-status" role="status">Showing matching titles already in the loaded catalog; this genre list has no separate upstream results yet.</p>}
      {browseError ? <NoticeCard title="This list is temporarily unavailable" error>Try selecting the collection or genre again shortly.</NoticeCard> : error ? <NoticeCard title={isAnime ? 'Anime search is temporarily unavailable' : 'Search is temporarily unavailable'} error>The catalog service did not respond. Try again shortly.</NoticeCard> : visible.length ? <div className="poster-grid">{visible.map((movie, index) => <TitleCard key={movie.detailPath || movie.contentId || movie.title} movie={movie} priority={index < 6} />)}</div> : browseLoading ? null : <NoticeCard title={selectedFacet ? 'No titles in this list right now' : query ? 'No matching titles' : isAnime ? 'Search for an Anime title' : `No ${scopeLabel} available`}>{selectedFacet ? 'The upstream list currently has no titles for this selection.' : isAnime ? 'Enter a title above to explore its available episode guide.' : 'Try another title or choose a different collection or genre.'}</NoticeCard>}
      {moreLoading && <p className="static-result-status" role="status">Loading the next catalog page.</p>}
      {moreError && <p className="static-result-status" role="alert">The next catalog page could not be loaded. You can retry.</p>}
      {noMoreUpstream && !hasLocalMore && <p className="static-result-status" role="status">No more titles are available for this selection.</p>}
      {showMoreButton && <div className="load-more"><button type="button" className="button button-outline" onClick={requestMore} disabled={moreLoading || browseLoading}>{moreLoading ? 'Loading…' : moreError ? 'Retry loading more' : hasLocalMore ? 'Load more titles' : 'Load next page'}</button></div>}
    </>}
  </main>;
}
