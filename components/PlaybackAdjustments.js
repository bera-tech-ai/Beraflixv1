'use client';

import { useState } from 'react';
import { SlidersHorizontal, Sun, Volume2, VolumeX } from 'lucide-react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export default function PlaybackAdjustments({
  brightness,
  onBrightnessChange,
  volume = 100,
  onVolumeChange,
  volumeAvailable = true
}) {
  const [open, setOpen] = useState(false);

  return <div className="playback-adjustments">
    <button
      type="button"
      className="playback-adjustments-toggle"
      aria-expanded={open}
      aria-controls="playback-adjustments-panel"
      onClick={() => setOpen((value) => !value)}
    >
      <SlidersHorizontal size={15} aria-hidden="true" />
      <span>Picture{volumeAvailable ? ' & sound' : ''}</span>
    </button>
    <div
      id="playback-adjustments-panel"
      className="playback-adjustments-panel"
      hidden={!open}
      role="group"
      aria-label="Playback adjustments"
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
    >
      <label className="playback-adjustment-row">
        <span><Sun size={15} aria-hidden="true" /> Picture brightness <output>{brightness}%</output></span>
        <input
          type="range"
          min="50"
          max="150"
          step="5"
          value={brightness}
          aria-label="Picture brightness"
          aria-valuetext={`${brightness} percent`}
          onChange={(event) => onBrightnessChange(clamp(event.target.value, 50, 150))}
        />
      </label>
      {volumeAvailable && <label className="playback-adjustment-row">
        <span>{volume === 0 ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />} Volume <output>{volume}%</output></span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          aria-label="Video volume"
          aria-valuetext={`${volume} percent`}
          onChange={(event) => onVolumeChange(clamp(event.target.value, 0, 100))}
        />
      </label>}
      <p>{volumeAvailable
        ? 'Picture brightness affects the media image, not your phone screen. Some mobile browsers lock web volume; use device buttons if the slider has no effect.'
        : 'Picture brightness affects this embedded view, not your phone screen. Use the embedded player or your device buttons for volume.'}</p>
    </div>
  </div>;
}
