'use client';

import { useEffect, useState } from 'react';
import { Play, RefreshCw, X } from 'lucide-react';
import NoticeCard from './NoticeCard';
import SportsMatchDetails from './SportsMatchDetails';
import SportsResourcesPanel from './SportsResourcesPanel';

function MatchDetailsAction({ match }) {
  const [open, setOpen] = useState(false);
  const matchId = /^\d{1,32}$/.test(String(match.matchId ?? '')) ? String(match.matchId) : '';
  const leagueId = /^\d{1,32}$/.test(String(match.leagueId ?? '')) ? String(match.leagueId) : '';
  if (!matchId && !leagueId) return null;
  return <div className="sports-match-details-wrap">
    <button type="button" className="sports-match-details-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      {open ? 'Hide match details' : 'Match details'}
    </button>
    {open && <SportsMatchDetails matchId={matchId} leagueId={leagueId} onClose={() => setOpen(false)} />}
  </div>;
}

function MatchCard({ match, onPlay, replay = false }) {
  const offers = replay ? match.replayOffers || [] : [];
  const [offerIndex, setOfferIndex] = useState(0);
  const url = replay ? offers[offerIndex]?.url : match.mediaUrl;
  const label = replay ? 'Watch replay' : 'Try live';
  return <article className="sports-match-card">
    <div className="sports-match-kicker"><span className={replay ? 'sports-replay-dot' : 'sports-live-dot'} />{match.league || (replay ? 'Replay available' : 'Match')}</div>
    <div className="sports-teams"><div><b>{match.team1.name}</b>{match.team1.score !== '' && <strong>{match.team1.score}</strong>}</div><span className="sports-vs">–</span><div><b>{match.team2.name}</b>{match.team2.score !== '' && <strong>{match.team2.score}</strong>}</div></div>
    <div className="sports-match-footer"><span>{match.status || (replay ? 'Full match replay' : 'In progress')}</span>{url ? <div className="sports-match-actions">{replay && offers.length > 1 && <label className="sr-only" htmlFor={`replay-${match.id}`}>Replay option</label>}{replay && offers.length > 1 && <select id={`replay-${match.id}`} className="sports-offer-select" value={offerIndex} onChange={(event) => setOfferIndex(Number(event.target.value))}>{offers.map((_, index) => <option key={index} value={index}>Replay option {index + 1}</option>)}</select>}<button type="button" className="sports-watch-button" onClick={() => onPlay({ url, title: `${match.team1.name} – ${match.team2.name}`, mode: 'video' })}><Play size={14} fill="currentColor" /> {label}</button></div> : <span className="sports-unavailable">No player link</span>}</div>
    <MatchDetailsAction match={match} />
  </article>;
}

function RecentMatchCard({ match }) {
  const teamScore = match.team1.score !== '' && match.team2.score !== '' ? `${match.team1.score} – ${match.team2.score}` : '';
  const score = match.score || teamScore;
  return <article className="sports-match-card">
    <div className="sports-match-kicker"><span className="sports-replay-dot" />{match.league || 'Recent match'}</div>
    <div className="sports-teams sports-recent-teams"><div><b>{match.team1.name}</b></div><span className="sports-recent-score">{score || 'Score unavailable'}</span><div><b>{match.team2.name}</b></div></div>
    <div className="sports-match-footer"><span>{match.status || 'Recent result'}</span></div>
    <MatchDetailsAction match={match} />
  </article>;
}

function UpcomingMatchCard({ match }) {
  return <article className="sports-match-card">
    <div className="sports-match-kicker"><span className="sports-live-dot" />{match.league || 'Football'}</div>
    <div className="sports-teams"><div><b>{match.team1.name}</b></div><span className="sports-vs">–</span><div><b>{match.team2.name}</b></div></div>
    <div className="sports-match-footer"><span>{match.time || match.status || 'Scheduled'}</span></div>
    <MatchDetailsAction match={match} />
  </article>;
}

