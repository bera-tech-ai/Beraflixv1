'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Check, Clock3, Download, FolderPlus, Heart, History, Play, Plus, Trash2, Tv, X } from 'lucide-react';
import TitleCard from './TitleCard';
import NoticeCard from './NoticeCard';
import { useShelf } from './ShelfProvider';
import { useOfflineVault } from './OfflineVaultProvider';

const tabs = [
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'favorites', label: 'Favorites', icon: Check },
  { id: 'continueWatching', label: 'Continue Watching', icon: Clock3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'liked', label: 'Liked', icon: Heart },
  { id: 'watched', label: 'Watched', icon: Tv },
  { id: 'collections', label: 'Collections', icon: FolderPlus }
];

function timestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
function watchHref(movie) {
  const path = `/watch/${encodeURIComponent(movie.detailPath)}`;
  return movie.season && movie.episode ? `${path}?${new URLSearchParams({ se: String(movie.season), ep: String(movie.episode) }).toString()}` : path;
}

function ShelfEntry({ movie, category, onRemove, toggle }) {
  const progress = category === 'continueWatching' ? Math.max(0, Math.min(100, Number(movie.percent) || 0)) : null;
  const episode = movie.season && movie.episode ? `S${movie.season} E${movie.episode}` : '';
  return <article className="shelf-entry">
    <TitleCard movie={movie} />
    <div className="shelf-entry-actions">
      {category === 'continueWatching' && <><span className="progress-label">{episode ? `${episode} · ` : ''}{progress}% watched</span><Link className="mini-action resume-action" href={watchHref(movie)}>Resume</Link></>}
      {category === 'history' && <span className="shelf-stamp">{episode ? `${episode} · ` : ''}Opened {timestamp(movie.openedAt)}</span>}
      {category === 'watched' && <button type="button" className="mini-action" onClick={() => toggle('watched', movie)}>{episode ? `Mark ${episode} unwatched` : 'Mark unwatched'}</button>}
      {category === 'watchlist' && <button type="button" className="mini-action" onClick={() => toggle('watchlist', movie)}>Remove from Watchlist</button>}
      {category === 'favorites' && <button type="button" className="mini-action" onClick={() => toggle('favorites', movie)}>Remove Favorite</button>}
      {category === 'liked' && <button type="button" className="mini-action" onClick={() => toggle('liked', movie)}>Unlike</button>}
      {(category === 'history' || category === 'continueWatching') && <button type="button" className="icon-action" onClick={() => onRemove(movie)} aria-label={`Remove ${movie.title} from ${category === 'history' ? 'history' : 'continue watching'}`}><X size={15} /></button>}
    </div>
    {progress !== null && <span className="progress-track shelf-progress"><i style={{ width: `${progress}%` }} /></span>}
  </article>;
}

