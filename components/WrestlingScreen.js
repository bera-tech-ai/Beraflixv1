'use client';

import { useState } from 'react';

export default function WrestlingScreen() {
  const [events, setEvents] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function loadEvents() {
    setStatus('loading');
    setError('');
    try {
      const response = await fetch('/api/wrestling/events?catalog=official&page=1', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Wrestling events are temporarily unavailable.');
      setEvents(Array.isArray(result.events) ? result.events : []);
      setStatus('ready');
    } catch (requestError) {
      setEvents(null);
      setError(requestError?.message || 'Wrestling events are temporarily unavailable.');
      setStatus('error');
    }
  }

  return <section className="wrestling-screen" aria-label="Wrestling event listings">
    <header className="wrestling-header">
      <div className="wrestling-heading-copy">
        <span className="wrestling-kicker">WRESTLING ARCHIVE</span>
        <h2 className="wrestling-title">Official event listings</h2>
        <p className="wrestling-intro">Browse event descriptions and listed segment labels.</p>
      </div>
      <button className="wrestling-load-button" type="button" onClick={loadEvents} disabled={status === 'loading'}>
        {status === 'loading' ? 'Loading events…' : events ? 'Refresh events' : 'Load events'}
      </button>
    </header>

    {status === 'loading' && <p className="wrestling-state" role="status">Loading wrestling events.</p>}
    {status === 'error' && <div className="wrestling-error" role="alert"><p>{error}</p><button className="wrestling-retry-button" type="button" onClick={loadEvents}>Try again</button></div>}
    {status === 'ready' && events.length === 0 && <p className="wrestling-empty" role="status">No events are listed right now.</p>}
    {status === 'ready' && events.length > 0 && <div className="wrestling-event-list">
      {events.map((event, index) => <article className="wrestling-event-card" key={`${event.title}-${index}`}>
        <div className="wrestling-event-copy">
          <h3 className="wrestling-event-title">{event.title}</h3>
          {event.description && <p className="wrestling-event-description">{event.description}</p>}
        </div>
        {event.parts?.length > 0 && <section className="wrestling-parts" aria-label={`${event.title} segment labels`}>
          <h4 className="wrestling-parts-title">Listed segments</h4>
          <ul className="wrestling-part-list">{event.parts.map((part, partIndex) => <li className="wrestling-part-label" key={`${part}-${partIndex}`}>{part}</li>)}</ul>
        </section>}
      </article>)}
    </div>}
    {status === 'idle' && <p className="wrestling-idle" role="status">Select “Load events” to request the official listing.</p>}
  </section>;
}
