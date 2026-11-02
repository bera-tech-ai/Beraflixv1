'use client';

import { useEffect, useMemo, useState } from 'react';
import { Radio, Tv } from 'lucide-react';
import NoticeCard from './NoticeCard';

const fallbackChannels = [{ id: '9', name: 'Channel 9', status: '', isLive: null, logo: '', slogan: '' }];

export default function ChannelScheduleScreen({ channels = fallbackChannels, directoryError = false }) {
  const availableChannels = useMemo(() => {
    const byId = new Map(fallbackChannels.map((channel) => [channel.id, channel]));
    for (const channel of channels) {
      if (channel?.id && channel?.name && channel.id !== '9') byId.set(String(channel.id), channel);
    }
    return [...byId.values()];
  }, [channels]);
  const [channelId, setChannelId] = useState('9');
  const [programs, setPrograms] = useState([]);
  const [status, setStatus] = useState('loading');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!availableChannels.some((channel) => channel.id === channelId)) {
      setChannelId('9');
      return undefined;
    }
    const controller = new AbortController();
    setPrograms([]);
    setStatus('loading');
    fetch(`/api/channels/${encodeURIComponent(channelId)}/schedule`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'The schedule is unavailable.');
        return Array.isArray(data.programs) ? data.programs : [];
      })
      .then((items) => {
        if (controller.signal.aborted) return;
        setPrograms(items);
        setStatus('ready');
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [availableChannels, channelId, retryToken]);

  const selected = availableChannels.find((channel) => channel.id === channelId) || fallbackChannels[0];

  return <section className="channel-explorer" aria-labelledby="channel-heading">
    <div className="channel-heading-row">
      <div>
        <span className="section-kicker">LIVE TV GUIDE</span>
        <h2 id="channel-heading">Channel schedules</h2>
        <p>Browse programme times supplied for each available channel.</p>
      </div>
      <span className="channel-heading-mark" aria-hidden="true"><Radio size={19} /></span>
    </div>

    <div className="channel-picker-row">
      <label htmlFor="channel-choice">Choose a channel</label>
      <select id="channel-choice" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
        {availableChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
      </select>
      <span className="channel-selected-meta">
        {selected.logo && <img className="channel-logo" src={selected.logo} alt={`${selected.name} logo`} loading="lazy" referrerPolicy="no-referrer" />}
        {typeof selected.isLive === 'boolean' && <span className={`channel-directory-status ${selected.isLive ? 'is-live' : ''}`}>{selected.isLive ? 'Live' : 'Not live'}</span>}
        {selected.status && <span className="channel-directory-status">{selected.status}</span>}
      </span>
    </div>

    {directoryError && <p className="static-result-status" role="status">The channel directory is temporarily unavailable. Channel 9 remains available.</p>}
    {status === 'loading' && <p className="static-result-status" role="status">Loading the schedule for {selected.name}.</p>}
    {status === 'error' && <NoticeCard title="This schedule is temporarily unavailable" error>Try again shortly. <button className="button-outline" type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry schedule</button></NoticeCard>}
    {status === 'ready' && programs.length === 0 && <NoticeCard title="No programme data was returned">The default schedule response contains no programme data for {selected.name}.</NoticeCard>}
    {status === 'ready' && programs.length > 0 && <div className="channel-program-list">
      {programs.map((program, index) => <article className="channel-program-card" key={`${program.id}-${index}`}>
        <div className="channel-program-time">
          {(program.startTime || program.endTime) && <span>{[program.startTime, program.endTime].filter(Boolean).join(' — ')}</span>}
          {program.status && <span className="channel-program-status">{program.status}</span>}
        </div>
        <div className="channel-program-copy">
          <h3>{program.title}</h3>
          {(program.description || program.schedule || program.slogan) && <p>{program.description || program.schedule || program.slogan}</p>}
          {program.presenters?.length > 0 && <span className="channel-presenters">{program.presenters.join(', ')}</span>}
        </div>
        <Tv className="channel-program-icon" size={17} aria-hidden="true" />
      </article>)}
    </div>}
    <p className="channel-guide-note">Schedule times are shown as provided by the listing service; no timezone is specified.</p>
  </section>;
}
