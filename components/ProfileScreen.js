'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Check, ChevronRight, CircleUserRound, Download, Info, MonitorCog, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { useShelf } from './ShelfProvider';

export default function ProfileScreen() {
  const { state, setProfile, setPreference, storageWarning } = useShelf();
  const [name, setName] = useState(state.profile.displayName || '');
  useEffect(() => { setName(state.profile.displayName || ''); }, [state.profile.displayName]);
  const displayName = state.profile.displayName || 'Local profile';
  const initials = displayName === 'Local profile' ? 'B' : displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const [saved, setSaved] = useState(false);

  function saveName(event) {
    event.preventDefault();
    setProfile({ displayName: name.trim().slice(0, 40) });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  return <main className="page-inner screen-page profile-page">
    <div className="screen-heading"><div><span className="section-kicker">YOUR BERAFLIX</span><h1>Profile</h1><p>Personalize the way you discover and watch.</p></div><span className="heading-mark"><UserRound size={20} /></span></div>
    <section className="profile-card"><div className="profile-avatar" aria-hidden="true">{initials}</div><div className="profile-main"><span className="section-kicker">THIS DEVICE</span><h2>{displayName}</h2><p>No account is connected. Your shelf and preferences live in this browser.</p></div><span className="profile-local-badge"><ShieldCheck size={14} /> LOCAL</span></section>
    <form className="profile-name-form" onSubmit={saveName}><label htmlFor="display-name">Display name</label><div><input id="display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Add a display name" /><button type="submit">{saved ? <><Check size={16} /> Saved</> : 'Save name'}</button></div></form>
    {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}

    <section className="profile-section"><div className="section-title-line"><span className="section-kicker">SHORTCUTS</span><h2>Your library</h2></div><Link href="/shelf" className="profile-link-card"><span className="profile-link-icon"><Bookmark size={18} /></span><span><b>My Shelf</b><small>Watchlist, favorites, history, and collections</small></span><ChevronRight size={18} /></Link><Link href="/downloads" className="profile-link-card"><span className="profile-link-icon blue-icon"><Download size={18} /></span><span><b>Download manager</b><small>Signed links, request history, and browser status guidance</small></span><ChevronRight size={18} /></Link></section>

    <section className="profile-section"><div className="section-title-line"><span className="section-kicker">INSTALL & OFFLINE</span><h2>Use BERAFLIX on your phone</h2></div><div className="install-help-card"><span className="profile-link-icon"><Smartphone size={18} /></span><div><b>Install from the app header</b><p>While you’re online, the installed app can browse and stream just like the website. BERAFLIX doesn’t automatically scan your phone’s Downloads folder. To watch an authorized file saved there offline, open it from your device’s file manager or media player; this website can’t yet open local files inside the BERAFLIX player. Streaming and the catalog still need an internet connection.</p></div></div></section>

    <section className="profile-section"><div className="section-title-line"><span className="section-kicker">PLAYBACK</span><h2>Preferences</h2></div>
      <label className="setting-row"><span><b>Save playback progress</b><small>Keep a resume point on this device when the stream reports time.</small></span><input type="checkbox" checked={Boolean(state.preferences.saveProgress)} onChange={(event) => setPreference('saveProgress', event.target.checked)} aria-label="Save playback progress" /></label>
      <label className="setting-row"><span><b>Autoplay on player open</b><small>Ask the browser to start the stream automatically; playback policies may block it.</small></span><input type="checkbox" checked={Boolean(state.preferences.autoplay)} onChange={(event) => setPreference('autoplay', event.target.checked)} aria-label="Autoplay on player open" /></label>
      <label className="setting-row quality-setting"><span><b>Streaming quality</b><small>Choose a preferred resolution when it is available.</small></span><select value={state.preferences.quality || 'auto'} onChange={(event) => setPreference('quality', event.target.value)} aria-label="Streaming quality"><option value="auto">Auto</option><option value="360p">360p</option><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
      <div className="appearance-row"><span className="appearance-icon"><MonitorCog size={18} /></span><span><b>Appearance</b><small>Cinematic dark mode is part of the BERAFLIX experience.</small></span><span className="appearance-chip">DARK</span></div>
    </section>

    <section className="profile-section"><div className="section-title-line"><span className="section-kicker">ACCOUNT & ABOUT</span><h2>About this profile</h2></div><div className="sync-notice"><CircleUserRound size={19} /><div><b>Cross-device sync is unavailable</b><p>There is no account or library-sync service connected. Your personal library stays on this device and syncs only across tabs in this browser.</p></div></div><div className="about-card"><span className="about-mark"><Info size={18} /></span><div><b>BERAFLIX</b><p>By BERA TECH</p><small>Discover stories. Build your shelf.</small></div><span className="about-brand">B·T</span></div></section>
  </main>;
}