export default function ShelfScreen({ catalog = [] }) {
  const { state, ready, storageWarning, toggle, removeHistory, removeProgress, clearHistory, createCollection, renameCollection, deleteCollection, toggleCollectionItem, removeDownloadRequest } = useShelf();
  const { records: offlineRecords, ready: offlineReady, openFile, deleteRecord: deleteOfflineFile } = useOfflineVault();
  const [active, setActive] = useState('watchlist');
  const [collectionId, setCollectionId] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [playingOffline, setPlayingOffline] = useState(null);
  const currentCollection = state.collections.find((collection) => collection.id === collectionId) || state.collections[0];
  const currentItems = active === 'collections' ? (currentCollection?.items || []) : active === 'downloads' ? state.downloads : (state[active] || []);
  const completedOffline = offlineRecords.filter((record) => record.status === 'complete');
  const incompleteOfflineCount = offlineRecords.filter((record) => ['downloading', 'paused', 'failed'].includes(record.status)).length;
  const availableTitles = useMemo(() => {
    if (!currentCollection) return [];
    return catalog.filter((movie) => !currentCollection.items.some((saved) => saved.detailPath === movie.detailPath) && movie.title.toLowerCase().includes(addQuery.toLowerCase())).slice(0, 10);
  }, [catalog, currentCollection, addQuery]);

  useEffect(() => {
    if (!playingOffline?.url) return undefined;
    return () => URL.revokeObjectURL(playingOffline.url);
  }, [playingOffline?.url]);

  function removeItem(item) {
    if (active === 'history') removeHistory(item);
    else if (active === 'continueWatching') removeProgress(item);
  }
  function submitCollection(event) {
    event.preventDefault();
    if (!collectionName.trim()) return;
    createCollection(collectionName);
    setCollectionName('');
  }
  function clearHistoryWithConfirm() {
    if (window.confirm('Clear all viewing history? This will not remove downloads, Favorites, Watchlist items, Likes, or Custom Collections.')) clearHistory();
  }
  async function playDownloadedFile(record) {
    try {
      const url = await openFile(record.id);
      setPlayingOffline({ title: record.title, url });
    } catch {
      window.alert('This local file is not available or no longer matches its verified size. Open Downloads to refresh the offline list.');
    }
  }
  async function deleteDownloadedFile(record) {
    if (!window.confirm(`Delete “${record.title}” from this device’s BERAFLIX offline vault?`)) return;
    try { await deleteOfflineFile(record.id); } catch { window.alert('The local file could not be deleted. Check browser storage permissions and try again.'); }
  }

  return <main className="page-inner screen-page shelf-page">
    <div className="screen-heading"><div><span className="section-kicker">YOUR PERSONAL CINEMA</span><h1>My Shelf</h1><p>Your watchlist, favorites, history, and collections.</p></div><div className="local-pill"><span className="status-dot" /> SAVED ON THIS DEVICE</div></div>
    {storageWarning && <div className="storage-warning" role="status">{storageWarning}</div>}
    <div className="shelf-layout">
      <aside className="shelf-tabs" aria-label="Shelf categories">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setActive(id)} className={`shelf-tab ${active === id ? 'selected' : ''}`} aria-pressed={active === id}><Icon size={17} /><span>{label}</span><small>{id === 'collections' ? state.collections.length : id === 'downloads' ? completedOffline.length : (state[id] || []).length}</small></button>)}</aside>
      <section className="shelf-panel">
        <div className="shelf-panel-heading"><div><span className="section-kicker">{active === 'collections' ? 'YOUR CURATED LISTS' : 'PRIVATE TO THIS BROWSER'}</span><h2>{tabs.find((tab) => tab.id === active)?.label}</h2></div>{active === 'history' && state.history.length > 0 && <button type="button" className="text-button danger-text" onClick={clearHistoryWithConfirm}><Trash2 size={15} /> Clear History</button>}</div>
        {!ready && <p className="muted-copy">Loading your shelf…</p>}
        {active === 'collections' ? <>
          <form onSubmit={submitCollection} className="collection-create-form"><input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} maxLength={40} placeholder="Name a collection" aria-label="Name a collection" /><button type="submit" disabled={!collectionName.trim()}><Plus size={16} /> Create</button></form>
          {state.collections.length > 0 ? <>
            <div className="collection-tabs">{state.collections.map((collection) => <button type="button" key={collection.id} className={`filter-chip ${currentCollection?.id === collection.id ? 'selected' : ''}`} onClick={() => setCollectionId(collection.id)}>{collection.name} <small>{collection.items.length}</small></button>)}</div>
            {currentCollection && <>
              <div className="collection-manage-row"><span>{currentCollection.items.length} saved titles</span><div><button type="button" className="mini-action" onClick={() => { const name = window.prompt('Rename this collection', currentCollection.name); if (name?.trim()) renameCollection(currentCollection.id, name); }}>Rename</button><button type="button" className="mini-action danger-text" onClick={() => { if (window.confirm(`Delete “${currentCollection.name}”? This only deletes the collection, not its titles.`)) { deleteCollection(currentCollection.id); setCollectionId(''); } }}>Delete</button></div></div>
              {currentCollection.items.length > 0 ? <div className="poster-grid shelf-grid">{currentCollection.items.map((movie) => <div key={movie.detailPath} className="collection-title"><TitleCard movie={movie} /><button type="button" className="mini-action" onClick={() => toggleCollectionItem(currentCollection.id, movie)}>Remove from collection</button></div>)}</div> : <NoticeCard title="This collection is waiting for a first title">Add a movie from your catalog below.</NoticeCard>}
              <div className="collection-add-area"><h3>Add a title</h3><input value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder="Filter catalog titles" aria-label="Filter catalog titles to add" />{availableTitles.length > 0 ? <div className="add-title-list">{availableTitles.map((movie) => <div key={movie.detailPath}><span>{movie.title}</span><button type="button" onClick={() => toggleCollectionItem(currentCollection.id, movie)}><Plus size={15} /> Add</button></div>)}</div> : <p className="muted-copy">No more matching titles in the current catalog.</p>}</div>
            </>}
          </> : <NoticeCard title="Create your first collection">Build a personal list, then add titles from a detail page or from the catalog below.</NoticeCard>}
        </> : active === 'downloads' ? <>
          <p className="source-availability-note">Completed files below are verified local copies in this browser profile. They do not sync to a cloud database or another device.</p>
          {completedOffline.length > 0 ? <div className="shelf-offline-list">{completedOffline.map((item) => <article key={item.id} className="shelf-offline-entry"><div className="shelf-offline-art">{item.coverUrl && <Image src={item.coverUrl} alt="" width={52} height={75} unoptimized />}</div><div className="shelf-offline-copy"><h3>{item.title}{item.season && item.episode ? ` · S${item.season} E${item.episode}` : ''}</h3><p>{item.quality} · Saved on this device</p><div className="shelf-entry-actions"><button type="button" className="mini-action" onClick={() => playDownloadedFile(item)}><Play size={13} /> Play offline</button><button type="button" className="mini-action danger-text" onClick={() => deleteDownloadedFile(item)}>Delete local file</button></div></div></article>)}</div> : <NoticeCard title={offlineReady ? 'No files saved offline yet' : 'Checking local offline storage'}>Choose Save Offline on a supported title, or open Downloads to check browser support and transfer status.</NoticeCard>}
          {incompleteOfflineCount > 0 && <p className="shelf-offline-pending" role="status">{incompleteOfflineCount} local {incompleteOfflineCount === 1 ? 'transfer is' : 'transfers are'} incomplete. <Link href="/downloads">Open Downloads to resume or discard them.</Link></p>}
          {currentItems.length > 0 && <details className="shelf-request-history"><summary>Browser-link request history ({currentItems.length})</summary><p>These records are not confirmed offline files and do not show browser download status.</p>{currentItems.map((item) => <div key={item.id} className="shelf-request-row"><span>{item.title}{item.season && item.episode ? ` · S${item.season} E${item.episode}` : ''} · {item.status}</span><div><Link className="mini-action" href={`/movie/${encodeURIComponent(item.detailPath)}`}>Title details</Link><button type="button" className="mini-action" onClick={() => removeDownloadRequest(item.id)}>Remove record</button></div></div>)}</details>}
          <Link href="/downloads" className="text-link shelf-browse-link">Open Downloads manager <span>→</span></Link>
        </> : currentItems.length > 0 ? <div className="poster-grid shelf-grid">{currentItems.map((movie) => <ShelfEntry key={`${movie.detailPath}-${movie.season || 0}-${movie.episode || 0}`} movie={movie} category={active} onRemove={removeItem} toggle={toggle} />)}</div> : <NoticeCard title={active === 'continueWatching' ? 'Nothing in progress yet' : active === 'history' ? 'Your history is clear' : 'Nothing saved here yet'}>{active === 'continueWatching' ? 'Start a title and playback progress will appear here when the stream supports it.' : active === 'history' ? 'Titles you open will appear here. Clearing history never removes your other shelf categories.' : 'Explore the catalog and use the actions on any title to save it here.'}</NoticeCard>}
      </section>
    </div>
    <p className="shelf-sync-note">Library changes stay in this browser and sync across open tabs. Account sign-in and cross-device sync are not enabled for this app.</p>
    <Link href="/explore" className="text-link shelf-browse-link">Browse the catalog <span>→</span></Link>
    {playingOffline && <div className="offline-player-overlay" role="dialog" aria-modal="true" aria-label={`Play ${playingOffline.title} offline`}><div className="offline-player-dialog"><div className="offline-player-toolbar"><div><span className="section-kicker">PLAYING FROM THIS DEVICE</span><h2>{playingOffline.title}</h2></div><button type="button" className="icon-button" onClick={() => setPlayingOffline(null)} aria-label="Close offline player">×</button></div><video className="offline-player-video" src={playingOffline.url} controls playsInline autoPlay preload="metadata" aria-label={`${playingOffline.title} offline video`} /></div></div>}
  </main>;
}
