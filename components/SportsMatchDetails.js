'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const TABS = [
  { id: 'summary', label: 'Summary', action: 'detail', needs: 'matchId' },
  { id: 'replay', label: 'Replay', action: 'replay', needs: 'matchId' },
  { id: 'h2h', label: 'H2H', action: 'h2h', needs: 'matchId' },
  { id: 'stats', label: 'Stats', action: 'stats', needs: 'matchId' },
  { id: 'events', label: 'Events', action: 'events', needs: 'matchId' },
  { id: 'lineups', label: 'Lineups', action: 'lineups', needs: 'matchId' },
  { id: 'standings', label: 'Standings', action: 'rankings', needs: 'leagueId' },
  { id: 'match-flow', label: 'Match flow', action: 'match-flow', needs: 'matchId' },
  { id: 'match-flow-new', label: 'Flow updates', action: 'match-flow-has-new', needs: 'matchId' }
];

function labelFor(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function hasContent(value) {
  if (value == null || value === false || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value === 'object') return Object.values(value).some(hasContent);
  return Boolean(value);
}

function DataValue({ value, name }) {
  if (value == null || value === '') return <span className="sports-detail-value-empty">—</span>;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return <span className="sports-detail-value-text">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className="sports-detail-value-empty">No records</span>;
    return <ol className="sports-detail-value-list">{value.map((item, index) => <li className="sports-detail-value-item" key={`${name}-${index}`}><DataValue value={item} name={`${name}-${index}`} /></li>)}</ol>;
  }
  const entries = Object.entries(value);
  if (!entries.length) return <span className="sports-detail-value-empty">No details</span>;
  return <dl className="sports-detail-value-object">{entries.map(([key, child]) => <div className="sports-detail-value-row" key={`${name}-${key}`}>
    <dt className="sports-detail-value-label">{labelFor(key)}</dt>
    <dd className="sports-detail-value-content"><DataValue value={child} name={`${name}-${key}`} /></dd>
  </div>)}</dl>;
}

export default function SportsMatchDetails({ matchId, leagueId, onClose }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [results, setResults] = useState({});
  const [retry, setRetry] = useState(0);
  const identity = `${matchId || ''}:${leagueId || ''}`;
  const tab = useMemo(() => TABS.find((item) => item.id === activeTab) || TABS[0], [activeTab]);
  const tabIdentifier = tab.needs === 'leagueId' ? leagueId : matchId;
  const resultKey = `${identity}:${tab.id}`;
  const result = results[resultKey];

  useEffect(() => {
    setActiveTab('summary');
    setResults({});
  }, [identity]);

  useEffect(() => {
    if (!tabIdentifier || result?.status === 'ready' || result?.status === 'loading') return undefined;
    const controller = new AbortController();
    setResults((current) => ({ ...current, [resultKey]: { status: 'loading' } }));

    const queryName = tab.needs;
    const query = new URLSearchParams([[queryName, String(tabIdentifier)]]);
    const endpoint = `/api/sports/${tab.action}?${query.toString()}`;
    fetch(endpoint, { method: 'GET', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Match details are temporarily unavailable.');
        return payload;
      })
      .then((payload) => {
        if (!controller.signal.aborted) setResults((current) => ({ ...current, [resultKey]: { status: 'ready', payload } }));
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.name !== 'AbortError') {
          setResults((current) => ({ ...current, [resultKey]: { status: 'error' } }));
        }
      });
    return () => controller.abort();
  }, [identity, resultKey, tab, tabIdentifier, retry]);

  const payload = result?.payload;
  const fields = payload && typeof payload === 'object'
    ? Object.entries(payload).filter(([key]) => key !== 'action')
    : [];
  const empty = !fields.some(([, value]) => hasContent(value));

  return <section className="sports-detail-panel" aria-label="Match details">
    <header className="sports-detail-header">
      <div className="sports-detail-heading">
        <span className="sports-detail-kicker">MATCH CENTRE</span>
        <h2 className="sports-detail-title">Match details</h2>
      </div>
      {typeof onClose === 'function' && <button className="sports-detail-close" type="button" onClick={onClose} aria-label="Close match details"><X size={17} /></button>}
    </header>

    <nav className="sports-detail-tabs" aria-label="Match detail sections" role="tablist">
      {TABS.map((item) => {
        const disabled = !((item.needs === 'leagueId' ? leagueId : matchId));
        return <button
          key={item.id}
          className={`sports-detail-tab${activeTab === item.id ? ' sports-detail-tab-active' : ''}`}
          id={`sports-detail-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === item.id}
          aria-controls="sports-detail-content"
          disabled={disabled}
          onClick={() => setActiveTab(item.id)}
        >{item.label}</button>;
      })}
    </nav>

    <div className="sports-detail-content" id="sports-detail-content" role="tabpanel" aria-labelledby={`sports-detail-tab-${tab.id}`}>
      {!tabIdentifier
        ? <p className="sports-detail-empty">A match or league identifier is needed to load this section.</p>
        : result?.status === 'loading' || !result
          ? <p className="sports-detail-pending" role="status">Loading match details…</p>
          : result.status === 'error'
            ? <div className="sports-detail-error" role="alert"><p>Match details are temporarily unavailable.</p><button type="button" className="text-link" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
            : empty
              ? <p className="sports-detail-empty">No details are listed for this section right now.</p>
              : <dl className="sports-detail-fields">{fields.map(([key, value]) => <div className="sports-detail-field" key={key}>
                <dt className="sports-detail-field-label">{labelFor(key)}</dt>
                <dd className="sports-detail-field-value"><DataValue name={key} value={value} /></dd>
              </div>)}</dl>}
    </div>
  </section>;
}