export default function SportsScreen({ initialData }) {
  const [data, setData] = useState(initialData || null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [playerError, setPlayerError] = useState(false);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState({ highlights: [], news: [] });
  const [recommendationStatus, setRecommendationStatus] = useState('loading');
  const [fixturesRequested, setFixturesRequested] = useState(false);
  const [fixturesRetry, setFixturesRetry] = useState(0);
  const [fixtures, setFixtures] = useState({ status: 'idle', matches: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/sports/recommendations?sportType=football', { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const next = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(next.error || 'Sports recommendations are unavailable.');
        return next;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setRecommendations({ highlights: Array.isArray(next.highlights) ? next.highlights : [], news: Array.isArray(next.news) ? next.news : [] });
        setRecommendationStatus('ready');
      })
      .catch((requestError) => { if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setRecommendationStatus('error'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!fixturesRequested) return undefined;
    const controller = new AbortController();
    setFixtures((current) => ({ ...current, status: 'loading' }));
    fetch('/api/sports/matches', { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        const next = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(next.error || 'The match list is temporarily unavailable.');
        return Array.isArray(next.matches) ? next.matches : [];
      })
      .then((matches) => { if (!controller.signal.aborted) setFixtures({ status: 'ready', matches }); })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setFixtures({ status: 'error', matches: [] });
      });
    return () => controller.abort();
  }, [fixturesRequested, fixturesRetry]);

  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/sports?sportType=football', { cache: 'no-store' });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.error || 'Sports are temporarily unavailable.');
      setData(next);
    } catch (requestError) {
      setError(requestError?.message || 'Sports are temporarily unavailable.');
    } finally {
      setRefreshing(false);
    }
  }

  function play(item) {
    setPlayerError(false);
    setPlayerAttempt(0);
    setActivePlayer(item);
  }

  const highlights = data?.highlights || [];
  const recentMatches = data?.latestMatches || [];
  const liveMatches = data?.ongoingMatches || [];
  const replayMatches = data?.replayMatches || [];

  return <section className="sports-screen" aria-label="Sports feeds">
    <div className="sports-toolbar"><div><span className="section-kicker">LIVE INDEX · FOOTBALL</span><p>Recent scores, live matches, highlights, and replays.</p></div><button type="button" className="button button-outline sports-refresh" onClick={refresh} disabled={refreshing} aria-label="Refresh sports feed"><RefreshCw size={15} /><span>{refreshing ? 'Refreshing…' : 'Refresh'}</span></button></div>
    {error && <p className="sports-error" role="status">{error}</p>}
    {recommendationStatus === 'loading' && <span className="sr-only" role="status" aria-live="polite">Sports recommendations are loading.</span>}
    {!data && <NoticeCard title="Sports feed unavailable" error>Try refreshing in a moment.</NoticeCard>}

    {activePlayer && <section className="sports-player-card" aria-label="Sports player">
      <div className="sports-player-heading"><div><span className="section-kicker">SPORTS PLAYER</span><h2>{activePlayer.title}</h2></div><button type="button" className="icon-button" onClick={() => setActivePlayer(null)} aria-label="Close player"><X size={18} /></button></div>
      <video className="sports-video" key={`${activePlayer.url}-${playerAttempt}`} src={activePlayer.url} controls playsInline preload="metadata" onError={() => setPlayerError(true)} />
      {playerError && <div className="sports-player-error" role="alert"><b>This stream isn’t available right now.</b><p>Scores and match listings are separate from media delivery. Try again later or choose a highlight/replay.</p><button type="button" className="sports-watch-button" onClick={() => { setPlayerError(false); setPlayerAttempt((value) => value + 1); }}>Try again</button></div>}
    </section>}

    {data && <>
      <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">FIXTURE INDEX</span><h2>Upcoming matches</h2></div>{fixtures.status === 'ready' && <span className="sports-count">{fixtures.matches.length}</span>}</div>
        {fixtures.status === 'idle' && <div className="sports-fixture-idle"><p>Check the next seven-day fixture window when you need it.</p><button type="button" className="button button-outline" onClick={() => setFixturesRequested(true)}>Load matches</button></div>}
        {fixtures.status === 'loading' && <p className="sports-empty" role="status">Loading match list…</p>}
        {fixtures.status === 'error' && <div className="sports-fixture-idle" role="alert"><p>The match list is temporarily unavailable.</p><button type="button" className="button button-outline" onClick={() => setFixturesRetry((value) => value + 1)}>Try again</button></div>}
        {fixtures.status === 'ready' && (fixtures.matches.length ? <div className="sports-match-list">{fixtures.matches.map((match) => <UpcomingMatchCard key={match.id} match={match} />)}</div> : <p className="sports-empty">No upcoming matches were returned for this window.</p>)}
      </section>
      <SportsResourcesPanel />

      <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">IN PLAY</span><h2>Live now</h2></div><span className="sports-count">{liveMatches.length}</span></div>
        {liveMatches.length ? <div className="sports-match-list">{liveMatches.map((match) => <MatchCard key={match.id} match={match} onPlay={play} />)}</div> : <p className="sports-empty">No live matches are listed right now.</p>}
      </section>

      <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">RECENT SCORES</span><h2>Recent matches</h2></div><span className="sports-count">{recentMatches.length}</span></div>
        {recentMatches.length ? <div className="sports-match-list">{recentMatches.map((match, index) => <RecentMatchCard key={match.id || `${match.team1.name}-${match.team2.name}-${index}`} match={match} />)}</div> : <p className="sports-empty">No recent matches are listed right now.</p>}
      </section>

      <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">QUICK CUTS</span><h2>Highlights</h2></div><span className="sports-count">{highlights.length}</span></div>
        {highlights.length ? <div className="sports-highlight-rail">{highlights.map((item) => <article className="sports-highlight-card" key={item.id}>
          {item.cover && <div className="sports-highlight-cover" style={{ backgroundImage: `url("${item.cover}")` }} />}
          <div><b>{item.title}</b><small>{item.duration ? (/^\d+(?:\.\d+)?$/.test(String(item.duration)) ? `${Math.max(1, Math.round(Number(item.duration) / 60))} min` : item.duration) : 'Match highlight'}</small></div>
          {item.url && <button type="button" className="sports-watch-button" onClick={() => play({ url: item.url, title: item.title, mode: 'video' })}><Play size={14} fill="currentColor" /> Watch</button>}
        </article>)}</div> : <p className="sports-empty">No highlights are listed right now.</p>}
      </section>

      {recommendations.highlights.length > 0 && <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">FOR YOU</span><h2>Recommended highlights</h2></div><span className="sports-count">{recommendations.highlights.length}</span></div>
        <div className="sports-highlight-rail">{recommendations.highlights.map((item) => <article className="sports-highlight-card" key={`recommended-${item.id}`}>
          {item.cover && <div className="sports-highlight-cover" style={{ backgroundImage: `url("${item.cover}")` }} />}
          <div><b>{item.title}</b><small>{item.duration ? (/^\d+(?:\.\d+)?$/.test(String(item.duration)) ? `${Math.max(1, Math.round(Number(item.duration) / 60))} min` : item.duration) : 'Match highlight'}</small></div>
          <button type="button" className="sports-watch-button" onClick={() => play({ url: item.url, title: item.title, mode: 'video' })}><Play size={14} fill="currentColor" /> Watch</button>
        </article>)}</div>
      </section>}

      {recommendations.news.length > 0 && <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">SPORTS DESK</span><h2>Latest stories</h2></div><span className="sports-count">{recommendations.news.length}</span></div>
        <div className="sports-news-list">{recommendations.news.map((item) => <article className="sports-news-card" key={item.id}><div>{item.category && <span className="sports-news-category">{item.category}</span>}<h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}</div></article>)}</div>
      </section>}

      {recommendationStatus === 'error' && <p className="sports-empty" role="status">Recommended highlights and sports stories are temporarily unavailable.</p>}

      <section className="sports-section"><div className="sports-section-title"><div><span className="section-kicker">THE FINAL WHISTLE</span><h2>Match replays</h2></div><span className="sports-count">{replayMatches.length}</span></div>
        {replayMatches.length ? <div className="sports-match-list">{replayMatches.map((match) => <MatchCard key={match.id} match={match} onPlay={play} replay />)}</div> : <p className="sports-empty">No replays are listed right now.</p>}
      </section>
    </>}
  </section>;
}
