'use client';

import { useState } from 'react';
import { useShelf } from './ShelfProvider';
import { Bookmark, Check, Heart, ListPlus, Plus } from 'lucide-react';

function Action({ active, onClick, icon: Icon, children, primary = false, disabled = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className={`action-button ${primary ? 'action-primary' : ''} ${active ? 'action-active' : ''}`}>
    {Icon && <Icon size={17} fill={active && Icon === Heart ? 'currentColor' : 'none'} />}<span>{children}</span>{active && <Check size={14} className="action-check" />}
  </button>;
}

export default function TitleActions({ movie }) {
  const { state, has, toggle, createCollection, toggleCollectionItem } = useShelf();
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState('');

  function addCollection(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const wasDuplicate = state.collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase());
    createCollection(name);
    setNewName('');
    setNotice(wasDuplicate ? 'That collection already exists.' : `Created “${name}”.`);
  }

  return <div className="detail-actions">
    <div className="action-row">
      <Action icon={Bookmark} active={has('watchlist', movie)} onClick={() => toggle('watchlist', movie)}>Watchlist</Action>
      <Action icon={Heart} active={has('favorites', movie)} onClick={() => toggle('favorites', movie)}>Favorites</Action>
      <Action icon={Heart} active={has('liked', movie)} onClick={() => toggle('liked', movie)}>Like</Action>
      <Action icon={Check} active={has('watched', movie)} onClick={() => toggle('watched', movie)}>Watched</Action>
    </div>
    <div className="collection-control">
      <label htmlFor="collection-add"><ListPlus size={17} /> Add to collection</label>
      <select id="collection-add" defaultValue="" onChange={(event) => {
        const id = event.target.value;
        if (id) toggleCollectionItem(id, movie);
        event.target.value = '';
      }}>
        <option value="" disabled>{state.collections.length ? 'Choose a collection' : 'Create a collection first'}</option>
        {state.collections.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}
      </select>
      <form onSubmit={addCollection} className="create-collection-inline">
        <input aria-label="New collection name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={40} placeholder="New collection" />
        <button type="submit" aria-label="Create collection" disabled={!newName.trim()}><Plus size={16} /></button>
      </form>
      {notice && <p className="inline-note" role="status">{notice}</p>}
    </div>
  </div>;
}
