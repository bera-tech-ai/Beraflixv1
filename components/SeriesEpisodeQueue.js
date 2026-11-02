'use client';

import { useEffect, useState } from 'react';
import DownloadButton from './DownloadButton';

const EPISODE_OPTIONS = Array.from({ length: 999 }, (_, index) => index + 1);
const QUALITY_OPTIONS = ['360p', '480p', '720p', '1080p'];

export default function SeriesEpisodeQueue({ movie, season = 1, startEpisode = 1, onQueueStateChange }) {
  const [throughEpisode, setThroughEpisode] = useState(String(startEpisode));
  const [queue, setQueue] = useState(null);
  const [handedOff, setHandedOff] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [notice, setNotice] = useState('');
  const selectedStart = Number(startEpisode);
  const selectedSeason = Number(season);

  useEffect(() => {
    setThroughEpisode((current) => Number(current) < Number(startEpisode) ? String(startEpisode) : current);
  }, [startEpisode]);

  function startQueue() {
    const end = Number(throughEpisode);
    if (!Number.isInteger(selectedStart) || selectedStart < 1 || !Number.isInteger(selectedSeason) || selectedSeason < 1 || !Number.isInteger(end) || end < selectedStart || end > 999) {
      setNotice('Choose an ending episode that is the same as or higher than the starting episode.');
      return;
    }
    setQueue({ season: selectedSeason, first: selectedStart, last: end, current: selectedStart });
    onQueueStateChange?.(true);
    setHandedOff(false);
    setNotice('');
  }

  function advanceQueue() {
    if (!queue) return;
    if (queue.current >= queue.last) {
      const count = queue.last - queue.first + 1;
      setQueue(null);
      onQueueStateChange?.(false);
      setHandedOff(false);
      setNotice(`${count} episode link${count === 1 ? '' : 's'} were handed to your browser. Check device Downloads; BERAFLIX cannot verify transfer completion.`);
      return;
    }
    setQueue((current) => ({ ...current, current: current.current + 1 }));
    setHandedOff(false);
  }

  function stopQueue() {
    setQueue(null);
    onQueueStateChange?.(false);
    setHandedOff(false);
    setNotice('Episode queue stopped. Any link already handed to the browser remains under browser/device control.');
  }

  return <section className="series-episode-queue" aria-label="Queue a series episode range">
    <span className="section-kicker">QUEUE EPISODES</span>
    <p className="series-queue-note">The catalog does not provide this season’s episode list or total. Choose the last episode yourself; each episode number is requested separately and may be unavailable.</p>
    {!queue ? <div className="series-queue-setup">
      <label>Through episode<select value={throughEpisode} onChange={(event) => setThroughEpisode(event.target.value)} aria-label="Ending episode number">{EPISODE_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      <label className="download-quality-control"><span>Quality</span><select value={quality} onChange={(event) => setQuality(event.target.value)} aria-label="Episode queue download quality">{QUALITY_OPTIONS.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      <button type="button" className="button button-outline" onClick={startQueue} disabled={Number(throughEpisode) < selectedStart}>Queue S{selectedSeason} E{selectedStart}–{throughEpisode}</button>
    </div> : <div className="series-queue-current" role="group" aria-label={`Episode ${queue.current} of ${queue.last - queue.first + 1}`}>
      <p className="series-queue-progress">Episode {queue.current - queue.first + 1} of {queue.last - queue.first + 1} · Season {queue.season}, Episode {queue.current}</p>
      <DownloadButton key={`${queue.season}-${queue.current}`} movie={movie} season={queue.season} episode={queue.current} compact qualityValue={quality} onQualityChange={setQuality} hideQualityControl onHandOff={() => setHandedOff(true)} />
      <p className="series-queue-note">Prepare this episode’s link, then hand it to your browser. Check the device Downloads manager before continuing; browser transfer status is not visible here.</p>
      {handedOff && <button type="button" className="button button-outline" onClick={advanceQueue}>{queue.current < queue.last ? `Prepare next episode (${queue.current + 1})` : 'Finish episode range'}</button>}
      <button type="button" className="text-button danger-text" onClick={stopQueue}>Stop queue</button>
    </div>}
    {notice && <p className="series-queue-notice" role="status">{notice}</p>}
  </section>;
}
