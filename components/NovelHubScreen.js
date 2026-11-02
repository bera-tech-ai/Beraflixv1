'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, Search, X } from 'lucide-react';

const SECTIONS = [
  { id: 'home', label: 'Discover' },
  { id: 'genres', label: 'Genres' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'recommendations', label: 'Recommended' },
  { id: 'operations', label: 'Collections' },
  { id: 'rank-groups', label: 'Rankings' }
];
const LIST_PAGE_SIZE = 24;
const CHAPTER_PAGE_SIZE = 100;

async function request(action, values = {}, options = {}) {
  const params = new URLSearchParams({ action });
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const response = await fetch(`/api/novels?${params.toString()}`, {
    cache: options.noStore ? 'no-store' : 'force-cache',
    signal: options.signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'This novel list is temporarily unavailable.');
  return data;
}

function CoverPlaceholder({ title }) {
  const initials = String(title || 'Novel').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase() || 'N';
  return <div className="novelhub-cover" aria-hidden="true"><span className="novelhub-cover-mark">{initials}</span><span className="novelhub-cover-caption">NOVEL</span></div>;
}

function NovelCard({ novel, onOpen }) {
  return <article className="novelhub-card">
    <button type="button" className="novelhub-card-open" onClick={() => onOpen(novel)} aria-label={`View ${novel.title || 'novel'} details`}>
      <CoverPlaceholder title={novel.title} />
      <span className="novelhub-card-copy">
        <strong className="novelhub-card-title">{novel.title || 'Untitled novel'}</strong>
        {novel.author && <span className="novelhub-card-author">{novel.author}</span>}
        {novel.genres?.length > 0 && <span className="novelhub-card-genres">{novel.genres.slice(0, 2).join(' · ')}</span>}
        {novel.score !== null && novel.score !== undefined && <span className="novelhub-card-score">Score {novel.score}</span>}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </article>;
}

function Status({ children, kind = 'note' }) {
  const role = kind === 'loading' ? 'status' : kind === 'error' ? 'alert' : 'note';
  return <p className={`novelhub-status novelhub-status-${kind}`} role={role}>{children}</p>;
}

export default function NovelHubScreen() {
  const [active, setActive] = useState('home');
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [genres, setGenres] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [listStatus, setListStatus] = useState('loading');
  const [detail, setDetail] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapterStatus, setChapterStatus] = useState('idle');
  const [detailStatus, setDetailStatus] = useState('idle');
  const [reader, setReader] = useState(null);
  const [readerStatus, setReaderStatus] = useState('idle');

  useEffect(() => {
    const controller = new AbortController();
    setListStatus('loading');
    request('home', { page: 1, size: LIST_PAGE_SIZE }, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setGroups(Array.isArray(data.sections) ? data.sections : []);
        setListStatus('ready');
      })
      .catch((error) => { if (!controller.signal.aborted) setListStatus('error'); });
    request('genres', {}, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setGenres(Array.isArray(data.items) ? data.items : []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function loadSection(section, currentPage = 1) {
    setActive(section);
    setSubmittedKeyword('');
    setPage(currentPage);
    setListStatus('loading');
    setItems([]);
    setGroups([]);
    try {
      const data = await request(section, { page: currentPage, size: LIST_PAGE_SIZE });
      setItems(Array.isArray(data.items) ? data.items : []);
      setGroups(Array.isArray(data.groups) ? data.groups : Array.isArray(data.sections) ? data.sections : []);
      setListStatus('ready');
    } catch {
      setListStatus('error');
    }
  }

  async function submitSearch(event, requestedKeyword = keyword) {
    event?.preventDefault();
    const query = String(requestedKeyword || '').trim().slice(0, 100);
    setKeyword(query);
    setSubmittedKeyword(query);
    setActive('search');
    setPage(1);
    setItems([]);
    setGroups([]);
    if (!query) {
      setListStatus('empty');
      return;
    }
    setListStatus('loading');
    try {
      const data = await request('search', { keyword: query, page: 1, size: LIST_PAGE_SIZE });
      setItems(Array.isArray(data.items) ? data.items : []);
      setListStatus('ready');
    } catch {
      setListStatus('error');
    }
  }

  async function openNovel(novel) {
    setReader(null);
    setReaderStatus('idle');
    setDetail(novel);
    setChapters([]);
    setDetailStatus('loading');
    setChapterStatus('loading');
    const novelId = novel?.novelId;
    if (!novelId) {
      setDetailStatus('ready');
      setChapterStatus('error');
      return;
    }
    const [detailResult, chaptersResult] = await Promise.allSettled([
      request('detail', { novelId }),
      request('chapters', { novelId, page: 1, size: CHAPTER_PAGE_SIZE })
    ]);
    if (detailResult.status === 'fulfilled') {
      setDetail(detailResult.value.item || novel);
      setDetailStatus('ready');
    } else setDetailStatus('error');
    if (chaptersResult.status === 'fulfilled') {
      setChapters(Array.isArray(chaptersResult.value.items) ? chaptersResult.value.items.slice(0, CHAPTER_PAGE_SIZE) : []);
      setChapterStatus('ready');
    } else setChapterStatus('error');
  }

  async function openChapter(chapter) {
    setReaderStatus('loading');
    setReader(null);
    try {
      const data = await request('chapter', { chapterId: chapter.chapterId }, { noStore: true });
      setReader(data.chapter || null);
      setReaderStatus(data.chapter?.content ? 'ready' : 'empty');
    } catch {
      setReaderStatus('error');
    }
  }

  function closeReader() {
    setReader(null);
    setReaderStatus('idle');
  }

  function closeDetail() {
    closeReader();
    setDetail(null);
    setChapters([]);
    setDetailStatus('idle');
    setChapterStatus('idle');
  }

  const activeLabel = active === 'search' ? `Search results for “${submittedKeyword}”` : SECTIONS.find((section) => section.id === active)?.label || 'Discover';
  const displayGroups = groups.length ? groups : (items.length ? [{ title: activeLabel, items }] : []);

  return <main className="novelhub-screen" aria-label="Novel discovery">
    <header className="novelhub-heading">
      <div><span className="novelhub-kicker">READ SOMETHING NEW</span><h1 className="novelhub-title">Books</h1><p className="novelhub-intro">Explore stories, browse genres, and open a chapter to read.</p></div>
      <BookOpen className="novelhub-heading-icon" size={25} aria-hidden="true" />
    </header>

    <form className="novelhub-search" role="search" onSubmit={submitSearch}>
      <Search size={19} aria-hidden="true" />
      <label className="novelhub-visually-hidden" htmlFor="novelhub-search-input">Search novels</label>
      <input id="novelhub-search-input" type="search" value={keyword} maxLength={100} placeholder="Search novels or authors" onChange={(event) => setKeyword(event.target.value)} />
      {keyword && <button type="button" className="novelhub-clear-search" aria-label="Clear search" onClick={() => setKeyword('')}><X size={16} /></button>}
      <button className="novelhub-search-submit" type="submit">Search</button>
    </form>

    <nav className="novelhub-navigation" aria-label="Novel sections">
      {SECTIONS.map((section) => <button type="button" key={section.id} className={`novelhub-nav-button${active === section.id ? ' novelhub-selected' : ''}`} aria-pressed={active === section.id} onClick={() => loadSection(section.id)}>{section.label}</button>)}
    </nav>

    {genres.length > 0 && <section className="novelhub-genre-area" aria-label="Browse genres">
      <h2 className="novelhub-subheading">Genres</h2>
      <div className="novelhub-genre-list">{genres.slice(0, 30).map((genre, index) => <button type="button" key={`${genre.name}-${index}`} className="novelhub-genre-button" onClick={() => submitSearch(null, genre.name)}>{genre.name}{genre.count !== null && genre.count !== undefined ? ` (${genre.count})` : ''}</button>)}</div>
    </section>}

    <section className="novelhub-results" aria-live="polite">
      <div className="novelhub-results-heading"><h2 className="novelhub-subheading">{activeLabel}</h2>{active === 'search' && submittedKeyword && <span className="novelhub-result-count">{items.length} shown</span>}</div>
      {listStatus === 'loading' && <Status kind="loading">Loading novels…</Status>}
      {listStatus === 'error' && <Status kind="error">This novel list is temporarily unavailable. Please try again.</Status>}
      {listStatus === 'empty' && <Status>No search term entered. Search by title, author, or genre.</Status>}
      {listStatus === 'ready' && displayGroups.length === 0 && <Status>No novels are available in this section right now.</Status>}
      {listStatus === 'ready' && displayGroups.map((group, groupIndex) => <section className="novelhub-group" key={`${group.title || 'section'}-${groupIndex}`}>
        {displayGroups.length > 1 && <h3 className="novelhub-group-title">{group.title || 'More to explore'}</h3>}
        <div className="novelhub-grid">{(group.items || []).slice(0, 100).map((novel, index) => <NovelCard key={novel.novelId || `${novel.title}-${index}`} novel={novel} onOpen={openNovel} />)}</div>
      </section>)}
      {listStatus === 'ready' && active === 'search' && items.length >= LIST_PAGE_SIZE && <button type="button" className="novelhub-more-button" onClick={async () => {
        const nextPage = page + 1;
        setListStatus('loading');
        try {
          const data = await request('search', { keyword: submittedKeyword, page: nextPage, size: LIST_PAGE_SIZE });
          setItems((current) => [...current, ...(Array.isArray(data.items) ? data.items : [])].slice(0, 100));
          setPage(nextPage);
          setListStatus('ready');
        } catch { setListStatus('error'); }
      }}>Load more results</button>}
    </section>

    {detail && <div className="novelhub-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
      <section className="novelhub-detail" role="dialog" aria-modal="true" aria-labelledby="novelhub-detail-title">
        <div className="novelhub-dialog-actions"><button type="button" className="novelhub-back-button" onClick={closeDetail}><ArrowLeft size={17} /> Back to browse</button><button type="button" className="novelhub-close-button" aria-label="Close details" onClick={closeDetail}><X size={20} /></button></div>
        <div className="novelhub-detail-heading"><CoverPlaceholder title={detail.title} /><div className="novelhub-detail-copy">
          <h2 id="novelhub-detail-title" className="novelhub-detail-title">{detail.title || 'Novel details'}</h2>
          {detail.author && <p className="novelhub-detail-author">by {detail.author}</p>}
          {detailStatus === 'loading' && <Status kind="loading">Loading novel details…</Status>}
          {detailStatus === 'error' && <Status kind="error">Full details are unavailable; showing the information from the list.</Status>}
          {detail.summary && <p className="novelhub-summary">{detail.summary}</p>}
          {!!detail.genres?.length && <p className="novelhub-detail-meta">{detail.genres.join(' · ')}</p>}
          {!!detail.novelStatusDesc && <p className="novelhub-detail-meta">{detail.novelStatusDesc}</p>}
          {detail.totalChapters !== null && detail.totalChapters !== undefined && <p className="novelhub-detail-meta">{detail.totalChapters} chapters</p>}
        </div></div>
        <section className="novelhub-chapter-section" aria-label="Chapter list">
          <h3 className="novelhub-chapter-heading">Chapters</h3>
          {chapterStatus === 'loading' && <Status kind="loading">Loading chapters…</Status>}
          {chapterStatus === 'error' && <Status kind="error">The chapter list is temporarily unavailable.</Status>}
          {chapterStatus === 'ready' && chapters.length === 0 && <Status>No chapters are available right now.</Status>}
          {chapters.length > 0 && <ol className="novelhub-chapter-list">{chapters.map((chapter, index) => <li className="novelhub-chapter-item" key={chapter.chapterId}>
            <button type="button" className="novelhub-chapter-button" onClick={() => openChapter(chapter)}><span className="novelhub-chapter-label">{chapter.chapterName || `Chapter ${chapter.seq ?? index + 1}`}</span><ChevronRight size={17} aria-hidden="true" /></button>
          </li>)}</ol>}
        </section>
      </section>
    </div>}

    {reader && <div className="novelhub-reader-overlay" role="presentation">
      <section className="novelhub-reader" role="dialog" aria-modal="true" aria-labelledby="novelhub-reader-title">
        <div className="novelhub-reader-toolbar"><button type="button" className="novelhub-back-button" onClick={closeReader}><ArrowLeft size={17} /> Chapter list</button><button type="button" className="novelhub-close-button" aria-label="Close reader" onClick={closeReader}><X size={20} /></button></div>
        <h2 id="novelhub-reader-title" className="novelhub-reader-title">{reader.chapterName || 'Chapter'}</h2>
        {reader.contentTruncated && <Status>The displayed chapter text has been shortened for safety.</Status>}
        <pre className="novelhub-reader-text">{reader.content}</pre>
      </section>
    </div>}
    {!reader && readerStatus === 'loading' && detail && <div className="novelhub-reader-message" role="status">Loading chapter…</div>}
    {!reader && readerStatus === 'error' && detail && <div className="novelhub-reader-message" role="alert">This chapter is temporarily unavailable.</div>}
    {!reader && readerStatus === 'empty' && detail && <div className="novelhub-reader-message" role="status">No chapter text is available.</div>}
  </main>;
}
