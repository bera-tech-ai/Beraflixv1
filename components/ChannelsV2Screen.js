'use client';

import { useCallback, useEffect, useState } from 'react';
import ChannelHlsPlayer from './ChannelHlsPlayer';

async function requestChannelStream(countryCode, channelId) {
  const params = new URLSearchParams({ country: countryCode, channelId });
  const response = await fetch(`/api/channels-v2/stream?${params.toString()}`, { cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Live playback is temporarily unavailable.');
  if (!['hls', 'embed'].includes(result.kind) || typeof result.url !== 'string') throw new Error('A supported player is not available for this channel.');
  return result;
}

export default function ChannelsV2Screen() {
  const [countries, setCountries] = useState(null);
  const [countriesStatus, setCountriesStatus] = useState('idle');
  const [countriesError, setCountriesError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [channels, setChannels] = useState(null);
  const [channelsStatus, setChannelsStatus] = useState('idle');
  const [channelsError, setChannelsError] = useState('');
  const [activeStream, setActiveStream] = useState(null);

  const loadStream = useCallback(async (countryCode, channel, quiet = false) => {
    const id = String(channel?.id ?? '');
    if (!/^[a-z]{2}$/.test(countryCode || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
    const identity = { id, countryCode, name: channel.name || 'Live channel' };
    setActiveStream((current) => quiet
      ? current?.id === id ? { ...current, refreshing: true, refreshError: false } : current
      : { ...identity, status: 'loading' });

    try {
      const result = await requestChannelStream(countryCode, id);
      setActiveStream((current) => {
        if (quiet && current?.id !== id) return current;
        return {
          ...identity,
          ...result,
          status: 'ready',
          refreshing: false,
          refreshError: false
        };
      });
    } catch (requestError) {
      setActiveStream((current) => {
        if (quiet) {
          return current?.id === id
            ? { ...current, refreshing: false, refreshError: true, expiresAt: new Date(Date.now() + 90_000).toISOString() }
            : current;
        }
        return { ...identity, status: 'error', error: requestError?.message || 'Live playback is temporarily unavailable.' };
      });
    }
  }, []);

  useEffect(() => {
    if (activeStream?.status !== 'ready' || activeStream.kind !== 'hls' || activeStream.refreshing || !activeStream.expiresAt) return undefined;
    const remaining = Date.parse(activeStream.expiresAt) - Date.now() - 60_000;
    const timer = window.setTimeout(() => loadStream(activeStream.countryCode, activeStream, true), Math.max(1000, remaining));
    return () => window.clearTimeout(timer);
  }, [activeStream, loadStream]);

  async function loadCountries() {
    setCountriesStatus('loading');
    setCountriesError('');
    setActiveStream(null);
    try {
      const response = await fetch('/api/channels-v2/countries', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The country directory is temporarily unavailable.');
      setCountries(Array.isArray(result.countries) ? result.countries : []);
      setCountriesStatus('ready');
      setSelectedCountry(null);
      setChannels(null);
      setChannelsStatus('idle');
    } catch (requestError) {
      setCountries(null);
      setCountriesError(requestError?.message || 'The country directory is temporarily unavailable.');
      setCountriesStatus('error');
    }
  }

  async function loadChannels(country) {
    if (!/^[a-z]{2}$/.test(country?.code || '')) return;
    setSelectedCountry(country);
    setChannelsStatus('loading');
    setChannelsError('');
    setActiveStream(null);
    setChannels(null);
    try {
      const response = await fetch(`/api/channels-v2?country=${encodeURIComponent(country.code)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Channels are temporarily unavailable.');
      setChannels(Array.isArray(result.channels) ? result.channels : []);
      setChannelsStatus('ready');
    } catch (requestError) {
      setChannelsError(requestError?.message || 'Channels are temporarily unavailable.');
      setChannelsStatus('error');
    }
  }

  return <section className="channelsv2-screen" aria-label="Channel directory">
    <header className="channelsv2-header">
      <div className="channelsv2-heading-copy">
        <span className="channelsv2-kicker">CHANNEL DIRECTORY</span>
        <h2 className="channelsv2-title">Browse by country</h2>
        <p className="channelsv2-intro">Browse regional channel details; live playback appears only when a supported source is available.</p>
      </div>
      <button className="channelsv2-load-button" type="button" onClick={loadCountries} disabled={countriesStatus === 'loading'}>
        {countriesStatus === 'loading' ? 'Loading countries…' : countries ? 'Refresh countries' : 'Load countries'}
      </button>
    </header>

    {countriesStatus === 'loading' && <p className="channelsv2-state" role="status">Loading the country directory.</p>}
    {countriesStatus === 'error' && <div className="channelsv2-error" role="alert"><p>{countriesError}</p><button className="channelsv2-retry-button" type="button" onClick={loadCountries}>Try again</button></div>}
    {countriesStatus === 'ready' && countries.length === 0 && <p className="channelsv2-empty" role="status">No countries are listed right now.</p>}
    {countriesStatus === 'idle' && <p className="channelsv2-idle" role="status">Select “Load countries” to browse the directory.</p>}

    {countriesStatus === 'ready' && countries.length > 0 && <section className="channelsv2-country-section" aria-label="Countries">
      <h3 className="channelsv2-section-title">Countries</h3>
      <ul className="channelsv2-country-list">
        {countries.map((country) => <li className="channelsv2-country-item" key={country.code}>
          <button className={`channelsv2-country-button${selectedCountry?.code === country.code ? ' channelsv2-country-button-selected' : ''}`} type="button" onClick={() => loadChannels(country)} aria-pressed={selectedCountry?.code === country.code} disabled={channelsStatus === 'loading' && selectedCountry?.code === country.code}>
            <span className="channelsv2-country-name">{country.name}</span>
            <span className="channelsv2-country-code">{country.code.toUpperCase()}</span>
            <span className="channelsv2-country-count">{country.channelCount} channels</span>
            {country.timeZone && <span className="channelsv2-country-timezone">{country.timeZone}</span>}
          </button>
        </li>)}
      </ul>
    </section>}

    {selectedCountry && <section className="channelsv2-channel-section" aria-label={`Channels in ${selectedCountry.name}`}>
      <div className="channelsv2-section-heading">
        <h3 className="channelsv2-section-title">Channels in {selectedCountry.name}</h3>
        <span className="channelsv2-selected-code">{selectedCountry.code.toUpperCase()}</span>
      </div>
      {channelsStatus === 'loading' && <p className="channelsv2-state" role="status">Loading channels for {selectedCountry.name}.</p>}
      {channelsStatus === 'error' && <div className="channelsv2-error" role="alert"><p>{channelsError}</p><button className="channelsv2-retry-button" type="button" onClick={() => loadChannels(selectedCountry)}>Try again</button></div>}
      {channelsStatus === 'ready' && channels?.length === 0 && <p className="channelsv2-empty" role="status">No channels are listed for this country.</p>}
      {channelsStatus === 'ready' && channels?.length > 0 && <div className="channelsv2-channel-list">
        {channels.map((channel) => {
          const isActive = activeStream?.id === String(channel.id);
          return <article className={`channelsv2-channel-card${isActive ? ' channelsv2-channel-card-active' : ''}`} key={channel.id}>
            <h4 className="channelsv2-channel-name">{channel.name}</h4>
            {channel.country && <p className="channelsv2-channel-country">{channel.country}</p>}
            <dl className="channelsv2-channel-meta">
              {channel.languages?.length > 0 && <div className="channelsv2-channel-meta-row"><dt>Languages</dt><dd>{channel.languages.join(', ')}</dd></div>}
              {channel.streamType && <div className="channelsv2-channel-meta-row"><dt>Type</dt><dd>{channel.streamType}</dd></div>}
              <div className="channelsv2-channel-meta-row"><dt>Geo restriction</dt><dd>{channel.isGeoBlocked ? 'Restricted' : 'Not marked as restricted'}</dd></div>
            </dl>
            {channel.isGeoBlocked
              ? <p className="channelsv2-restricted-note">Playback is not available for this channel in the current region.</p>
              : <button className="channelsv2-watch-button" type="button" onClick={() => loadStream(selectedCountry.code, channel)} disabled={isActive && activeStream.status === 'loading'}>{isActive && activeStream.status === 'loading' ? 'Starting…' : isActive && activeStream.status === 'ready' ? 'Reconnect' : 'Watch live'}</button>}
            {isActive && <div className="channelsv2-live-panel">
              <div className="channelsv2-live-heading"><span className="channelsv2-kicker">LIVE CHANNEL</span><button className="channelsv2-close-live" type="button" onClick={() => setActiveStream(null)}>Close</button></div>
              {activeStream.status === 'loading' && <p className="channelsv2-state" role="status">Preparing live playback.</p>}
              {activeStream.status === 'error' && <div className="channelsv2-player-error" role="alert"><p>{activeStream.error}</p><button type="button" className="channelsv2-retry-button" onClick={() => loadStream(selectedCountry.code, channel)}>Try again</button></div>}
              {activeStream.status === 'ready' && <>
                {activeStream.kind === 'hls'
                  ? <ChannelHlsPlayer key={activeStream.url} url={activeStream.url} title={channel.name} onRetry={() => loadStream(selectedCountry.code, channel)} />
                  : <iframe className="channelsv2-embed-player" src={activeStream.url} title={`${channel.name} live player`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" />}
                {activeStream.refreshing && <p className="channelsv2-state" role="status">Renewing live playback access.</p>}
                {activeStream.refreshError && <div className="channelsv2-player-error" role="alert"><p>Live playback access could not be renewed.</p><button type="button" className="channelsv2-retry-button" onClick={() => loadStream(selectedCountry.code, channel)}>Reconnect</button></div>}
              </>}
            </div>}
          </article>;
        })}
      </div>}
    </section>}
  </section>;
}
