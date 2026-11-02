'use client';

import { useState } from 'react';

function humanize(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function Value({ value, name }) {
  if (value == null || value === '') return <span className="sports-resource-empty">—</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return value.length
    ? <ul className="sports-resource-list">{value.map((item, index) => <li key={`${name}-${index}`}><Value value={item} name={`${name}-${index}`} /></li>)}</ul>
    : <span className="sports-resource-empty">No records</span>;
  const entries = Object.entries(value);
  return entries.length
    ? <dl className="sports-resource-fields">{entries.map(([key, entry]) => <div className="sports-resource-field" key={`${name}-${key}`}><dt>{humanize(key)}</dt><dd><Value value={entry} name={`${name}-${key}`} /></dd></div>)}</dl>
    : <span className="sports-resource-empty">No details</span>;
}

export default function SportsResourcesPanel() {
  const [result, setResult] = useState({ status: 'idle', items: [] });

  async function load() {
    setResult((current) => ({ ...current, status: 'loading' }));
    try {
      const response = await fetch('/api/sports/resources', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('Sports resources are temporarily unavailable.');
      setResult({ status: 'ready', items: Array.isArray(payload.items) ? payload.items : [] });
    } catch {
      setResult({ status: 'error', items: [] });
    }
  }

  return <section className="sports-section sports-resources-panel" aria-label="Sports resources">
    <div className="sports-section-title"><div><span className="section-kicker">SPORTS REFERENCE</span><h2>Resources</h2></div></div>
    {result.status === 'idle' && <div className="sports-fixture-idle"><p>Load the documented sports resource directory when needed.</p><button type="button" className="button button-outline" onClick={load}>Load resources</button></div>}
    {result.status === 'loading' && <p className="sports-empty" role="status">Loading sports resources…</p>}
    {result.status === 'error' && <div className="sports-fixture-idle" role="alert"><p>Sports resources are temporarily unavailable.</p><button type="button" className="button button-outline" onClick={load}>Try again</button></div>}
    {result.status === 'ready' && (result.items.length
      ? <div className="sports-resource-grid">{result.items.map((item, index) => <article className="sports-resource-card" key={`${item?.id || 'resource'}-${index}`}><Value value={item} name={`resource-${index}`} /></article>)}</div>
      : <p className="sports-empty" role="status">No resource records were returned.</p>)}
  </section>;
}
